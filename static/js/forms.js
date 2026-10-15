/* =====================================================================
   LinkSphere - static/js/forms.js
   Category, team and admin actions, event delegation, and modal forms
   ===================================================================== */
'use strict';

function openCreateCategoryModal() {
  const bodyHtml =
    '<div class="field">' +
      '<label for="m_cat_name">Category Name *</label>' +
      '<input class="input" id="m_cat_name" name="name" placeholder="e.g. Work, College, or Tech" required>' +
    '</div>';

  openModal('Create Category', bodyHtml, 'Create Category', function (form) {
    const name = String(form.get('name') || '').trim();
    if (!name) { return 'Please enter a category name.'; }

    fetch('/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name })
    }).then(function (res) {
      if (res.ok) {
        toast('Category created.');
        closeModal();
        window.location.reload();
      } else {
        res.json().then(function (err) {
          $('formError').textContent = err.error || 'Failed to create category.';
        });
      }
    }).catch(function () {
      $('formError').textContent = 'Network error creating category.';
    });
  });
}

function deleteCategory(categoryId) {
  confirmBox('Delete Category?', 'Are you sure you want to delete this category? Active links in this category cannot be deleted.', 'Delete Category', function () {
    fetch('/categories/' + categoryId + '/delete', { method: 'POST' })
      .then(function (res) {
        if (res.ok) {
          toast('Category deleted.');
          window.location.reload();
        } else {
          res.json().then(function (err) {
            toast(err.error || 'Cannot delete category.', true);
          });
        }
      }).catch(function () {
        toast('Network error deleting category.', true);
      });
  });
}

function openRenameCategoryModal(categoryId, currentName) {
  const bodyHtml =
    '<div class="field">' +
      '<label for="m_rename_cat">Category Name *</label>' +
      '<input class="input" id="m_rename_cat" name="name" value="' + esc(currentName || '') + '" required>' +
    '</div>';

  openModal('Rename Category', bodyHtml, 'Save Name', function (form) {
    const name = String(form.get('name') || '').trim();
    if (!name) { return 'Please enter a category name.'; }

    fetch('/categories/' + categoryId + '/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name })
    }).then(function (res) {
      if (res.ok) {
        toast('Category renamed.');
        closeModal();
        window.location.reload();
      } else {
        res.json().then(function (err) {
          $('formError').textContent = err.error || 'Failed to rename category.';
        });
      }
    }).catch(function () {
      $('formError').textContent = 'Network error renaming category.';
    });
  });
}

function openCreateFolderModal(categoryId) {
  if (!categoryId) {
    toast('Please select a category first.', true);
    return;
  }
  const bodyHtml =
    '<div class="field">' +
      '<label for="m_folder_name">Folder Name *</label>' +
      '<input class="input" id="m_folder_name" name="name" placeholder="e.g. Design Assets, Research, API Docs" required>' +
    '</div>';

  openModal('Create Folder', bodyHtml, 'Create Folder', function (form) {
    const name = String(form.get('name') || '').trim();
    if (!name) { return 'Please enter a folder name.'; }

    fetch('/categories/' + categoryId + '/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name })
    }).then(function (res) {
      if (res.ok) {
        toast('Folder created.');
        closeModal();
        window.location.reload();
      } else {
        res.json().then(function (err) {
          $('formError').textContent = err.error || 'Failed to create folder.';
        });
      }
    }).catch(function () {
      $('formError').textContent = 'Network error creating folder.';
    });
  });
}

function openRenameFolderModal(folderId, currentName) {
  const bodyHtml =
    '<div class="field">' +
      '<label for="m_rename_folder">Folder Name *</label>' +
      '<input class="input" id="m_rename_folder" name="name" value="' + esc(currentName || '') + '" required>' +
    '</div>';

  openModal('Rename Folder', bodyHtml, 'Save Name', function (form) {
    const name = String(form.get('name') || '').trim();
    if (!name) { return 'Please enter a folder name.'; }

    fetch('/folders/' + folderId + '/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name })
    }).then(function (res) {
      if (res.ok) {
        toast('Folder renamed.');
        closeModal();
        window.location.reload();
      } else {
        res.json().then(function (err) {
          $('formError').textContent = err.error || 'Failed to rename folder.';
        });
      }
    }).catch(function () {
      $('formError').textContent = 'Network error renaming folder.';
    });
  });
}

