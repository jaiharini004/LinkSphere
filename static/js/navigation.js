/* =====================================================================
   LinkSphere - static/js/navigation.js
   Modals, confirmations, mobile drawers, and route navigation
   ===================================================================== */
'use strict';

let modalHandler = null;
let lastActiveElement = null;

function openModal(title, bodyHtml, submitLabel, onSubmit, isDanger) {
  lastActiveElement = document.activeElement;
  const modalTitle = $('modalTitle');
  const modalBody = $('modalBody');
  const backdrop = $('modalBackdrop');
  if (!modalTitle || !backdrop) { return; }

  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHtml;

  const formError = $('formError');
  if (formError) { formError.textContent = ''; }

  const submitButton = $('modalSubmit');
  if (submitButton) {
    submitButton.classList.toggle('hidden', submitLabel === null);
    submitButton.textContent = submitLabel || '';
    submitButton.className = 'btn ' + (isDanger ? 'btn-danger' : 'btn-primary') + (submitLabel === null ? ' hidden' : '');
    submitButton.disabled = false;
  }

  const cancelButton = $('modalCancel');
  if (cancelButton) {
    cancelButton.textContent = submitLabel === null ? 'Close' : 'Cancel';
  }

  modalHandler = onSubmit || null;
  backdrop.classList.remove('hidden');

  const firstField = modalBody.querySelector('input, select, textarea');
  if (firstField) {
    setTimeout(function () { firstField.focus(); }, 50);
  } else if (submitLabel !== null && submitButton) {
    submitButton.focus();
  }
}

function closeModal() {
  const backdrop = $('modalBackdrop');
  if (backdrop) { backdrop.classList.add('hidden'); }
  modalHandler = null;
  const submitButton = $('modalSubmit');
  if (submitButton) { submitButton.disabled = false; }
  if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
    try { lastActiveElement.focus(); } catch (e) {}
    lastActiveElement = null;
  }
}

function confirmBox(title, message, yesLabel, onYes) {
  openModal(title, '<p>' + message + '</p>', yesLabel, function () {
    if (typeof onYes === 'function') { onYes(); }
  }, true);
}

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

function navigateTo(view, filter) {
  const routeMap = {
    overview: '/dashboard',
    links: '/links',
    categories: '/categories',
    teams: '/teams',
    favourites: '/favourites',
    archive: '/archive',
    trash: '/trash',
    settings: '/settings',
    adminOverview: '/admin/dashboard',
    adminUsers: '/admin/users',
    adminTeams: '/admin/teams'
  };

  let targetUrl = routeMap[view] || '/dashboard';
  if (filter && filter !== 'all') {
    targetUrl += (targetUrl.indexOf('?') === -1 ? '?' : '&') + 'filter=' + encodeURIComponent(filter);
  }
  window.location.href = targetUrl;
}
