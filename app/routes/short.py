from datetime import datetime
from flask import Blueprint, render_template, request, redirect, url_for
from app.extensions import db
from app.models import Link

short_bp = Blueprint('short', __name__)

@short_bp.route('/s/<short_code>')
def resolve_short_code(short_code):
    link = Link.query.filter_by(short_code=short_code).first()

    if not link:
        return render_template(
            'auth/public_short_url.html',
            error_message=f"Short URL '{short_code}' was not found.",
            initial_code=short_code,
        ), 404

    if link.status.lower() in ['deleted', 'trash']:
        return render_template(
            'auth/public_short_url.html',
            error_message="This link is currently in the Trash and unavailable.",
            initial_code=short_code,
        ), 404

    if link.status.lower() in ['archived', 'archive']:
        return render_template(
            'auth/public_short_url.html',
            error_message="This link has been archived and is currently unavailable.",
            initial_code=short_code,
        ), 404

    # Increment click count and update last clicked time
    link.click_count += 1
    link.last_clicked_at = datetime.utcnow()
    db.session.commit()

    return redirect(link.url)


@short_bp.route('/public', methods=['GET', 'POST'])
def public_resolver():
    """Manual lookup screen for short URLs."""
    if request.method == 'POST':
        data = request.get_json(silent=True) or request.form
        code_input = (data.get('code') or '').strip()
        code = code_input.rstrip('/').split('/')[-1] if code_input else ''
        return redirect(url_for('short.resolve_short_code', short_code=code))
    return render_template('auth/public_short_url.html')