function deleteFolderAction(folderId, categoryId) {
  confirmBox('Delete Folder?', 'Are you sure you want to delete this folder? Contained links will remain in the category outside folders.', 'Delete Folder', function () {
    fetch('/folders/' + folderId + '/delete', { method: 'POST' })
      .then(function (res) {
        if (res.ok) {
          toast('Folder deleted.');
          if (categoryId) {
            window.location.href = '/categories/' + categoryId;
          } else {
            window.location.reload();
          }
        } else {
          toast('Failed to delete folder.', true);
        }
      }).catch(function () {
        toast('Network error deleting folder.', true);
      });
  }, true);
}

function openCreateTeamModal() {
  const bodyHtml =
    '<div class="field">' +
      '<label for="m_team_name">Team Name *</label>' +
      '<input class="input" id="m_team_name" name="name" placeholder="e.g. Design Club or Study Group" required>' +
    '</div>' +
    '<div class="field">' +
      '<label for="m_team_desc">Description (optional)</label>' +
      '<textarea class="input" id="m_team_desc" name="description" placeholder="Collaborative space for shared links" rows="2"></textarea>' +
    '</div>';

  openModal('Create Team', bodyHtml, 'Create Team', function (form) {
    const name = String(form.get('name') || '').trim();
    const desc = String(form.get('description') || '').trim();
    if (!name) { return 'Please enter a team name.'; }

    fetch('/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, description: desc })
    }).then(function (res) {
      if (res.ok) {
        toast('Team created.');
        closeModal();
        res.json().then(function (data) {
          window.location.href = '/teams/' + data.id;
        }).catch(function () {
          window.location.href = '/teams';
        });
      } else {
        res.json().then(function (err) {
          $('formError').textContent = err.error || 'Failed to create team.';
        });
      }
    }).catch(function () {
      $('formError').textContent = 'Network error creating team.';
    });
  });
}

function openEditTeamModal(teamId) {
  const card = document.querySelector('[data-id="' + teamId + '"]') ? document.querySelector('[data-id="' + teamId + '"]').closest('article, .back-row, main') : null;
  const currentName = card && card.querySelector('h3, h2') ? card.querySelector('h3, h2').textContent.trim() : '';

  const bodyHtml =
    '<div class="field">' +
      '<label for="m_edit_team_name">Team Name *</label>' +
      '<input class="input" id="m_edit_team_name" name="name" value="' + esc(currentName) + '" required>' +
    '</div>' +
    '<div class="field">' +
      '<label for="m_edit_team_desc">Description</label>' +
      '<textarea class="input" id="m_edit_team_desc" name="description" rows="2" placeholder="Team description"></textarea>' +
    '</div>';

  openModal('Edit Team Details', bodyHtml, 'Save Changes', function (form) {
    const name = String(form.get('name') || '').trim();
    const desc = String(form.get('description') || '').trim();
    if (!name) { return 'Please enter a team name.'; }

    fetch('/teams/' + teamId + '/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, description: desc })
    }).then(function (res) {
      if (res.ok) {
        toast('Team updated.');
        closeModal();
        window.location.reload();
      } else {
        res.json().then(function (err) {
          $('formError').textContent = err.error || 'Failed to update team.';
        });
      }
    }).catch(function () {
      $('formError').textContent = 'Network error updating team.';
    });
  });
}

