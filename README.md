# LinkSphere — Modern Full-Stack Link Management & Collaboration Platform

LinkSphere is a centralized platform to bookmark, organize, share, monitor, and analyze web links. Built with **Python Flask**, **Flask-SQLAlchemy**, and **Supabase PostgreSQL**, LinkSphere pairs a sleek glassmorphic UI with automated short URL redirection, hierarchical category and folder workspaces, team collaboration, automated 5-minute link health monitoring, and n8n webhook automation.

---

## 1. Tech Stack

| Layer | Technologies & Tools |
|---|---|
| **Backend Framework** | Python 3.10+, Flask (App Factory & Blueprints) |
| **Database & ORM** | Supabase PostgreSQL, Flask-SQLAlchemy, `psycopg[binary]` *(with automatic SQLite local fallback)* |
| **Authentication & Security** | Flask Session authentication, Werkzeug password hashing, ownership isolation |
| **Automation & Scheduling** | Python daemon background threads (5-minute health check scheduler), n8n Webhooks |
| **HTTP & Networking** | `requests` (URL health verification & n8n webhook dispatch) |
| **Template Engine** | Jinja2 with modular macros, layout inheritance, and server-side rendering |
| **Frontend Styling** | Vanilla CSS3, Custom Glassmorphism design system, CSS Custom Properties, Responsive Grid & Flexbox |
| **Frontend Logic** | Vanilla JavaScript (ES6+), Event Delegation, Fetch API, Modal system, Toast engine |
| **Configuration** | `python-dotenv` for secure environment variable management |

---

## 2. Core Features

### 🔗 Link Management & Smart Shortening
- **Complete Link CRUD**: Save links with title, destination URL, description, category, folder, and comma-separated tags.
- **Automated Short URL Engine**: Generates unique, collision-resistant 6-character short codes (`/s/<short_code>`).
- **Click Tracking & Analytics**: Automatically increments click counts and records `last_clicked_at` timestamps on every redirect.
- **Full-Text Live Search & Health Filters**: Filter links across *All*, *Healthy*, *Unhealthy*, *Restricted*, *Not Verified*, and *Short URLs*.

### 📂 Hierarchical Organization (Category &rarr; Folder &rarr; Link Cards)
- **Scoped Categories**: Create Personal categories or shared Team categories.
- **Category Workspace (`/categories/<category_id>`)**:
  - Displays folder counts and an action bar to create folders, add category links, rename, or delete.
  - Dashed empty state box when no folders exist.
- **Folder Detail View (`/categories/<category_id>?folder_id=<folder_id>`)**:
  - Add links directly into designated folders.
  - Interactive folder cards showing link counts with Open, Rename, and Delete actions.
- **Safe Deletion Protection**:
  - Categories containing active links cannot be deleted until links are cleared or moved.
  - Deleting a folder preserves contained links by safely converting them into category-level loose links.

### ⭐ Favourites & Star Badges
- **1-Click Star Toggle**: Interactive golden star button (`★` / `☆`) on every card header and in the dropdown menu.
- **Dedicated Favourites Space**: Instantly access all starred links at `/favourites`.

### 🩺 Automated 5-Minute Link Health Monitoring
- **Background Daemon Scheduler**: Built-in background daemon thread (`LinkSphereHealthScheduler`) automatically tests URL availability across all active links **every 5 minutes** without requiring manual intervention.
- **Intelligent Reachability Detection**: Uses HTTP HEAD with automatic GET fallback to classify links into:
  - `✓ Healthy` (200–399)
  - `! Restricted` (401 / 403 authorization required)
  - `✕ Unhealthy` (404, 500, DNS failure, timeout)
- **Relative Timestamps**: Displays live relative check times (e.g., `just now`, `5m ago`, `2h ago`).
- **Manual Verification**: Option to trigger on-demand checks per link via **... More &rarr; Run Health Check**.

### 👥 Team Collaboration & n8n Email Invites
- **Collaborative Teams**: Create teams and share categories across teammates.
- **Teammate Invites**: Invite members with customizable roles (*Member* vs *Manager*).
- **n8n Automation Webhooks**:
  - `send_invitation_email(email, team, role, inviter)` sends payload to `N8N_INVITE_WEBHOOK_URL` authenticated with `X-Invite-Token`.
  - Link creation webhook notification for downstream workflows.

### 🗑️ Lifecycle & Recovery (Archive & Trash)
- **Soft Delete (Trash)**: Move links to Trash to disable short URLs while keeping them recoverable.
- **1-Click Restore**: Easily restore links back to Active.
- **Permanent Purge**: Permanently remove deleted links when desired.
- **Archive Space**: Archive completed or reference links without cluttering the main feed.

