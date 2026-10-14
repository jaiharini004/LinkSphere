# LinkSphere — Full-Stack Flask & Supabase PostgreSQL Application

A centralized workspace to save, organise, share, and monitor web links, built with **Python Flask**, **Flask-SQLAlchemy**, **Supabase PostgreSQL**, and server-side **Jinja2 templates** preserving the modern glassmorphism design.

---

## 1. Tech Stack

- **Backend**: Python 3 & Flask
- **Database**: Supabase PostgreSQL (via `Flask-SQLAlchemy` and `psycopg[binary]`)
- **Authentication**: Secure Flask sessions & Werkzeug password hashing
- **Template Engine**: Jinja2 with modular components
- **Styling**: Vanilla CSS with glassmorphic aesthetic, responsive drawer, and dark/light themes
- **Environment**: `python-dotenv` for safe configuration

---

## 2. Project Structure

```text
LinkSphere/
├── app/                       # Modular Application Package
│   ├── __init__.py            # Application factory (create_app), extensions, blueprints
│   ├── config.py              # Configuration class loading environment variables
│   ├── extensions.py          # Shared extensions (SQLAlchemy instance)
│   ├── models.py              # Relational models (User, Category, Link, Team)
│   ├── helpers.py             # Auth decorators, short codes, and metrics
│   └── routes/                # Modular route blueprints
│       ├── __init__.py        # Package marker
│       ├── auth.py            # Login, register, admin login, logout, landing
│       ├── user.py            # Dashboard, links CRUD, categories, teams, settings
│       ├── short.py           # Short URL redirection (/s/<code/>) and resolver
│       └── admin.py           # Admin dashboard, users management, teams overview
├── app.py                     # Clean application entry point (`python app.py`)
├── config.py                  # Root configuration alias
├── requirements.txt           # Python dependencies
├── .env                       # Local environment variables (ignored by git)
├── .env.example               # Template for environment configuration
├── .gitignore                 # Excludes .env, virtual environments, and caches
├── test_backend.py            # Automated verification test suite
├── README.md                  # Setup guide and documentation
├── templates/                 # Server-rendered Jinja2 templates
│   ├── base.html              # Main application shell & global layout
│   ├── auth/                  # Authentication & public pages
│   │   ├── user_login.html    # User login & landing hero
│   │   ├── register.html      # New account registration
│   │   ├── admin_login.html   # Platform administrator sign-in
│   │   └── public_short_url.html # Public short URL lookup
│   ├── user/                  # Authenticated user pages
│   │   ├── dashboard.html     # Real-time metrics, frequently used & health donut
│   │   ├── my_links.html      # Saved links with search and health filters
│   │   ├── categories.html    # Personal categories
│   │   ├── teams.html         # User teams
│   │   ├── favourites.html    # Starred favourite links
│   │   ├── archive.html       # Archived links
│   │   ├── trash.html         # Trashed links with restore and permanent delete
│   │   └── settings.html      # User settings & dark/light theme switch
│   ├── admin/                 # Administrator portal
│   │   ├── dashboard.html     # Platform activity and system health metrics
│   │   ├── users.html         # User management (view, disable/enable, filter)
│   │   └── teams_resources.html # Platform team oversight
│   └── components/            # Reusable UI macros
│       ├── navbar.html        # Header with profile chip & POST sign out
│       ├── sidebar.html       # Sidebar navigation
│       ├── link_card.html     # Reusable glassmorphic link card macro
│       ├── metric_card.html   # Overview count cards
│       ├── modal.html         # Accessible modal dialog
│       └── toast.html         # Toast feedback container
└── static/
    ├── css/                   # Stylesheets
    │   ├── style.css          # Theme variables, glassmorphic layout, buttons
    │   ├── components.css     # Card and modal styles
    │   └── responsive.css     # Mobile viewport rules
    └── js/                    # Modular client-side interactions
        ├── main.js            # Theme switching, toast notifications, helpers
        ├── navigation.js      # Modal handling, mobile drawer, route transitions
        ├── links.js           # Add/Edit modals, copy URL, short link resolution
        └── forms.js           # Global event delegation, category & admin actions
```

---

## 3. Quick Start & Setup Instructions

### Step 1: Install Dependencies

Ensure Python 3.10+ is installed on your machine. Open a terminal in the project directory and run:

```bash
pip install -r requirements.txt
```

### Step 2: Configure Environment Variables

Copy `.env.example` to create your `.env` file:

```bash
cp .env.example .env
```

Open `.env` in any text editor:

```env
SECRET_KEY=generate_a_random_secret_key_here
DATABASE_URL=your_supabase_postgresql_connection_string
```

> **Note on Local Development**: If `DATABASE_URL` is left as placeholder or blank, LinkSphere automatically falls back to a local SQLite database (`sqlite:///linksphere.db`) so you can run and test the application immediately without an active Supabase project.

---

## 4. Supabase PostgreSQL Connection Setup