function deleteTeam(teamId) {
  confirmBox('Delete Team?', 'Are you sure you want to delete this team? Categories belonging to it will become personal.', 'Delete Team', function () {
    fetch('/teams/' + teamId + '/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).then(function (res) {
      if (res.ok) {
        toast('Team deleted.');
        window.location.href = '/teams';
      } else {
        toast('Failed to delete team.', true);
      }
    }).catch(function () {
      toast('Network error deleting team.', true);
    });
  }, true);
}

function openCreateSharedCategoryModal(teamId, teamName) {
  const bodyHtml =
    '<div class="field">' +
      '<label for="m_shared_cat_name">Category Name *</label>' +
      '<input class="input" id="m_shared_cat_name" name="name" placeholder="e.g. Design Assets, Research" required>' +
    '</div>' +
    '<p class="card-meta">This category will be shared with all members of <b>' + esc(teamName || 'this team') + '</b>.</p>';

  openModal('Create Shared Category', bodyHtml, 'Create Category', function (form) {
    const name = String(form.get('name') || '').trim();
    if (!name) { return 'Please enter a category name.'; }

    fetch('/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, team_name: teamName })
    }).then(function (res) {
      if (res.ok) {
        toast('Shared category created.');
        closeModal();
        window.location.reload();
      } else {
        res.json().then(function (err) {
          $('formError').textContent = err.error || 'Failed to create category.';
        });
      }
    }).catch(function () {
      $('formError').textContent = 'Network error creating category.';
    });
  });
}

function openAddMemberModal(teamId) {
  const bodyHtml =
    '<div class="field">' +
      '<label for="m_member_email">Teammate Email *</label>' +
      '<input class="input" id="m_member_email" name="email" type="email" placeholder="colleague@example.com" required>' +
    '</div>' +
    '<div class="field">' +
      '<label for="m_member_role">Role</label>' +
      '<select class="select" id="m_member_role" name="role">' +
        '<option value="Member">Member (View & contribute)</option>' +
        '<option value="Manager">Manager (Full team control)</option>' +
      '</select>' +
    '</div>';

  openModal('Add Team Member', bodyHtml, 'Add Member', function (form) {
    const email = String(form.get('email') || '').trim();
    const role = String(form.get('role') || 'Member');
    if (!email) { return 'Please enter an email address.'; }

    fetch('/teams/' + teamId + '/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, role: role })
    }).then(function (res) {
      if (res.ok) {
        toast('Member invited to team.');
        closeModal();
        window.location.reload();
      } else {
        res.json().then(function (err) {
          $('formError').textContent = err.error || 'Could not add member.';
        });
      }
    }).catch(function () {
      $('formError').textContent = 'Network error adding member.';
    });
  });
}

function viewTeamDetails(teamId) {
  window.location.href = '/teams/' + teamId;
}

function toggleUser(userId) {
  fetch('/admin/users/' + userId + '/toggle-status', { method: 'POST' })
    .then(function (res) {
      if (res.ok) {
        toast('User status updated.');
        window.location.reload();
      } else {
        res.json().then(function (err) {
          toast(err.error || 'Could not update user.', true);
        });
      }
    }).catch(function () {
      toast('Network error updating user.', true);
    });
}

function viewUserDetails(userId) {
  const row = document.querySelector('[data-id="' + userId + '"]').closest('tr, article');
  if (!row) { return; }
  const name = row.querySelector('b, .user-card-name') ? row.querySelector('b, .user-card-name').textContent : 'User';

  const body =
    '<p><strong>Account Name:</strong> ' + esc(name) + '</p>' +
    '<p>Platform account managed in Supabase PostgreSQL.</p>';

  openModal('User Account: ' + name, body, null, null);
}

