/* =====================================================================
   LinkSphere - script.js
   A frontend-only PROTOTYPE written with plain JavaScript.
   There is no server or database: all data lives in the `data` object and
   is saved in the browser's localStorage so it survives a page refresh.
   Nothing here is real security, real URL shortening or real link checking.

   Sections:
    1. Constants and icons            8. Modal and toast helpers
    2. Sample data + localStorage     9. Navigation and page shell
    3. Small helper functions        10. User pages (render functions)
    4. Lookups and permissions       11. Link actions
    5. Metrics (dashboard counts)    12. Categories, folders, teams
    6. Health check simulation       13. Admin actions
    7. Short URL simulation          14. Login / sign out and events
   ===================================================================== */
'use strict';

/* ---------------------------------------------------------------------
   1. CONSTANTS AND ICONS
   --------------------------------------------------------------------- */
const STORAGE_KEY = 'linksphere_demo_v2'; // name of the localStorage entry
const SHORT_DOMAIN = 'lnk.sphere';        // fake domain used for demo short URLs

// Inner SVG shapes for the simple line icons used across the app.
const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.2a5 5 0 0 1 4.5 5"/>',
  star: '<path d="M12 3.5l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.9l6-.9z"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1.5"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>'
};

// Builds one <svg> icon string from a name in ICONS.
function icon(name) {
  return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>';
}

// The LinkSphere sphere logo (a circle with orbit lines).
function logoSvg() {
  return '<svg viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="20" cy="20" r="15"/><ellipse cx="20" cy="20" rx="15" ry="6"/><path d="M20 5v30"/></svg>';
}

// Page settings: title, sidebar label/icon, whether the search bar shows, and the top action button.
const PAGES = {
  overview:   { title: 'Dashboard',  label: 'Dashboard',  icon: 'grid',     search: false, action: null },
  links:      { title: 'My Link',    label: 'My Link',    icon: 'link',     search: true,  action: 'Add Link',        searchHint: 'Search name, category or tags' },
  categories: { title: 'Categories', label: 'Categories', icon: 'folder',   search: true,  action: 'Create Category', searchHint: 'Search categories or folders' },
  teams:      { title: 'Teams',      label: 'Teams',      icon: 'users',    search: true,  action: 'Create Team',     searchHint: 'Search teams' },
  favourites: { title: 'Favourites', label: 'Favourites', icon: 'star',     search: true,  action: null,              searchHint: 'Search name, category or tags' },
  archive:    { title: 'Archive',    label: 'Archive',    icon: 'archive',  search: true,  action: null,              searchHint: 'Search archived links' },
  trash:      { title: 'Trash',      label: 'Trash',      icon: 'trash',    search: true,  action: null,              searchHint: 'Search deleted links' },
  settings:   { title: 'Settings',   label: 'Settings',   icon: 'settings', search: false, action: null },
  adminOverview: { title: 'Admin Dashboard',         label: 'Overview',          icon: 'grid',   search: false, action: null },
  adminUsers:    { title: 'User Management',         label: 'User Management',   icon: 'user',   search: false, action: null },
  adminTeams:    { title: 'Teams & Platform Resources', label: 'Teams & Resources', icon: 'box', search: false, action: null }
};
const USER_NAV = ['overview', 'links', 'categories', 'teams', '-', 'favourites', 'archive', 'trash', 'settings'];
const ADMIN_NAV = ['adminOverview', 'adminUsers', 'adminTeams'];

// Names shown to the user for each health status.
const HEALTH_LABELS = { healthy: 'Healthy', unhealthy: 'Unhealthy', restricted: 'Restricted', notverified: 'Not Verified' };
const HEALTH_GLYPHS = { healthy: '✓', unhealthy: '✕', restricted: '!', notverified: '?' };

/* ---------------------------------------------------------------------
   2. SAMPLE DATA AND LOCALSTORAGE
   --------------------------------------------------------------------- */
function minsAgo(n) { return Date.now() - n * 60000; }
function daysAgo(n) { return Date.now() - n * 86400000; }

// Creates one link object, filling in defaults for anything not given.
function makeLink(values) {
  const defaults = {
    description: '', tags: [], folderId: '', state: 'Active', health: 'notverified',
    lastChecked: null, uses: 0, shortCode: '', checkStep: 0, uncertainCount: 0, createdAt: Date.now()
  };
  return Object.assign(defaults, values);
}

// Builds the starting demo data (used the first time, or after "Reset demo data").
function createSampleData() {
  return {
    session: null,                                  // { userId } when signed in
    settings: { compact: false, showDescriptions: true, theme: 'light' },
    nextId: 100,                                    // counter for new ids
    users: [
      { id: 'u1', name: 'Asha Raman',   email: 'asha@example.com',  role: 'User',  status: 'Active',   registered: daysAgo(150) },
      { id: 'u2', name: 'Ravi Kumar',   email: 'ravi@example.com',  role: 'User',  status: 'Active',   registered: daysAgo(120) },
      { id: 'u3', name: 'Meena Sundar', email: 'meena@example.com', role: 'User',  status: 'Active',   registered: daysAgo(90) },
      { id: 'u4', name: 'Karthik Nair', email: 'karthik@example.com', role: 'User', status: 'Disabled', registered: daysAgo(60) },
      { id: 'u5', name: 'Divya Iyer',   email: 'divya@example.com', role: 'User',  status: 'Active',   registered: daysAgo(20) },
      { id: 'u6', name: 'Arjun Das',    email: 'arjun@example.com', role: 'User',  status: 'Active',   registered: daysAgo(3) },
      { id: 'a1', name: 'Platform Admin', email: 'admin@linksphere.demo', role: 'Admin', status: 'Active', registered: daysAgo(300) }
    ],
    teams: [
      { id: 't1', name: 'Design Club',    description: 'Design systems, UI kits, inspirations and visual assets for creative projects.', members: [{ userId: 'u1', role: 'Manager' }, { userId: 'u3', role: 'Member' }, { userId: 'u5', role: 'Member' }] },
      { id: 't2', name: 'Study Group',    description: 'Collaborative exam preparation, course notes, timetables and past papers.', members: [{ userId: 'u2', role: 'Manager' }, { userId: 'u1', role: 'Member' }, { userId: 'u4', role: 'Member' }] },
      { id: 't3', name: 'Marketing Team', description: 'Brand assets, quarterly campaign materials and public promotion resources.', members: [{ userId: 'u6', role: 'Manager' }, { userId: 'u3', role: 'Member' }] }
    ],
    // ownerType 'user' = personal category, 'team' = shared category
    categories: [
      { id: 'c1',  name: 'College',          ownerType: 'user', ownerId: 'u1' },
      { id: 'c2',  name: 'Work',             ownerType: 'user', ownerId: 'u1' },
      { id: 'c3',  name: 'Inspiration',      ownerType: 'user', ownerId: 'u1' },
      { id: 'c10', name: 'Design Resources', ownerType: 'team', ownerId: 't1' },
      { id: 'c11', name: 'Exam Prep',        ownerType: 'team', ownerId: 't2' },
      { id: 'c12', name: 'Campaign Assets',  ownerType: 'team', ownerId: 't3' },
      { id: 'c13', name: 'Recipes',          ownerType: 'user', ownerId: 'u2' }
    ],
    folders: [
      { id: 'f1', categoryId: 'c1',  name: 'Semester 5' },
      { id: 'f2', categoryId: 'c1',  name: 'Assignments' },
      { id: 'f3', categoryId: 'c2',  name: 'Documentation' },
      { id: 'f4', categoryId: 'c2',  name: 'Planning' },
      { id: 'f5', categoryId: 'c10', name: 'UI Kits' },
      { id: 'f6', categoryId: 'c11', name: 'Past Papers' }
    ],
    links: [
      makeLink({ id: 'l1',  title: 'Semester 5 Notes', url: 'https://example.com/docs/semester-5', description: 'Course notes and reading list', tags: ['study', 'notes', 'exams'], categoryId: 'c1', folderId: 'f1', createdBy: 'u1', health: 'healthy', lastChecked: minsAgo(2), uses: 14, shortCode: 'sem5Kx', createdAt: daysAgo(2) }),
      makeLink({ id: 'l2',  title: 'MDN Web Docs', url: 'https://developer.mozilla.org', description: 'Reference for HTML, CSS and JavaScript', tags: ['web', 'docs'], categoryId: 'c2', folderId: 'f3', createdBy: 'u1', health: 'healthy', lastChecked: minsAgo(3), uses: 22, createdAt: daysAgo(5) }),
      makeLink({ id: 'l3',  title: 'Assignment Tracker', url: 'https://example.com/assignments', description: 'Deadlines for this semester', tags: ['study', 'deadlines'], categoryId: 'c1', folderId: 'f2', createdBy: 'u1', health: 'healthy', lastChecked: minsAgo(4), uses: 9, createdAt: daysAgo(3) }),
      makeLink({ id: 'l4',  title: 'University Portal', url: 'https://portal.example.edu/login', description: 'Student login portal', tags: ['college'], categoryId: 'c1', createdBy: 'u1', health: 'restricted', lastChecked: minsAgo(9), uses: 31, createdAt: daysAgo(20) }),
      makeLink({ id: 'l5',  title: 'Old Course Page', url: 'https://example.edu/old-course', description: 'Last year\'s course page', tags: ['college', 'archive'], categoryId: 'c1', createdBy: 'u1', health: 'unhealthy', lastChecked: minsAgo(14), uses: 2, createdAt: daysAgo(40) }),
      makeLink({ id: 'l6',  title: 'GitHub Docs', url: 'https://docs.github.com', description: 'Guides for Git and GitHub', tags: ['git', 'docs'], categoryId: 'c2', folderId: 'f3', createdBy: 'u1', health: 'healthy', lastChecked: minsAgo(6), uses: 17, shortCode: 'gh7Qp2', createdAt: daysAgo(8) }),
      makeLink({ id: 'l7',  title: 'Project Roadmap', url: 'https://example.com/roadmap', description: 'Quarterly plan', tags: ['planning'], categoryId: 'c2', folderId: 'f4', createdBy: 'u1', health: 'notverified', lastChecked: null, uses: 4, createdAt: daysAgo(1) }),
      makeLink({ id: 'l8',  title: 'Colour Palette Tool', url: 'https://example.com/palettes', description: 'Pick colours for projects', tags: ['design', 'colour'], categoryId: 'c3', createdBy: 'u1', health: 'healthy', lastChecked: minsAgo(1), uses: 11, createdAt: daysAgo(6) }),
      makeLink({ id: 'l9',  title: 'Typography Guide', url: 'https://example.com/type-guide-404', description: 'Choosing fonts', tags: ['design', 'fonts'], categoryId: 'c3', createdBy: 'u1', health: 'unhealthy', lastChecked: minsAgo(12), uses: 3, createdAt: daysAgo(9) }),
      makeLink({ id: 'l10', title: 'Design Podcast', url: 'https://example.com/podcast', description: 'Weekly design talks', tags: ['design', 'audio'], categoryId: 'c3', createdBy: 'u1', health: 'healthy', lastChecked: minsAgo(5), uses: 6, createdAt: daysAgo(12) }),
      makeLink({ id: 'l11', title: 'Old Timetable', url: 'https://example.com/timetable-2025', description: 'Last year\'s timetable', tags: ['college'], categoryId: 'c1', createdBy: 'u1', state: 'Archived', health: 'healthy', lastChecked: minsAgo(500), createdAt: daysAgo(200) }),
      makeLink({ id: 'l12', title: 'Hackathon Rules', url: 'https://example.com/hackathon', description: 'Event rules', tags: ['event'], categoryId: 'c2', createdBy: 'u1', state: 'Archived', health: 'restricted', lastChecked: minsAgo(700), createdAt: daysAgo(100) }),
      makeLink({ id: 'l13', title: 'Broken Tutorial', url: 'https://example.com/broken-tutorial', description: 'Page no longer exists', tags: ['tutorial'], categoryId: 'c3', createdBy: 'u1', state: 'Deleted', health: 'unhealthy', lastChecked: minsAgo(900), shortCode: 'brk404', createdAt: daysAgo(70) }),
      makeLink({ id: 'l14', title: 'Duplicate Notes', url: 'https://example.com/docs/semester-5-copy', description: 'Copy of an existing link', tags: ['study'], categoryId: 'c1', createdBy: 'u1', state: 'Deleted', health: 'healthy', lastChecked: minsAgo(800), createdAt: daysAgo(30) }),
      makeLink({ id: 'l15', title: 'UI Kit Library', url: 'https://example.com/ui-kits', description: 'Shared UI kits for the club', tags: ['design', 'ui'], categoryId: 'c10', folderId: 'f5', createdBy: 'u3', health: 'healthy', lastChecked: minsAgo(3), uses: 8, createdAt: daysAgo(4) }),
      makeLink({ id: 'l16', title: 'Brand Guidelines', url: 'https://example.com/brand', description: 'Logos and colours', tags: ['brand'], categoryId: 'c10', createdBy: 'u1', health: 'healthy', lastChecked: minsAgo(4), uses: 12, shortCode: 'brandA', createdAt: daysAgo(7) }),
      makeLink({ id: 'l17', title: 'Past Papers 2025', url: 'https://example.com/past-papers/private', description: 'Shared exam papers', tags: ['exams'], categoryId: 'c11', folderId: 'f6', createdBy: 'u2', health: 'restricted', lastChecked: minsAgo(10), uses: 5, createdAt: daysAgo(10) }),
      makeLink({ id: 'l18', title: 'Exam Timetable', url: 'https://example.com/exam-timetable', description: 'Dates for the term exams', tags: ['exams', 'dates'], categoryId: 'c11', createdBy: 'u1', health: 'healthy', lastChecked: minsAgo(8), uses: 7, createdAt: daysAgo(14) }),
      makeLink({ id: 'l19', title: 'Campaign Assets', url: 'https://example.com/campaign', description: 'Marketing images', tags: ['marketing'], categoryId: 'c12', createdBy: 'u6', health: 'healthy', lastChecked: minsAgo(20), uses: 3, createdAt: daysAgo(2) }),
      makeLink({ id: 'l20', title: 'Family Recipes', url: 'https://example.com/recipes', description: 'Personal recipe collection', tags: ['food'], categoryId: 'c13', createdBy: 'u2', health: 'healthy', lastChecked: minsAgo(30), uses: 9, createdAt: daysAgo(15) })
    ],
    // Favourites are stored PER USER, so one person's star never affects another.
    favourites: { u1: ['l1', 'l6', 'l8', 'l15'], u2: ['l17', 'l20'] },
    // Platform activity history for Admin Dashboard
    activity: [
      { id: 'act1', type: 'team', desc: 'Asha Raman created team "Design Club"', timestamp: minsAgo(18) },
      { id: 'act2', type: 'member', desc: 'Meena Sundar joined "Design Club" as Member', timestamp: minsAgo(45) },
      { id: 'act3', type: 'link', desc: 'Ravi Kumar added shared link "Past Papers 2025"', timestamp: minsAgo(92) },
      { id: 'act4', type: 'health', desc: 'System completed automated link health verification cycle', timestamp: minsAgo(140) },
      { id: 'act5', type: 'user', desc: 'Arjun Das registered a new account', timestamp: daysAgo(3) },
      { id: 'act6', type: 'status', desc: 'Platform Admin updated account status for Karthik Nair (Disabled)', timestamp: daysAgo(5) }
    ]
  };
}

// Loads saved data from localStorage, or creates sample data if nothing is saved.
function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.activity) { parsed.activity = createSampleData().activity; }
      const samples = createSampleData();
      parsed.teams.forEach(function (t) {
        if (!t.description) {
          const sample = samples.teams.find(function (st) { return st.id === t.id; });
          t.description = sample ? sample.description : '';
        }
      });
      return parsed;
    }
  } catch (error) {
    console.warn('Could not read saved data, using sample data.', error);
  }
  return createSampleData();
}

// Saves the whole data object to localStorage (called after every change).
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Could not save data.', error);
  }
}

let data = loadData();   // all demo data
// Temporary screen state (not saved): which page, filters, open menu...
const ui = { view: 'overview', search: '', healthFilter: 'all', categoryId: null, folderId: null, teamId: null, openMenu: null, userSearch: '', userFilter: 'all', adminTeamSearch: '', authScreen: 'user-login' };
let modalHandler = null; // function to run when the modal form is submitted

// Logs an action to the platform activity feed (persisted in data.activity).
function logActivity(type, desc) {
  if (!data.activity) { data.activity = []; }
  data.activity.unshift({ id: newId('act'), type: type, desc: desc, timestamp: Date.now() });
  if (data.activity.length > 30) { data.activity.pop(); }
}

/* ---------------------------------------------------------------------
   3. SMALL HELPER FUNCTIONS
   --------------------------------------------------------------------- */
// Shortcut for document.getElementById.
function $(id) { return document.getElementById(id); }

// Makes text safe to put inside HTML (stops <script> injection).
function esc(text) {
  return String(text === undefined || text === null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Creates a new unique id such as "l101".
function newId(prefix) {
  data.nextId = data.nextId + 1;
  return prefix + data.nextId;
}

// Turns a timestamp into "2 minutes ago".
function timeAgo(timestamp) {
  if (!timestamp) { return 'not checked yet'; }
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) { return 'just now'; }
  if (minutes < 60) { return minutes + (minutes === 1 ? ' minute ago' : ' minutes ago'); }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) { return hours + (hours === 1 ? ' hour ago' : ' hours ago'); }
  const days = Math.floor(hours / 24);
  return days + (days === 1 ? ' day ago' : ' days ago');
}

// Formats a timestamp as a short date, e.g. "12 Oct 2026".
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Checks that a web address is valid (must start with http:// or https://).
function isValidUrl(text) {
  try {
    const parsed = new URL(text);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.length > 0;
  } catch (error) {
    return false;
  }
}

// Checks a simple email format.
function isValidEmail(text) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text); }

