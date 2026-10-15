from datetime import datetime
from urllib.parse import urlparse
from flask import Blueprint, render_template, request, redirect, url_for, jsonify
from app.extensions import db
from app.models import Link
from app.helpers import generate_short_code, get_current_user

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


@short_bp.route('/short/create', methods=['POST'])
@short_bp.route('/create-short', methods=['POST'])
def create_short_url():
    """Public endpoint to create short URLs from landing page without requiring login."""
    data = request.get_json(silent=True) or request.form
    raw_url = (data.get('url') or data.get('destination_url') or '').strip()

    if not raw_url:
        return jsonify({'error': 'Please provide a destination URL.'}), 400

    parsed = urlparse(raw_url)
    if not parsed.scheme:
        raw_url = 'https://' + raw_url
        parsed = urlparse(raw_url)

    if parsed.scheme not in ['http', 'https'] or not parsed.netloc:
        return jsonify({'error': 'Please enter a valid URL starting with http:// or https://'}), 400

    existing = Link.query.filter_by(url=raw_url).filter(
        Link.short_code.isnot(None),
        Link.short_code != '',
        Link.status.in_(['active', 'Active'])
    ).first()

    current_user = get_current_user()

    if existing:
        short_code = existing.short_code
    else:
        short_code = generate_short_code()
        domain = parsed.netloc.replace('www.', '')
        title = domain.capitalize() if domain else 'Short Link'

        new_link = Link(
            title=title,
            url=raw_url,
            short_code=short_code,
            user_id=current_user.id if current_user else None,
            status='active',
            health='healthy',
            _is_favourite=0,
            _opens_count=0
        )
        db.session.add(new_link)
        db.session.commit()

    short_url = f"{request.host_url}s/{short_code}"
    display_url = f"https://lnk.sphere/{short_code}"

    return jsonify({
        'status': 'ok',
        'short_code': short_code,
        'short_url': short_url,
        'display_url': display_url
    })