function editUser(userId) {
  fetch('/admin/users/' + userId)
    .then(function (res) {
      if (!res.ok) { throw new Error('Could not fetch user details'); }
      return res.json();
    })
    .then(function (u) {
      let teamOptions = '<option value="">None</option>';
      if (u.available_teams && u.available_teams.length) {
        u.available_teams.forEach(function (t) {
          teamOptions += '<option value="' + t.id + '"' + (u.team_id === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>';
        });
      }

      const bodyHtml =
        '<div class="field">' +
          '<label for="eu_name">Name *</label>' +
          '<input class="input" id="eu_name" name="name" value="' + esc(u.name) + '" required>' +
        '</div>' +
        '<div class="field">' +
          '<label for="eu_email">Email</label>' +
          '<input class="input" id="eu_email" name="email" value="' + esc(u.email) + '" readonly style="opacity:0.75;cursor:not-allowed;">' +
        '</div>' +
        '<div class="field">' +
          '<label for="eu_role">Role</label>' +
          '<select class="select" id="eu_role" name="role">' +
            '<option value="User"' + (u.role === 'User' ? ' selected' : '') + '>User</option>' +
            '<option value="Admin"' + (u.role === 'Admin' ? ' selected' : '') + '>Admin</option>' +
          '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="eu_status">Status</label>' +
          '<select class="select" id="eu_status" name="status">' +
            '<option value="Active"' + (u.status === 'Active' ? ' selected' : '') + '>Active</option>' +
            '<option value="Disabled"' + (u.status === 'Disabled' ? ' selected' : '') + '>Disabled</option>' +
          '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="eu_team">Team Assignment</label>' +
          '<select class="select" id="eu_team" name="team">' + teamOptions + '</select>' +
          '<span class="hint">Assign user as team member or None to clear.</span>' +
        '</div>';

      openModal('Edit User: ' + u.name, bodyHtml, 'Save Changes', function (form) {
        const name = String(form.get('name') || '').trim();
        const role = String(form.get('role') || 'User');
        const status = String(form.get('status') || 'Active');
        const team = form.get('team');

        if (!name) { return 'Please enter a name.'; }

        fetch('/admin/users/' + userId + '/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, role: role, status: status, team: team })
        }).then(function (res) {
          if (res.ok) {
            toast('User updated.');
            closeModal();
            window.location.reload();
          } else {
            res.json().then(function (err) {
              const errEl = $('formError');
              if (errEl) { errEl.textContent = err.error || 'Could not update user.'; }
              else { toast(err.error || 'Could not update user.', true); }
            });
          }
        }).catch(function () {
          const errEl = $('formError');
          if (errEl) { errEl.textContent = 'Network error updating user.'; }
        });
      });
    })
    .catch(function () {
      toast('Could not retrieve user info.', true);
    });
}

function deleteUser(userId) {
  const btn = document.querySelector('[data-action="deleteUser"][data-id="' + userId + '"]');
  const name = (btn && btn.dataset.name) ? btn.dataset.name : 'this user';

  confirmBox(
    'Delete user account?',
    'Delete <b>' + esc(name) + '</b>? Their personal categories and links will be permanently removed. Shared team resources stay safe.',
    'Delete User',
    function () {
      fetch('/admin/users/' + userId + '/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).then(function (res) {
        if (res.ok) {
          toast('User ' + name + ' deleted.');
          closeModal();
          window.location.reload();
        } else {
          res.json().then(function (err) {
            toast(err.error || 'Could not delete user.', true);
          });
        }
      }).catch(function () {
        toast('Network error deleting user.', true);
      });
    }
  );
}

function removeTeamMember(teamId, memberId) {
  confirmBox(
    'Remove team member?',
    'Are you sure you want to remove this member from the team?',
    'Remove Member',
    function () {
      fetch('/teams/' + teamId + '/members/' + memberId + '/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).then(function (res) {
        if (res.ok) {
          toast('Member removed.');
          closeModal();
          window.location.reload();
        } else {
          res.json().then(function (err) {
            toast(err.error || 'Could not remove member.', true);
          });
        }
      }).catch(function () {
        toast('Network error removing member.', true);
      });
    }
  );
}


/* ---------------------------------------------------------------------
   Global Event Delegation
   --------------------------------------------------------------------- */