// Turns "#study, notes exams" into ["study","notes","exams"] (no duplicates).
function parseTags(text) {
  const parts = String(text).split(/[,\s]+/);
  const tags = [];
  for (let i = 0; i < parts.length; i++) {
    const tag = parts[i].replace(/^#/, '').toLowerCase();
    if (tag && tags.indexOf(tag) === -1) { tags.push(tag); }
  }
  return tags;
}

// Copies text to the clipboard and shows a toast (with a robust fallback).
function copyText(text, message) {
  const successMsg = message || 'URL copied successfully.';
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(function () {
      toast(successMsg);
    }, function () {
      if (fallbackCopy(text)) { toast(successMsg); }
      else { toast('Unable to copy to clipboard.', true); }
    });
  } else {
    if (fallbackCopy(text)) { toast(successMsg); }
    else { toast('Unable to copy to clipboard.', true); }
  }
}
function fallbackCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.focus();
  area.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (error) { ok = false; }
  document.body.removeChild(area);
  return ok;
}

/* ---------------------------------------------------------------------
   4. LOOKUPS AND PERMISSIONS
   Client-side checks only demonstrate the rules in the PDF - they are NOT real security.
   --------------------------------------------------------------------- */
function currentUser() { return data.users.find(function (u) { return u.id === (data.session && data.session.userId); }) || null; }
function userById(id) { return data.users.find(function (u) { return u.id === id; }); }
function userName(id) { const u = userById(id); return u ? u.name : 'Former user'; }
function teamById(id) { return data.teams.find(function (t) { return t.id === id; }); }
function categoryById(id) { return data.categories.find(function (c) { return c.id === id; }); }
function folderById(id) { return data.folders.find(function (f) { return f.id === id; }); }
function linkById(id) { return data.links.find(function (l) { return l.id === id; }); }

// Returns "Manager", "Member" or null for the signed-in user in a team.
function myRole(team) {
  const me = currentUser();
  const found = team.members.find(function (m) { return m.userId === me.id; });
  return found ? found.role : null;
}
// Teams the signed-in user belongs to.
function myTeams() { return data.teams.filter(function (t) { return myRole(t) !== null; }); }
// Teams where the signed-in user is Manager.
function managedTeams() { return data.teams.filter(function (t) { return myRole(t) === 'Manager'; }); }
// Teams that a given user belongs to (used by the admin table).
function teamsOfUser(userId) {
  return data.teams.filter(function (t) { return t.members.some(function (m) { return m.userId === userId; }); });
}

// Can the signed-in user see this link? (personal = owner only, shared = team members)
function canSeeLink(link) {
  const me = currentUser();
  const category = categoryById(link.categoryId);
  if (!category) { return link.createdBy === me.id; }
  if (category.ownerType === 'user') { return category.ownerId === me.id; }
  const team = teamById(category.ownerId);
  return !!team && myRole(team) !== null;
}
// Can the signed-in user edit / archive / delete this link?
// Owner: yes. Team Manager: yes (even other people's links). Plain member: only their own.
function canManageLink(link) {
  const me = currentUser();
  if (link.createdBy === me.id) { return true; }
  const category = categoryById(link.categoryId);
  if (category && category.ownerType === 'team') {
    const team = teamById(category.ownerId);
    return !!team && myRole(team) === 'Manager';
  }
  return false;
}
// Can the signed-in user create/rename/delete this category or its folders?
function canManageCategory(category) {
  const me = currentUser();
  if (category.ownerType === 'user') { return category.ownerId === me.id; }
  const team = teamById(category.ownerId);
  return !!team && myRole(team) === 'Manager';
}
// Can the signed-in user add links to this category? (members may add to shared folders)
function canAddToCategory(category) {
  const me = currentUser();
  if (category.ownerType === 'user') { return category.ownerId === me.id; }
  const team = teamById(category.ownerId);
  return !!team && myRole(team) !== null;
}
// Categories the signed-in user can see: own personal ones + shared ones from their teams.
function visibleCategories() {
  return data.categories.filter(function (c) {
    const me = currentUser();
    if (c.ownerType === 'user') { return c.ownerId === me.id; }
    const team = teamById(c.ownerId);
    return !!team && myRole(team) !== null;
  });
}
// Name of the space that owns a category (used for the "unique name" rule).
function categoryOwnerLabel(category) {
  if (category.ownerType === 'user') { return 'Personal'; }
  const team = teamById(category.ownerId);
  return 'Team: ' + (team ? team.name : 'removed team');
}
// All links the signed-in user can see in a given state ('Active', 'Archived', 'Deleted').
function visibleLinks(state) {
  return data.links.filter(function (l) { return l.state === state && canSeeLink(l); });
}
function isFavourite(linkId) {
  const me = currentUser();
  const list = data.favourites[me.id] || [];
  return list.indexOf(linkId) !== -1;
}
function favouriteLinks() { return visibleLinks('Active').filter(function (l) { return isFavourite(l.id); }); }

// Search rule: match link title, URL, description, category name or tags (ignore case and spaces).
function applySearch(list) {
  const text = ui.search.trim().toLowerCase();
  if (text === '') { return list; }
  return list.filter(function (link) {
    const category = categoryById(link.categoryId);
    const categoryName = category ? category.name.toLowerCase() : '';
    const inTitle = link.title.toLowerCase().indexOf(text) !== -1;
    const inUrl = link.url ? link.url.toLowerCase().indexOf(text) !== -1 : false;
    const inDesc = link.description ? link.description.toLowerCase().indexOf(text) !== -1 : false;
    const inCategory = categoryName.indexOf(text) !== -1;
    const inTags = link.tags.some(function (tag) { return tag.toLowerCase().indexOf(text) !== -1; });
    return inTitle || inUrl || inDesc || inCategory || inTags;
  });
}

/* ---------------------------------------------------------------------
   5. METRICS (all counts are calculated from the data after every change)
   --------------------------------------------------------------------- */
// Counts for the signed-in user's dashboard.
function userMetrics() {
  const me = currentUser();
  const active = visibleLinks('Active');
  function countHealth(status) { return active.filter(function (l) { return l.health === status; }).length; }
  return {
    total: active.length,
    healthy: countHealth('healthy'),
    unhealthy: countHealth('unhealthy'),
    restricted: countHealth('restricted'),
    notverified: countHealth('notverified'),
    favourites: favouriteLinks().length,
    shortUrls: active.filter(function (l) { return l.shortCode !== ''; }).length,
    categories: typeof visibleCategories === 'function' ? visibleCategories().length : data.categories.filter(function (c) { return c.ownerType === 'user' && c.ownerId === me.id; }).length,
    teams: myTeams().length
  };
}
// Counts for the admin dashboard (platform wide; admins see counts, not personal link contents).
function adminMetrics() {
  const active = data.links.filter(function (l) { return l.state === 'Active'; });
  function countHealth(status) { return active.filter(function (l) { return l.health === status; }).length; }
  const weekAgo = daysAgo(7);
  const dayAgo = daysAgo(1);
  return {
    users: data.users.length,
    activeUsers: data.users.filter(function (u) { return u.status === 'Active'; }).length,
    disabledUsers: data.users.filter(function (u) { return u.status === 'Disabled'; }).length,
    teams: data.teams.length,
    activeLinks: active.length,
    healthy: countHealth('healthy'),
    unhealthy: countHealth('unhealthy'),
    restricted: countHealth('restricted'),
    notverified: countHealth('notverified'),
    newUsersWeek: data.users.filter(function (u) { return u.registered >= weekAgo; }).length,
    linksToday: data.links.filter(function (l) { return l.createdAt >= dayAgo; }).length,
    linksWeek: data.links.filter(function (l) { return l.createdAt >= weekAgo; }).length,
    checkedLastCycle: active.filter(function (l) { return l.lastChecked && l.lastChecked >= minsAgo(5); }).length
  };
}

/* ---------------------------------------------------------------------
   6. HEALTH CHECK SIMULATION (no real network requests!)
   --------------------------------------------------------------------- */
// Predefined demonstration outcomes that "Run Health Check" cycles through.
const HEALTH_SCRIPT = [
  { result: 'healthy',    text: 'The link responded successfully (simulated 200 OK).' },
  { result: 'restricted', text: 'The site limits automated access (simulated 403). Not counted as a failure.' },
  { result: 'uncertain',  text: 'The check timed out (simulated). The last known status was kept.' },
  { result: 'unhealthy',  text: 'A failure was confirmed on every try (simulated 404).' }
];

// Instant check used when a link is added, edited or restored: decided by simple words in the URL.
function instantOutcome(link) {
  const url = link.url.toLowerCase();
  if (url.indexOf('404') !== -1 || url.indexOf('broken') !== -1 || url.indexOf('old-') !== -1) { return HEALTH_SCRIPT[3]; }
  if (url.indexOf('login') !== -1 || url.indexOf('private') !== -1) { return HEALTH_SCRIPT[1]; }
  return HEALTH_SCRIPT[0];
}

// Applies one outcome to a link following the PDF rules (uncertain keeps the last status;
// 3 uncertain results in a row turn the link Unhealthy).
function applyHealthResult(link, outcome) {
  link.lastChecked = Date.now();
  if (outcome.result === 'uncertain') {
    link.uncertainCount = (link.uncertainCount || 0) + 1;
    if (link.uncertainCount >= 3) {
      link.health = 'unhealthy';
      return 'Uncertain 3 times in a row, so the link is now marked Unhealthy (simulated).';
    }
    return outcome.text;
  }
  link.uncertainCount = 0;
  link.health = outcome.result;
  return outcome.text;
}

// Runs the instant check for a link (only for Active links - Archived/Deleted are never checked).
function runInstantCheck(link) {
  if (link.state !== 'Active') { return; }
  link.health = 'notverified';
  applyHealthResult(link, instantOutcome(link));
}

// "Run Health Check" button: simulates the next outcome and refreshes the screen.
function runHealthCheck(linkId) {
  const link = linkById(linkId);
  if (!link) { return; }
  if (link.state !== 'Active') { toast('Archived and deleted links are not health-checked.', true); return; }
  const outcome = HEALTH_SCRIPT[link.checkStep % HEALTH_SCRIPT.length];
  link.checkStep = link.checkStep + 1;
  const message = applyHealthResult(link, outcome);
  saveData();
  render();
  toast('Simulated check: ' + message);
}

/* ---------------------------------------------------------------------
   7. SHORT URL SIMULATION
   --------------------------------------------------------------------- */
// Makes a random 6-character code that no other link uses.
function generateCode() {
  const letters = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 6; i++) { code += letters.charAt(Math.floor(Math.random() * letters.length)); }
  } while (data.links.some(function (l) { return l.shortCode === code; }));
  return code;
}
function shortUrlOf(link) { return 'https://' + SHORT_DOMAIN + '/' + link.shortCode; }

// Pretends to open a short URL: returns a message about what would happen.
function resolveShortCode(input) {
  const code = String(input).trim().split('/').filter(Boolean).pop() || '';
  const link = data.links.find(function (l) { return l.shortCode !== '' && l.shortCode === code; });
  if (!link) { return { ok: false, text: 'Link not found. No short URL matches that code.' }; }
  if (link.state === 'Deleted') { return { ok: false, text: 'Link unavailable. This link is currently in the Trash.' }; }
  return { ok: true, text: 'Active short link redirecting to ' + link.url };
}

/* ---------------------------------------------------------------------
   8. MODAL AND TOAST HELPERS
   --------------------------------------------------------------------- */
// Shows a small temporary message at the bottom (disappears by itself).
function toast(message, isError) {
  const box = document.createElement('div');
  box.className = 'toast' + (isError ? ' error' : '');
  box.textContent = message;
  $('toastArea').appendChild(box);
  setTimeout(function () { if (box.parentNode) { box.parentNode.removeChild(box); } }, 3200);
}

let lastActiveElement = null;

// Opens the shared modal. submitLabel = null makes it a "view only" dialog with a Close button.
// onSubmit receives the form values and returns an error text to keep the modal open.
function openModal(title, bodyHtml, submitLabel, onSubmit, isDanger) {
  lastActiveElement = document.activeElement;
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML = bodyHtml;
  $('formError').textContent = '';
  const submitButton = $('modalSubmit');
  submitButton.classList.toggle('hidden', submitLabel === null);
  submitButton.textContent = submitLabel || '';
  submitButton.className = 'btn ' + (isDanger ? 'btn-danger' : 'btn-primary') + (submitLabel === null ? ' hidden' : '');
  submitButton.disabled = false;
  $('modalCancel').textContent = submitLabel === null ? 'Close' : 'Cancel';
  modalHandler = onSubmit || null;
  $('modalBackdrop').classList.remove('hidden');
  const firstField = $('modalBody').querySelector('input, select, textarea');
  (firstField || (submitLabel === null ? $('modalCancel') : submitButton)).focus();
}
function closeModal() {
  $('modalBackdrop').classList.add('hidden');
  modalHandler = null;
  const submitButton = $('modalSubmit');
  if (submitButton) { submitButton.disabled = false; }
  if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
    try { lastActiveElement.focus(); } catch (e) {}
    lastActiveElement = null;
  }
}

// Sign In popup modal on landing page
function openSignInModal() {
  const backdrop = $('signInModalBackdrop');
  if (backdrop) {
    backdrop.classList.remove('hidden');
    const err = $('ulError');
    if (err) { err.textContent = ''; }
    const emailField = $('ulEmail');
    if (emailField) {
      setTimeout(function () { emailField.focus(); }, 60);
    }
  }
}
function closeSignInModal() {
  const backdrop = $('signInModalBackdrop');
  if (backdrop) {
    backdrop.classList.add('hidden');
  }
}
// Opens a yes/no confirmation dialog.
function confirmBox(title, message, yesLabel, onYes) {
  openModal(title, '<p>' + message + '</p>', yesLabel, function () { onYes(); }, true);
}

/* ---------------------------------------------------------------------
   9. NAVIGATION AND PAGE SHELL
   --------------------------------------------------------------------- */
function toggleMobileMenu() {
  const sidebar = $('sidebar');
  const backdrop = $('sidebarBackdrop');
  const btn = $('mobileMenuBtn');
  if (!sidebar) { return; }
  const isOpen = sidebar.classList.contains('mobile-open');
  if (isOpen) {
    closeMobileMenu();
  } else {
    sidebar.classList.add('mobile-open');
    if (backdrop) { backdrop.classList.remove('hidden'); }
    if (btn) { btn.setAttribute('aria-expanded', 'true'); }
    document.body.classList.add('mobile-menu-active');
  }
}

function closeMobileMenu() {
  const sidebar = $('sidebar');
  const backdrop = $('sidebarBackdrop');
  const btn = $('mobileMenuBtn');
  if (sidebar) { sidebar.classList.remove('mobile-open'); }
  if (backdrop) { backdrop.classList.add('hidden'); }
  if (btn) { btn.setAttribute('aria-expanded', 'false'); }
  document.body.classList.remove('mobile-menu-active');
}

// Switches to another page. `filter` is optional (used by dashboard metric cards).
function navigate(view, filter) {
  const user = currentUser();
  if (!user) { showAuth('user-login'); return; }
  // Role re-check: normal users cannot open admin pages and admins stay in the admin area.
  const isAdminView = view.indexOf('admin') === 0;
  if (isAdminView && user.role !== 'Admin') {
    view = 'overview';
    toast('Access denied: Admin privileges required.', true);
  }
  if (!isAdminView && user.role === 'Admin') { view = 'adminOverview'; }
  ui.view = view;
  ui.categoryId = null;
  ui.folderId = null;
  ui.teamId = null;
  ui.search = '';
  ui.openMenu = null;
  ui.healthFilter = filter || 'all';
  const searchInput = $('globalSearch');
  if (searchInput) { searchInput.value = ''; }
  if (window.location && window.location.hash !== '#' + view) {
    try { history.pushState({ view: view }, '', '#' + view); } catch (e) {}
  }
  render();
  closeMobileMenu();
  const content = $('pageContent');
  if (content) { content.scrollTop = 0; }
}

