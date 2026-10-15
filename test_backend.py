"""
LinkSphere Automated Verification Test Suite
Runs on an isolated test SQLite database to protect production/Supabase data.
"""
import os
from flask import Flask
from app import create_app
from app.config import Config
from app.extensions import db
from app.models import User, Link, Category, Team

class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = 'test-secret-key'

test_app = create_app(TestConfig)
client = test_app.test_client()

def run_tests():
    with test_app.app_context():
        # Setup clean test schema in memory
        db.drop_all()
        db.create_all()

        print("--- RUNNING COMPREHENSIVE BACKEND TESTS ---")

        # 1. Registration
        res = client.post('/register', data={
            'name': 'Rahul Sharma',
            'email': 'rahul@example.com',
            'password': 'password123'
        }, follow_redirects=True)
        assert res.status_code == 200, f"Registration failed: {res.status_code}"
        rahul = User.query.filter_by(email='rahul@example.com').first()
        assert rahul is not None
        assert rahul.name == 'Rahul Sharma'
        assert rahul.is_admin is False
        assert rahul.check_password('password123') is True
        print("Test 1 Passed: New user registered and password hashed with Werkzeug.")

        # 2. Login
        client.post('/logout')
        res = client.post('/login', data={'email': 'rahul@example.com', 'password': 'password123'}, follow_redirects=True)
        assert res.status_code == 200
        assert b"Dashboard" in res.data
        print("Test 2 Passed: User login and session creation verified.")

        # 3. Create Link
        res = client.post('/links/new', data={
            'title': 'Rahul Portfolio',
            'url': 'https://rahul.dev',
            'description': 'Personal website',
            'tags': 'portfolio, dev'
        }, follow_redirects=True)
        assert res.status_code == 200
        rahul_link = Link.query.filter_by(title='Rahul Portfolio').first()
        assert rahul_link is not None
        assert rahul_link.user_id == rahul.id
        assert rahul_link.health_status == 'Not Verified'
        assert len(rahul_link.short_code) >= 6
        print(f"Test 3 Passed: Link created with short code '{rahul_link.short_code}' and default 'Not Verified' health.")

        # 4. Search and Filter links
        res = client.get('/links?q=Portfolio')
        assert res.status_code == 200
        assert b"Rahul Portfolio" in res.data
        res = client.get('/links?filter=healthy')
        assert res.status_code == 200
        print("Test 4 Passed: Link search and health filters functional.")

        # 5. User Isolation / Ownership Security
        # Create user Asha
        asha = User(name="Asha Raman", email="asha@example.com", is_admin=False, is_active=True)
        asha.set_password("user123")
        db.session.add(asha)
        db.session.commit()

        client.post('/logout')
        client.post('/login', data={'email': 'asha@example.com', 'password': 'user123'})
        
        # Asha tries to edit Rahul's link
        res = client.post(f'/links/{rahul_link.id}/edit', data={'title': 'Hacked Title'})
        assert res.status_code == 403

        # Asha tries to favorite Rahul's link
        res = client.post(f'/links/{rahul_link.id}/favorite')
        assert res.status_code == 403

        # Asha tries to trash Rahul's link
        res = client.post(f'/links/{rahul_link.id}/trash')
        assert res.status_code == 403

        # Asha tries to delete Rahul's link
        res = client.post(f'/links/{rahul_link.id}/delete')
        assert res.status_code == 403
        print("Test 5 Passed: User isolation enforced. Cross-user operations rejected with 403 Forbidden.")

        # 6. Category Delete Protection
        res = client.post('/categories', data={'name': 'ProtectedCategory'}, follow_redirects=True)
        cat = Category.query.filter_by(user_id=asha.id, name='ProtectedCategory').first()
        assert cat is not None
        link_in_cat = Link(
            title="Active In Cat",
            url="https://example.org",
            short_code="activecat1",
            category_id=cat.id,
            user_id=asha.id,
            status="active"
        )
        db.session.add(link_in_cat)
        db.session.commit()

        # Attempt to delete category with active link
        res = client.post(f'/categories/{cat.id}/delete', follow_redirects=True)
        assert Category.query.filter_by(id=cat.id).first() is not None
        print("Test 6 Passed: Category delete protection verified (cannot delete while active links exist).")

        # 7. Short URL Redirection & Click Tracking
        client.post('/logout')
        prev_clicks = rahul_link.click_count
        res = client.get(f'/s/{rahul_link.short_code}')
        assert res.status_code == 302
        assert res.location == 'https://rahul.dev'
        db.session.refresh(rahul_link)
        assert rahul_link.click_count == prev_clicks + 1
        assert rahul_link.last_clicked_at is not None
        print("Test 7 Passed: Short URL redirection updates click_count and last_clicked_at.")

        # 8. 404 for unknown short code
        res = client.get('/s/nonexistentcode999')
        assert res.status_code == 404
        print("Test 8 Passed: Nonexistent short code returns 404.")

        # 9. Disabled User cannot login
        admin_user = User(name="Platform Admin", email="admin@linksphere.demo", is_admin=True, is_active=True)
        admin_user.set_password("admin123")
        db.session.add(admin_user)
        db.session.commit()

        client.post('/admin/login', data={'email': 'admin@linksphere.demo', 'password': 'admin123'})
        client.post(f'/admin/users/{rahul.id}/toggle-status')
        db.session.refresh(rahul)
        assert rahul.is_active is False
        client.post('/logout')
        res = client.post('/login', data={'email': 'rahul@example.com', 'password': 'password123'}, follow_redirects=True)
        assert b"disabled" in res.data
        print("Test 9 Passed: Disabled user blocked from signing in.")

        # 10. Admin role protection
        client.post('/login', data={'email': 'asha@example.com', 'password': 'user123'})
        res = client.get('/admin/dashboard')
        assert res.status_code == 302
        assert '/admin/login' in res.location
        res = client.get('/admin/users')
        assert res.status_code == 302
        # 11. Admin Teams and Platform Resources Route
        test_team = Team(name="Engineering Alpha", leader_id=admin_user.id)
        db.session.add(test_team)
        db.session.commit()

        client.post('/logout')
        client.post('/admin/login', data={'email': 'admin@linksphere.demo', 'password': 'admin123'})
        res = client.get('/admin/teams')
        assert res.status_code == 200, f"Admin teams failed with {res.status_code}"
        assert b"Platform resources" in res.data
        assert b"Active links" in res.data
        assert b"Engineering Alpha" in res.data
        print("Test 11 Passed: Admin teams page loads cleanly with platform resources breakdown.")

        # 12. Custom 404 Error Handler Page
        client.post('/logout')
        res = client.get('/this-path-does-not-exist')
        assert res.status_code == 404
        assert b"Page Not Found" in res.data
        assert b"404" in res.data
        assert b"Go Back" in res.data
        print("Test 12 Passed: Custom 404 error page rendered properly.")

        # 13. Favourites Link Cards & Menu rendering
        rahul.is_active = True
        rahul_link.is_favourite = True
        db.session.commit()

        client.post('/logout')
        client.post('/login', data={'email': 'rahul@example.com', 'password': 'password123'})
        res = client.get('/favourites')
        assert res.status_code == 200
        assert b"Favourites" in res.data
        assert b"Rahul Portfolio" in res.data
        assert b"data-action=\"toggleMenu\"" in res.data
        # Ensure 'menu-open' is NOT pre-baked on cards or menu-wraps
        assert b"menu-wrap menu-open" not in res.data
        # 14. User Team Detail View (Image 1 Layout)
        res = client.get(f'/teams/{test_team.id}')
        # Logged in as rahul; test_team leader is admin_user, so create a team for rahul
        rahul_team = Team(name="Design Club", leader_id=rahul.id)
        db.session.add(rahul_team)
        db.session.commit()

        res = client.get(f'/teams/{rahul_team.id}')
        assert res.status_code == 200
        assert b"leader Permissions Active" in res.data
        assert b"Team peoples (1)" in res.data
        assert b"Shared Categories (0)" in res.data
        assert b"Shared Links (0)" in res.data
        assert b"Create Shared Category" in res.data
        assert b"Add people" in res.data
        assert b"Create Team" in res.data
        print("Test 14 Passed: User team detail view renders exact Image 1 sections.")

        # 15. Admin page has 1st search bar removed
        client.post('/logout')
        client.post('/admin/login', data={'email': 'admin@linksphere.demo', 'password': 'admin123'})
        res = client.get('/admin/teams')
        assert res.status_code == 200
        assert b'id="globalSearch"' not in res.data
        assert b'id="searchBox"' not in res.data
        assert b'id="adminTeamSearch"' in res.data
        print("Test 15 Passed: 1st global search bar removed from admin page.")

        # 16. Card Delete and Restore functionality
        client.post('/logout')
        client.post('/login', data={'email': 'rahul@example.com', 'password': 'password123'})
        # Move link to trash (delete card)
        res = client.post(f'/links/{rahul_link.id}/trash', follow_redirects=True)
        assert res.status_code == 200
        db.session.refresh(rahul_link)
        assert rahul_link.status == 'trash'

        # Restore card
        res = client.post(f'/links/{rahul_link.id}/restore', follow_redirects=True)
        assert res.status_code == 200
        db.session.refresh(rahul_link)
        assert rahul_link.status == 'active'
        # 17. Category Folder View, Folder Creation, and Adding Link in Cards
        work_cat = Category(name="Work Projects", user_id=rahul.id)
        db.session.add(work_cat)
        db.session.commit()

        # Check Category overview page
        res = client.get(f'/categories/{work_cat.id}')
        assert res.status_code == 200
        assert b"Work Projects" in res.data
        assert b"All categories" in res.data
        assert b"Folders (0)" in res.data
        assert b"No folders in this category" in res.data
        assert b"Add Link here" in res.data
        assert b"Links in category (no folder) (0)" in res.data

        # Create folder in category
        res = client.post(f'/categories/{work_cat.id}/folders', json={'name': 'API Documentation'})
        assert res.status_code == 200
        data = res.get_json()
        fld_id = data['id']

        # Category page now shows folder
        res = client.get(f'/categories/{work_cat.id}')
        assert res.status_code == 200
        assert b"Folders (1)" in res.data
        assert b"API Documentation" in res.data

        # Rename folder
        res = client.post(f'/folders/{fld_id}/rename', json={'name': 'Backend APIs'})
        assert res.status_code == 200
        assert res.get_json()['name'] == 'Backend APIs'

        # Add link in folder
        res = client.post('/links/new', json={
            'title': 'FastAPI Documentation',
            'url': 'https://fastapi.tiangolo.com',
            'category_id': work_cat.id,
            'folder_id': fld_id,
            'tags': 'api, python'
        })
        assert res.status_code == 200
        fld_link = Link.query.filter_by(title='FastAPI Documentation').first()
        assert fld_link is not None
        assert fld_link.category_id == work_cat.id
        assert fld_link.folder_id == fld_id
        assert fld_link.folder_name == 'Backend APIs'

        # Folder detail view renders folder header and link card
        res = client.get(f'/categories/{work_cat.id}?folder_id={fld_id}')
        assert res.status_code == 200
        assert b"Back to Work Projects" in res.data
        assert b"Backend APIs" in res.data
        assert b"Links in this folder (1)" in res.data
        assert b"FastAPI Documentation" in res.data

        # Delete folder moves link to loose links
        res = client.post(f'/folders/{fld_id}/delete')
        assert res.status_code == 200
        db.session.refresh(fld_link)
        assert fld_link.folder_id is None
        assert fld_link.category_id == work_cat.id

        # Category overview now shows link in loose links
        res = client.get(f'/categories/{work_cat.id}')
        assert res.status_code == 200
        assert b"Folders (0)" in res.data
        assert b"Links in category (no folder) (1)" in res.data
        assert b"FastAPI Documentation" in res.data
        print("Test 17 Passed: Category folder workspace, folder creation, link cards in folder, and safe folder deletion verified.")

        # 18. Favourites Toggle and View
        rahul_link.is_favourite = False
        db.session.commit()

        # rahul toggles favorite on rahul_link
        res = client.post(f'/links/{rahul_link.id}/favorite', headers={'Accept': 'application/json'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['status'] == 'ok'
        assert data['is_favourite'] is True
        db.session.refresh(rahul_link)
        assert rahul_link.is_favourite is True

        # Check Favourites view includes this link
        res = client.get('/favourites')
        assert res.status_code == 200
        assert b"Rahul Portfolio" in res.data

        # Toggle back (unfavorite)
        res = client.post(f'/links/{rahul_link.id}/favorite', headers={'Accept': 'application/json'})
        assert res.status_code == 200
        assert res.get_json()['is_favourite'] is False
        db.session.refresh(rahul_link)
        assert rahul_link.is_favourite is False
        print("Test 18 Passed: Favourites toggle API and views verified.")

        # 19. Link Health Verification (Manual and Bulk)
        res = client.post(f'/links/{rahul_link.id}/health-check', headers={'Accept': 'application/json'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['status'] == 'ok'
        assert 'health' in data
        assert rahul_link.last_checked is not None
        assert rahul_link.last_checked_text in ['just now', 'recently', '0m ago']

        # Bulk health check (same logic used by 5-minute background scheduler)
        from app.helpers import check_all_active_links
        checked_count = check_all_active_links()
        assert checked_count >= 1
        print("Test 19 Passed: Automatic & manual link health checking verified.")

        # 20. n8n Team Invitation Webhook
        from unittest.mock import patch, MagicMock
        from app.helpers import send_invitation_email

        with patch('requests.post') as mock_post:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.raise_for_status.return_value = None
            mock_post.return_value = mock_resp

            # Direct function test
            res_obj = send_invitation_email("partner@example.com")
            assert mock_post.called
            args, kwargs = mock_post.call_args
            assert kwargs['json'] == {'email': 'partner@example.com'}
            assert 'X-Invite-Token' in kwargs['headers']

            # API route test: rahul invites partner to rahul_team
            res = client.post(f'/teams/{rahul_team.id}/peoples', json={
                'email': 'teammate@example.com',
                'role': 'people'
            })
            assert res.status_code == 200
            assert res.get_json()['status'] == 'ok'
            assert res.get_json()['webhook_sent'] is True
        print("Test 20 Passed: n8n team people invitation webhook integration verified.")

        print("\n===========================================")
        print("ALL 20 VERIFICATION SUITES PASSED FLAWLESSLY!")
        print("===========================================")

if __name__ == '__main__':
    run_tests()