document.addEventListener('click', function (event) {
  // Close any open menus if clicking outside
  const clickedMenuWrap = event.target.closest('.menu-wrap');
  if (!clickedMenuWrap) {
    document.querySelectorAll('.menu-wrap.menu-open').forEach(function (m) {
      m.classList.remove('menu-open');
      const c = m.closest('.link-card, .cat-card, .team-card, .folder-card, .glass-card');
      if (c) c.classList.remove('menu-open');
    });
  }

  if (event.target.id === 'modalBackdrop') { closeModal(); return; }
  if (event.target.id === 'signInModalBackdrop') { closeSignInModal(); return; }

  const element = event.target.closest('[data-action]');
  if (!element) { return; }

  const action = element.dataset.action;
  const d = element.dataset;

  if (action === 'toggleMenu') {
    event.stopPropagation();
    const wrap = element.closest('.menu-wrap');
    const card = element.closest('.link-card, .cat-card, .team-card, .folder-card, .glass-card');
    const isCurrentlyOpen = wrap ? wrap.classList.contains('menu-open') : false;

    // Close all other menus first
    document.querySelectorAll('.menu-wrap.menu-open').forEach(function (m) {
      m.classList.remove('menu-open');
      const c = m.closest('.link-card, .cat-card, .team-card, .folder-card, .glass-card');
      if (c) c.classList.remove('menu-open');
    });

    if (wrap && !isCurrentlyOpen) {
      wrap.classList.add('menu-open');
      if (card) card.classList.add('menu-open');
    }
    return;
  }

  // If clicked an action inside a menu, close that menu
  const activeMenuWrap = element.closest('.menu-wrap');
  if (activeMenuWrap && action !== 'toggleMenu') {
    activeMenuWrap.classList.remove('menu-open');
    const c = activeMenuWrap.closest('.link-card, .cat-card, .team-card, .folder-card, .glass-card');
    if (c) c.classList.remove('menu-open');
  }

  if (action === 'topAction') {
    const pageTitle = $('pageTitle') ? $('pageTitle').textContent.trim() : '';
    const topActionBtn = $('topAction');
    const btnText = topActionBtn ? topActionBtn.textContent.trim().toLowerCase() : '';

    if (btnText.indexOf('team') !== -1 || pageTitle.indexOf('Teams') !== -1 || window.location.pathname.indexOf('/teams') !== -1) {
      openCreateTeamModal();
    } else if (btnText.indexOf('category') !== -1 || pageTitle.indexOf('Categories') !== -1) {
      openCreateCategoryModal();
    } else {
      openAddLinkForm();
    }
    return;
  }

  if (action === 'addLink' || action === 'addLinkToFolder') {
    openAddLinkForm(d.category, d.folder, d.catname, d.foldername);
    return;
  }

  if (action === 'editLink') {
    openEditLinkForm(d.id);
    return;
  }

  if (action === 'toggleFavourite') {
    toggleFavourite(d.id);
    return;
  }

  if (action === 'archiveLink') {
    archiveLink(d.id);
    return;
  }

  if (action === 'restoreLink') {
    restoreLink(d.id);
    return;
  }

  if (action === 'deleteLink') {
    deleteLink(d.id);
    return;
  }

  if (action === 'purgeLink') {
    purgeLink(d.id);
    return;
  }

  if (action === 'shortUrl') {
    showShortUrl(d.id);
    return;
  }

  if (action === 'healthCheck') {
    checkLinkHealth(d.id);
    return;
  }

  if (action === 'copyShort') {
    const card = element.closest('.link-card');
    const codeEl = card ? card.querySelector('.card-short code') : null;
    let code = d.short || '';
    if (!code && codeEl) {
      const parts = codeEl.textContent.trim().split('/');
      code = parts[parts.length - 1];
    }
    copyShort(code);
    return;
  }

  if (action === 'copyLandingShort') {
    const outputEl = $('landingShortOutput');
    const url = d.url || (outputEl ? outputEl.textContent : '');
    if (url) {
      copyUrl(url);
    }
    return;
  }

  if (action === 'copyUrl') {
    const card = element.closest('.link-card');
    const urlEl = card ? card.querySelector('.card-url') : null;
    const url = d.url || (urlEl ? urlEl.getAttribute('href') : '');
    copyUrl(url);
    return;
  }

  if (action === 'openLink') {
    const card = element.closest('.link-card');
    const urlEl = card ? card.querySelector('.card-url') : null;
    const url = urlEl ? urlEl.getAttribute('href') : '';
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    return;
  }

  if (action === 'createCategory') {
    openCreateCategoryModal();
    return;
  }

  if (action === 'renameCategory') {
    openRenameCategoryModal(d.id, d.name);
    return;
  }

  if (action === 'deleteCategory') {
    deleteCategory(d.id);
    return;
  }

  if (action === 'viewCategory') {
    window.location.href = '/categories/' + encodeURIComponent(d.id);
    return;
  }

  if (action === 'openFolder') {
    window.location.href = '/categories/' + encodeURIComponent(d.category) + '?folder_id=' + encodeURIComponent(d.id);
    return;
  }

  if (action === 'backToCategory') {
    window.location.href = '/categories/' + encodeURIComponent(d.category);
    return;
  }

  if (action === 'backCategories') {
    window.location.href = '/categories';
    return;
  }

  if (action === 'createFolder') {
    openCreateFolderModal(d.category || d.id);
    return;
  }

  if (action === 'renameFolder') {
    openRenameFolderModal(d.id, d.name);
    return;
  }

  if (action === 'deleteFolder') {
    deleteFolderAction(d.id, d.category);
    return;
  }

  if (action === 'createTeam') {
    openCreateTeamModal();
    return;
  }

  if (action === 'viewTeam') {
    viewTeamDetails(d.id);
    return;
  }

  if (action === 'editTeam') {
    openEditTeamModal(d.id);
    return;
  }

  if (action === 'deleteTeam' || action === 'leaveTeam') {
    deleteTeam(d.id);
    return;
  }

  if (action === 'createSharedCategory') {
    openCreateSharedCategoryModal(d.id, d.name);
    return;
  }

  if (action === 'addMember') {
    openAddMemberModal(d.id);
    return;
  }

  if (action === 'backTeams') {
    window.location.href = '/teams';
    return;
  }

  if (action === 'toggleUser') {
    toggleUser(d.id);
    return;
  }

  if (action === 'editUser') {
    editUser(d.id);
    return;
  }

  if (action === 'deleteUser') {
    deleteUser(d.id);
    return;
  }

  if (action === 'removeMember') {
    removeTeamMember(d.team, d.member);
    return;
  }

  if (action === 'viewUser') {
    viewUserDetails(d.id);
    return;
  }

  if (action === 'toggleTheme') {
    toggleTheme();
    return;
  }

  if (action === 'toggleMobileMenu') {
    toggleMobileMenu();
    return;
  }

  if (action === 'closeMobileMenu') {
    closeMobileMenu();
    return;
  }

  if (action === 'openSignInModal') {
    openSignInModal();
    return;
  }

  if (action === 'closeSignInModal') {
    closeSignInModal();
    return;
  }

  if (action === 'closeModal') {
    closeModal();
    return;
  }

  if (action === 'nav' || action === 'goto') {
    navigateTo(d.view, d.filter);
    return;
  }

  if (action === 'setFilter') {
    navigateTo('links', d.filter);
    return;
  }

  if (action === 'setUserFilter') {
    window.location.href = '/admin/users?filter=' + encodeURIComponent(d.filter);
    return;
  }

  if (action === 'adminViewTeam') {
    viewTeamDetails(d.id);
    return;
  }

  if (action === 'adminDeleteTeam') {
    confirmBox('Delete Team', 'Are you sure you want to remove this team? Categories belonging to it will become personal.', 'Delete Team', function () {
      fetch('/admin/teams/' + d.id + '/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).then(function (res) {
        if (res.ok) {
          toast('Team deleted.');
          window.location.reload();
        } else {
          toast('Failed to delete team.', true);
        }
      }).catch(function () {
        toast('Network error deleting team.', true);
      });
    }, true);
    return;
  }
});

