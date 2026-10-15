from flask import Blueprint, render_template, request, redirect, url_for, jsonify, flash
from app.extensions import db
from app.models import User, Team, Category, Link, Teampeople
from app.helpers import admin_required, compute_admin_metrics, get_current_user

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

@admin_bp.route('/dashboard')
@admin_required
def admin_dashboard():
    admin_metrics = compute_admin_metrics()
    return render_template(
        'admin/dashboard.html',
        admin_metrics=admin_metrics,
        is_admin=True,
        active_page='adminOverview',
    )


@admin_bp.route('/users')
@admin_required
def admin_users():
    filter_type = request.args.get('filter', 'all').lower()
    query = User.query

    if filter_type == 'active':
        query = query.filter(User.status_str.ilike('active'))
    elif filter_type == 'disabled':
        query = query.filter(User.status_str.ilike('disabled'))
    elif filter_type == 'admins':
        query = query.filter(User.role_str.ilike('admin'))

    users = query.order_by(User.created_at.desc()).all()
    active_count = User.query.filter(User.status_str.ilike('active')).count()
    disabled_count = User.query.filter(User.status_str.ilike('disabled')).count()
    admin_count = User.query.filter(User.role_str.ilike('admin')).count()

    all_teams = Team.query.order_by(Team.name.asc()).all()

    return render_template(
        'admin/users.html',
        users=users,
        active_count=active_count,
        disabled_count=disabled_count,
        admin_count=admin_count,
        teams=all_teams,
        is_admin=True,
        active_page='adminUsers',
    )


@admin_bp.route('/users/<int:user_id>', methods=['GET'])
@admin_required
def admin_get_user(user_id):
    u = User.query.get_or_404(user_id)
    user_team_ids = [m.team_id for m in Teampeople.query.filter((Teampeople.user_id == u.id) | (Teampeople.email == u.email)).all()]
    leader_teams = [t.id for t in Team.query.filter_by(leader_id=u.id).all()]
    all_user_team_ids = list(set(user_team_ids + leader_teams))

    all_teams = [{'id': t.id, 'name': t.name} for t in Team.query.order_by(Team.name.asc()).all()]

    return jsonify({
        'id': u.id,
        'name': u.name,
        'email': u.email,
        'role': u.role,
        'status': u.status,
        'teams_label': u.teams_label,
        'team_id': all_user_team_ids[0] if all_user_team_ids else None,
        'available_teams': all_teams
    })


@admin_bp.route('/users/<int:user_id>/edit', methods=['POST'])
@admin_required
def admin_edit_user(user_id):
    current_admin = get_current_user()
    target_user = User.query.get_or_404(user_id)

    data = request.get_json(silent=True) or request.form
    name = (data.get('name') or '').strip()
    role = (data.get('role') or target_user.role).strip()
    status = (data.get('status') or target_user.status).strip()
    team_id = data.get('team')

    if not name:
        return jsonify({'error': 'Name is required.'}), 400

    if target_user.id == current_admin.id and role.lower() != 'admin':
        return jsonify({'error': 'You cannot revoke your own administrator privileges.'}), 400

    target_user.name = name
    target_user.role_str = 'admin' if role.lower() == 'admin' else 'user'
    target_user.status_str = 'Active' if status.lower() == 'active' else 'Disabled'

    # Team assignment if provided
    if team_id is not None:
        team_id_str = str(team_id).strip()
        if team_id_str == '' or team_id_str == 'none':
            Teampeople.query.filter((Teampeople.user_id == target_user.id) | (Teampeople.email == target_user.email)).delete()
        else:
            try:
                t_id = int(team_id_str)
                team = Team.query.get(t_id)
                if team and team.leader_id != target_user.id:
                    existing = Teampeople.query.filter_by(team_id=t_id).filter(
                        (Teampeople.user_id == target_user.id) | (Teampeople.email == target_user.email)
                    ).first()
                    if not existing:
                        db.session.add(Teampeople(
                            team_id=t_id,
                            user_id=target_user.id,
                            email=target_user.email,
                            role='people'
                        ))
            except (ValueError, TypeError):
                pass

    db.session.commit()
    return jsonify({
        'status': 'ok',
        'message': f'User "{target_user.name}" updated successfully.',
        'user': {
            'id': target_user.id,
            'name': target_user.name,
            'role': target_user.role,
            'status': target_user.status,
            'teams_label': target_user.teams_label,
        }
    })


@admin_bp.route('/users/<int:user_id>/delete', methods=['POST'])
@admin_required
def admin_delete_user(user_id):
    current_admin = get_current_user()
    target_user = User.query.get_or_404(user_id)

    if target_user.id == current_admin.id:
        error_msg = "You cannot delete your own administrator account."
        if request.is_json:
            return jsonify({'error': error_msg}), 400
        flash(error_msg, 'error')
        return redirect(url_for('admin.admin_users'))

    deleted_name = target_user.name

    # Remove user from any team peopleships
    Teampeople.query.filter((Teampeople.user_id == target_user.id) | (Teampeople.email == target_user.email)).delete()

    db.session.delete(target_user)
    db.session.commit()

    if request.is_json:
        return jsonify({'status': 'ok', 'message': f'User "{deleted_name}" deleted.'})
    flash(f'User "{deleted_name}" deleted.', 'success')
    return redirect(url_for('admin.admin_users'))


@admin_bp.route('/users/<int:user_id>/toggle-status', methods=['POST'])
@admin_required
def admin_toggle_user(user_id):
    current_admin = get_current_user()
    target_user = User.query.get_or_404(user_id)

    if target_user.id == current_admin.id:
        error_msg = "You cannot disable your own administrator account."
        if request.is_json:
            return jsonify({'error': error_msg}), 400
        flash(error_msg, 'error')
        return redirect(url_for('admin.admin_users'))

    target_user.is_active = not target_user.is_active
    db.session.commit()

    if request.is_json:
        return jsonify({'status': 'ok', 'is_active': target_user.is_active})
    return redirect(url_for('admin.admin_users'))


@admin_bp.route('/teams')
@admin_required
def admin_teams():
    all_teams = Team.query.order_by(Team.created_at.desc()).all()
    
    # Calculate platform resources breakdown
    platform_resources = {
        'active_links': Link.query.filter(Link.status.in_(['active', 'Active'])).count(),
        'archived_links': Link.query.filter(Link.status.in_(['archive', 'Archived'])).count(),
        'trash_links': Link.query.filter(Link.status.in_(['trash', 'Deleted', 'Trash'])).count(),
        'short_urls': Link.query.filter(Link.short_code.isnot(None), Link.short_code != '').count(),
        'personal_categories': Category.query.filter((Category.team_name.is_(None)) | (Category.team_name == '')).count(),
        'shared_categories': Category.query.filter(Category.team_name.isnot(None), Category.team_name != '').count(),
        'folders': 0,
    }

    return render_template(
        'admin/teams_resources.html',
        teams=all_teams,
        platform_resources=platform_resources,
        is_admin=True,
        active_page='adminTeams',
    )


@admin_bp.route('/teams/<int:team_id>/delete', methods=['POST'])
@admin_required
def admin_delete_team(team_id):
    team = Team.query.get_or_404(team_id)
    team_name = team.name
    # Unlink any categories associated with this team so they become personal
    Category.query.filter_by(team_name=team_name).update({'team_name': None})
    db.session.delete(team)
    db.session.commit()
    if request.is_json:
        return jsonify({'status': 'ok', 'message': f'Team "{team_name}" deleted.'})
    flash(f'Team "{team_name}" deleted.', 'success')
    return redirect(url_for('admin.admin_teams'))
