from datetime import datetime
from flask import Blueprint, render_template, request, redirect, url_for, jsonify, abort, flash
from app.extensions import db
from sqlalchemy import func
from app.models import User, Link, Category, Team, Folder, TeamMember
from app.helpers import (
    get_current_user,
    login_required,
    compute_user_metrics,
    generate_short_code,
    trigger_n8n_webhook,
)

user_bp = Blueprint('user', __name__)

@user_bp.route('/dashboard')
@login_required
def dashboard():
    user = get_current_user()
    metrics = compute_user_metrics(user)

    frequent_links = (
        Link.query.filter(
            Link.user_id == user.id,
            Link.status.in_(['active', 'Active'])
        )
        .order_by(Link._opens_count.desc(), Link.created_at.desc())
        .limit(5)
        .all()
    )

    recent_links = (
        Link.query.filter(
            Link.user_id == user.id,
            Link.status.in_(['active', 'Active'])
        )
        .order_by(Link.created_at.desc())
        .limit(5)
        .all()
    )

    return render_template(
        'user/dashboard.html',
        metrics=metrics,
        frequent_links=frequent_links,
        recent_links=recent_links,
        active_page='overview',
    )


@user_bp.route('/links')
@login_required
def my_links():
    user = get_current_user()
    metrics = compute_user_metrics(user)

    query = Link.query.filter(
        Link.user_id == user.id,
        Link.status.in_(['active', 'Active'])
    )

    # Search filter
    search_query = request.args.get('q', '').strip()
    if search_query:
        term = f"%{search_query}%"
        query = query.filter(
            db.or_(
                Link.title.ilike(term),
                Link.url.ilike(term),
                Link.description.ilike(term),
                Link._tags.ilike(term),
            )
        )

    # Health status filter
    current_filter = request.args.get('filter', 'all').lower()
    if current_filter == 'healthy':
        query = query.filter(Link.health == 'healthy')
    elif current_filter == 'unhealthy':
        query = query.filter(Link.health == 'unhealthy')
    elif current_filter == 'restricted':
        query = query.filter(Link.health == 'restricted')
    elif current_filter == 'notverified':
        query = query.filter(Link.health.in_(['notverified', 'Not Verified', None]))
    elif current_filter == 'short':
        query = query.filter(Link.short_code != '')

    # Category filter
    category_id = request.args.get('category_id')
    if category_id:
        try:
            query = query.filter(Link.category_id == int(category_id))
        except ValueError:
            pass

    links = query.order_by(Link.created_at.desc()).all()
    user_categories = Category.query.filter_by(user_id=user.id).order_by(Category.name.asc()).all()

    return render_template(
        'user/my_links.html',
        links=links,
        metrics=metrics,
        current_filter=current_filter,
        search_query=search_query,
        categories=user_categories,
        active_page='links',
    )


@user_bp.route('/links/new', methods=['GET', 'POST'])
@login_required
def new_link():
    user = get_current_user()
    if request.method == 'POST':
        data = request.get_json(silent=True) or request.form
        title = (data.get('title') or '').strip()
        url = (data.get('url') or '').strip()
        description = (data.get('description') or '').strip()
        raw_tags = data.get('tags') or ''
        category_id = data.get('category_id') or data.get('category')
        folder_id = data.get('folder_id') or data.get('folder')

        if not title:
            return jsonify({'error': 'Please provide a title for the link.'}), 400

        if not url:
            return jsonify({'error': 'Please provide a destination URL.'}), 400

        if not (url.startswith('http://') or url.startswith('https://')):
            url = 'https://' + url

        if isinstance(raw_tags, list):
            tags_str = ', '.join(raw_tags)
        else:
            tags_str = str(raw_tags).strip()

        cat_id = None
        if category_id:
            try:
                cat = Category.query.filter_by(id=int(category_id)).first()
                if cat and (cat.user_id == user.id or cat.team_name in [t.name for t in Team.query.filter_by(manager_id=user.id).all()]):
                    cat_id = cat.id
            except (ValueError, TypeError):
                pass

        fld_id = None
        if folder_id:
            try:
                fld = Folder.query.filter_by(id=int(folder_id), user_id=user.id).first()
                if fld:
                    fld_id = fld.id
                    if not cat_id:
                        cat_id = fld.category_id
            except (ValueError, TypeError):
                pass

        short_code = generate_short_code()

        link = Link(
            title=title,
            url=url,
            short_code=short_code,
            description=description,
            _tags=tags_str,
            category_id=cat_id,
            folder_id=fld_id,
            user_id=user.id,
            status='active',
            health='notverified',
            _is_favourite=0,
            _opens_count=0,
        )

        db.session.add(link)
        db.session.commit()

        trigger_n8n_webhook(link)

        if request.is_json:
            return jsonify({
                'status': 'ok',
                'id': link.id,
                'title': link.title,
                'url': link.url,
                'short_code': link.short_code,
            })
        return redirect(url_for('user.my_links'))

    return redirect(url_for('user.my_links'))


