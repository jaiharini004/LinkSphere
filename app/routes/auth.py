from flask import Blueprint, render_template, request, redirect, url_for, session, jsonify
from app.extensions import db
from app.models import User
from app.helpers import get_current_user

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/')
def index():
    user = get_current_user()
    if user:
        if user.is_admin:
            return redirect(url_for('admin.admin_dashboard'))
        return redirect(url_for('user.dashboard'))
    return redirect(url_for('auth.user_login'))


@auth_bp.route('/login', methods=['GET', 'POST'])
def user_login():
    if request.method == 'POST':
        data = request.get_json(silent=True) or request.form
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''

        if not email or not password:
            error_message = 'Please provide both email and password.'
            if request.is_json:
                return jsonify({'error': error_message}), 400
            return render_template('auth/user_login.html', error_message=error_message, form_email=email)

        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            error_message = 'Invalid email or password.'
            if request.is_json:
                return jsonify({'error': error_message}), 401
            return render_template('auth/user_login.html', error_message=error_message, form_email=email)

        if not user.is_active:
            error_message = 'Your account has been disabled. Please contact an administrator.'
            if request.is_json:
                return jsonify({'error': error_message}), 403
            return render_template('auth/user_login.html', error_message=error_message, form_email=email)

        session['user_id'] = user.id

        if user.is_admin:
            target = url_for('admin.admin_dashboard')
        else:
            target = url_for('user.dashboard')

        if request.is_json:
            return jsonify({
                'status': 'ok',
                'redirect': target,
                'user': {'id': user.id, 'name': user.name, 'email': user.email, 'role': user.role}
            })
        return redirect(target)

    user = get_current_user()
    if user:
        return redirect(url_for('user.dashboard'))
    return render_template('auth/user_login.html')


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        data = request.get_json(silent=True) or request.form
        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''

        if not name:
            error_message = 'Please enter your full name.'
            if request.is_json:
                return jsonify({'error': error_message}), 400
            return render_template('auth/register.html', error_message=error_message, form_name=name, form_email=email)

        if not email or '@' not in email:
            error_message = 'Please enter a valid email address.'
            if request.is_json:
                return jsonify({'error': error_message}), 400
            return render_template('auth/register.html', error_message=error_message, form_name=name, form_email=email)

        if len(password) < 6:
            error_message = 'Password must be at least 6 characters long.'
            if request.is_json:
                return jsonify({'error': error_message}), 400
            return render_template('auth/register.html', error_message=error_message, form_name=name, form_email=email)

        if User.query.filter_by(email=email).first():
            error_message = 'An account with this email address already exists.'
            if request.is_json:
                return jsonify({'error': error_message}), 400
            return render_template('auth/register.html', error_message=error_message, form_name=name, form_email=email)

        new_user = User(name=name, email=email, is_admin=False, is_active=True)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()

        # Automatically sign the user in
        session['user_id'] = new_user.id

        if request.is_json:
            return jsonify({
                'status': 'ok',
                'redirect': url_for('user.dashboard'),
                'user': {'id': new_user.id, 'name': new_user.name, 'email': new_user.email, 'role': new_user.role}
            })
        return redirect(url_for('user.dashboard'))

    return render_template('auth/register.html')


@auth_bp.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        data = request.get_json(silent=True) or request.form
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''

        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            error_message = 'Invalid administrator credentials.'
            if request.is_json:
                return jsonify({'error': error_message}), 401
            return render_template('auth/admin_login.html', error_message=error_message, form_email=email)

        if not user.is_admin:
            error_message = 'Access denied: This account does not possess administrator privileges.'
            if request.is_json:
                return jsonify({'error': error_message}), 403
            return render_template('auth/admin_login.html', error_message=error_message, form_email=email)

        if not user.is_active:
            error_message = 'This administrator account is disabled.'
            if request.is_json:
                return jsonify({'error': error_message}), 403
            return render_template('auth/admin_login.html', error_message=error_message, form_email=email)

        session['user_id'] = user.id

        if request.is_json:
            return jsonify({'status': 'ok', 'redirect': url_for('admin.admin_dashboard')})
        return redirect(url_for('admin.admin_dashboard'))

    user = get_current_user()
    if user and user.is_admin:
        return redirect(url_for('admin.admin_dashboard'))
    return render_template('auth/admin_login.html')


@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    if request.is_json:
        return jsonify({'status': 'ok', 'redirect': url_for('auth.user_login')})
    return redirect(url_for('auth.user_login'))
