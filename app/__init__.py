
import os

from flask import Flask, render_template, request, jsonify

from app.config import Config
from app.extensions import db
from app.models import User, Category, Link, Team
from app.helpers import get_current_user, compute_user_metrics
from app.routes.auth import auth_bp
from app.routes.user import user_bp
from app.routes.short import short_bp
from app.routes.admin import admin_bp


def seed_initial_data():
    """Seed starter accounts and sample records if the database is empty."""

    if not User.query.first():
        print("[LinkSphere] Seeding starter accounts for demonstration...")

        admin_user = User(
            name="Platform Admin",
            email="admin@linksphere.demo",
            is_admin=True,
            is_active=True,
        )
        admin_user.set_password("admin123")
        db.session.add(admin_user)

        demo_user = User(
            name="Asha Raman",
            email="asha@example.com",
            is_admin=False,
            is_active=True,
        )
        demo_user.set_password("user123")
        db.session.add(demo_user)
        db.session.flush()

        # Starter categories
        cat_work = Category(name="Work", user_id=demo_user.id)
        cat_study = Category(name="College", user_id=demo_user.id)
        cat_inspire = Category(name="Inspiration", user_id=demo_user.id)

        db.session.add_all([cat_work, cat_study, cat_inspire])
        db.session.flush()

        # Starter links
        link1 = Link(
            title="Flask Documentation",
            url="https://flask.palletsprojects.com",
            short_code="flask99",
            description=(
                "Official documentation for the Flask Python micro-framework."
            ),
            _tags="python, flask, web",
            category_id=cat_work.id,
            user_id=demo_user.id,
            status="Active",
            health_status="Healthy",
            is_favourite=True,
            click_count=12,
        )

        link2 = Link(
            title="Supabase Documentation",
            url="https://supabase.com/docs",
            short_code="supa42",
            description=(
                "Supabase is an open source Firebase alternative "
                "built on PostgreSQL."
            ),
            _tags="database, postgres, supabase",
            category_id=cat_work.id,
            user_id=demo_user.id,
            status="Active",
            health_status="Healthy",
            is_favourite=True,
            click_count=8,
        )

        link3 = Link(
            title="PostgreSQL Official Site",
            url="https://www.postgresql.org",
            short_code="pgdoc1",
            description=(
                "The world's most advanced open source relational database."
            ),
            _tags="sql, relational, database",
            category_id=cat_study.id,
            user_id=demo_user.id,
            status="Active",
            health_status="Not Verified",
            is_favourite=False,
            click_count=3,
        )

        db.session.add_all([link1, link2, link3])

        # Starter team
        team1 = Team(
            name="Design Club",
            owner_id=demo_user.id,
        )
        db.session.add(team1)

        db.session.commit()
        print("[LinkSphere] Seed completed successfully.")


def create_app(config_class=Config):
    """Create and configure the Flask application."""

    # Locate templates and static directories relative to project root.
    base_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..")
    )

    templates_dir = os.path.join(base_dir, "templates")
    static_dir = os.path.join(base_dir, "static")

    app = Flask(
        __name__,
        template_folder=templates_dir,
        static_folder=static_dir,
    )

    app.config.from_object(config_class)

    # Initialize database extension.
    db.init_app(app)

    # Register blueprints.
    app.register_blueprint(auth_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(short_bp)
    app.register_blueprint(admin_bp)

    # Make common values available to Jinja2 templates.
    @app.context_processor
    def inject_globals():
        user = get_current_user()
        is_admin = bool(user and user.is_admin)

        metrics = (
            compute_user_metrics(user)
            if user and not is_admin
            else {}
        )

        return {
            "current_user": user,
            "is_admin": is_admin,
            "metrics": metrics,
        }

    # Add short endpoint aliases for existing templates.
    existing_endpoints = {
        rule.endpoint for rule in app.url_map.iter_rules()
    }

    for rule in list(app.url_map.iter_rules()):
        if "." in rule.endpoint:
            short_name = rule.endpoint.split(".", 1)[1]

            if short_name not in existing_endpoints:
                existing_endpoints.add(short_name)

                methods = list(
                    rule.methods - {"OPTIONS", "HEAD"}
                )

                app.add_url_rule(
                    rule.rule,
                    endpoint=short_name,
                    view_func=app.view_functions[rule.endpoint],
                    methods=methods,
                )

    # Handle HTTP 400 errors.
    @app.errorhandler(400)
    def handle_bad_request(error):
        if request.is_json or request.path.startswith("/api"):
            return jsonify({
                "error": "Bad request",
                "details": str(error),
            }), 400

        return render_template(
            "error.html",
            error_code=400,
            error_title="Bad Request",
            error_message=(
                "The server could not understand your request. "
                "Please check your input and try again."
            ),
        ), 400

    # Handle HTTP 403 errors.
    @app.errorhandler(403)
    def handle_forbidden(error):
        if request.is_json or request.path.startswith("/api"):
            return jsonify({
                "error": "Forbidden access",
            }), 403

        return render_template(
            "error.html",
            error_code=403,
            error_title="Access Denied",
            error_message=(
                "You do not have permission to access this resource."
            ),
        ), 403

    # Handle HTTP 404 errors.
    @app.errorhandler(404)
    def handle_not_found(error):
        if request.is_json or request.path.startswith("/api"):
            return jsonify({
                "error": "Resource not found",
            }), 404

        return render_template(
            "error.html",
            error_code=404,
            error_title="Page Not Found",
            error_message=(
                "The page, link, or resource you are looking for "
                "does not exist or has been moved."
            ),
        ), 404

    # Handle HTTP 500 errors.
    @app.errorhandler(500)
    def handle_internal_server_error(error):
        db.session.rollback()

        if request.is_json or request.path.startswith("/api"):
            return jsonify({
                "error": "Internal server error",
            }), 500

        return render_template(
            "error.html",
            error_code=500,
            error_title="Internal Server Error",
            error_message=(
                "A server error occurred while processing your request. "
                "Please try again shortly."
            ),
        ), 500

    # Handle unexpected exceptions.
    @app.errorhandler(Exception)
    def handle_generic_exception(error):
        from werkzeug.exceptions import HTTPException

        if isinstance(error, HTTPException):
            return error

        db.session.rollback()

        # Log the exception for debugging without exposing it to users.
        app.logger.exception("Unexpected application error")

        if request.is_json or request.path.startswith("/api"):
            return jsonify({
                "error": "An unexpected server error occurred",
            }), 500

        return render_template(
            "error.html",
            error_code=500,
            error_title="Unexpected Error",
            error_message=(
                "An unexpected error occurred while processing "
                "your request."
            ),
        ), 500

    # Initialize database tables and seed demo data.
    with app.app_context():
        try:
            db.create_all()
            seed_initial_data()
        except Exception:
            db.session.rollback()
            app.logger.exception(
                "Database initialization or seeding failed"
            )

    # Background schedulers are disabled by default.
    # Use n8n for recurring health checks in Vercel deployments.
    if (
        not app.config.get("TESTING", False)
        and app.config.get("ENABLE_HEALTH_SCHEDULER", False)
    ):
        from app.helpers import start_health_scheduler
        start_health_scheduler(app)

    return app


# Export the default Flask application instance.
app = create_app()
