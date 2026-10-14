import os
import secrets
import string
from datetime import datetime
from functools import wraps
from flask import session, request, redirect, url_for, jsonify
from app.models import User, Link, Category, Team

def generate_short_code(length=6):
    """Generate a collision-free URL-safe short code."""
    chars = string.ascii_letters + string.digits
    for _ in range(20):
        code = ''.join(secrets.choice(chars) for _ in range(length))
        if not Link.query.filter_by(short_code=code).first():
            return code
    return secrets.token_hex(4)


def get_current_user():
    """Retrieve logged-in user from the database."""
    user_id = session.get('user_id')
    if not user_id:
        return None
    user = User.query.get(user_id)
    if not user or not user.is_active:
        session.clear()
        return None
    return user


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            if request.is_json:
                return jsonify({'error': 'Authentication required'}), 401
            return redirect(url_for('auth.user_login'))
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user or not user.is_admin:
            if request.is_json:
                return jsonify({'error': 'Administrator privileges required'}), 403
            return redirect(url_for('auth.admin_login'))
        return f(*args, **kwargs)
    return decorated_function


def compute_user_metrics(user):
    """Calculate dashboard metrics for a user."""
    active_links = Link.query.filter(
        Link.user_id == user.id,
        Link.status.in_(['active', 'Active'])
    ).all()

    total_active = len(active_links)
    healthy_count = sum(1 for l in active_links if (l.health or '').lower() == 'healthy')
    unhealthy_count = sum(1 for l in active_links if (l.health or '').lower() == 'unhealthy')
    restricted_count = sum(1 for l in active_links if (l.health or '').lower() == 'restricted')
    notverified_count = sum(1 for l in active_links if (l.health or 'notverified').lower() in ['not verified', 'notverified', ''])
    short_urls_count = sum(1 for l in active_links if bool(l.short_code))

    categories_count = Category.query.filter_by(user_id=user.id).count()
    teams_count = Team.query.filter_by(manager_id=user.id).count()
    favourites_count = Link.query.filter(
        Link.user_id == user.id,
        Link.status.in_(['active', 'Active']),
        Link._is_favourite == 1
    ).count()
    archived_count = Link.query.filter(
        Link.user_id == user.id,
        Link.status.in_(['archive', 'Archived'])
    ).count()
    deleted_count = Link.query.filter(
        Link.user_id == user.id,
        Link.status.in_(['trash', 'Deleted'])
    ).count()

    return {
        'total': total_active,
        'categories': categories_count,
        'total_categories': categories_count,
        'teams': teams_count,
        'total_teams': teams_count,
        'shortUrls': short_urls_count,
        'short_urls': short_urls_count,
        'healthy': healthy_count,
        'unhealthy': unhealthy_count,
        'restricted': restricted_count,
        'notverified': notverified_count,
        'favourites': favourites_count,
        'archived_count': archived_count,
        'deleted_count': deleted_count,
    }


def compute_admin_metrics():
    """Calculate platform-wide metrics for admins."""
    active_links = Link.query.filter(Link.status.in_(['active', 'Active'])).all()
    return {
        'users': User.query.count(),
        'activeUsers': User.query.filter(User.status_str.in_(['Active', 'active'])).count(),
        'disabledUsers': User.query.filter(User.status_str.in_(['Disabled', 'disabled'])).count(),
        'teams': Team.query.count(),
        'activeLinks': len(active_links),
        'healthy': sum(1 for l in active_links if (l.health or '').lower() == 'healthy'),
        'unhealthy': sum(1 for l in active_links if (l.health or '').lower() == 'unhealthy'),
        'restricted': sum(1 for l in active_links if (l.health or '').lower() == 'restricted'),
        'notverified': sum(1 for l in active_links if (l.health or 'notverified').lower() in ['not verified', 'notverified', '']),
    }