// Redraws the whole signed-in screen (sidebar, header and page).
function render() {
  const user = currentUser();
  if (!user) { showAuth(); return; }
  $('authArea').classList.add('hidden');
  $('appArea').classList.remove('hidden');
  const isAdmin = user.role === 'Admin';
  $('topLogo').innerHTML = logoSvg() + 'LinkSphere' + (isAdmin ? '<span class="logo-sub">Admin</span>' : '');
  $('avatar').textContent = user.name.charAt(0).toUpperCase();
  $('profileName').textContent = user.name;
  if ($('themeBtn')) {
    $('themeBtn').classList.remove('hidden');
    $('themeBtn').innerHTML = icon(data.settings.theme === 'dark' ? 'sun' : 'moon');
    $('themeBtn').setAttribute('title', data.settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
  $('searchIcon').innerHTML = icon('search');
  if (isAdmin && ui.view.indexOf('admin') !== 0) { ui.view = 'adminOverview'; }
  if (!isAdmin && ui.view.indexOf('admin') === 0) { ui.view = 'overview'; }
  renderSidebar(isAdmin);
  renderHeader();
  renderPage();
}

// Builds the sidebar buttons. The active page gets the "active" class.
function renderSidebar(isAdmin) {
  const items = isAdmin ? ADMIN_NAV : USER_NAV;
  const metrics = isAdmin ? null : userMetrics();
  let html = '';
  for (let i = 0; i < items.length; i++) {
    const key = items[i];
    if (key === '-') { html += '<div class="nav-gap"></div>'; continue; }
    const page = PAGES[key];
    const active = key === ui.view;
    let count = '';
    if (metrics && key === 'favourites') { count = '<span class="nav-count">' + metrics.favourites + '</span>'; }
    if (metrics && key === 'archive') { count = '<span class="nav-count">' + visibleLinks('Archived').length + '</span>'; }
    if (metrics && key === 'trash') { count = '<span class="nav-count">' + visibleLinks('Deleted').length + '</span>'; }
    html += '<button type="button" class="nav-btn' + (active ? ' active' : '') + '" data-action="nav" data-view="' + key + '"' + (active ? ' aria-current="page"' : '') + '>' + icon(page.icon) + '<span>' + page.label + '</span>' + count + '</button>';
  }
  $('sidebar').innerHTML = html;
}

// Updates the page title, the search bar and the top action button.
function renderHeader() {
  const page = PAGES[ui.view];
  const user = currentUser();
  $('pageTitle').textContent = page.title;
  let sub = '';
  if (ui.view === 'overview') {
    sub = 'Welcome back, ' + esc(user.name.split(' ')[0]);
  } else if (ui.view === 'adminOverview') { sub = 'Platform summary <span class="sim-label">Simulated admin</span>'; }
  else if (ui.view === 'adminUsers') { sub = 'View, edit, disable or delete accounts. <span class="sim-label">Simulated</span>'; }
  else if (ui.view === 'adminTeams') { sub = 'Teams and platform resources (counts only for personal items).'; }
  else if (ui.view === 'links') { sub = 'Your links and links shared by your teams.'; }
  else if (ui.view === 'favourites') { sub = 'Active links you starred.'; }
  else if (ui.view === 'archive') { sub = 'Archived links are not health-checked.'; }
  else if (ui.view === 'trash') { sub = 'Deleted links. Their short URLs stop working.'; }
  $('pageSub').innerHTML = sub;
  $('searchBox').classList.toggle('hidden', !page.search);
  if (page.searchHint) { $('globalSearch').placeholder = page.searchHint; }
  const actionButton = $('topAction');
  actionButton.classList.toggle('hidden', !page.action);
  actionButton.textContent = page.action || '';
  $('pageTools').classList.toggle('hidden', !page.search && !page.action);
  const themeBtn = $('themeBtn');
  if (themeBtn) {
    themeBtn.classList.remove('hidden');
    themeBtn.innerHTML = icon(data.settings.theme === 'dark' ? 'sun' : 'moon');
    themeBtn.setAttribute('title', data.settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    themeBtn.setAttribute('aria-label', data.settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
}

// Calls the render function that matches the current page.
function renderPage() {
  const content = $('pageContent');
  content.classList.toggle('compact', !!data.settings.compact);
  let html = '';
  if (ui.view === 'overview') { html = pageOverview(); }
  else if (ui.view === 'links') { html = pageLinks(); }
  else if (ui.view === 'categories') { html = ui.categoryId ? pageCategoryDetail() : pageCategories(); }
  else if (ui.view === 'teams') { html = ui.teamId ? pageTeamDetail() : pageTeams(); }
  else if (ui.view === 'favourites') { html = pageFavourites(); }
  else if (ui.view === 'archive') { html = pageArchive(); }
  else if (ui.view === 'trash') { html = pageTrash(); }
  else if (ui.view === 'settings') { html = pageSettings(); }
  else if (ui.view === 'adminOverview') { html = pageAdminOverview(); }
  else if (ui.view === 'adminUsers') { html = pageAdminUsers(); }
  else if (ui.view === 'adminTeams') { html = pageAdminTeams(); }
  content.innerHTML = html;
  if (ui.openMenu !== null) {
    adjustOpenMenuPosition();
  }
}

// Adjusts the position of the open dropdown menu to stay fully in viewport
function adjustOpenMenuPosition() {
  const menu = document.querySelector('.menu');
  if (!menu) return;
  const wrap = menu.closest('.menu-wrap');
  if (!wrap) return;
  const rect = menu.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const container = $('pageContent') || document.body;
  const contRect = container.getBoundingClientRect();

  const viewBottom = Math.min(window.innerHeight, contRect.bottom);
  const spaceBelow = viewBottom - wrapRect.bottom;
  const spaceAbove = wrapRect.top - Math.max(0, contRect.top);

  if (spaceBelow < rect.height + 15 && spaceAbove > spaceBelow) {
    menu.classList.add('menu-up');
  } else {
    menu.classList.remove('menu-up');
  }

  const viewRight = Math.min(window.innerWidth, contRect.right);
  const viewLeft = Math.max(0, contRect.left);
  const updatedRect = menu.getBoundingClientRect();

  if (updatedRect.right > viewRight - 10) {
    menu.style.left = 'auto';
    menu.style.right = '0';
  } else if (updatedRect.left < viewLeft + 10) {
    menu.style.left = '0';
    menu.style.right = 'auto';
  }
}

// Shows one of the login screens.
function showAuth(screen) {
  if (screen) { ui.authScreen = screen; }
  $('appArea').classList.add('hidden');
  $('authArea').classList.remove('hidden');
  const screens = ['user-login', 'register', 'admin-login', 'public'];
  for (let i = 0; i < screens.length; i++) {
    $('screen-' + screens[i]).classList.toggle('hidden', screens[i] !== ui.authScreen);
  }
}

/* ---------------------------------------------------------------------
   10. USER PAGES (each function returns the HTML for one page)
   --------------------------------------------------------------------- */
// Small health badge: colour + glyph + text (never colour alone).
function healthBadge(status) {
  return '<span class="badge badge-' + status + '">' + HEALTH_GLYPHS[status] + ' ' + HEALTH_LABELS[status] + '</span>';
}

// Friendly "empty" message.
function emptyState(title, text, buttonHtml) {
  return '<div class="empty-state"><h3>' + title + '</h3><p>' + text + '</p>' + (buttonHtml || '') + '</div>';
}

// Builds the small "More" menu. `key` identifies which menu is open.
function menuHtml(key, itemsHtml) {
  const open = ui.openMenu === key;
  return '<div class="menu-wrap' + (open ? ' menu-open' : '') + '"><button type="button" class="btn btn-sm" data-action="toggleMenu" data-key="' + key + '" aria-haspopup="true" aria-expanded="' + open + '">' + icon('more') + 'More</button>' +
    (open ? '<div class="menu" role="menu">' + itemsHtml + '</div>' : '') + '</div>';
}
function menuItem(action, id, label, extra) {
  return '<button type="button" role="menuitem" data-action="' + action + '" data-id="' + id + '"' + (extra && extra.danger ? ' class="danger"' : '') + '>' + label + '</button>';
}

// The reusable link card. mode = 'active', 'archive' or 'trash'.
function linkCardHtml(link, mode) {
  const category = categoryById(link.categoryId);
  const folder = folderById(link.folderId);
  const canManage = canManageLink(link);
  const where = (category ? esc(category.name) : 'No category') + (folder ? ' &gt; ' + esc(folder.name) : '');
  const owner = category && category.ownerType === 'team' ? 'Team: ' + esc(categoryOwnerLabel(category).replace('Team: ', '')) + ' · added by ' + esc(userName(link.createdBy)) : 'Personal';
  const tags = link.tags.map(function (t) { return '<span class="tag">#' + esc(t) + '</span>'; }).join('');
  let star = '';
  let actions = '';
  let shortLine = '';

  if (link.shortCode) {
    shortLine = mode === 'trash'
      ? '<div class="card-short"><span>Short URL unavailable while in Trash</span></div>'
      : '<div class="card-short"><span>Short URL: <code>' + esc(shortUrlOf(link)) + '</code></span></div>';
  }

  if (mode === 'active') {
    const on = isFavourite(link.id);
    star = on
      ? '<span class="star-badge" aria-label="Favourite link" title="Favourite link" style="color:#d49a00;line-height:0;display:inline-flex;align-items:center;">' + icon('star') + '</span>'
      : '';

    let moreItems = '';
    if (canManage) {
      moreItems += menuItem('editLink', link.id, 'Edit');
    }
    moreItems += menuItem('toggleFavourite', link.id, on ? 'Remove from Favorites' : 'Add to Favorites');
    if (canManage) {
      moreItems += menuItem('moveLink', link.id, 'Move to folder / category');
      moreItems += menuItem('archiveLink', link.id, 'Archive');
      moreItems += menuItem('deleteLink', link.id, 'Delete', { danger: true });
    }
    moreItems += menuItem('shortUrl', link.id, link.shortCode ? 'View Short URL' : 'Generate Short URL');
    moreItems += menuItem('healthCheck', link.id, 'Run Health Check (simulated)');
    if (link.shortCode) { moreItems += menuItem('copyShort', link.id, 'Copy Short URL'); }
    if (!canManage) {
      moreItems += '<div class="menu-note">Shared link: Team member read-only access.</div>';
    }

    actions =
      '<button type="button" class="btn btn-sm btn-primary" data-action="openLink" data-id="' + link.id + '" title="Open destination in new tab">' + icon('link') + 'Open</button>' +
      '<button type="button" class="btn btn-sm" data-action="copyUrl" data-id="' + link.id + '" title="Copy original URL">Copy URL</button>' +
      menuHtml(link.id, moreItems);
  } else if (mode === 'archive') {
    actions =
      '<button type="button" class="btn btn-sm" data-action="openLink" data-id="' + link.id + '">' + icon('link') + 'Open</button>' +
      '<button type="button" class="btn btn-sm" data-action="copyUrl" data-id="' + link.id + '">Copy URL</button>' +
      (canManage
        ? '<button type="button" class="btn btn-sm btn-primary" data-action="restoreLink" data-id="' + link.id + '">Restore</button>' +
          '<button type="button" class="btn btn-sm btn-danger" data-action="deleteLink" data-id="' + link.id + '">Delete</button>'
        : '<span class="card-meta">Read only</span>');
  } else {
    actions =
      '<button type="button" class="btn btn-sm" data-action="copyUrl" data-id="' + link.id + '">Copy URL</button>' +
      (canManage
        ? '<button type="button" class="btn btn-sm btn-primary" data-action="restoreLink" data-id="' + link.id + '">Restore</button>' +
          '<button type="button" class="btn btn-sm btn-danger" data-action="purgeLink" data-id="' + link.id + '">Permanently Delete</button>'
        : '<span class="card-meta">Read only</span>');
  }

  return '<article class="glass-card link-card' + (ui.openMenu === link.id ? ' menu-open' : '') + '">' +
    '<div class="card-head"><h3 class="card-title">' + esc(link.title) + '</h3>' + star + '</div>' +
    '<a class="card-url" href="' + esc(link.url) + '" target="_blank" rel="noopener noreferrer" data-action="openLink" data-id="' + link.id + '">' + esc(link.url) + '</a>' +
    (link.description && data.settings.showDescriptions ? '<p class="card-desc">' + esc(link.description) + '</p>' : '') +
    (tags ? '<div class="tag-row">' + tags + '</div>' : '') +
    '<div class="card-meta">Category: ' + where + '<br>' + owner + '</div>' +
    '<div class="card-foot"><div class="card-health">' + healthBadge(link.health) + '<span>Last checked (simulated): ' + timeAgo(link.lastChecked) + '</span></div>' +
    '<div class="card-actions">' + actions + '</div></div></article>';
}

// Turns a list of links into a card grid (or an empty state).
function cardGrid(list, mode, emptyHtml) {
  if (list.length === 0) { return emptyHtml; }
  return '<div class="card-grid">' + list.map(function (l) { return linkCardHtml(l, mode); }).join('') + '</div>';
}

// Draws the health pie/donut chart from counts using plain SVG circles.
function donutHtml(counts, keys) {
  keys = keys || ['healthy', 'unhealthy', 'restricted', 'notverified'];
  let total = 0;
  for (let k = 0; k < keys.length; k++) { total += (counts[keys[k]] || 0); }
  let offset = 25; // start at the top of the circle
  let circles = '<circle cx="21" cy="21" r="15.9155" stroke="var(--accent-soft)"/>';
  for (let i = 0; i < keys.length; i++) {
    const val = counts[keys[i]] || 0;
    const percent = total === 0 ? 0 : (val / total) * 100;
    if (percent > 0) {
      circles += '<circle class="stroke-' + keys[i] + '" cx="21" cy="21" r="15.9155" stroke-dasharray="' + percent + ' ' + (100 - percent) + '" stroke-dashoffset="' + offset + '"/>';
      offset -= percent;
    }
  }
  const labelParts = keys.map(function (k) { return (counts[k] || 0) + ' ' + k; }).join(', ');
  return '<svg class="donut" viewBox="0 0 42 42" role="img" aria-label="Link health chart: ' + labelParts + '">' + circles +
    '<text x="21" y="21.5" text-anchor="middle" font-size="9">' + (counts.total || total) + '</text><text x="21" y="27" text-anchor="middle" font-size="3.6" style="font-weight:600">links</text></svg>';
}

// Legend rows beside the donut. Each row is a button that opens My Link with that filter.
function legendHtml(counts, clickable, keys) {
  keys = keys || ['healthy', 'unhealthy', 'restricted', 'notverified'];
  return '<div class="legend">' + keys.map(function (k) {
    const inner = '<span class="swatch sw-' + k + '"></span>' + HEALTH_LABELS[k] + '<b>' + (counts[k] || 0) + '</b>';
    return clickable
      ? '<button type="button" class="legend-row" data-action="goto" data-view="links" data-filter="' + k + '">' + inner + '</button>'
      : '<div class="legend-row">' + inner + '</div>';
  }).join('') + '</div>';
}

// PAGE 1: Dashboard (title, 4 metric cards, Frequently Used, Health Status, Recent Links)
function pageOverview() {
  const m = userMetrics();
  const active = visibleLinks('Active');
  const frequent = active.slice().sort(function (a, b) { return b.uses - a.uses; }).slice(0, 5);
  const recent = active.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 3);

  const cards = [
    { label: 'Total Links', value: m.total, view: 'links', filter: 'all', type: 'total' },
    { label: 'Total Categories', value: m.categories, view: 'categories', filter: 'all', type: 'categories' },
    { label: 'Total Teams', value: m.teams, view: 'teams', filter: 'all', type: 'teams' },
    { label: 'Short URLs', value: m.shortUrls, view: 'links', filter: 'short', type: 'short' }
  ];
  let html = '<div class="metric-grid">' + cards.map(function (c) {
    return '<button type="button" class="metric-card type-' + c.type + '" data-action="goto" data-view="' + c.view + '" data-filter="' + c.filter + '"><div class="metric-label">' + c.label + '</div><div class="metric-value">' + c.value + '</div></button>';
  }).join('') + '</div>';

  const frequentHtml = frequent.length === 0 ? '<p class="card-meta">No links yet.</p>' :
    '<ol class="rank-list">' + frequent.map(function (l, i) {
      return '<li class="rank-item"><span class="rank-num">' + (i + 1) + '</span><span class="rank-name" title="' + esc(l.title) + '">' + esc(l.title) + '</span><span class="rank-uses">' + l.uses + ' opens</span><button type="button" class="btn btn-sm" data-action="openLink" data-id="' + l.id + '">Open</button></li>';
    }).join('') + '</ol>';

  html += '<div class="grid-2">' +
    '<section class="glass-panel"><h2 class="panel-title">Frequently Used</h2>' + frequentHtml + '<p class="card-meta" style="margin-top:12px">Usage statistics update after opening links.</p></section>' +
    '<section class="glass-panel"><h2 class="panel-title">Health Status</h2><div class="donut-wrap">' + donutHtml(m, ['healthy', 'unhealthy']) + legendHtml(m, true, ['healthy', 'unhealthy']) + '</div></section></div>';

  html += '<section class="glass-panel"><div class="panel-title-row"><h2 class="panel-title">Recent Links</h2><div class="card-actions">' +
    '<button type="button" class="btn btn-sm" data-action="nav" data-view="links">Open My Link</button>' +
    '<button type="button" class="btn btn-sm" data-action="nav" data-view="categories">Categories</button>' +
    '<button type="button" class="btn btn-sm" data-action="nav" data-view="teams">Teams</button></div></div>' +
    cardGrid(recent, 'active', emptyState('No links yet', 'Add your first link to see it here.', '<button type="button" class="btn btn-primary" data-action="addLink">Add Link</button>')) + '</section>';
  return html;
}

// PAGE 2: My Link (filter chips + link cards)
function pageLinks() {
  const m = userMetrics();
  const filters = [
    { key: 'all', label: 'All (' + m.total + ')' },
    { key: 'healthy', label: 'Healthy (' + m.healthy + ')' },
    { key: 'unhealthy', label: 'Unhealthy (' + m.unhealthy + ')' },
    { key: 'restricted', label: 'Restricted (' + m.restricted + ')' },
    { key: 'notverified', label: 'Not Verified (' + m.notverified + ')' },
    { key: 'short', label: 'Short URLs (' + m.shortUrls + ')' }
  ];
  let list = visibleLinks('Active');
  if (ui.healthFilter === 'short') { list = list.filter(function (l) { return l.shortCode !== ''; }); }
  else if (ui.healthFilter !== 'all') { list = list.filter(function (l) { return l.health === ui.healthFilter; }); }
  list = applySearch(list).sort(function (a, b) { return b.createdAt - a.createdAt; });

  const chips = '<div class="chip-row">' + filters.map(function (f) {
    return '<button type="button" class="chip' + (ui.healthFilter === f.key ? ' active' : '') + '" data-action="setFilter" data-filter="' + f.key + '">' + f.label + '</button>';
  }).join('') + '</div>';
  const emptyText = ui.search.trim() !== '' || ui.healthFilter !== 'all' ? emptyState('No links found', 'Try a different search or filter.', '<button type="button" class="btn" data-action="clearFilters">Clear search and filter</button>')
    : emptyState('No links yet', 'Save your first link.', '<button type="button" class="btn btn-primary" data-action="addLink">Add Link</button>');
  return chips + cardGrid(list, 'active', emptyText);
}

// PAGE 3a: Categories list (personal + shared)
function pageCategories() {
  const text = ui.search.trim().toLowerCase();
  const list = visibleCategories().filter(function (c) {
    if (text === '') { return true; }
    const folderMatch = data.folders.some(function (f) { return f.categoryId === c.id && f.name.toLowerCase().indexOf(text) !== -1; });
    return c.name.toLowerCase().indexOf(text) !== -1 || folderMatch;
  });
  function cardFor(c) {
    const count = visibleLinks('Active').filter(function (l) { return l.categoryId === c.id; }).length;
    const folderCount = data.folders.filter(function (f) { return f.categoryId === c.id; }).length;
    let items = '';
    if (canManageCategory(c)) {
      items += menuItem('createFolder', c.id, 'Create Folder') + menuItem('renameCategory', c.id, 'Rename') + menuItem('deleteCategory', c.id, 'Delete', { danger: true });
    } else {
      items += '<div class="menu-note">Only team Managers can change shared categories.</div>';
    }
    return '<article class="glass-card cat-card' + (ui.openMenu === 'cat' + c.id ? ' menu-open' : '') + '"><h3>' + esc(c.name) + '</h3>' +
      '<span class="badge badge-role" style="align-self:flex-start">' + esc(categoryOwnerLabel(c)) + '</span>' +
      '<p class="cat-stat">' + count + ' active link' + (count === 1 ? '' : 's') + ' · ' + folderCount + ' folder' + (folderCount === 1 ? '' : 's') + '</p>' +
      '<div class="card-actions" style="margin-top:auto;padding-top:8px"><button type="button" class="btn btn-sm btn-primary" data-action="viewCategory" data-id="' + c.id + '">Open</button>' + menuHtml('cat' + c.id, items) + '</div></article>';
  }
  const personal = list.filter(function (c) { return c.ownerType === 'user'; });
  const shared = list.filter(function (c) { return c.ownerType === 'team'; });
  let html = '<div class="note-box">Structure: Category &rarr; Folders &rarr; Link cards. A category that still has active links cannot be deleted until the links are moved.</div>';
  html += '<h2 class="section-title" style="margin-top:0">Personal categories</h2>';
  html += personal.length ? '<div class="card-grid">' + personal.map(cardFor).join('') + '</div>' : emptyState('No personal categories', 'Create a category to organise your links.', '<button type="button" class="btn btn-primary" data-action="createCategory">Create Category</button>');
  html += '<h2 class="section-title">Shared categories (from your teams)</h2>';
  html += shared.length ? '<div class="card-grid">' + shared.map(cardFor).join('') + '</div>' : emptyState('No shared categories', 'Shared categories appear here when a Team Manager creates them.', '');
  return html;
}

// PAGE 3b: One category with its folders and links
function pageCategoryDetail() {
  const category = categoryById(ui.categoryId);
  if (!category) { ui.categoryId = null; ui.folderId = null; return pageCategories(); }
  const manage = canManageCategory(category);
  const links = visibleLinks('Active').filter(function (l) { return l.categoryId === category.id; });
  const folders = data.folders.filter(function (f) { return f.categoryId === category.id; });

  // If a folder is opened, show only that folder's contents view
  if (ui.folderId) {
    const folder = folderById(ui.folderId);
    if (folder && folder.categoryId === category.id) {
      const inFolder = applySearch(links.filter(function (l) { return l.folderId === folder.id; }));
      let html = '<div class="back-row" style="margin-bottom:var(--space-4);">' +
        '<button type="button" class="btn btn-sm" data-action="backToCategory">&larr; Back to ' + esc(category.name) + '</button>' +
        '<h2 class="section-title" style="margin:0;">' + icon('folder') + ' ' + esc(folder.name) + ' <span class="badge badge-role">' + esc(category.name) + '</span></h2>' +
        '</div>';

      html += '<div class="card-actions" style="margin-bottom:16px;">' +
        '<button type="button" class="btn btn-sm btn-primary" data-action="addLinkToFolder" data-category="' + category.id + '" data-folder="' + folder.id + '">Add Link</button>' +
        (manage ? '<button type="button" class="btn btn-sm" data-action="renameFolder" data-id="' + folder.id + '">Rename Folder</button>' +
          '<button type="button" class="btn btn-sm" data-action="moveFolder" data-id="' + folder.id + '">Move to Another Category</button>' +
          '<button type="button" class="btn btn-sm btn-danger" data-action="deleteFolder" data-id="' + folder.id + '">Delete Folder</button>' : '') +
        '</div>';

      html += '<section class="glass-panel team-section">';
      html += '<div class="panel-title-row"><h3 class="panel-title">Links in this folder (' + inFolder.length + ')</h3></div>';
      if (inFolder.length === 0) {
        html += emptyState('No links in this folder.', 'Save links into this folder using Add Link.', '<button type="button" class="btn btn-sm btn-primary" data-action="addLinkToFolder" data-category="' + category.id + '" data-folder="' + folder.id + '">Add Link</button>');
      } else {
        html += cardGrid(inFolder, 'active', '<p class="card-meta">No links in this folder.</p>');
      }
      html += '</section>';
      return html;
    } else {
      ui.folderId = null;
    }
  }

  // Category Overview View
  let html = '<div class="back-row" style="margin-bottom:var(--space-4);">' +
    '<button type="button" class="btn btn-sm" data-action="backCategories">&larr; All categories</button>' +
    '<h2 class="section-title" style="margin:0;">' + esc(category.name) + ' <span class="badge badge-role">' + esc(categoryOwnerLabel(category)) + '</span></h2>' +
    '</div>';

  html += '<div class="card-actions" style="margin-bottom:16px;">';
  if (canAddToCategory(category)) {
    html += '<button type="button" class="btn btn-sm btn-primary" data-action="addLink" data-category="' + category.id + '">Add Link here</button>';
  }
  if (manage) {
    html += '<button type="button" class="btn btn-sm" data-action="createFolder" data-id="' + category.id + '">Create Folder</button>' +
      '<button type="button" class="btn btn-sm" data-action="renameCategory" data-id="' + category.id + '">Rename Category</button>' +
      '<button type="button" class="btn btn-sm btn-danger" data-action="deleteCategory" data-id="' + category.id + '">Delete Category</button>';
  } else {
    html += '<span class="card-meta">Only team Managers can change this shared category.</span>';
  }
  html += '</div>';

  // Created Folders section displayed as clean rectangular cards
  html += '<section class="glass-panel team-section" style="margin-bottom:var(--space-5);">';
  html += '<div class="panel-title-row"><h3 class="panel-title">' + icon('folder') + ' Folders (' + folders.length + ')</h3>' +
    (manage ? '<button type="button" class="btn btn-sm btn-primary" data-action="createFolder" data-id="' + category.id + '">Create Folder</button>' : '') +
    '</div>';

  if (folders.length === 0) {
    html += emptyState('No folders in this category', 'Create folders to organise links inside this category.', manage ? '<button type="button" class="btn btn-sm btn-primary" data-action="createFolder" data-id="' + category.id + '">Create Folder</button>' : '');
  } else {
    html += '<div class="folder-grid">' + folders.map(function (f) {
      const folderLinks = visibleLinks('Active').filter(function (l) { return l.categoryId === category.id && l.folderId === f.id; });
      let fItems = '';
      if (manage) {
        fItems += menuItem('moveFolder', f.id, 'Move to Another Category') +
          menuItem('renameFolder', f.id, 'Rename') +
          menuItem('deleteFolder', f.id, 'Delete', { danger: true });
      } else {
        fItems += '<div class="menu-note">Read-only folder.</div>';
      }
      return '<article class="glass-card folder-card' + (ui.openMenu === 'fld' + f.id ? ' menu-open' : '') + '">' +
        '<div class="card-head"><h3>' + icon('folder') + ' ' + esc(f.name) + '</h3></div>' +
        '<p class="cat-stat">' + folderLinks.length + ' link' + (folderLinks.length === 1 ? '' : 's') + '</p>' +
        '<div class="card-actions" style="margin-top:auto;padding-top:8px;">' +
          '<button type="button" class="btn btn-sm btn-primary" data-action="openFolder" data-id="' + f.id + '" data-category="' + category.id + '">Open</button>' +
          menuHtml('fld' + f.id, fItems) +
        '</div>' +
      '</article>';
    }).join('') + '</div>';
  }
  html += '</section>';

  // Category-level links (loose links with no folder, or category overview)
  const loose = applySearch(links.filter(function (l) { return !l.folderId || !folderById(l.folderId); }));
  html += '<section class="glass-panel team-section">';
  html += '<div class="panel-title-row"><h3 class="panel-title">Links in category (no folder) (' + loose.length + ')</h3></div>';
  if (loose.length === 0) {
    html += '<p class="card-meta">No category-level links outside folders.</p>';
  } else {
    html += cardGrid(loose, 'active', '<p class="card-meta">No category-level links match your search filter.</p>');
  }
  html += '</section>';

  return html;
}

// PAGE 4a: Teams list
function pageTeams() {
  const text = ui.search.trim().toLowerCase();
  const list = myTeams().filter(function (t) {
    if (text === '') { return true; }
    const inName = t.name.toLowerCase().indexOf(text) !== -1;
    const inDesc = t.description ? t.description.toLowerCase().indexOf(text) !== -1 : false;
    return inName || inDesc;
  });
  if (list.length === 0) {
    return ui.search.trim()
      ? emptyState('No matching teams', 'No teams match "' + esc(ui.search.trim()) + '".', '<button type="button" class="btn" data-action="clearFilters">Clear search</button>')
      : emptyState('No teams joined', 'You are not part of any teams yet. Create a team to collaborate on shared links.', '<button type="button" class="btn btn-primary" data-action="createTeam">Create Team</button>');
  }
  return '<div class="card-grid">' + list.map(function (t) {
    const role = myRole(t);
    const isManager = role === 'Manager';
    const sharedCount = data.categories.filter(function (c) { return c.ownerType === 'team' && c.ownerId === t.id; }).length;
    const managers = t.members.filter(function (m) { return m.role === 'Manager'; }).map(function (m) { return userName(m.userId); }).join(', ') || 'None';
    let items = '';
    if (isManager) {
      items += menuItem('editTeam', t.id, 'Edit Team Details') +
        menuItem('addMember', t.id, 'Add Member') +
        menuItem('createSharedCategory', t.id, 'Create Shared Category') +
        menuItem('deleteTeam', t.id, 'Delete Team', { danger: true });
    } else {
      items += '<div class="menu-note">Team Member: Read-only access to team settings.</div>';
    }
    return '<article class="glass-card team-card' + (ui.openMenu === 'team' + t.id ? ' menu-open' : '') + '">' +
      '<div class="card-head"><h3>' + esc(t.name) + '</h3><span class="badge badge-role">Role: ' + role + '</span></div>' +
      (t.description ? '<p class="team-desc">' + esc(t.description) + '</p>' : '<p class="team-desc" style="font-style:italic">No description provided.</p>') +
      '<div class="team-meta">' +
        '<span><b>' + t.members.length + '</b> member' + (t.members.length === 1 ? '' : 's') + '</span> · ' +
        '<span><b>' + sharedCount + '</b> shared categor' + (sharedCount === 1 ? 'y' : 'ies') + '</span> · ' +
        '<span>Manager: <b class="team-managers">' + esc(managers) + '</b></span>' +
      '</div>' +
      '<div class="card-actions" style="margin-top:auto;padding-top:10px">' +
        '<button type="button" class="btn btn-sm btn-primary" data-action="viewTeam" data-id="' + t.id + '">View Details</button>' +
        (isManager ? '<button type="button" class="btn btn-sm" data-action="addMember" data-id="' + t.id + '">Add Member</button>' : '') +
        menuHtml('team' + t.id, items) +
      '</div>' +
    '</article>';
  }).join('') + '</div>';
}

// PAGE 4b: One team (members, roles, shared categories and folders, shared links)
function pageTeamDetail() {
  const team = teamById(ui.teamId);
  if (!team || myRole(team) === null) { ui.teamId = null; return pageTeams(); }
  const role = myRole(team);
  const isManager = role === 'Manager';
  const managers = team.members.filter(function (m) { return m.role === 'Manager'; }).map(function (m) { return userName(m.userId); }).join(', ') || 'None';
  const sharedCats = data.categories.filter(function (c) { return c.ownerType === 'team' && c.ownerId === team.id; });
  const teamLinks = visibleLinks('Active').filter(function (l) { const c = categoryById(l.categoryId); return c && c.ownerType === 'team' && c.ownerId === team.id; });

  let html = '<div class="back-row" style="margin-bottom:var(--space-4);">' +
    '<button type="button" class="btn btn-sm" data-action="backTeams">&larr; Back to Teams</button>' +
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<h2 class="section-title" style="margin:0">' + esc(team.name) + '</h2>' +
      '<span class="badge badge-role">Your role: ' + role + '</span>' +
    '</div>' +
    '<div class="card-actions" style="margin-left:auto">' +
      (isManager ? '<button type="button" class="btn btn-sm" data-action="editTeam" data-id="' + team.id + '">Edit Team</button>' : '') +
      (isManager ? '<button type="button" class="btn btn-sm btn-primary" data-action="addMember" data-id="' + team.id + '">Add Member</button>' : '') +
    '</div>' +
  '</div>';

  // 1. Team Information / Detail Section
  html += '<section class="glass-panel team-section">' +
    '<div class="panel-title-row"><h3 class="panel-title">Team Information</h3><span class="badge badge-role">Your role: ' + role + '</span></div>' +
    (team.description ? '<p class="team-desc" style="font-size:14px;margin-bottom:12px">' + esc(team.description) + '</p>' : '') +
    '<div class="team-meta" style="font-size:13px;margin-bottom:14px;">' +
      '<span>Team Manager(s): <b class="team-managers">' + esc(managers) + '</b></span> · ' +
      '<span>Members: <b>' + team.members.length + '</b></span> · ' +
      '<span>Shared Categories: <b>' + sharedCats.length + '</b></span> · ' +
      '<span>Shared Links: <b>' + teamLinks.length + '</b></span>' +
    '</div>' +
    '<div class="note-box" style="margin-bottom:16px;">' + (isManager
      ? '<b>Manager Permissions Active:</b> You have administrative rights to edit team details, add or remove members, change roles, create shared categories, and manage any shared links in this team.'
      : '<b>Member Access (Read-Only Management):</b> You can view team resources, contribute new links, and edit your own contributed links. Member management and shared category creation are reserved for Team Managers.') +
    '</div>' +
    '<div class="panel-title-row"><h4 style="margin:0;font-size:15px;font-weight:600;color:var(--text-strong);">Team Members (' + team.members.length + ')</h4>' +
    (isManager ? '<button type="button" class="btn btn-sm btn-primary" data-action="addMember" data-id="' + team.id + '">Add Member</button>' : '') +
    '</div>' +
    '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Permissions</th><th>Actions</th></tr></thead><tbody>' +
    team.members.map(function (member) {
      const user = userById(member.userId);
      const isSelf = user && user.id === currentUser().id;
      const roleCell = isManager
        ? '<select class="select" style="width:auto;padding:6px 10px" data-change="changeRole" data-team="' + team.id + '" data-user="' + member.userId + '" aria-label="Role of ' + esc(user ? user.name : 'member') + '">' +
            '<option value="Manager"' + (member.role === 'Manager' ? ' selected' : '') + '>Manager</option>' +
            '<option value="Member"' + (member.role === 'Member' ? ' selected' : '') + '>Member</option>' +
          '</select>'
        : '<span class="badge badge-role">' + member.role + '</span>';

      const permDesc = member.role === 'Manager' ? 'Full team control' : 'Can view &amp; contribute';

      const actionBtn = isManager
        ? '<button type="button" class="btn btn-sm btn-danger" data-action="removeMember" data-team="' + team.id + '" data-user="' + member.userId + '">Remove' + (isSelf ? ' (Leave)' : '') + '</button>'
        : '<span class="card-meta">Read-only</span>';

      return '<tr>' +
        '<td><b>' + esc(user ? user.name : 'Former user') + '</b>' + (isSelf ? ' <span class="badge badge-active" style="font-size:10px">You</span>' : '') + '</td>' +
        '<td>' + esc(user ? user.email : '-') + '</td>' +
        '<td>' + roleCell + '</td>' +
        '<td><span class="card-meta">' + permDesc + '</span></td>' +
        '<td>' + actionBtn + '</td>' +
      '</tr>';
    }).join('') + '</tbody></table></div></section>';

  // 2. Shared Categories Section
  html += '<section class="glass-panel team-section">' +
    '<div class="panel-title-row"><h3 class="panel-title">Shared Categories (' + sharedCats.length + ')</h3>' +
    (isManager ? '<button type="button" class="btn btn-sm btn-primary" data-action="createSharedCategory" data-id="' + team.id + '">Create Shared Category</button>' : '') +
    '</div>';
  if (sharedCats.length === 0) {
    html += emptyState('No shared categories yet', 'Shared categories allow team members to organise links into common folders.', isManager ? '<button type="button" class="btn btn-sm btn-primary" data-action="createSharedCategory" data-id="' + team.id + '">Create Shared Category</button>' : '');
  } else {
    html += '<div class="card-grid">' + sharedCats.map(function (c) {
      const folders = data.folders.filter(function (f) { return f.categoryId === c.id; });
      const count = visibleLinks('Active').filter(function (l) { return l.categoryId === c.id; }).length;
      return '<article class="glass-card cat-card' + (ui.openMenu === 'cat' + c.id ? ' menu-open' : '') + '"><h3>' + esc(c.name) + '</h3><p class="cat-stat">' + count + ' active link' + (count === 1 ? '' : 's') + ' · ' + folders.length + ' folder' + (folders.length === 1 ? '' : 's') + '</p>' +
        '<div class="tag-row">' + (folders.length ? folders.map(function (f) { return '<span class="tag">' + icon('folder') + ' ' + esc(f.name) + '</span>'; }).join('') : '<span class="card-meta">No folders</span>') + '</div>' +
        '<div class="card-actions" style="margin-top:auto;padding-top:8px"><button type="button" class="btn btn-sm btn-primary" data-action="viewCategoryFromTeam" data-id="' + c.id + '">Open Category</button></div></article>';
    }).join('') + '</div>';
  }
  html += '</section>';

  // 3. Shared Links Section
  const filteredLinks = applySearch(teamLinks);
  html += '<section class="glass-panel team-section">' +
    '<div class="panel-title-row"><h3 class="panel-title">Shared Links (' + teamLinks.length + ')</h3>' +
    (sharedCats.length > 0 ? '<button type="button" class="btn btn-sm btn-primary" data-action="addLink" data-category="' + sharedCats[0].id + '">Add Link to Team</button>' : '') +
    '</div>';

  if (teamLinks.length === 0) {
    html += emptyState('No shared links in this team', 'Team members can save links into shared categories to collaborate.', sharedCats.length > 0 ? '<button type="button" class="btn btn-sm btn-primary" data-action="addLink" data-category="' + sharedCats[0].id + '">Add Link</button>' : '');
  } else {
    html += cardGrid(filteredLinks, 'active', '<p class="card-meta">No shared links matched your search filter.</p>');
  }
  html += '</section>';

  return html;
}

// PAGE 5: Favourites (only active links starred by the signed-in user)
function pageFavourites() {
  const list = applySearch(favouriteLinks());
  const empty = ui.search.trim()
    ? emptyState('No links found', 'No favourite matches "' + esc(ui.search.trim()) + '".', '<button type="button" class="btn" data-action="clearFilters">Clear search</button>')
    : emptyState('No favourites', 'Tap the star on a link to add it here.', '<button type="button" class="btn" data-action="nav" data-view="links">Go to My Link</button>');
  return cardGrid(list, 'active', empty);
}

// PAGE 6: Archive
function pageArchive() {
  const list = applySearch(visibleLinks('Archived'));
  const empty = ui.search.trim()
    ? emptyState('No links found', 'No archived links match "' + esc(ui.search.trim()) + '".', '<button type="button" class="btn" data-action="clearFilters">Clear search</button>')
    : emptyState('Archive is empty', 'Links you archive appear here. Restore them any time.', '');
  return '<div class="note-box">Archived links are kept but they are not active and are never health-checked.</div>' +
    cardGrid(list, 'archive', empty);
}

// PAGE 7: Trash
function pageTrash() {
  const list = applySearch(visibleLinks('Deleted'));
  const empty = ui.search.trim()
    ? emptyState('No links found', 'No trash links match "' + esc(ui.search.trim()) + '".', '<button type="button" class="btn" data-action="clearFilters">Clear search</button>')
    : emptyState('Trash is empty', 'Deleted links appear here.', '');
  return '<div class="note-box">Deleted links stay here until you restore them or delete them permanently. Their short URLs do not work while they are in the Trash.</div>' +
    cardGrid(list, 'trash', empty);
}

// PAGE 8: Settings (profile, display preferences, sign out)
function pageSettings() {
  const user = currentUser();
  return '<div class="settings-grid">' +
    '<section class="glass-panel"><h2 class="panel-title">Profile</h2><form id="profileForm" novalidate>' +
    '<div class="field"><label for="setName">Name</label><input class="input" id="setName" value="' + esc(user.name) + '"></div>' +
    '<div class="field"><label for="setEmail">Email</label><input class="input" id="setEmail" value="' + esc(user.email) + '" disabled></div>' +
    '<p class="form-error" id="profileError" role="alert"></p><button type="submit" class="btn btn-primary">Save Profile</button></form></section>' +
    '<section class="glass-panel"><h2 class="panel-title">Display preferences</h2>' +
    '<label class="switch-row">Compact link cards<input type="checkbox" data-change="pref" data-pref="compact"' + (data.settings.compact ? ' checked' : '') + '></label>' +
    '<label class="switch-row">Dark theme<input type="checkbox" data-change="pref" data-pref="dark"' + (data.settings.theme === 'dark' ? ' checked' : '') + '></label></section></div>';
}

/* ---------------------------------------------------------------------
   11. LINK ACTIONS
   --------------------------------------------------------------------- */
// Builds the <option> list of categories the user may add links to, grouped as Personal / Team.
function categoryOptions(selectedId, extraCategory) {
  const me = currentUser();
  const options = data.categories.filter(function (c) { return canAddToCategory(c) || c.id === extraCategory; });
  const personal = options.filter(function (c) { return c.ownerType === 'user' && c.ownerId === me.id; });
  const shared = options.filter(function (c) { return c.ownerType === 'team'; });
  function opt(c) { return '<option value="' + c.id + '"' + (c.id === selectedId ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }
  return (personal.length ? '<optgroup label="Personal">' + personal.map(opt).join('') + '</optgroup>' : '') +
    (shared.length ? '<optgroup label="Shared (team)">' + shared.map(function (c) { return '<option value="' + c.id + '"' + (c.id === selectedId ? ' selected' : '') + '>' + esc(c.name) + ' - ' + esc(categoryOwnerLabel(c)) + '</option>'; }).join('') + '</optgroup>' : '');
}
// Builds the <option> list of folders inside a category.
function folderOptions(categoryId, selectedId) {
  let html = '<option value="">No folder (category level)</option>';
  data.folders.filter(function (f) { return f.categoryId === categoryId; }).forEach(function (f) {
    html += '<option value="' + f.id + '"' + (f.id === selectedId ? ' selected' : '') + '>' + esc(f.name) + '</option>';
  });
  return html;
}

// Opens the Add Link / Edit Link form. `link` is null when adding. `preset` can pre-select a category.
function openLinkForm(link, preset) {
  const editing = !!link;
  const startCategory = editing ? link.categoryId : (preset && preset.categoryId) || '';
  const categories = categoryOptions(startCategory, editing ? link.categoryId : '');
  if (!categories) { toast('Create a category first.', true); return; }
  const firstCategory = startCategory || (data.categories.filter(canAddToCategory)[0] || {}).id;
  const body =
    '<div class="field"><label for="f_title">Title</label><input class="input" id="f_title" name="title" value="' + esc(editing ? link.title : '') + '"></div>' +
    '<div class="field"><label for="f_url">Original URL</label><input class="input" id="f_url" name="url" placeholder="https://example.com" value="' + esc(editing ? link.url : '') + '"></div>' +
    '<div class="field"><label for="f_description">Description (optional)</label><textarea class="textarea" id="f_description" name="description">' + esc(editing ? link.description : '') + '</textarea></div>' +
    '<div class="field"><label for="f_tags">Tags (optional)</label><input class="input" id="f_tags" name="tags" placeholder="study, notes" value="' + esc(editing ? link.tags.join(', ') : '') + '"><span class="hint">Separate tags with commas.</span></div>' +
    '<div class="field"><label for="f_category">Category</label><select class="select" id="f_category" name="category" data-change="folderList">' + categoryOptions(firstCategory, editing ? link.categoryId : '') + '</select></div>' +
    '<div class="field"><label for="f_folder">Folder (optional)</label><select class="select" id="f_folder" name="folder">' + folderOptions(firstCategory, editing ? link.folderId : (preset && preset.folderId) || '') + '</select></div>';
  openModal(editing ? 'Edit Link' : 'Add Link', body, editing ? 'Save Changes' : 'Save Link', function (form) {
    const title = String(form.get('title')).trim();
    const url = String(form.get('url')).trim();
    const categoryId = form.get('category');
    if (title === '') { return 'Please enter a title.'; }
    if (!isValidUrl(url)) { return 'Please enter a valid web address starting with http:// or https://'; }
    if (!categoryId || !categoryById(categoryId)) { return 'Please choose a category.'; }
    const values = { title: title, url: url, description: String(form.get('description')).trim(), tags: parseTags(form.get('tags')), categoryId: categoryId, folderId: form.get('folder') || '' };
    if (editing) {
      const urlChanged = link.url !== url;
      Object.assign(link, values);
      if (urlChanged) { runInstantCheck(link); }
      toast('Link updated.');
    } else {
      const created = makeLink(Object.assign(values, { id: newId('l'), createdBy: currentUser().id, createdAt: Date.now() }));
      data.links.push(created);
      runInstantCheck(created); // instant (simulated) health check
      toast('Link saved. A simulated health check was run.');
    }
    saveData();
    render();
  });
}

// Opens the Move Link form (change category and folder).
function openMoveForm(link) {
  const body = '<div class="field"><label for="m_category">Category</label><select class="select" id="m_category" name="category" data-change="folderList">' + categoryOptions(link.categoryId, link.categoryId) + '</select></div>' +
    '<div class="field"><label for="m_folder">Folder</label><select class="select" id="m_folder" name="folder">' + folderOptions(link.categoryId, link.folderId) + '</select></div>';
  openModal('Move "' + link.title + '"', body, 'Move Link', function (form) {
    const categoryId = form.get('category');
    if (!categoryById(categoryId)) { return 'Please choose a category.'; }
    link.categoryId = categoryId;
    link.folderId = form.get('folder') || '';
    saveData(); render(); toast('Link moved.');
  });
}

// Checks the signed-in user may change this link; shows a message if not.
function allowedToChange(link) {
  if (canManageLink(link)) { return true; }
  toast('Only the owner or a team Manager can change this link.', true);
  return false;
}

// Star control: add or remove a favourite for the signed-in user only.
function toggleFavourite(linkId) {
  const me = currentUser();
  const list = data.favourites[me.id] || [];
  const position = list.indexOf(linkId);
  if (position === -1) { list.push(linkId); } else { list.splice(position, 1); }
  data.favourites[me.id] = list;
  saveData();
  render();
}

// Open: counts a "use" and opens the original URL in a new tab.
function openLinkAction(linkId) {
  const link = linkById(linkId);
  if (!link) { return; }
  link.uses = link.uses + 1;
  saveData();
  window.open(link.url, '_blank', 'noopener');
  render();
}

// Archive: state becomes Archived (health checks stop).
function archiveLink(linkId) {
  const link = linkById(linkId);
  if (!link || !allowedToChange(link)) { return; }
  link.state = 'Archived';
  ui.openMenu = null;
  saveData(); render(); toast('Moved to Archive.');
}

// Delete: asks first, then state becomes Deleted (Trash).
function deleteLink(linkId) {
  const link = linkById(linkId);
  if (!link || !allowedToChange(link)) { return; }
  ui.openMenu = null;
  confirmBox('Move to Trash?', 'Move "<b>' + esc(link.title) + '</b>" to the Trash? Its short URL will stop working while it is in the Trash.', 'Move to Trash', function () {
    link.state = 'Deleted';
    saveData(); render(); toast('Moved to Trash.');
  });
}

// Restore: state returns to Active and an instant simulated health check runs.
function restoreLink(linkId) {
  const link = linkById(linkId);
  if (!link || !allowedToChange(link)) { return; }
  link.state = 'Active';
  runInstantCheck(link);
  saveData(); render(); toast('Link restored to Active.');
}

// Permanently Delete: confirmation, then the record is removed completely.
function purgeLink(linkId) {
  const link = linkById(linkId);
  if (!link || !allowedToChange(link)) { return; }
  confirmBox('Delete permanently?', 'This will permanently remove "<b>' + esc(link.title) + '</b>". This cannot be undone.', 'Delete Permanently', function () {
    data.links = data.links.filter(function (l) { return l.id !== linkId; });
    Object.keys(data.favourites).forEach(function (uid) {
      data.favourites[uid] = data.favourites[uid].filter(function (id) { return id !== linkId; });
    });
    saveData(); render(); toast('Link permanently deleted.');
  });
}

// Generate Short URL: reuse the existing code or generate one, then show the dialog.
function showShortUrl(linkId) {
  const link = linkById(linkId);
  if (!link) { return; }
  ui.openMenu = null;
  let created = false;
  if (link.shortCode === '') {
    if (window.fetch && window.location && window.location.protocol.indexOf('http') === 0) {
      fetch('/api/links/' + encodeURIComponent(link.id) + '/shorten', { method: 'POST' })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (resData) {
          if (resData && (resData.shortCode || resData.short_code)) {
            link.shortCode = resData.shortCode || resData.short_code;
            saveData(); render();
          }
        }).catch(function () {});
    }
    link.shortCode = generateCode();
    created = true;
    saveData();
    render();
  }
  const fullShort = shortUrlOf(link);
  const body = '<p class="card-meta" style="margin-bottom:12px">Short URL generated for this link. You can copy, share, or open the link directly.</p>' +
    '<div class="field"><label>Short URL' + (created ? ' (generated)' : ' (active)') + '</label><div class="copy-row"><code>' + esc(fullShort) + '</code><button type="button" class="btn btn-sm btn-primary" data-action="copyShort" data-id="' + link.id + '">Copy Short URL</button></div></div>' +
    '<div class="field"><label>Original Destination URL</label><div class="copy-row"><code>' + esc(link.url) + '</code><button type="button" class="btn btn-sm" data-action="copyUrl" data-id="' + link.id + '">Copy Original URL</button></div></div>' +
    '<div style="display:flex;gap:8px;align-items:center;margin-top:10px;"><a href="' + esc(link.url) + '" target="_blank" rel="noopener noreferrer" class="btn btn-sm">Visit Destination</a><button type="button" class="btn btn-sm" data-action="testShort" data-id="' + link.id + '">Verify Short URL</button></div><div id="shortTest" class="result-box hidden" role="status" style="margin-top:10px"></div>';
  openModal('Short URL for "' + link.title + '"', body, null, null);
}

/* ---------------------------------------------------------------------
   12. CATEGORIES, FOLDERS AND TEAMS
   --------------------------------------------------------------------- */
// Is this category name already used in the same space (same owner)?
function categoryNameTaken(name, ownerType, ownerId, ignoreId) {
  return data.categories.some(function (c) {
    return c.id !== ignoreId && c.ownerType === ownerType && c.ownerId === ownerId && c.name.toLowerCase() === name.toLowerCase();
  });
}

// Create Category (personal, or shared when the user manages a team).
function openCreateCategory(presetTeamId) {
  const me = currentUser();
  let ownerOptions = '<option value="user:' + me.id + '">Personal (only me)</option>';
  managedTeams().forEach(function (t) {
    ownerOptions += '<option value="team:' + t.id + '"' + (t.id === presetTeamId ? ' selected' : '') + '>Shared with team: ' + esc(t.name) + '</option>';
  });
  const body = '<div class="field"><label for="cat_name">Category name</label><input class="input" id="cat_name" name="name"></div>' +
    '<div class="field"><label for="cat_owner">Who owns it?</label><select class="select" id="cat_owner" name="owner">' + ownerOptions + '</select><span class="hint">Only team Managers can create shared categories.</span></div>';
  openModal('Create Category', body, 'Create Category', function (form) {
    const name = String(form.get('name')).trim();
    const parts = String(form.get('owner')).split(':');
    if (name === '') { return 'Please enter a category name.'; }
    if (categoryNameTaken(name, parts[0], parts[1], '')) { return 'That name is already used in this space.'; }
    if (parts[0] === 'team' && myRole(teamById(parts[1])) !== 'Manager') { return 'Only team Managers can create shared categories.'; }
    data.categories.push({ id: newId('c'), name: name, ownerType: parts[0], ownerId: parts[1] });
    saveData(); render(); toast('Category created.');
  });
}

// Rename Category.
function openRenameCategory(categoryId) {
  const category = categoryById(categoryId);
  if (!category || !canManageCategory(category)) { toast('Only the owner or a team Manager can rename this category.', true); return; }
  ui.openMenu = null;
  openModal('Rename Category', '<div class="field"><label for="rn">New name</label><input class="input" id="rn" name="name" value="' + esc(category.name) + '"></div>', 'Rename', function (form) {
    const name = String(form.get('name')).trim();
    if (name === '') { return 'Please enter a name.'; }
    if (categoryNameTaken(name, category.ownerType, category.ownerId, category.id)) { return 'That name is already used in this space.'; }
    category.name = name;
    saveData(); render(); toast('Category renamed.');
  });
}

// Delete Category: blocked while it still has active links.
function deleteCategory(categoryId) {
  const category = categoryById(categoryId);
  if (!category || !canManageCategory(category)) { toast('Only the owner or a team Manager can delete this category.', true); return; }
  ui.openMenu = null;
  const activeCount = data.links.filter(function (l) { return l.categoryId === categoryId && l.state === 'Active'; }).length;
  if (activeCount > 0) { toast('This category still has ' + activeCount + ' active link(s). Move them to another category first.', true); render(); return; }
  confirmBox('Delete category?', 'Delete "<b>' + esc(category.name) + '</b>" and its folders?', 'Delete Category', function () {
    data.folders = data.folders.filter(function (f) { return f.categoryId !== categoryId; });
    data.links.forEach(function (l) { if (l.categoryId === categoryId) { l.categoryId = ''; l.folderId = ''; } });
    data.categories = data.categories.filter(function (c) { return c.id !== categoryId; });
    ui.categoryId = null;
    saveData(); render(); toast('Category deleted.');
  });
}

// Create Folder inside a category.
function openCreateFolder(categoryId) {
  const category = categoryById(categoryId);
  if (!category || !canManageCategory(category)) { toast('Only the owner or a team Manager can create folders here.', true); return; }
  ui.openMenu = null;
  openModal('Create Folder in "' + category.name + '"', '<div class="field"><label for="fo">Folder name</label><input class="input" id="fo" name="name"></div>', 'Create Folder', function (form) {
    const name = String(form.get('name')).trim();
    if (name === '') { return 'Please enter a folder name.'; }
    if (data.folders.some(function (f) { return f.categoryId === categoryId && f.name.toLowerCase() === name.toLowerCase(); })) { return 'A folder with that name already exists in this category.'; }
    data.folders.push({ id: newId('f'), categoryId: categoryId, name: name });
    saveData(); render(); toast('Folder created.');
  });
}

// Rename Folder.
function openRenameFolder(folderId) {
  const folder = folderById(folderId);
  const category = folder && categoryById(folder.categoryId);
  if (!folder || !category || !canManageCategory(category)) { toast('Only the owner or a team Manager can rename folders.', true); return; }
  openModal('Rename Folder', '<div class="field"><label for="rf">New name</label><input class="input" id="rf" name="name" value="' + esc(folder.name) + '"></div>', 'Rename', function (form) {
    const name = String(form.get('name')).trim();
    if (name === '') { return 'Please enter a name.'; }
    if (data.folders.some(function (f) { return f.id !== folder.id && f.categoryId === folder.categoryId && f.name.toLowerCase() === name.toLowerCase(); })) { return 'That folder name is already used.'; }
    folder.name = name;
    saveData(); render(); toast('Folder renamed.');
  });
}

// Move Folder to another category.
function openMoveFolder(folderId) {
  const folder = folderById(folderId);
  const currentCategory = folder && categoryById(folder.categoryId);
  if (!folder || !currentCategory || !canManageCategory(currentCategory)) {
    toast('Only the owner or a team Manager can move this folder.', true);
    return;
  }
  ui.openMenu = null;
  const me = currentUser();
  const validCategories = data.categories.filter(function (c) {
    return c.id !== currentCategory.id && canManageCategory(c);
  });
  if (validCategories.length === 0) {
    toast('No other categories available to move this folder to.', true);
    return;
  }
  const personal = validCategories.filter(function (c) { return c.ownerType === 'user' && c.ownerId === me.id; });
  const shared = validCategories.filter(function (c) { return c.ownerType === 'team'; });
  function opt(c) { return '<option value="' + c.id + '">' + esc(c.name) + (c.ownerType === 'team' ? ' (' + esc(categoryOwnerLabel(c)) + ')' : '') + '</option>'; }
  const optionsHtml = (personal.length ? '<optgroup label="Personal">' + personal.map(opt).join('') + '</optgroup>' : '') +
    (shared.length ? '<optgroup label="Shared (team)">' + shared.map(opt).join('') + '</optgroup>' : '');

  const body =
    '<p class="card-meta" style="margin-bottom:14px">Select the destination category for folder <b>"' + esc(folder.name) + '"</b>. All saved links in this folder will remain inside the folder.</p>' +
    '<div class="field"><label for="mf_category">Destination Category</label><select class="select" id="mf_category" name="destinationCategory" required>' + optionsHtml + '</select></div>';

  openModal('Move Folder: ' + folder.name, body, 'Move Folder', function (form) {
    const destId = form.get('destinationCategory');
    const destCat = categoryById(destId);
    if (!destCat || !canManageCategory(destCat)) { return 'Please select a valid destination category.'; }
    if (destCat.id === currentCategory.id) { return 'Destination category must be different from current category.'; }
    if (data.folders.some(function (f) { return f.categoryId === destCat.id && f.name.toLowerCase() === folder.name.toLowerCase(); })) {
      return 'A folder named "' + folder.name + '" already exists in ' + destCat.name + '.';
    }

    folder.categoryId = destCat.id;
    data.links.forEach(function (l) {
      if (l.folderId === folder.id) {
        l.categoryId = destCat.id;
      }
    });

    ui.categoryId = destCat.id;
    saveData();
    render();
    toast('Folder "' + folder.name + '" moved to "' + destCat.name + '".');
  });
}

// Delete Folder: its links move up to the category level.
function deleteFolder(folderId) {
  const folder = folderById(folderId);
  const category = folder && categoryById(folder.categoryId);
  if (!folder || !category || !canManageCategory(category)) { toast('Only the owner or a team Manager can delete folders.', true); return; }
  confirmBox('Delete folder?', 'Delete "<b>' + esc(folder.name) + '</b>"? Its links move up to the category "' + esc(category.name) + '".', 'Delete Folder', function () {
    data.links.forEach(function (l) { if (l.folderId === folderId) { l.folderId = ''; } });
    data.folders = data.folders.filter(function (f) { return f.id !== folderId; });
    if (ui.folderId === folderId) { ui.folderId = null; }
    saveData(); render(); toast('Folder deleted. Links moved to the category.');
  });
}

// Create Team: the creator automatically becomes its Manager.
function openCreateTeam() {
  const body =
    '<div class="field"><label for="tn">Team name <span style="color:var(--bad)">*</span></label><input class="input" id="tn" name="name" placeholder="e.g. Design Club" required><span class="hint">Give your team a clear, recognisable name.</span></div>' +
    '<div class="field"><label for="td">Team description (optional)</label><textarea class="textarea" id="td" name="description" placeholder="What is this team working on?"></textarea><span class="hint">Explain the purpose and resources shared within this team.</span></div>' +
    '<div class="note-box" style="margin-top:12px;margin-bottom:0"><b>Note:</b> As the creator, you will automatically become the Team Manager.</div>';

  openModal('Create Team', body, 'Create Team', function (form) {
    const name = String(form.get('name') || '').trim();
    const description = String(form.get('description') || '').trim();
    if (name === '') { return 'Please enter a team name.'; }
    if (name.length < 2) { return 'Team name must be at least 2 characters.'; }
    if (data.teams.some(function (t) { return t.name.toLowerCase() === name.toLowerCase(); })) { return 'A team with that name already exists.'; }
    const me = currentUser();
    const teamId = newId('t');
    data.teams.push({
      id: teamId,
      name: name,
      description: description,
      members: [{ userId: me.id, role: 'Manager' }]
    });
    logActivity('team', me.name + ' created team "' + name + '"');
    saveData();
    render();
    toast('Team "' + name + '" created successfully. You are the Manager.');
  });
}

// Edit Team details (name and description) - Managers only.
function openEditTeam(teamId) {
  const team = teamById(teamId);
  if (!team || myRole(team) !== 'Manager') { toast('Only team Managers can edit team settings.', true); return; }
  const body =
    '<div class="field"><label for="et_name">Team name <span style="color:var(--bad)">*</span></label><input class="input" id="et_name" name="name" value="' + esc(team.name) + '" required></div>' +
    '<div class="field"><label for="et_desc">Team description</label><textarea class="textarea" id="et_desc" name="description">' + esc(team.description || '') + '</textarea></div>';
  openModal('Edit Team Details', body, 'Save Changes', function (form) {
    const name = String(form.get('name') || '').trim();
    const description = String(form.get('description') || '').trim();
    if (name === '') { return 'Please enter a team name.'; }
    const existing = data.teams.find(function (t) { return t.name.toLowerCase() === name.toLowerCase() && t.id !== team.id; });
    if (existing) { return 'Another team with that name already exists.'; }
    team.name = name;
    team.description = description;
    logActivity('team', currentUser().name + ' updated details for team "' + name + '"');
    saveData();
    render();
    toast('Team details updated.');
  });
}

// Add Member by user selection or email (Managers only).
function openAddMember(teamId) {
  const team = teamById(teamId);
  if (!team || myRole(team) !== 'Manager') { toast('Only team Managers can add members.', true); return; }
  ui.openMenu = null;
  const currentMemberIds = team.members.map(function (m) { return m.userId; });
  const availableUsers = data.users.filter(function (u) { return u.role === 'User' && u.status === 'Active' && currentMemberIds.indexOf(u.id) === -1; });
  
  let userSelectOptions = '<option value="">-- Choose from registered users --</option>';
  availableUsers.forEach(function (u) {
    userSelectOptions += '<option value="' + esc(u.email) + '">' + esc(u.name) + ' (' + esc(u.email) + ')</option>';
  });

  const body =
    '<div class="field"><label for="am_select">Select a registered user</label><select class="select" id="am_select" name="userSelect" data-change="selectMemberUser">' + userSelectOptions + '</select><span class="hint">Choose an existing active user or type an email below.</span></div>' +
    '<div class="field"><label for="am_email">Or enter user email <span style="color:var(--bad)">*</span></label><input class="input" id="am_email" name="email" placeholder="name@example.com" required></div>' +
    '<div class="field"><label for="am_role">Assign Team Role</label><select class="select" id="am_role" name="role"><option value="Member">Member (can view and contribute links)</option><option value="Manager">Manager (can manage members and categories)</option></select></div>' +
    '<div class="note-box" style="margin-top:12px;margin-bottom:0"><b>Permissions:</b> Managers have full control over team members, shared folders, and links. Members can only edit links they personally created.</div>';

  openModal('Add Member to "' + esc(team.name) + '"', body, 'Add Member', function (form) {
    let email = String(form.get('email') || '').trim().toLowerCase();
    const selectedEmail = String(form.get('userSelect') || '').trim().toLowerCase();
    if (selectedEmail && !email) { email = selectedEmail; }
    if (!email) { return 'Please select a user or enter an email address.'; }
    if (!isValidEmail(email)) { return 'Please enter a valid email address.'; }
    const user = data.users.find(function (u) { return u.email.toLowerCase() === email; });
    if (!user) { return 'No user found with that email address.'; }
    if (user.role === 'Admin') { return 'Platform administrators cannot be added as regular team members.'; }
    if (user.status === 'Disabled') { return 'That user account is currently disabled.'; }
    if (team.members.some(function (m) { return m.userId === user.id; })) { return user.name + ' is already a member of this team.'; }
    const role = form.get('role') || 'Member';
    team.members.push({ userId: user.id, role: role });
    logActivity('member', user.name + ' joined team "' + team.name + '" as ' + role);
    saveData();
    render();
    toast(user.name + ' added to team as ' + role + '.');
  });
}

// Counts how many Managers a team has (a team must always keep one).
function managerCount(team) { return team.members.filter(function (m) { return m.role === 'Manager'; }).length; }

// Change a member's role (Managers only).
function changeRole(teamId, userId, newRole) {
  const team = teamById(teamId);
  if (!team || myRole(team) !== 'Manager') { toast('Only team Managers can change member roles.', true); render(); return; }
  const member = team.members.find(function (m) { return m.userId === userId; });
  if (!member) { return; }
  if (member.role === 'Manager' && newRole === 'Member' && managerCount(team) <= 1) {
    toast('Cannot demote the only Manager. A team must have at least one Manager.', true);
    render();
    return;
  }
  const oldRole = member.role;
  member.role = newRole;
  logActivity('role', userName(userId) + '\'s role in "' + team.name + '" changed to ' + newRole);
  saveData();
  render();
  toast(userName(userId) + '\'s role changed from ' + oldRole + ' to ' + newRole + '.');
}

// Remove a member after confirmation (their personal items are not touched).
function removeMember(teamId, userId) {
  const team = teamById(teamId);
  if (!team || myRole(team) !== 'Manager') { toast('Only team Managers can remove members.', true); return; }
  const member = team.members.find(function (m) { return m.userId === userId; });
  if (!member) { return; }
  if (member.role === 'Manager' && managerCount(team) <= 1) {
    toast('Cannot remove the only Manager. Promote another member before removing.', true);
    return;
  }
  const memberName = userName(userId);
  confirmBox('Remove member?', 'Are you sure you want to remove <b>' + esc(memberName) + '</b> from "' + esc(team.name) + '"? Their shared and personal items will remain safe.', 'Remove Member', function () {
    team.members = team.members.filter(function (m) { return m.userId !== userId; });
    logActivity('member', memberName + ' was removed from team "' + team.name + '"');
    if (userId === currentUser().id) { ui.teamId = null; }
    saveData();
    render();
    toast(memberName + ' was removed from the team.');
  });
}

// Deletes a team: shared categories and folders are removed and their links go to Trash.
function removeTeamData(teamId) {
  const sharedIds = data.categories.filter(function (c) { return c.ownerType === 'team' && c.ownerId === teamId; }).map(function (c) { return c.id; });
  data.links.forEach(function (l) { if (sharedIds.indexOf(l.categoryId) !== -1) { l.state = 'Deleted'; l.categoryId = ''; l.folderId = ''; } });
  data.folders = data.folders.filter(function (f) { return sharedIds.indexOf(f.categoryId) === -1; });
  data.categories = data.categories.filter(function (c) { return sharedIds.indexOf(c.id) === -1; });
  data.teams = data.teams.filter(function (t) { return t.id !== teamId; });
}
function deleteTeam(teamId) {
  const team = teamById(teamId);
  if (!team || myRole(team) !== 'Manager') { toast('Only team Managers can delete a team.', true); return; }
  ui.openMenu = null;
  confirmBox('Delete team?', 'Delete "<b>' + esc(team.name) + '</b>"? Its shared categories and folders are removed and its shared links move to the Trash.', 'Delete Team', function () {
    logActivity('team', currentUser().name + ' deleted team "' + team.name + '"');
    removeTeamData(teamId);
    ui.teamId = null;
    saveData(); render(); toast('Team deleted.');
  });
}

/* ---------------------------------------------------------------------
   13. ADMIN PAGES AND ACTIONS (admin role is re-checked for each action)
   --------------------------------------------------------------------- */
// Returns true only if the signed-in account is an Admin.
function requireAdmin() {
  const user = currentUser();
  if (user && user.role === 'Admin') { return true; }
  toast('Task blocked: admin role required.', true);
  return false;
}

// Admin overview: platform metrics, health chart and activity.
function pageAdminOverview() {
  const m = adminMetrics();
  const cards = [
    { label: 'Total Users', value: m.users, view: 'adminUsers', filter: 'all' },
    { label: 'Active Users', value: m.activeUsers, view: 'adminUsers', filter: 'active' },
    { label: 'Disabled Users', value: m.disabledUsers, view: 'adminUsers', filter: 'disabled' },
    { label: 'Total Teams', value: m.teams, view: 'adminTeams' },
    { label: 'Total Active Links', value: m.activeLinks, view: 'adminTeams' },
    { label: 'Healthy Links', value: m.healthy, view: 'adminTeams', type: 'healthy' },
    { label: 'Unhealthy Links', value: m.unhealthy, view: 'adminTeams', type: 'unhealthy' }
  ];
  let html = '<div class="metric-grid" style="grid-template-columns:repeat(auto-fit, minmax(160px, 1fr))">' + cards.map(function (c) {
    const typeClass = c.type ? ' type-' + c.type : '';
    return '<button type="button" class="metric-card admin-metric' + typeClass + '" data-action="goto" data-view="' + c.view + '"' + (c.filter ? ' data-filter="' + c.filter + '"' : '') + '>' +
      '<div class="metric-label">' + c.label + '</div><div class="metric-value">' + c.value + '</div></button>';
  }).join('') + '</div>';

  const activities = (data.activity || []).slice(0, 10);
  let activityFeedHtml = '';
  if (activities.length === 0) {
    activityFeedHtml = '<p class="card-meta" style="padding:16px 0">No platform activity recorded yet.</p>';
  } else {
    activityFeedHtml = '<div class="activity-feed">' + activities.map(function (act) {
      let iconName = 'bell';
      if (act.type === 'team') { iconName = 'users'; }
      else if (act.type === 'member' || act.type === 'role') { iconName = 'user'; }
      else if (act.type === 'link') { iconName = 'link'; }
      else if (act.type === 'health') { iconName = 'check'; }
      return '<div class="activity-feed-item">' +
        '<div class="activity-feed-icon">' + icon(iconName) + '</div>' +
        '<div class="activity-feed-body">' +
          '<div class="activity-feed-desc">' + esc(act.desc) + '</div>' +
          '<div class="activity-feed-time">' + timeAgo(act.timestamp) + '</div>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  html += '<div class="grid-2">' +
    '<section class="glass-panel">' +
      '<h2 class="panel-title">Platform Link Health</h2>' +
      '<div class="donut-wrap">' + donutHtml(m) + legendHtml(m, false) + '</div>' +
      '<p class="card-meta" style="margin-top:12px">Restricted and Not Verified are monitored states, not system failures.</p>' +
    '</section>' +
    '<section class="glass-panel">' +
      '<div class="panel-title-row"><h2 class="panel-title">Platform Activity Log</h2><span class="sim-label">Live system log</span></div>' +
      activityFeedHtml +
    '</section>' +
  '</div>';
  return html;
}

// Filters users list by search query and active status filter chip.
function filteredUsers() {
  const text = (ui.userSearch || '').trim().toLowerCase();
  const filter = ui.userFilter || 'all';
  return data.users.filter(function (u) {
    if (filter === 'active' && u.status !== 'Active') { return false; }
    if (filter === 'disabled' && u.status !== 'Disabled') { return false; }
    if (filter === 'admins' && u.role !== 'Admin') { return false; }
    if (text === '') { return true; }
    const inName = u.name.toLowerCase().indexOf(text) !== -1;
    const inEmail = u.email.toLowerCase().indexOf(text) !== -1;
    return inName || inEmail;
  });
}

// Builds desktop table rows for User Management.
function userRowsHtml() {
  const rows = filteredUsers();
  const me = currentUser();
  if (rows.length === 0) { return '<tr><td colspan="7" style="text-align:center;padding:24px">No users matched your filter criteria.</td></tr>'; }
  return rows.map(function (u) {
    const teams = teamsOfUser(u.id).map(function (t) { const m = t.members.find(function (x) { return x.userId === u.id; }); return esc(t.name) + ' (' + m.role + ')'; }).join(', ') || '-';
    const isSelf = u.id === me.id;
    const toggle = u.status === 'Active'
      ? '<button type="button" class="btn btn-sm" data-action="toggleUser" data-id="' + u.id + '"' + (isSelf ? ' disabled title="You cannot disable your own account"' : '') + '>Disable</button>'
      : '<button type="button" class="btn btn-sm" data-action="toggleUser" data-id="' + u.id + '">Enable</button>';
    return '<tr><td><b>' + esc(u.name) + '</b>' + (isSelf ? ' <span class="badge badge-active" style="font-size:10px">You</span>' : '') + '</td>' +
      '<td>' + esc(u.email) + '</td><td><span class="badge badge-role">' + u.role + '</span></td><td>' + teams + '</td>' +
      '<td><span class="badge badge-' + u.status.toLowerCase() + '">' + u.status + '</span></td><td>' + formatDate(u.registered) + '</td>' +
      '<td><div class="row-actions"><button type="button" class="btn btn-sm" data-action="viewUser" data-id="' + u.id + '">View</button><button type="button" class="btn btn-sm" data-action="editUser" data-id="' + u.id + '">Edit</button>' + toggle +
      '<button type="button" class="btn btn-sm btn-danger" data-action="deleteUser" data-id="' + u.id + '"' + (isSelf ? ' disabled title="You cannot delete your own account"' : '') + '>Delete</button></div></td></tr>';
  }).join('');
}

// Builds responsive mobile cards for User Management.
function userMobileCardsHtml() {
  const rows = filteredUsers();
  const me = currentUser();
  if (rows.length === 0) { return '<div class="empty-state"><h3>No users found</h3><p>Try adjusting your search query or status filter.</p></div>'; }
  return rows.map(function (u) {
    const teams = teamsOfUser(u.id).map(function (t) { const m = t.members.find(function (x) { return x.userId === u.id; }); return esc(t.name) + ' (' + m.role + ')'; }).join(', ') || 'No teams';
    const isSelf = u.id === me.id;
    const toggle = u.status === 'Active'
      ? '<button type="button" class="btn btn-sm" data-action="toggleUser" data-id="' + u.id + '"' + (isSelf ? ' disabled' : '') + '>Disable</button>'
      : '<button type="button" class="btn btn-sm" data-action="toggleUser" data-id="' + u.id + '">Enable</button>';
    return '<article class="user-mobile-card">' +
      '<div class="user-card-head">' +
        '<div><div class="user-card-name">' + esc(u.name) + (isSelf ? ' <span class="badge badge-active" style="font-size:10px">You</span>' : '') + '</div><div class="user-card-email">' + esc(u.email) + '</div></div>' +
        '<span class="badge badge-' + u.status.toLowerCase() + '">' + u.status + '</span>' +
      '</div>' +
      '<div class="user-card-meta">' +
        '<span class="badge badge-role">Role: ' + u.role + '</span>' +
        '<span class="card-meta">Joined ' + formatDate(u.registered) + '</span>' +
      '</div>' +
      '<div class="card-meta">Teams: ' + teams + '</div>' +
      '<div class="card-actions" style="margin-top:6px">' +
        '<button type="button" class="btn btn-sm" data-action="viewUser" data-id="' + u.id + '">View</button>' +
        '<button type="button" class="btn btn-sm" data-action="editUser" data-id="' + u.id + '">Edit</button>' +
        toggle +
        '<button type="button" class="btn btn-sm btn-danger" data-action="deleteUser" data-id="' + u.id + '"' + (isSelf ? ' disabled' : '') + '>Delete</button>' +
      '</div>' +
    '</article>';
  }).join('');
}

// Admin page: User Management.
function pageAdminUsers() {
  const currentFilter = ui.userFilter || 'all';
  const totalCount = data.users.length;
  const activeCount = data.users.filter(function (u) { return u.status === 'Active'; }).length;
  const disabledCount = data.users.filter(function (u) { return u.status === 'Disabled'; }).length;
  const adminCount = data.users.filter(function (u) { return u.role === 'Admin'; }).length;

  const chips = [
    { id: 'all', label: 'All Users (' + totalCount + ')' },
    { id: 'active', label: 'Active (' + activeCount + ')' },
    { id: 'disabled', label: 'Disabled (' + disabledCount + ')' },
    { id: 'admins', label: 'Admins (' + adminCount + ')' }
  ];

  const chipsHtml = '<div class="chip-row">' + chips.map(function (c) {
    const active = currentFilter === c.id;
    return '<button type="button" class="chip' + (active ? ' active' : '') + '" data-action="setUserFilter" data-filter="' + c.id + '"' + (active ? ' aria-pressed="true"' : '') + '>' + c.label + '</button>';
  }).join('') + '</div>';

  return '<section class="glass-panel">' +
    '<div class="panel-title-row">' +
      '<h2 class="panel-title">Registered Users</h2>' +
      '<label class="search-box" style="max-width:300px;height:40px">' +
        '<span>' + icon('search') + '</span>' +
        '<input id="userSearch" type="search" placeholder="Filter by name or email" value="' + esc(ui.userSearch) + '" aria-label="Filter users">' +
      '</label>' +
    '</div>' +
    chipsHtml +
    '<div class="table-wrap desktop-user-table"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Team</th><th>Status</th><th>Registered</th><th>Actions</th></tr></thead><tbody id="userRows">' + userRowsHtml() + '</tbody></table></div>' +
    '<div id="userMobileCards" class="user-mobile-cards">' + userMobileCardsHtml() + '</div>' +
    '<p class="card-meta" style="margin-top:14px">Simulated platform user directory: changes update local browser demo state.</p></section>';
}

// Builds team administration table rows.
function adminTeamRowsHtml() {
  const activeLinks = data.links.filter(function (l) { return l.state === 'Active'; });
  const text = (ui.adminTeamSearch || '').trim().toLowerCase();
  const teams = data.teams.filter(function (t) {
    if (text === '') { return true; }
    const inName = t.name.toLowerCase().indexOf(text) !== -1;
    const inManager = t.members.some(function (m) { return m.role === 'Manager' && userName(m.userId).toLowerCase().indexOf(text) !== -1; });
    return inName || inManager;
  });
  if (teams.length === 0) { return '<tr><td colspan="6" style="text-align:center;padding:20px">No teams match your search.</td></tr>'; }
  return teams.map(function (t) {
    const manager = t.members.filter(function (m) { return m.role === 'Manager'; }).map(function (m) { return esc(userName(m.userId)); }).join(', ') || '-';
    const catIds = data.categories.filter(function (c) { return c.ownerType === 'team' && c.ownerId === t.id; }).map(function (c) { return c.id; });
    const linkCount = activeLinks.filter(function (l) { return catIds.indexOf(l.categoryId) !== -1; }).length;
    return '<tr><td><b>' + esc(t.name) + '</b>' + (t.description ? '<br><small class="card-meta">' + esc(t.description) + '</small>' : '') + '</td>' +
      '<td>' + esc(manager) + '</td><td>' + t.members.length + '</td><td>' + catIds.length + '</td><td>' + linkCount + '</td>' +
      '<td><div class="row-actions"><button type="button" class="btn btn-sm" data-action="adminViewTeam" data-id="' + t.id + '">View Details</button><button type="button" class="btn btn-sm btn-danger" data-action="adminDeleteTeam" data-id="' + t.id + '">Delete</button></div></td></tr>';
  }).join('');
}

// Admin page: Teams and Platform Resources.
function pageAdminTeams() {
  const activeLinks = data.links.filter(function (l) { return l.state === 'Active'; });
  const resources = [
    ['Active links', activeLinks.length], ['Archived links', data.links.filter(function (l) { return l.state === 'Archived'; }).length],
    ['Links in Trash', data.links.filter(function (l) { return l.state === 'Deleted'; }).length], ['Short URL mappings', data.links.filter(function (l) { return l.shortCode !== ''; }).length],
    ['Personal categories', data.categories.filter(function (c) { return c.ownerType === 'user'; }).length], ['Shared categories', data.categories.filter(function (c) { return c.ownerType === 'team'; }).length],
    ['Folders', data.folders.length]
  ];
  return '<section class="glass-panel" style="margin-bottom:16px">' +
    '<div class="panel-title-row"><h2 class="panel-title">Platform Teams (' + data.teams.length + ')</h2>' +
    '<label class="search-box" style="max-width:300px;height:40px"><span>' + icon('search') + '</span><input id="adminTeamSearch" type="search" placeholder="Search teams or managers" value="' + esc(ui.adminTeamSearch) + '" aria-label="Search teams"></label></div>' +
    '<div class="table-wrap"><table><thead><tr><th>Team</th><th>Manager(s)</th><th>Members</th><th>Shared categories</th><th>Active links</th><th>Actions</th></tr></thead><tbody id="adminTeamRows">' + adminTeamRowsHtml() + '</tbody></table></div></section>' +
    '<section class="glass-panel"><h2 class="panel-title">Platform Resources Breakdown</h2><div class="activity-list">' + resources.map(function (r) { return '<div class="activity-item"><b>' + r[1] + '</b>' + r[0] + '</div>'; }).join('') + '</div><p class="card-meta" style="margin-top:12px">Admins view aggregate resource counts across the entire system. Personal bookmarks remain private.</p></section>';
}

// View User details (counts only).
function adminViewUser(userId) {
  if (!requireAdmin()) { return; }
  const u = userById(userId);
  if (!u) { return; }
  const personalCats = data.categories.filter(function (c) { return c.ownerType === 'user' && c.ownerId === u.id; }).length;
  const userTeams = teamsOfUser(u.id);
  const body = '<dl class="kv"><dt>Name</dt><dd>' + esc(u.name) + '</dd><dt>Email</dt><dd>' + esc(u.email) + '</dd><dt>Role</dt><dd>' + u.role + '</dd><dt>Status</dt><dd>' + u.status + '</dd><dt>Registered</dt><dd>' + formatDate(u.registered) + '</dd>' +
    '<dt>Teams</dt><dd>' + (userTeams.map(function (t) { const m = t.members.find(function (x) { return x.userId === u.id; }); return esc(t.name) + ' (' + (m ? m.role : 'Member') + ')'; }).join(', ') || 'None') + '</dd><dt>Personal categories</dt><dd>' + personalCats + ' (contents private)</dd></dl>';
  openModal('User Details: ' + u.name, body, null, null);
}

// Edit User: change name, role or team.
function adminEditUser(userId) {
  if (!requireAdmin()) { return; }
  const u = userById(userId);
  if (!u) { return; }
  const current = teamsOfUser(u.id);
  const teamOptions = '<option value="">None</option>' + data.teams.map(function (t) { return '<option value="' + t.id + '"' + (current.length && current[0].id === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('');
  const body = '<div class="field"><label for="eu_name">Name</label><input class="input" id="eu_name" name="name" value="' + esc(u.name) + '"></div>' +
    '<div class="field"><label for="eu_role">Role</label><select class="select" id="eu_role" name="role"><option' + (u.role === 'User' ? ' selected' : '') + '>User</option><option' + (u.role === 'Admin' ? ' selected' : '') + '>Admin</option></select></div>' +
    '<div class="field"><label for="eu_team">Team Assignment</label><select class="select" id="eu_team" name="team">' + teamOptions + '</select><span class="hint">Selecting a team adds the user as Member. Selecting None removes them from all teams.</span></div>';
  openModal('Edit User: ' + u.name, body, 'Save Changes', function (form) {
    const name = String(form.get('name')).trim();
    if (name === '') { return 'Please enter a name.'; }
    if (u.id === currentUser().id && form.get('role') !== u.role) { return 'You cannot change your own role.'; }
    u.name = name;
    u.role = form.get('role');
    const teamId = form.get('team');
    if (teamId === '') {
      data.teams.forEach(function (t) { t.members = t.members.filter(function (m) { return m.userId !== u.id; }); });
    } else {
      const team = teamById(teamId);
      if (!team.members.some(function (m) { return m.userId === u.id; })) { team.members.push({ userId: u.id, role: 'Member' }); }
    }
    logActivity('user', 'Platform Admin updated user account for ' + u.name);
    saveData(); render(); toast('User updated.');
  });
}

// Disable (with confirmation) or re-enable a user.
function adminToggleUser(userId) {
  if (!requireAdmin()) { return; }
  const u = userById(userId);
  if (!u) { return; }
  if (u.id === currentUser().id) { toast('You cannot disable your own account.', true); return; }
  if (u.status === 'Disabled') {
    u.status = 'Active';
    logActivity('status', 'Platform Admin enabled account for ' + u.name);
    saveData(); render(); toast('User ' + u.name + ' enabled.');
    return;
  }
  confirmBox('Disable user account?', 'Disable <b>' + esc(u.name) + '</b> (' + esc(u.email) + ')? They will not be able to sign in.', 'Disable Account', function () {
    u.status = 'Disabled';
    logActivity('status', 'Platform Admin disabled account for ' + u.name);
    saveData(); render(); toast('User ' + u.name + ' disabled.');
  });
}

// Delete a user (with confirmation). Team content stays; personal items are removed.
function adminDeleteUser(userId) {
  if (!requireAdmin()) { return; }
  const u = userById(userId);
  if (!u) { return; }
  if (u.id === currentUser().id) { toast('You cannot delete your own account.', true); return; }
  confirmBox('Delete user account?', 'Delete <b>' + esc(u.name) + '</b>? Their personal categories and links are removed. Shared team resources stay safe.', 'Delete User', function () {
    const personalIds = data.categories.filter(function (c) { return c.ownerType === 'user' && c.ownerId === u.id; }).map(function (c) { return c.id; });
    data.links = data.links.filter(function (l) { return personalIds.indexOf(l.categoryId) === -1; });
    data.folders = data.folders.filter(function (f) { return personalIds.indexOf(f.categoryId) === -1; });
    data.categories = data.categories.filter(function (c) { return personalIds.indexOf(c.id) === -1; });
    data.teams.forEach(function (t) { t.members = t.members.filter(function (m) { return m.userId !== u.id; }); });
    delete data.favourites[u.id];
    const deletedName = u.name;
    data.users = data.users.filter(function (x) { return x.id !== u.id; });
    logActivity('user', 'Platform Admin deleted user ' + deletedName);
    saveData(); render(); toast('User ' + deletedName + ' deleted.');
  });
}

// Admin: view a team's members and resources in detail.
function adminViewTeam(teamId) {
  if (!requireAdmin()) { return; }
  const t = teamById(teamId);
  if (!t) { return; }
  const managers = t.members.filter(function (m) { return m.role === 'Manager'; }).map(function (m) { return userName(m.userId); }).join(', ') || 'None';
  const sharedCats = data.categories.filter(function (c) { return c.ownerType === 'team' && c.ownerId === t.id; });
  const activeLinks = data.links.filter(function (l) {
    if (l.state !== 'Active') { return false; }
    return sharedCats.some(function (c) { return c.id === l.categoryId; });
  });

  const memberListHtml = t.members.map(function (m) {
    const u = userById(m.userId);
    return '<li><b>' + esc(u ? u.name : 'Former user') + '</b> (' + esc(u ? u.email : '-') + ') &ndash; <span class="badge badge-role">' + m.role + '</span></li>';
  }).join('');

  const catListHtml = sharedCats.length > 0
    ? sharedCats.map(function (c) {
        const folders = data.folders.filter(function (f) { return f.categoryId === c.id; }).map(function (f) { return f.name; }).join(', ');
        return '<li><b>' + esc(c.name) + '</b>' + (folders ? ' (Folders: ' + esc(folders) + ')' : '') + '</li>';
      }).join('')
    : '<li>No shared categories created yet.</li>';

  const body =
    '<dl class="kv">' +
      '<dt>Team Name</dt><dd>' + esc(t.name) + '</dd>' +
      '<dt>Description</dt><dd>' + esc(t.description || 'No description provided.') + '</dd>' +
      '<dt>Manager(s)</dt><dd>' + esc(managers) + '</dd>' +
      '<dt>Total Members</dt><dd>' + t.members.length + '</dd>' +
      '<dt>Shared Links</dt><dd>' + activeLinks.length + ' active links</dd>' +
    '</dl>' +
    '<h3 style="font-size:15px;margin:16px 0 8px;color:var(--text-strong)">Members (' + t.members.length + ')</h3>' +
    '<ul style="padding-left:18px;margin:0 0 14px;font-size:13px;line-height:1.7">' + memberListHtml + '</ul>' +
    '<h3 style="font-size:15px;margin:16px 0 8px;color:var(--text-strong)">Shared Categories (' + sharedCats.length + ')</h3>' +
    '<ul style="padding-left:18px;margin:0;font-size:13px;line-height:1.7">' + catListHtml + '</ul>';

  openModal('Team Administration: ' + t.name, body, null, null);
}

// Admin: delete a team (with confirmation).
function adminDeleteTeam(teamId) {
  if (!requireAdmin()) { return; }
  const t = teamById(teamId);
  if (!t) { return; }
  confirmBox('Delete team?', 'Delete "<b>' + esc(t.name) + '</b>"? Shared categories and folders are removed and shared links move to the Trash.', 'Delete Team', function () {
    logActivity('team', 'Platform Admin deleted team "' + t.name + '"');
    removeTeamData(teamId);
    saveData(); render(); toast('Team deleted.');
  });
}

/* ---------------------------------------------------------------------
   14. LOGIN, SIGN OUT AND EVENT LISTENERS
   --------------------------------------------------------------------- */
// Checks email + password for the given login page ('user' or 'admin'). Returns an error text or null.
function tryLogin(email, password, area) {
  const user = data.users.find(function (u) { return u.email.toLowerCase() === email.toLowerCase(); });
  if (!user) { return 'Email or password is incorrect.'; }
  if (user.password && user.password !== password) { return 'Email or password is incorrect.'; }
  if (user.status === 'Disabled') { return 'This account is disabled. Please contact an administrator.'; }
  if (area === 'admin' && user.role !== 'Admin') { return 'This account is not authorised for the admin area.'; }
  if (area === 'user' && user.role === 'Admin') { return 'Administrators must sign in on the Admin Login page.'; }
  data.session = { userId: user.id };
  saveData();
  ui.view = user.role === 'Admin' ? 'adminOverview' : 'overview';
  ui.search = ''; ui.healthFilter = 'all'; ui.categoryId = null; ui.teamId = null; ui.openMenu = null;
  const searchInput = $('globalSearch');
  if (searchInput) { searchInput.value = ''; }
  render();
  closeMobileMenu();
  return null;
}

// Signs out and returns to the login screen.
function signOut() {
  data.session = null;
  saveData();
  closeModal();
  closeMobileMenu();
  showAuth('user-login');
  toast('Signed out.');
}

function applyTheme() {
  const isDark = data.settings.theme === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  const btns = [$('themeBtn'), $('landingThemeBtn')];
  btns.forEach(function (btn) {
    if (btn) {
      btn.innerHTML = icon(isDark ? 'sun' : 'moon');
      btn.setAttribute('title', isDark ? 'Switch to light theme' : 'Switch to dark theme');
      btn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    }
  });
}

// Handles every form on the page (login, register, search, profile, modal form).
function handleSubmit(event) {
  const form = event.target;
  if (form.id === 'modalForm') {
    event.preventDefault();
    if (!modalHandler) { closeModal(); return; }
    const submitBtn = $('modalSubmit');
    if (submitBtn) { submitBtn.disabled = true; }
    const result = modalHandler(new FormData(form));
    if (typeof result === 'string') {
      $('formError').textContent = result;
      if (submitBtn) { submitBtn.disabled = false; }
    } else {
      closeModal();
    }
    return;
  }
  if (form.id === 'userLoginForm' || form.id === 'adminLoginForm') {
    event.preventDefault();
    const admin = form.id === 'adminLoginForm';
    const email = $(admin ? 'alEmail' : 'ulEmail').value.trim();
    const password = $(admin ? 'alPassword' : 'ulPassword').value;
    const errorBox = $(admin ? 'alError' : 'ulError');
    if (!isValidEmail(email)) { errorBox.textContent = 'Please enter a valid email address.'; return; }
    if (password === '') { errorBox.textContent = 'Please enter your password.'; return; }
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; }
    errorBox.textContent = '';

    // If served over HTTP/HTTPS, submit to Flask backend route / API
    if (window.fetch && window.location && window.location.protocol.indexOf('http') === 0) {
      const endpoint = admin ? '/admin/login' : '/login';
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      }).then(function (res) {
        if (res.ok) {
          return res.json().then(function (resData) {
            const authUser = (resData && resData.user) ? resData.user : {
              id: (data.users.find(function (u) { return u.email.toLowerCase() === email.toLowerCase(); }) || {}).id || newId(admin ? 'a' : 'u'),
              name: (resData && resData.name) || (admin ? 'Platform Admin' : email.split('@')[0]),
              email: email,
              role: admin ? 'Admin' : 'User',
              status: 'Active'
            };
            if (!data.users.some(function (u) { return u.id === authUser.id; })) { data.users.push(authUser); }
            data.session = { userId: authUser.id };
            saveData();
            ui.view = admin ? 'adminOverview' : 'overview';
            ui.search = ''; ui.healthFilter = 'all'; ui.categoryId = null; ui.teamId = null; ui.openMenu = null;
            const searchInput = $('globalSearch');
            if (searchInput) { searchInput.value = ''; }
            render();
            closeMobileMenu();
            closeSignInModal();
            form.reset();
            toast('Signed in successfully.');
          });
        } else {
          return res.json().then(function (err) {
            errorBox.textContent = (err && (err.error || err.message)) || 'Email or password is incorrect.';
            if (submitBtn) { submitBtn.disabled = false; }
          }).catch(function () {
            errorBox.textContent = 'Email or password is incorrect.';
            if (submitBtn) { submitBtn.disabled = false; }
          });
        }
      }).catch(function () {
        const error = tryLogin(email, password, admin ? 'admin' : 'user');
        errorBox.textContent = error || '';
        if (submitBtn) { submitBtn.disabled = false; }
        if (!error) { closeSignInModal(); form.reset(); toast('Signed in successfully.'); }
      });
      return;
    }

    const error = tryLogin(email, password, admin ? 'admin' : 'user');
    errorBox.textContent = error || '';
    if (submitBtn) { submitBtn.disabled = false; }
    if (!error) { closeSignInModal(); form.reset(); toast('Signed in successfully.'); }
    return;
  }
  if (form.id === 'registerForm') {
    event.preventDefault();
    const name = $('rgName').value.trim();
    const email = $('rgEmail').value.trim();
    const password = $('rgPassword').value;
    const box = $('rgError');
    if (name === '') { box.textContent = 'Please enter your name.'; return; }
    if (!isValidEmail(email)) { box.textContent = 'Please enter a valid email address.'; return; }
    if (password.length < 6) { box.textContent = 'Password must be at least 6 characters.'; return; }
    if (data.users.some(function (u) { return u.email.toLowerCase() === email.toLowerCase(); })) { box.textContent = 'That email is already registered.'; return; }
    data.users.push({ id: newId('u'), name: name, email: email, password: password, role: 'User', status: 'Active', registered: Date.now() });
    saveData();
    box.textContent = '';
    tryLogin(email, password, 'user');
    form.reset();
    toast('Account created successfully.');
    return;
  }
  if (form.id === 'publicForm') {
    event.preventDefault();
    const result = resolveShortCode($('pubCode').value);
    const box = $('publicResult');
    box.classList.remove('hidden');
    box.textContent = result.text;
    return;
  }
  if (form.id === 'landingShortForm') {
    event.preventDefault();
    const urlInput = $('landingLongUrl');
    const errBox = $('landingShortError');
    const resBox = $('landingShortResult');
    const val = urlInput ? urlInput.value.trim() : '';
    if (resBox) { resBox.classList.add('hidden'); resBox.innerHTML = ''; }
    if (!val) {
      if (errBox) { errBox.style.color = 'var(--bad)'; errBox.textContent = 'Please enter a URL to shorten.'; }
      return;
    }
    if (!isValidUrl(val)) {
      if (errBox) { errBox.style.color = 'var(--bad)'; errBox.textContent = 'Please enter a valid URL starting with http:// or https://'; }
      return;
    }
    let link = data.links.find(function (l) { return l.url.toLowerCase() === val.toLowerCase() && l.shortCode && l.state !== 'Deleted'; });
    if (!link) {
      const code = generateShortCode();
      link = {
        id: nextId('link'),
        title: val.replace(/^https?:\/\//i, '').split('/')[0] || 'Short Link',
        url: val,
        shortCode: code,
        description: '',
        tags: [],
        categoryId: null,
        folderId: null,
        createdBy: null,
        createdAt: Date.now(),
        state: 'Active',
        health: 'healthy',
        uncertainCount: 0,
        lastChecked: Date.now(),
        uses: 0
      };
      data.links.push(link);
      saveData();
    }
    if (errBox) { errBox.textContent = ''; }
    if (resBox) {
      resBox.classList.remove('hidden');
      resBox.innerHTML = '<div style="margin-bottom:6px"><strong>Generated Short URL:</strong></div>' +
        '<div class="copy-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<code id="landingShortOutput">' + esc(shortUrlOf(link)) + '</code>' +
        '<button type="button" class="btn btn-sm btn-primary" data-action="copyLandingShort">Copy Short URL</button>' +
        '<a href="' + esc(shortUrlOf(link)) + '" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="text-decoration:none;">Open</a></div>';
    }
    toast('Short URL created!');
    return;
  }

  if (form.id === 'profileForm') {
    event.preventDefault();
    const name = $('setName').value.trim();
    if (name === '') { $('profileError').textContent = 'Name cannot be empty.'; return; }
    currentUser().name = name;
    saveData(); render(); toast('Profile saved.');
  }
}

// The "top action" button changes with the page (Add Link, Create Category, Create Team).
function topAction() {
  if (ui.view === 'links') { openLinkForm(null, null); }
  else if (ui.view === 'categories') { openCreateCategory(''); }
  else if (ui.view === 'teams') { openCreateTeam(); }
}

// One table of click actions: the key matches the data-action attribute in the HTML.
const clickActions = {
  openSignInModal: function () { openSignInModal(); },
  closeSignInModal: function () { closeSignInModal(); },
  goRegisterFromModal: function () {
    closeSignInModal();
    const regLink = document.querySelector('a[data-action="goRegisterFromModal"]');
    const href = regLink ? regLink.getAttribute('href') : null;
    if (href && href !== '#' && !href.startsWith('{{') && !href.startsWith('#')) {
      window.location.href = href;
      return;
    }
    showAuth('register');
  },
  scrollSection: function (d) {
    const targetId = d && d.target;
    const el = targetId ? $(targetId) : null;
    if (el) {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    }
    const navItems = document.querySelectorAll('.landing-nav-item');
    navItems.forEach(function (item) {
      item.classList.toggle('active', item.dataset.target === targetId);
    });
  },
  copyLandingShort: function () {
    const codeEl = $('landingShortOutput');
    if (codeEl) {
      copyText(codeEl.textContent, 'Short URL copied.');
    }
  },
  focusSignIn: function () {
    openSignInModal();
  },
  goHome: function () {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
  },
  nav: function (d) { navigate(d.view); },
  goto: function (d) {
    if (d.filter) {
      if (d.view === 'adminUsers') { ui.userFilter = d.filter; }
      else { ui.healthFilter = d.filter; }
    }
    navigate(d.view);
  },
  setUserFilter: function (d) { ui.userFilter = d.filter; renderPage(); },
  topAction: function () { topAction(); },
  toggleMenu: function (d) { ui.openMenu = ui.openMenu === d.key ? null : d.key; renderPage(); },
  openLink: function (d) { openLinkAction(d.id); },
  copyUrl: function (d) { const l = linkById(d.id); if (l) { copyText(l.url, 'Original URL copied.'); } },
  copyShort: function (d) { ui.openMenu = null; const l = linkById(d.id); if (l && l.shortCode) { copyText(shortUrlOf(l), 'Short URL copied.'); } },
  toggleFavourite: function (d) { ui.openMenu = null; toggleFavourite(d.id); },
  addLink: function (d) { openLinkForm(null, d.category ? { categoryId: d.category } : null); },
  editLink: function (d) { ui.openMenu = null; const l = linkById(d.id); if (l && allowedToChange(l)) { openLinkForm(l, null); } },
  moveLink: function (d) { ui.openMenu = null; const l = linkById(d.id); if (l && allowedToChange(l)) { openMoveForm(l); } },
  archiveLink: function (d) { ui.openMenu = null; archiveLink(d.id); },
  deleteLink: function (d) { ui.openMenu = null; deleteLink(d.id); },
  restoreLink: function (d) { restoreLink(d.id); },
  purgeLink: function (d) { purgeLink(d.id); },
  shortUrl: function (d) { ui.openMenu = null; showShortUrl(d.id); },
  healthCheck: function (d) { ui.openMenu = null; runHealthCheck(d.id); },
  testShort: function (d) {
    const l = linkById(d.id);
    const box = $('shortTest');
    box.classList.remove('hidden');
    box.textContent = l ? resolveShortCode(l.shortCode).text : '';
  },
  setFilter: function (d) { ui.healthFilter = d.filter; renderPage(); },
  setUserFilter: function (d) { ui.userFilter = d.filter; renderPage(); },
  clearFilters: function () { ui.healthFilter = 'all'; ui.search = ''; $('globalSearch').value = ''; renderPage(); },
  createCategory: function () { openCreateCategory(''); },
  viewCategory: function (d) { ui.categoryId = d.id; ui.folderId = null; ui.openMenu = null; ui.search = ''; $('globalSearch').value = ''; renderPage(); },
  backCategories: function () { ui.categoryId = null; ui.folderId = null; ui.openMenu = null; renderPage(); },
  renameCategory: function (d) { openRenameCategory(d.id); },
  deleteCategory: function (d) { deleteCategory(d.id); },
  openFolder: function (d) { ui.folderId = d.id; ui.openMenu = null; renderPage(); },
  backToCategory: function () { ui.folderId = null; ui.openMenu = null; renderPage(); },
  createFolder: function (d) { openCreateFolder(d.id); },
  renameFolder: function (d) { ui.openMenu = null; openRenameFolder(d.id); },
  moveFolder: function (d) { ui.openMenu = null; openMoveFolder(d.id); },
  deleteFolder: function (d) { ui.openMenu = null; deleteFolder(d.id); },
  addLinkToFolder: function (d) { openLinkForm(null, { categoryId: d.category, folderId: d.folder }); },
  createTeam: function () { openCreateTeam(); },
  editTeam: function (d) { ui.openMenu = null; openEditTeam(d.id); },
  viewTeam: function (d) { ui.teamId = d.id; ui.openMenu = null; renderPage(); },
  backTeams: function () { ui.teamId = null; renderPage(); },
  addMember: function (d) { openAddMember(d.id); },
  removeMember: function (d) { removeMember(d.team, d.user); },
  deleteTeam: function (d) { deleteTeam(d.id); },
  createSharedCategory: function (d) { ui.openMenu = null; openCreateCategory(d.id); },
  viewCategoryFromTeam: function (d) { ui.view = 'categories'; ui.categoryId = d.id; ui.folderId = null; ui.teamId = null; render(); },
  toggleTheme: function () { data.settings.theme = data.settings.theme === 'dark' ? 'light' : 'dark'; saveData(); applyTheme(); renderHeader(); renderPage(); },
  resetDemo: function () {
    confirmBox('Reset demo data?', 'This replaces all demo data in this browser with the original sample data.', 'Reset', function () {
      const theme = data.settings.theme;
      data = createSampleData();
      data.settings.theme = theme;
      saveData(); showAuth('user-login'); toast('Demo data reset. Please sign in again.');
    });
  },
  signOut: function () { signOut(); },
  closeModal: function () { closeModal(); },
  goAuth: function (d) { showAuth(d.screen); },
  viewUser: function (d) { adminViewUser(d.id); },
  editUser: function (d) { adminEditUser(d.id); },
  toggleUser: function (d) { adminToggleUser(d.id); },
  deleteUser: function (d) { adminDeleteUser(d.id); },
  adminViewTeam: function (d) { adminViewTeam(d.id); },
  adminDeleteTeam: function (d) { adminDeleteTeam(d.id); },
  toggleMobileMenu: function () { toggleMobileMenu(); },
  closeMobileMenu: function () { closeMobileMenu(); }
};

// One click listener for the whole page (event delegation): finds the nearest [data-action].
document.addEventListener('click', function (event) {
  const clickedMenu = event.target.closest('.menu-wrap');
  if (ui.openMenu !== null && !clickedMenu) { ui.openMenu = null; renderPage(); }
  if (event.target.id === 'modalBackdrop') { closeModal(); return; }
  if (event.target.id === 'signInModalBackdrop') { closeSignInModal(); return; }
  const element = event.target.closest('[data-action]');
  if (!element) { return; }
  const action = clickActions[element.dataset.action];
  if (!action) { return; }
  // Links that open in a new tab should not also follow the href themselves.
  if (element.tagName === 'A') { event.preventDefault(); }
  action(element.dataset);
});

// Form submissions (login, register, modal, profile...).
document.addEventListener('submit', handleSubmit);

// Typing in the search boxes.
document.addEventListener('input', function (event) {
  if (event.target.id === 'globalSearch') {
    ui.search = event.target.value;
    renderPage();
  } else if (event.target.id === 'userSearch') {
    ui.userSearch = event.target.value;
    const userRows = $('userRows');
    if (userRows) { userRows.innerHTML = userRowsHtml(); }
    const userCards = $('userMobileCards');
    if (userCards) { userCards.innerHTML = userMobileCardsHtml(); }
  } else if (event.target.id === 'adminTeamSearch') {
    ui.adminTeamSearch = event.target.value;
    const adminTeamRows = $('adminTeamRows');
    if (adminTeamRows) { adminTeamRows.innerHTML = adminTeamRowsHtml(); }
  }
});

// Dropdowns and checkboxes marked with data-change.
document.addEventListener('change', function (event) {
  const kind = event.target.dataset.change;
  if (kind === 'changeRole') {
    changeRole(event.target.dataset.team, event.target.dataset.user, event.target.value);
  } else if (kind === 'selectMemberUser') {
    const emailField = $('am_email');
    if (emailField && event.target.value) { emailField.value = event.target.value; }
  } else if (kind === 'folderList') {
    // When the category changes inside a form, refresh the folder list.
    const folderSelect = $('modalBody').querySelector('select[name="folder"]');
    if (folderSelect) { folderSelect.innerHTML = folderOptions(event.target.value, ''); }
  } else if (kind === 'pref') {
    const pref = event.target.dataset.pref;
    if (pref === 'dark') { data.settings.theme = event.target.checked ? 'dark' : 'light'; applyTheme(); }
    else { data.settings[pref] = event.target.checked; }
    saveData(); renderPage();
  }
});

// Escape closes the modal, an open menu, or the mobile drawer.
document.addEventListener('keydown', function (event) {
  if (event.key !== 'Escape') { return; }
  const signInBackdrop = $('signInModalBackdrop');
  if (signInBackdrop && !signInBackdrop.classList.contains('hidden')) {
    closeSignInModal();
    return;
  }
  if (!$('modalBackdrop').classList.contains('hidden')) { closeModal(); }
  else if (ui.openMenu !== null) { ui.openMenu = null; renderPage(); }
  else { closeMobileMenu(); }
});

// Handle browser back and forward buttons.
window.addEventListener('popstate', function () {
  const hash = (window.location.hash || '').replace(/^#/, '');
  if (hash && hash !== ui.view) {
    navigate(hash);
  }
});

// Start the app: fill the logos, apply the theme, then show login or the saved session.
function init() {
  ['authLogo1', 'authLogo2', 'authLogo3', 'authLogo4'].forEach(function (id) { $(id).innerHTML = logoSvg() + 'LinkSphere'; });
  applyTheme();
  const user = currentUser();
  if (user && user.status === 'Active') {
    const hash = (window.location.hash || '').replace(/^#/, '');
    let defaultView = user.role === 'Admin' ? 'adminOverview' : 'overview';
    if (hash) {
      const isAdminView = hash.indexOf('admin') === 0;
      if ((isAdminView && user.role === 'Admin') || (!isAdminView && user.role !== 'Admin')) {
        defaultView = hash;
      }
    }
    ui.view = defaultView;
    render();
  } else {
    data.session = null;
    showAuth('user-login');
  }
}
init();
