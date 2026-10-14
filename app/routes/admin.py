from flask import Blueprint, render_template, request, redirect, url_for, jsonify, flash
from app.extensions import db
from app.models import User, Team, Category, Link
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
        query = query.filter_by(is_active=True)
    elif filter_type == 'disabled':
        query = query.filter_by(is_active=False)
    elif filter_type == 'admins':
        query = query.filter_by(is_admin=True)

    users = query.order_by(User.created_at.desc()).all()
    active_count = User.query.filter_by(is_active=True).count()
    disabled_count = User.query.filter_by(is_active=False).count()
    admin_count = User.query.filter_by(is_admin=True).count()

    return render_template(
        'admin/users.html',
        users=users,
        active_count=active_count,
        disabled_count=disabled_count,
        admin_count=admin_count,
        is_admin=True,
        active_page='adminUsers',
    )


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