def trigger_n8n_webhook(link):
    """Optional n8n webhook notification for link health and automation."""
    webhook_url = os.getenv('N8N_WEBHOOK_URL', '').strip()
    if not webhook_url:
        return
    try:
        import requests
        requests.post(
            webhook_url,
            json={
                'event': 'link_created',
                'link_id': link.id,
                'title': link.title,
                'url': link.url,
                'short_code': link.short_code,
                'timestamp': datetime.utcnow().isoformat(),
            },
            timeout=1.5,
        )
    except Exception as e:
        print(f"[LinkSphere] Optional n8n webhook notification skipped: {e}")


def send_invitation_email(email, team=None, role=None, inviter=None):
    """
    Sends an invitation email webhook to n8n with the configured secret token.
    """
    import requests
    webhook_url = os.getenv("N8N_INVITE_WEBHOOK_URL")
    token = os.getenv("N8N_INVITE_TOKEN")

    if not webhook_url:
        print("[LinkSphere] N8N_INVITE_WEBHOOK_URL is not set.")
        return None

    payload = {"email": email}
    if team:
        payload["team_name"] = team.name if hasattr(team, 'name') else str(team)
        if hasattr(team, 'id'):
            payload["team_id"] = team.id
    if role:
        payload["role"] = str(role)
    if inviter:
        payload["inviter_name"] = inviter.name if hasattr(inviter, 'name') else str(inviter)
        if hasattr(inviter, 'email'):
            payload["inviter_email"] = inviter.email

    headers = {}
    if token:
        headers["X-Invite-Token"] = token

    response = requests.post(
        webhook_url,
        json=payload,
        headers=headers,
        timeout=10
    )

    response.raise_for_status()
    return response


def verify_link_health(link):
    """
    Checks the HTTP status and availability of a link's destination URL.
    Updates link.health and link.last_checked.
    """
    url = (link.url or '').strip()
    if not url:
        link.health = 'unhealthy'
        link.last_checked = datetime.utcnow()
        return link.health

    if not (url.startswith('http://') or url.startswith('https://')):
        url = 'https://' + url

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LinkSphere/1.0'
    }

    try:
        import requests
        resp = requests.head(url, headers=headers, timeout=4, allow_redirects=True)
        if resp.status_code in (405, 403, 400):
            # Some servers reject HEAD requests; fallback to GET
            resp = requests.get(url, headers=headers, timeout=4, stream=True, allow_redirects=True)

        status = resp.status_code
        if status < 400:
            link.health = 'healthy'
        elif status in (401, 403):
            link.health = 'restricted'
        else:
            link.health = 'unhealthy'
    except Exception:
        link.health = 'unhealthy'

    link.last_checked = datetime.utcnow()
    return link.health


def check_all_active_links():
    """Checks the health of all active links across the system."""
    from app.extensions import db
    try:
        active_links = Link.query.filter(Link.status.in_(['active', 'Active'])).all()
        for l in active_links:
            verify_link_health(l)
        db.session.commit()
        return len(active_links)
    except Exception as e:
        db.session.rollback()
        print(f"[LinkSphere] Automatic health check error: {e}")
        return 0


_scheduler_started = False

def start_health_scheduler(app):
    """Starts a background daemon thread that checks link health every 5 minutes (300 seconds)."""
    global _scheduler_started
    if _scheduler_started:
        return
    _scheduler_started = True

    import threading
    import time

    def _loop():
        # Brief pause on startup before first check
        time.sleep(3)
        while True:
            try:
                with app.app_context():
                    count = check_all_active_links()
                    if count:
                        print(f"[LinkSphere] Automatic 5-minute health check ran for {count} links at {datetime.utcnow().strftime('%H:%M:%S')}")
            except Exception as e:
                print(f"[LinkSphere] Background health check thread exception: {e}")
            time.sleep(300)

    t = threading.Thread(target=_loop, daemon=True, name="LinkSphereHealthScheduler")
    t.start()