@user_bp.route('/links/<int:link_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_link(link_id):
    user = get_current_user()
    link = Link.query.get_or_404(link_id)

    if link.user_id != user.id:
        abort(403)

    if request.method == 'POST':
        data = request.get_json(silent=True) or request.form
        title = (data.get('title') or '').strip()
        url = (data.get('url') or '').strip()
        description = (data.get('description') or '').strip()
        raw_tags = data.get('tags') or ''
        category_id = data.get('category_id') or data.get('category')

        if title:
            link.title = title
        if url:
            if not (url.startswith('http://') or url.startswith('https://')):
                url = 'https://' + url
            link.url = url

        link.description = description

        if isinstance(raw_tags, list):
            link._tags = ', '.join(raw_tags)
        else:
            link._tags = str(raw_tags).strip()

        if category_id:
            try:
                cat = Category.query.filter_by(id=int(category_id), user_id=user.id).first()
                link.category_id = cat.id if cat else None
            except (ValueError, TypeError):
                link.category_id = None
        else:
            link.category_id = None

        db.session.commit()

        if request.is_json:
            return jsonify({'status': 'ok', 'id': link.id})
        return redirect(url_for('user.my_links'))

    return jsonify({
        'id': link.id,
        'title': link.title,
        'url': link.url,
        'description': link.description or '',
        'tags': link.tags,
        'category_id': link.category_id,
        'short_code': link.short_code,
    })


def _is_api_request():
    return (
        request.is_json
        or 'application/json' in request.headers.get('Accept', '')
        or request.headers.get('X-Requested-With') == 'XMLHttpRequest'
        or not request.form
    )


@user_bp.route('/links/<int:link_id>/favorite', methods=['POST'])
@login_required
def toggle_favorite(link_id):
    user = get_current_user()
    link = Link.query.get_or_404(link_id)

    if link.user_id != user.id:
        abort(403)

    link._is_favourite = 0 if link._is_favourite else 1
    db.session.commit()

    if _is_api_request():
        return jsonify({'status': 'ok', 'is_favourite': bool(link.is_favourite)})
    return redirect(request.referrer or url_for('user.my_links'))


@user_bp.route('/links/<int:link_id>/archive', methods=['POST'])
@login_required
def archive_link(link_id):
    user = get_current_user()
    link = Link.query.get_or_404(link_id)

    if link.user_id != user.id:
        abort(403)

    link.status = 'archive'
    db.session.commit()

    if _is_api_request():
        return jsonify({'status': 'ok'})
    return redirect(request.referrer or url_for('user.my_links'))


@user_bp.route('/links/<int:link_id>/restore', methods=['POST'])
@login_required
def restore_link(link_id):
    user = get_current_user()
    link = Link.query.get_or_404(link_id)

    if link.user_id != user.id:
        abort(403)

    link.status = 'active'
    db.session.commit()

    if _is_api_request():
        return jsonify({'status': 'ok'})
    return redirect(request.referrer or url_for('user.my_links'))


@user_bp.route('/links/<int:link_id>/trash', methods=['POST'])
@login_required
def trash_link(link_id):
    user = get_current_user()
    link = Link.query.get_or_404(link_id)

    if link.user_id != user.id:
        abort(403)

    link.status = 'trash'
    db.session.commit()

    if _is_api_request():
        return jsonify({'status': 'ok'})
    return redirect(request.referrer or url_for('user.my_links'))


@user_bp.route('/links/<int:link_id>/delete', methods=['POST'])
@login_required
def delete_link(link_id):
    user = get_current_user()
    link = Link.query.get_or_404(link_id)

    if link.user_id != user.id:
        abort(403)

    db.session.delete(link)
    db.session.commit()

    if _is_api_request():
        return jsonify({'status': 'ok'})
    return redirect(url_for('user.trash'))


@user_bp.route('/links/<int:link_id>/health-check', methods=['POST'])
@login_required
def check_single_link_health(link_id):
    user = get_current_user()
    link = Link.query.get_or_404(link_id)

    if link.user_id != user.id:
        user_teams = [t.name for t in Team.query.filter_by(manager_id=user.id).all()]
        if not link.category or link.category.team_name not in user_teams:
            abort(403)

    from app.helpers import verify_link_health
    verify_link_health(link)
    db.session.commit()

    return jsonify({
        'status': 'ok',
        'health': link.health,
        'health_status': link.health_status,
        'last_checked': link.last_checked_text,
    })


@user_bp.route('/links/health-check-all', methods=['POST'])
@login_required
def check_user_links_health():
    user = get_current_user()
    active_links = Link.query.filter(
        Link.user_id == user.id,
        Link.status.in_(['active', 'Active'])
    ).all()
    from app.helpers import verify_link_health
    for l in active_links:
        verify_link_health(l)
    db.session.commit()
    return jsonify({'status': 'ok', 'checked': len(active_links)})


@user_bp.route('/favourites')
@login_required
def favourites():
    user = get_current_user()
    metrics = compute_user_metrics(user)
    favourite_links = (
        Link.query.filter(
            Link.user_id == user.id,
            Link.status.in_(['active', 'Active']),
            Link._is_favourite == 1
        )
        .order_by(Link.created_at.desc())
        .all()
    )
    return render_template(
        'user/favourites.html',
        favourite_links=favourite_links,
        metrics=metrics,
        active_page='favourites',
    )


@user_bp.route('/archive')
@login_required
def archive():
    user = get_current_user()
    metrics = compute_user_metrics(user)
    archived_links = (
        Link.query.filter(
            Link.user_id == user.id,
            Link.status.in_(['archive', 'Archived'])
        )
        .order_by(Link.created_at.desc())
        .all()
    )
    return render_template(
        'user/archive.html',
        archived_links=archived_links,
        metrics=metrics,
        active_page='archive',
    )


@user_bp.route('/trash')
@login_required
def trash():
    user = get_current_user()
    metrics = compute_user_metrics(user)
    deleted_links = (
        Link.query.filter(
            Link.user_id == user.id,
            Link.status.in_(['trash', 'Deleted'])
        )
        .order_by(Link.created_at.desc())
        .all()
    )
    return render_template(
        'user/trash.html',
        deleted_links=deleted_links,
        metrics=metrics,
        active_page='trash',
    )


@user_bp.route('/categories', methods=['GET', 'POST'], defaults={'category_id': None})
@user_bp.route('/categories/<int:category_id>', methods=['GET'])
@login_required
def categories(category_id=None):
    user = get_current_user()
    if request.method == 'POST':
        data = request.get_json(silent=True) or request.form
        name = (data.get('name') or '').strip()
        team_name = (data.get('team_name') or '').strip() or None

        if not name:
            error_msg = 'Please enter a category name.'
            if request.is_json:
                return jsonify({'error': error_msg}), 400
            flash(error_msg, 'error')
            return redirect(url_for('user.categories'))

        existing = Category.query.filter_by(user_id=user.id, name=name).first()
        if existing:
            error_msg = 'A category with this name already exists.'
            if request.is_json:
                return jsonify({'error': error_msg}), 400
            flash(error_msg, 'error')
            return redirect(url_for('user.categories'))

        new_cat = Category(name=name, user_id=user.id, team_name=team_name)
        db.session.add(new_cat)
        db.session.commit()

        if request.is_json:
            return jsonify({'status': 'ok', 'id': new_cat.id, 'name': new_cat.name, 'team_name': new_cat.team_name})
        return redirect(url_for('user.categories', category_id=new_cat.id))

    if not category_id and request.args.get('category_id'):
        try:
            category_id = int(request.args.get('category_id'))
        except (ValueError, TypeError):
            pass

    folder_id = None
    if request.args.get('folder_id'):
        try:
            folder_id = int(request.args.get('folder_id'))
        except (ValueError, TypeError):
            pass

    active_category = None
    active_folder = None
    folders = []
    folder_links = []
    loose_links = []

    if category_id:
        active_category = Category.query.filter_by(id=category_id, user_id=user.id).first()
        if not active_category:
            user_teams = Team.query.filter_by(manager_id=user.id).all()
            user_team_names = [t.name for t in user_teams]
            active_category = Category.query.filter(
                Category.id == category_id,
                Category.team_name.in_(user_team_names)
            ).first()

        if active_category:
            folders = Folder.query.filter_by(category_id=active_category.id).order_by(Folder.created_at.desc()).all()
            if folder_id:
                active_folder = Folder.query.filter_by(id=folder_id, category_id=active_category.id).first()
                if active_folder:
                    folder_links = Link.query.filter(
                        Link.category_id == active_category.id,
                        Link.folder_id == active_folder.id,
                        Link.status.in_(['active', 'Active'])
                    ).order_by(Link.created_at.desc()).all()

            loose_links = Link.query.filter(
                Link.category_id == active_category.id,
                (Link.folder_id.is_(None)) | (Link.folder_id == 0),
                Link.status.in_(['active', 'Active'])
            ).order_by(Link.created_at.desc()).all()

    personal_categories = Category.query.filter(
        Category.user_id == user.id,
        (Category.team_name.is_(None)) | (Category.team_name == '')
    ).order_by(Category.created_at.desc()).all()

    user_teams = Team.query.filter_by(manager_id=user.id).all()
    user_team_names = [t.name for t in user_teams]
    shared_categories = Category.query.filter(
        Category.team_name.in_(user_team_names)
    ).order_by(Category.created_at.desc()).all() if user_team_names else []

    return render_template(
        'user/categories.html',
        personal_categories=personal_categories,
        shared_categories=shared_categories,
        active_category=active_category,
        active_folder=active_folder,
        folders=folders,
        folder_links=folder_links,
        loose_links=loose_links,
        active_page='categories',
    )


@user_bp.route('/categories/<int:category_id>/folders', methods=['POST'])
@login_required
def create_folder(category_id):
    user = get_current_user()
    category = Category.query.get_or_404(category_id)
    if category.user_id != user.id:
        user_teams = [t.name for t in Team.query.filter_by(manager_id=user.id).all()]
        if not category.team_name or category.team_name not in user_teams:
            abort(403)

    data = request.get_json(silent=True) or request.form
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Please enter a folder name.'}), 400

    new_folder = Folder(name=name, category_id=category.id, user_id=user.id)
    db.session.add(new_folder)
    db.session.commit()
    return jsonify({'status': 'ok', 'id': new_folder.id, 'name': new_folder.name})


@user_bp.route('/folders/<int:folder_id>/rename', methods=['POST'])
@login_required
def rename_folder(folder_id):
    user = get_current_user()
    folder = Folder.query.get_or_404(folder_id)
    data = request.get_json(silent=True) or request.form
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Folder name cannot be empty.'}), 400

    folder.name = name
    db.session.commit()
    return jsonify({'status': 'ok', 'name': folder.name})


@user_bp.route('/folders/<int:folder_id>/delete', methods=['POST'])
@login_required
def delete_folder(folder_id):
    user = get_current_user()
    folder = Folder.query.get_or_404(folder_id)
    # Move contained links to loose category links (folder_id = None)
    Link.query.filter_by(folder_id=folder.id).update({'folder_id': None})
    db.session.delete(folder)
    db.session.commit()
    return jsonify({'status': 'ok'})


@user_bp.route('/categories/<int:category_id>/rename', methods=['POST'])
@login_required
def rename_category(category_id):
    user = get_current_user()
    category = Category.query.get_or_404(category_id)
    if category.user_id != user.id:
        abort(403)
    data = request.get_json(silent=True) or request.form
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Category name cannot be empty.'}), 400

    category.name = name
    db.session.commit()
    return jsonify({'status': 'ok', 'name': category.name})


@user_bp.route('/categories/<int:category_id>/delete', methods=['POST'])
@login_required
def delete_category(category_id):
    user = get_current_user()
    category = Category.query.get_or_404(category_id)

    if category.user_id != user.id:
        abort(403)

    active_count = Link.query.filter(
        Link.category_id == category.id,
        Link.status.in_(['active', 'Active'])
    ).count()

    if active_count > 0:
        error_msg = f"Cannot delete '{category.name}'. It still contains {active_count} active link(s). Move them first."
        if request.is_json:
            return jsonify({'error': error_msg}), 400
        flash(error_msg, 'error')
        return redirect(url_for('user.categories'))

    db.session.delete(category)
    db.session.commit()

    if request.is_json:
        return jsonify({'status': 'ok'})
    return redirect(url_for('user.categories'))


@user_bp.route('/teams', methods=['GET', 'POST'], defaults={'team_id': None})
@user_bp.route('/teams/<int:team_id>', methods=['GET'])
@login_required
def teams(team_id=None):
    user = get_current_user()
    if request.method == 'POST':
        data = request.get_json(silent=True) or request.form
        name = (data.get('name') or '').strip()
        description = (data.get('description') or '').strip() or None

        if not name:
            error_msg = 'Please enter a team name.'
            if request.is_json:
                return jsonify({'error': error_msg}), 400
            flash(error_msg, 'error')
            return redirect(url_for('user.teams'))

        new_team = Team(name=name, description=description, manager_id=user.id)
        db.session.add(new_team)
        db.session.commit()

        if request.is_json:
            return jsonify({'status': 'ok', 'id': new_team.id, 'name': new_team.name})
        return redirect(url_for('user.teams', team_id=new_team.id))

    if not team_id and request.args.get('team_id'):
        try:
            team_id = int(request.args.get('team_id'))
        except (ValueError, TypeError):
            pass

    # Find all teams where user is manager or a member
    member_team_ids = [m.team_id for m in TeamMember.query.filter((TeamMember.user_id == user.id) | (TeamMember.email == user.email)).all()]
    teams_list = Team.query.filter(
        (Team.manager_id == user.id) | (Team.id.in_(member_team_ids))
    ).order_by(Team.created_at.desc()).all()

    active_team = None
    shared_categories = []
    shared_links = []
    is_manager = False

    if team_id:
        active_team = Team.query.filter(
            (Team.id == team_id) & ((Team.manager_id == user.id) | (Team.id.in_(member_team_ids)))
        ).first()

    if not active_team and teams_list:
        active_team = teams_list[0]

    if active_team:
        is_manager = (active_team.manager_id == user.id)
        if not is_manager:
            user_mem = TeamMember.query.filter_by(team_id=active_team.id).filter(
                (TeamMember.user_id == user.id) | (TeamMember.email == user.email)
            ).first()
            if user_mem and user_mem.role == 'Manager':
                is_manager = True

        shared_categories = Category.query.filter_by(team_name=active_team.name).all()
        cat_ids = [c.id for c in shared_categories]
        if cat_ids:
            shared_links = Link.query.filter(
                Link.category_id.in_(cat_ids),
                Link.status.in_(['active', 'Active'])
            ).all()

    return render_template(
        'user/teams.html',
        teams=teams_list,
        active_team=active_team,
        is_manager=is_manager,
        shared_categories=shared_categories,
        shared_links=shared_links,
        active_page='teams',
    )


@user_bp.route('/teams/<int:team_id>/edit', methods=['POST'])
@login_required
def edit_team(team_id):
    user = get_current_user()
    team = Team.query.filter_by(id=team_id, manager_id=user.id).first_or_404()

    data = request.get_json(silent=True) or request.form
    new_name = (data.get('name') or '').strip()
    new_desc = (data.get('description') or '').strip()

    if not new_name:
        return jsonify({'error': 'Team name cannot be empty.'}), 400

    old_name = team.name
    team.name = new_name
    team.description = new_desc or None

    if old_name != new_name:
        Category.query.filter_by(team_name=old_name).update({'team_name': new_name})

    db.session.commit()
    return jsonify({'status': 'ok', 'name': team.name})


@user_bp.route('/teams/<int:team_id>/delete', methods=['POST'])
@login_required
def delete_team(team_id):
    user = get_current_user()
    team = Team.query.filter_by(id=team_id, manager_id=user.id).first_or_404()

    Category.query.filter_by(team_name=team.name).update({'team_name': None})
    db.session.delete(team)
    db.session.commit()

    if request.is_json:
        return jsonify({'status': 'ok'})
    return redirect(url_for('user.teams'))


@user_bp.route('/teams/<int:team_id>/members', methods=['POST'])
@login_required
def add_team_member(team_id):
    user = get_current_user()
    team = Team.query.filter_by(id=team_id, manager_id=user.id).first_or_404()

    data = request.get_json(silent=True) or request.form
    email = (data.get('email') or '').strip().lower()
    role = (data.get('role') or 'Member').strip()

    if not email:
        return jsonify({'error': 'Please provide an email address.'}), 400

    # Check if target is manager
    if team.owner and team.owner.email.lower() == email:
        return jsonify({'error': 'User is already the manager of this team.'}), 400

    # Check if already a member
    existing = TeamMember.query.filter_by(team_id=team.id).filter(func.lower(TeamMember.email) == email).first()
    if existing:
        return jsonify({'error': f"'{email}' is already a member of this team."}), 400

    # Check if registered user exists
    reg_user = User.query.filter(func.lower(User.email) == email).first()
    if reg_user and reg_user.is_admin:
        return jsonify({'error': 'Platform administrators cannot be added as regular team members.'}), 400

    member = TeamMember(
        team_id=team.id,
        user_id=reg_user.id if reg_user else None,
        email=email,
        role=role
    )
    db.session.add(member)
    db.session.commit()

    from app.helpers import send_invitation_email
    webhook_sent = False
    try:
        send_invitation_email(email, team=team, role=role, inviter=user)
        webhook_sent = True
    except Exception as e:
        print(f"[LinkSphere] n8n invite webhook notification notice: {e}")

    return jsonify({
        'status': 'ok',
        'message': f'Added {email} to {team.name} as {role}',
        'email': email,
        'role': role,
        'members_count': team.members_count,
        'webhook_sent': webhook_sent
    })


@user_bp.route('/teams/<int:team_id>/members/<int:member_id>/delete', methods=['POST'])
@login_required
def remove_team_member(team_id, member_id):
    user = get_current_user()
    team = Team.query.get_or_404(team_id)
    member = TeamMember.query.filter_by(id=member_id, team_id=team.id).first_or_404()

    # Permission check: team manager OR the member themselves
    is_manager = (team.manager_id == user.id)
    is_self = (member.user_id == user.id or member.email.lower() == user.email.lower())

    if not (is_manager or is_self):
        return jsonify({'error': 'You do not have permission to remove this member.'}), 403

    db.session.delete(member)
    db.session.commit()
    return jsonify({'status': 'ok', 'message': 'Member removed from team.', 'members_count': team.members_count})


@user_bp.route('/teams/<int:team_id>/members/<int:member_id>/role', methods=['POST'])
@login_required
def change_team_member_role(team_id, member_id):
    user = get_current_user()
    team = Team.query.filter_by(id=team_id, manager_id=user.id).first_or_404()
    member = TeamMember.query.filter_by(id=member_id, team_id=team.id).first_or_404()

    data = request.get_json(silent=True) or request.form
    new_role = (data.get('role') or 'Member').strip()
    if new_role not in ['Manager', 'Member']:
        return jsonify({'error': 'Invalid role.'}), 400

    member.role = new_role
    db.session.commit()
    return jsonify({'status': 'ok', 'role': member.role})



@user_bp.route('/settings')
@login_required
def settings():
    user = get_current_user()
    return render_template(
        'user/settings.html',
        current_user=user,
        active_page='settings',
        user_settings={'compact': False, 'theme': 'light'},
    )
