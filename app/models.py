from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.Text, nullable=False)
    role_str = db.Column('role', db.String(50), default='user', nullable=False)
    status_str = db.Column('status', db.String(50), default='Active', nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    categories = db.relationship('Category', backref='user', lazy=True, cascade='all, delete-orphan')
    links = db.relationship('Link', backref='user', lazy=True, cascade='all, delete-orphan')
    teams = db.relationship('Team', backref='owner', foreign_keys='Team.leader_id', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def is_admin(self):
        return (self.role_str or '').lower() == 'admin'

    @is_admin.setter
    def is_admin(self, val):
        self.role_str = 'admin' if val else 'user'

    @property
    def is_active(self):
        return (self.status_str or '').lower() == 'active'

    @is_active.setter
    def is_active(self, val):
        self.status_str = 'Active' if val else 'Disabled'

    @property
    def role(self):
        return 'Admin' if self.is_admin else 'User'

    @property
    def status(self):
        return 'Active' if self.is_active else 'Disabled'

    @property
    def registered_date(self):
        return self.created_at.strftime('%b %d, %Y') if self.created_at else 'Recent'

    @property
    def teams_label(self):
        try:
            teams_as_leader = Team.query.filter_by(leader_id=self.id).all()
            teams_as_people = Team.query.join(Teampeople, Teampeople.team_id == Team.id).filter(
                (Teampeople.user_id == self.id) | (Teampeople.email == self.email)
            ).all()
            team_names = list({t.name for t in (teams_as_leader + teams_as_people)})
            return ', '.join(sorted(team_names)) if team_names else '-'
        except Exception:
            return '-'



class Category(db.Model):
    __tablename__ = 'categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    team_name = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    @property
    def active_links_count(self):
        return Link.query.filter(
            Link.category_id == self.id,
            Link.status.in_(['active', 'Active'])
        ).count()

    @property
    def folders_count(self):
        return Folder.query.filter_by(category_id=self.id).count()

    @property
    def can_manage(self):
        return True


class Folder(db.Model):
    __tablename__ = 'folders'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    category = db.relationship('Category', backref=db.backref('folders', lazy=True, cascade='all, delete-orphan'))
    links = db.relationship('Link', backref='folder', lazy=True)

    @property
    def links_count(self):
        return Link.query.filter(
            Link.folder_id == self.id,
            Link.status.in_(['active', 'Active'])
        ).count()


class Link(db.Model):
    __tablename__ = 'links'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    url = db.Column(db.Text, nullable=False)
    short_code = db.Column(db.String(20), unique=True, nullable=False, index=True)
    description = db.Column(db.Text, nullable=True)
    _tags = db.Column('tags', db.Text, nullable=True)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id', ondelete='SET NULL'), nullable=True)
    folder_id = db.Column(db.Integer, db.ForeignKey('folders.id', ondelete='SET NULL'), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=True)
    status = db.Column(db.String(50), default='active', nullable=False)  # 'active', 'archive', 'trash'
    health = db.Column('health', db.String(50), default='notverified', nullable=False)  # 'healthy', 'unhealthy', 'restricted', 'notverified'
    _is_favourite = db.Column('is_favourite', db.Integer, default=0, nullable=False)
    _opens_count = db.Column('opens_count', db.Integer, default=0, nullable=False)
    last_checked = db.Column('last_checked', db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    category = db.relationship('Category', backref=db.backref('links', lazy=True))

    @property
    def tags(self):
        if not self._tags:
            return []
        return [t.strip() for t in self._tags.split(',') if t.strip()]

    @tags.setter
    def tags(self, val):
        if isinstance(val, list):
            self._tags = ', '.join(val)
        elif val is None:
            self._tags = ''
        else:
            self._tags = str(val).strip()

    @property
    def category_name(self):
        return self.category.name if self.category else 'No category'

    @property
    def folder_name(self):
        return self.folder.name if self.folder else ''

    @property
    def owner_label(self):
        return 'Personal'

    @property
    def health_status(self):
        h = (self.health or 'notverified').lower().replace(' ', '')
        if h == 'healthy':
            return 'Healthy'
        elif h == 'unhealthy':
            return 'Unhealthy'
        elif h == 'restricted':
            return 'Restricted'
        return 'Not Verified'

    @health_status.setter
    def health_status(self, val):
        self.health = (val or 'notverified').lower().replace(' ', '')

    @property
    def is_favourite(self):
        return bool(self._is_favourite)

    @is_favourite.setter
    def is_favourite(self, val):
        self._is_favourite = 1 if val else 0

    @property
    def click_count(self):
        return self._opens_count or 0

    @click_count.setter
    def click_count(self, val):
        self._opens_count = val or 0

    @property
    def last_clicked_at(self):
        return self.last_checked

    @last_clicked_at.setter
    def last_clicked_at(self, val):
        self.last_checked = val

    @property
    def last_checked_text(self):
        if not self.last_checked:
            return 'recently'
        diff = datetime.utcnow() - self.last_checked
        seconds = max(0, int(diff.total_seconds()))
        if seconds < 60:
            return 'just now'
        elif seconds < 3600:
            m = seconds // 60
            return f'{m}m ago'
        elif seconds < 86400:
            h = seconds // 3600
            return f'{h}h ago'
        else:
            return self.last_checked.strftime('%b %d')

    @property
    def can_manage(self):
        return True

    @property
    def uses(self):
        return self.click_count


class Team(db.Model):
    __tablename__ = 'teams'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    leader_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    @property
    def leader(self):
        return self.owner

    @property
    def owner_id(self):
        return self.leader_id

    @owner_id.setter
    def owner_id(self, val):
        self.leader_id = val

    @property
    def leader_name(self):
        return self.owner.name if self.owner else '-'

    @property
    def leaders_label(self):
        return self.leader_name

    @property
    def peoples_list(self):
        try:
            return Teampeople.query.filter_by(team_id=self.id).order_by(Teampeople.created_at.asc()).all()
        except Exception:
            return []

    @property
    def peoples_count(self):
        try:
            other_count = Teampeople.query.filter(
                Teampeople.team_id == self.id,
                (Teampeople.user_id != self.leader_id) | (Teampeople.user_id.is_(None))
            ).count()
            return 1 + other_count
        except Exception:
            return 1

    @property
    def shared_categories_count(self):
        return Category.query.filter_by(team_name=self.name).count()

    @property
    def active_links_count(self):
        cats = Category.query.filter_by(team_name=self.name).all()
        if not cats:
            return 0
        cat_ids = [c.id for c in cats]
        return Link.query.filter(Link.category_id.in_(cat_ids), Link.status.in_(['active', 'Active'])).count()

    @property
    def user_role(self):
        return 'leader'


class Teampeople(db.Model):
    __tablename__ = 'team_peoples'

    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=True)
    email = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(50), default='people', nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('team_peopleships', lazy=True, cascade='all, delete-orphan'))
    team = db.relationship('Team', foreign_keys=[team_id], backref=db.backref('peoples', lazy=True, cascade='all, delete-orphan'))

    @property
    def people_name(self):
        if self.user and self.user.name:
            return self.user.name
        return self.email.split('@')[0]

