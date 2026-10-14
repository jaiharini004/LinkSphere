/* =====================================================================
   LinkSphere - static/js/main.js
   Core helpers, theme persistence, and toast feedback
   ===================================================================== */
'use strict';

const $ = function (id) {
  return document.getElementById(id);
};

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

function icon(name) {
  return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
}

function logoSvg() {
  return '<svg viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="20" cy="20" r="15"/><ellipse cx="20" cy="20" rx="15" ry="6"/><path d="M20 5v30"/></svg>';
}

function esc(str) {
  if (str === null || str === undefined) { return ''; }
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function isValidUrl(str) {
  if (!str) { return false; }
  const s = String(str).trim();
  return s.indexOf('http://') === 0 || s.indexOf('https://') === 0 || s.indexOf('.') !== -1;
}

/* ---------------------------------------------------------------------
   Theme Management
   --------------------------------------------------------------------- */
function getTheme() {
  return localStorage.getItem('linksphere_theme') || 'light';
}

function applyTheme() {
  const currentTheme = getTheme();
  const isDark = currentTheme === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

  const btns = [$('themeBtn'), $('landingThemeBtn')];
  btns.forEach(function (btn) {
    if (btn) {
      btn.innerHTML = icon(isDark ? 'sun' : 'moon');
      btn.setAttribute('title', isDark ? 'Switch to light theme' : 'Switch to dark theme');
      btn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    }
  });

  const darkSwitch = $('darkThemeSwitch');
  if (darkSwitch) {
    darkSwitch.checked = isDark;
  }
}

function toggleTheme() {
  const nextTheme = getTheme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem('linksphere_theme', nextTheme);
  applyTheme();
}

/* ---------------------------------------------------------------------
   Toast Feedback System
   --------------------------------------------------------------------- */
function toast(message, isError) {
  let area = $('toastArea');
  if (!area) {
    area = document.createElement('div');
    area.id = 'toastArea';
    area.className = 'toast-area';
    document.body.appendChild(area);
  }
  const box = document.createElement('div');
  box.className = 'toast' + (isError ? ' error' : '');
  box.textContent = message;
  area.appendChild(box);
  setTimeout(function () {
    if (box.parentNode) {
      box.parentNode.removeChild(box);
    }
  }, 3200);
}

// Initialise theme immediately on load
if (typeof document !== 'undefined') {
  applyTheme();
}