### 🛡️ Administration Portal
- **Admin Dashboard (`/admin/dashboard`)**: Platform-wide metrics, link health distributions, and user trends.
- **User Management (`/admin/users`)**: Search, filter, view details, and activate/deactivate user accounts.
- **Team Resource Oversight (`/admin/teams`)**: View all teams, managers, member counts, and associated categories.

---

## 3. Architecture & Data Flow

LinkSphere follows the **Application Factory pattern** with modular Flask Blueprints and a normalized relational database schema.

```
                           +-----------------------+
                           |  Client Browser (UI)  |
                           +-----------+-----------+
                                       |
                   HTTP Requests / REST API / Form Actions
                                       |
                                       v
                          +------------+------------+
                          |   Flask Application     |
                          |   (Factory Pattern)     |
                          +------------+------------+
                                       |
         +-----------------+-----------+-----------+-----------------+
         |                 |                       |                 |
         v                 v                       v                 v
   [Auth Blueprint]  [User Blueprint]       [Admin Blueprint]  [Short Blueprint]
   - /login          - /dashboard           - /admin/dashboard - /s/<code>
   - /register       - /links (CRUD)        - /admin/users     - Redirect & Click
   - /logout         - /categories & folders- /admin/teams       Tracking
                     - /teams & members
                     - /favourites, archive
                               |
         +---------------------+---------------------+
         |                                           |
         v                                           v
+--------+------------------+             +----------+-------------+
| Supabase PostgreSQL DB    |             | Automation Services    |
| (Flask-SQLAlchemy Models) |             |                        |
| - users                   |             | - 5-Min Health Daemon  |
| - categories              |             | - n8n Webhook Dispatch |
| - folders                 |             |   (Invites & Alerts)   |
| - links                   |             +------------------------+
| - teams                   |
+---------------------------+
```

### Relational Schema Diagram

```mermaid
erDiagram
    USERS ||--o{ LINKS : owns
    USERS ||--o{ CATEGORIES : creates
    USERS ||--o{ FOLDERS : creates
    USERS ||--o{ TEAMS : manages

    CATEGORIES ||--o{ FOLDERS : contains
    CATEGORIES ||--o{ LINKS : classifies
    FOLDERS ||--o{ LINKS : groups

    USERS {
        int id PK
        string name
        string email UK
        string password_hash
        boolean is_admin
        boolean is_active
        datetime created_at
    }

    CATEGORIES {
        int id PK
        string name
        int user_id FK
        string team_name
        datetime created_at
    }

    FOLDERS {
        int id PK
        string name
        int category_id FK
        int user_id FK
        datetime created_at
    }

    LINKS {
        int id PK
        string title
        text url
        string short_code UK
        text description
        text tags
        int category_id FK
        int folder_id FK
        int user_id FK
        string status
        string health
        int is_favourite
        int opens_count
        datetime last_checked
        datetime created_at
    }

    TEAMS {
        int id PK
        string name
        text description
        int manager_id FK
        datetime created_at
    }
```

---

## 4. Folder Structure

```text
LinkSphere/
├── app/                              # Modular Application Package
│   ├── __init__.py                   # App factory, blueprints, database seed, scheduler start
│   ├── config.py                     # Config class loading .env variables
│   ├── extensions.py                 # Shared Flask-SQLAlchemy instance
│   ├── models.py                     # Database models: User, Category, Folder, Link, Team
│   ├── helpers.py                    # Auth helpers, metrics, health checker, n8n invite functions
│   └── routes/                       # Modular blueprint routes
│       ├── __init__.py               # Route package marker
│       ├── auth.py                   # /login, /register, /admin/login, /logout, /
│       ├── user.py                   # Links CRUD, folders, categories, teams, favourites, archive
│       ├── short.py                  # Short link redirection (/s/<code>) & resolver
│       └── admin.py                  # Admin dashboard, user management, team resources
├── templates/                        # Server-rendered Jinja2 Templates
│   ├── base.html                     # Application base shell (header, sidebar, drawer)
│   ├── error.html                    # Unified error page (400, 403, 404, 500)
│   ├── auth/                         # Authentication views
│   │   ├── user_login.html           # User login modal & landing view
│   │   ├── register.html             # User registration
│   │   ├── admin_login.html          # Administrator login portal
│   │   └── public_short_url.html     # Public short code search
│   ├── user/                         # Authenticated user spaces
│   │   ├── dashboard.html            # Metrics overview, quick actions, health donut
│   │   ├── my_links.html             # Link grid with search & health status filters
│   │   ├── categories.html           # Categories, folder management & loose link cards
│   │   ├── teams.html                # Teams directory & team management view
│   │   ├── favourites.html           # Starred links view
│   │   ├── archive.html              # Archived links space
│   │   ├── trash.html                # Deleted links with restore & permanent delete
│   │   └── settings.html             # Profile settings & theme toggle
│   ├── admin/                        # Administrator views
│   │   ├── dashboard.html            # System overview & platform metrics
│   │   ├── users.html                # User directory, filter & toggle activation
│   │   └── teams_resources.html      # Platform team resource tracking
│   └── components/                   # Reusable UI macros
│       ├── navbar.html               # Top navigation bar
│       ├── sidebar.html              # Desktop & mobile sidebar navigation
│       ├── link_card.html            # Card macro with star button, health badge & menu
│       ├── metric_card.html          # Metric stat display card
│       ├── modal.html                # Accessible modal wrapper
│       └── toast.html                # Toast notification element
├── static/                           # Static Assets
│   ├── css/                          # Modern glassmorphism stylesheets
│   │   ├── style.css                 # Base theme variables, glass styling, typography
│   │   ├── components.css            # Component styles (cards, menus, badges, modals)
│   │   └── responsive.css            # Responsive layouts & mobile breakpoints
│   └── js/                           # Vanilla JavaScript client modules
│       ├── main.js                   # Theme switching, toast alerts, escape key listeners
│       ├── navigation.js             # Mobile drawer, navigation transitions, modals
│       ├── links.js                  # Link modal, health check triggers, star toggle, short links
│       └── forms.js                  # Event delegation, category & folder actions, team management
├── app.py                            # Application entry point (`python app.py`)
├── requirements.txt                  # Python dependencies
├── .env                              # Environment variables (secrets, DB URL, n8n webhook)
├── .env.example                      # Template for environment configuration
├── test_backend.py                   # Automated 20-suite end-to-end verification tests
└── README.md                         # Comprehensive documentation and setup guide
```