/* Live filter for admin teams table */
document.addEventListener('DOMContentLoaded', function () {
  const searchInput = $('adminTeamSearch');
  const rowsContainer = $('adminTeamRows');
  if (searchInput && rowsContainer) {
    searchInput.addEventListener('input', function () {
      const q = searchInput.value.toLowerCase().trim();
      const rows = rowsContainer.querySelectorAll('tr');
      rows.forEach(function (tr) {
        const text = tr.textContent.toLowerCase();
        tr.style.display = text.indexOf(q) !== -1 ? '' : 'none';
      });
    });
  }
});

/* Modal form submission */
document.addEventListener('submit', function (event) {
  const form = event.target;
  if (form.id === 'modalForm') {
    event.preventDefault();
    if (!modalHandler) { closeModal(); return; }
    const submitBtn = $('modalSubmit');
    if (submitBtn) { submitBtn.disabled = true; }
    const result = modalHandler(new FormData(form));
    if (typeof result === 'string') {
      const err = $('formError');
      if (err) { err.textContent = result; }
      if (submitBtn) { submitBtn.disabled = false; }
    } else {
      closeModal();
    }
    return;
  }

  if (form.id === 'landingShortForm') {
    event.preventDefault();
    const urlInput = $('landingLongUrl');
    const errBox = $('landingShortError');
    const resBox = $('landingShortResult');
    const val = urlInput ? urlInput.value.trim() : '';

    if (resBox) { resBox.classList.add('hidden'); resBox.innerHTML = ''; }
    if (errBox) { errBox.textContent = ''; }

    if (!val) {
      if (errBox) { errBox.textContent = 'Please enter a URL to shorten.'; }
      return;
    }

    fetch('/short/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: val })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          if (errBox) { errBox.textContent = data.error || 'Could not create short URL.'; }
        } else {
          if (errBox) { errBox.textContent = ''; }
          if (resBox) {
            resBox.classList.remove('hidden');
            resBox.innerHTML =
              '<div style="margin-bottom:8px"><strong>Generated Short URL:</strong></div>' +
              '<div class="copy-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
                '<code id="landingShortOutput" style="font-weight:600;padding:6px 12px;background:rgba(255,255,255,0.08);border-radius:6px;">' + esc(data.short_url) + '</code>' +
                '<button type="button" class="btn btn-sm btn-primary" data-action="copyLandingShort" data-url="' + esc(data.short_url) + '">Copy Short URL</button>' +
                '<a href="' + esc(data.short_url) + '" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="text-decoration:none;">Open</a>' +
              '</div>';
          }
          toast('Short URL created!');
        }
      });
    }).catch(function () {
      if (errBox) { errBox.textContent = 'Network error creating short URL.'; }
    });
    return;
  }
});

/* Team member role change listener */
document.addEventListener('change', function (event) {
  const target = event.target;
  if (target && target.dataset.change === 'changeRole') {
    const teamId = target.dataset.team;
    const memberId = target.dataset.member;
    const newRole = target.value;
    if (teamId && memberId) {
      fetch('/teams/' + teamId + '/members/' + memberId + '/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      }).then(function (res) {
        if (res.ok) {
          toast('Member role updated to ' + newRole + '.');
        } else {
          res.json().then(function (err) { toast(err.error || 'Could not update role.', true); });
        }
      }).catch(function () {
        toast('Network error updating role.', true);
      });
    }
  }
});


/* Keyboard Escape to dismiss modals and open menus */
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    document.querySelectorAll('.menu-wrap.menu-open').forEach(function (m) {
      m.classList.remove('menu-open');
      const c = m.closest('.link-card, .cat-card, .team-card, .folder-card, .glass-card');
      if (c) c.classList.remove('menu-open');
    });
    closeModal();
    closeSignInModal();
    closeMobileMenu();
  }
});