To connect LinkSphere to your live Supabase database:

1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Create a new project or select an existing one.
3. In your project, navigate to **Project Settings** (gear icon) &rarr; **Database**.
4. Scroll to **Connection string** and select the **URI** tab.
5. Choose **Transaction Pooler** (recommended for serverless/app platforms, port 6543) or **Direct connection** (port 5432).
6. Copy the URI and replace `[YOUR-PASSWORD]` with your actual Supabase database password.
7. Ensure `?sslmode=require` is present at the end of the connection string.
8. Paste the full URI into your `.env` file:

```env
DATABASE_URL=postgresql://postgres.yourprojectref:YourSecretPassword@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### Database Tables Created Automatically

On initial application startup, Flask-SQLAlchemy automatically executes `db.create_all()`, which provisions the following tables without destructive resets:

- `users`: ID, name, email (unique), password_hash, is_admin, is_active, created_at
- `categories`: ID, name, user_id (FK), created_at, unique constraint on `(user_id, name)`
- `links`: ID, title, url, short_code (unique), description, tags, category_id (FK), user_id (FK), status, health_status, is_favourite, click_count, last_clicked_at, created_at, updated_at
- `teams`: ID, name, owner_id (FK), created_at

### How to Promote a User to Administrator

To grant platform administrator privileges to any registered user, run this command in your **Supabase SQL Editor**:

```sql
UPDATE users
SET is_admin = true
WHERE email = 'youremail@example.com';
```

---

## 5. Running the Application

Start the Flask development server:

```bash
python app.py
```

The application will start on `http://127.0.0.1:5000/`.

### Pre-Seeded Starter Accounts (Instant Demo)

For immediate testing out of the box, LinkSphere initializes starter accounts when the database is empty:

| Account Type | Email | Password | Role | Access |
|---|---|---|---|---|
| Platform Admin | `admin@linksphere.demo` | `admin123` | Administrator | `/admin/dashboard`, `/admin/users`, `/admin/teams` |
| Standard User | `asha@example.com` | `user123` | User | `/dashboard`, `/links`, `/categories`, `/teams` |

---

## 6. Running the Automated Tests

LinkSphere includes a full automated verification test suite verifying all routes, ownership isolation, short URL redirects, and access control:

```bash
python test_backend.py
```

---

## 7. Working Routes Reference

| HTTP Method | Route | Endpoint Name | Description | Access |
|---|---|---|---|---|
| `GET` | `/` | `index` | Redirects to dashboard or login | Public |
| `GET`, `POST` | `/login` | `user_login` | User authentication & landing screen | Public |
| `GET`, `POST` | `/register` | `register` | Register new user account | Public |
| `GET`, `POST` | `/admin/login` | `admin_login` | Admin sign-in | Public |
| `POST` | `/logout` | `logout` | Clears session and logs out | Logged in |
| `GET` | `/dashboard` | `dashboard` | User dashboard with real metrics | User |
| `GET` | `/links` | `my_links` | List owned links with search & health filters | User |
| `GET`, `POST` | `/links/new` | `new_link` | Create new link & generate short code | User |
| `GET`, `POST` | `/links/<id>/edit` | `edit_link` | Edit owned link | Owner only |
| `POST` | `/links/<id>/favorite`| `toggle_favorite` | Toggle favorite star | Owner only |
| `POST` | `/links/<id>/archive` | `archive_link` | Move link to Archive | Owner only |
| `POST` | `/links/<id>/restore` | `restore_link` | Restore archived/trashed link | Owner only |
| `POST` | `/links/<id>/trash` | `trash_link` | Move link to Trash | Owner only |
| `POST` | `/links/<id>/delete` | `delete_link` | Permanently delete trashed link | Owner only |
| `GET` | `/favourites` | `favourites` | View starred links | User |
| `GET` | `/archive` | `archive` | View archived links | User |
| `GET` | `/trash` | `trash` | View deleted links in Trash | User |
| `GET`, `POST` | `/categories` | `categories` | List and create categories | User |
| `POST` | `/categories/<id>/delete`| `delete_category` | Delete category (blocked if active links exist) | Owner only |
| `GET`, `POST` | `/teams` | `teams` | List and create teams | User |
| `GET` | `/settings` | `settings` | View user profile and theme switch | User |
| `GET` | `/s/<short_code>` | `resolve_short_code` | Resolve short link, track clicks, redirect | Public |
| `GET`, `POST` | `/public` | `public_resolver` | Manual short link lookup screen | Public |
| `GET` | `/admin/dashboard` | `admin_dashboard` | Admin platform metrics overview | Admin only |
| `GET` | `/admin/users` | `admin_users` | Admin user list & status filtering | Admin only |
| `POST` | `/admin/users/<id>/toggle-status` | `admin_toggle_user` | Enable/disable user accounts | Admin only |
| `GET` | `/admin/teams` | `admin_teams` | Admin view of all platform teams | Admin only |