---

## 5. Setup & Installation Guide

### Prerequisites
- **Python 3.10** or higher
- A **Supabase account** (or local SQLite for zero-config testing)

### Step 1: Clone the Repository & Enter Directory
```bash
cd LinkSphere
```

### Step 2: Create and Activate a Virtual Environment
- **On Windows (PowerShell)**:
  ```powershell
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  ```
- **On Linux / macOS**:
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

### Step 3: Install Required Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables
Create your `.env` file by copying `.env.example`:
```bash
cp .env.example .env
```

Open `.env` and fill in your settings:
```env
# Flask Secret Key
SECRET_KEY=your_secure_random_secret_key

# Supabase PostgreSQL Connection URL
# Using Transaction Pooler (recommended for port 6543):
DATABASE_URL=postgresql://postgres.yourprojectref:YourPassword@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require

# n8n Automation Webhooks
N8N_INVITE_WEBHOOK_URL=https://your-n8n-instance.app.n8n.cloud/webhook/linksphere-invite
N8N_INVITE_TOKEN=your_generated_secret_token

# Optional Link Created Webhook
# N8N_WEBHOOK_URL=https://your-n8n-instance.app.n8n.cloud/webhook/linksphere-link-created
```

> **Local SQLite Fallback**: If `DATABASE_URL` is omitted or empty, LinkSphere automatically connects to `sqlite:///linksphere.db` locally.

### Step 5: Run Database Initialization & Start Server
```bash
python app.py
```
LinkSphere will start on `http://127.0.0.1:5000/`.

---

## 6. Pre-Seeded Starter Accounts

For immediate testing, LinkSphere automatically seeds demo accounts when launched with a clean database:

| Account Type | Email | Password | Access Privileges |
|---|---|---|---|
| **Platform Admin** | `admin@linksphere.demo` | `admin123` | Platform oversight (`/admin/dashboard`, `/admin/users`, `/admin/teams`) |
| **Standard User** | `asha@example.com` | `user123` | Personal workspace (`/dashboard`, `/links`, `/categories`, `/teams`) |

---

## 7. Running the Automated Test Suite

LinkSphere includes an automated test suite (`test_backend.py`) covering all features in an isolated test database:

```bash
python test_backend.py
```

### Verified Test Suites:
1. User registration & Werkzeug password hashing
2. User login & authenticated session creation
3. Link creation with short code generation and health status
4. Search queries & health filter chips
5. User isolation & multi-tenant security (403 Forbidden enforcement)
6. Category delete protection (prevents deleting categories with active links)
7. Short URL redirection (`/s/<code>`), click count increments, & timestamping
8. Non-existent short code 404 handling
9. Account deactivation enforcement
10. Admin authentication & dashboard statistics
11. Admin teams overview & system resource distribution
12. Custom styled 404 error page rendering
13. Favourites view & dropdown menus
14. Team detail view & manager controls
15. Admin search bar layout optimization
16. Trash soft deletion & 1-click restoration
17. Category folder workspace, folder creation, link cards in folders, and folder deletion
18. Favourites toggle API (`POST /links/<id>/favorite`) and view updates
19. Automatic 5-minute background link health checking & manual verification
20. n8n team member invitation webhook (`send_invitation_email`) with token authentication

---

## 8. API & Route Reference

### Public & Authentication
- `GET /` — Redirects to Dashboard (if authenticated) or Login landing view.
- `GET, POST /login` — User authentication.
- `GET, POST /register` — User registration.
- `GET, POST /admin/login` — Administrator authentication.
- `POST /logout` — Session termination.
- `GET /s/<short_code>` — Public short link redirect with click analytics.
- `GET, POST /public` — Public short URL manual resolution page.

### User Workspace & Links
- `GET /dashboard` — Dashboard overview with metrics, top links, and health chart.
- `GET /links` — Filtered link feed (`?q=...&filter=healthy|unhealthy|restricted|notverified|short`).
- `POST /links/new` — Create a new link (supports `category_id` and `folder_id`).
- `GET, POST /links/<id>/edit` — Edit link metadata, tags, and category.
- `POST /links/<id>/favorite` — Toggle star status (`is_favourite`).
- `POST /links/<id>/health-check` — Perform immediate HTTP health check on link destination.
- `POST /links/health-check-all` — Check health of all active links for the user.
- `POST /links/<id>/archive` — Move link to Archive.
- `POST /links/<id>/restore` — Restore archived or trashed link to Active.
- `POST /links/<id>/trash` — Soft delete link to Trash.
- `POST /links/<id>/delete` — Permanently purge link.
- `GET /favourites` — View starred links.
- `GET /archive` — View archived links.
- `GET /trash` — View trashed links with restore and purge actions.

### Categories & Folders
- `GET, POST /categories` — List all categories or create a new category.
- `GET /categories/<category_id>` — Category workspace view with folders and loose link cards.
- `POST /categories/<category_id>/rename` — Rename category.
- `POST /categories/<category_id>/delete` — Delete category (safely blocked if active links exist).
- `POST /categories/<category_id>/folders` — Create a folder inside category.
- `POST /folders/<folder_id>/rename` — Rename folder.
- `POST /folders/<folder_id>/delete` — Delete folder (moves links to category loose links).

### Teams & Webhooks
- `GET, POST /teams` — View user teams or create a new team.
- `GET /teams/<team_id>` — Team detail workspace with manager controls, shared categories, and links.
- `POST /teams/<team_id>/edit` — Edit team name and description.
- `POST /teams/<team_id>/delete` — Delete team (owned categories revert to personal).
- `POST /teams/<team_id>/categories` — Create a category scoped to the team.
- `POST /teams/<team_id>/members` — Invite teammate by email; triggers `send_invitation_email` to n8n webhook.
- `GET /settings` — User preferences and light/dark theme switch.

### Administrator Portal
- `GET /admin/dashboard` — Platform overview, system metrics, and activity charts.
- `GET /admin/users` — User management directory with search and active/inactive filters.
- `POST /admin/users/<id>/toggle-status` — Enable or disable a user account.
- `GET /admin/teams` — Platform team resources and manager directory.

---

## 9. Features That Can Be Added (Future Roadmap)

Here are high-impact enhancements planned for future LinkSphere releases:

1. **Browser Extension (Chrome / Firefox / Edge)**
   - 1-click bookmarking tool directly from any active browser tab.
   - Automatically parses page metadata (title, favicon, description) and adds the link to a chosen category and folder.

2. **QR Code Generator**
   - Automatically generate and display downloadable SVG/PNG QR codes for every short URL to easily share links on mobile devices and physical presentations.

3. **Link Preview Cards & OpenGraph Scraper**
   - Automatically fetch OpenGraph metadata and images when pasting a destination URL to display rich preview cards.

4. **Tag Autocomplete & Tag Cloud Explorer**
   - Interactive tag cloud on the dashboard and intelligent auto-suggestions while creating or editing links.

5. **Advanced Click Analytics & Referrer Breakdown**
   - Detailed charts showing clicks over time, geographic distribution (country/city), referring domains, and browser user agents.

6. **Automated Broken Link Alerts (Slack / Discord / Email)**
   - When the 5-minute background health check detects an unhealthy link (404/500), dispatch instant alert webhooks via n8n to Slack, Discord, or email.

7. **Bulk Link Import & Export**
   - Import links from standard browser bookmark exports (HTML files), Pocket, or Raindrop.
   - Export all saved links as JSON, CSV, or formatted Markdown.

8. **Two-Factor Authentication (2FA / TOTP)**
   - Time-based one-time password authentication (Google Authenticator, Authy) for extra security on user and administrator accounts.

---

## 10. License

This project is licensed under the MIT License. Feel free to use, modify, and distribute LinkSphere for personal and commercial projects.
