/* =====================================================================
   LinkSphere - static/js/links.js
   Link card actions, CRUD modals, copy functions, and favorites
   ===================================================================== */
'use strict';

let appCategoriesCache = null;

function fetchCategoriesList(callback) {
  fetch('/api/categories', {
    headers: { 'Accept': 'application/json' }
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      appCategoriesCache = data.categories || [];
      if (callback) { callback(appCategoriesCache); }
    })
    .catch(function () {
      if (callback) { callback(appCategoriesCache || []); }
    });
}

// Prefetch categories when the script is loaded
if (typeof window !== 'undefined') {
  fetchCategoriesList();
}

function buildCategorySelectOptions(cats, selectedId) {
  let html = '<option value="">General (No Category)</option>';
  const personal = [];
  const shared = [];
  (cats || []).forEach(function (c) {
    if (c.team_name) {
      shared.push(c);
    } else {
      personal.push(c);
    }
  });

  if (personal.length > 0) {
    html += '<optgroup label="Personal Categories">';
    personal.forEach(function (c) {
      const isSel = String(c.id) === String(selectedId) ? ' selected' : '';
      html += '<option value="' + esc(c.id) + '"' + isSel + '>' + esc(c.name) + '</option>';
    });
    html += '</optgroup>';
  }

  if (shared.length > 0) {
    html += '<optgroup label="Team Categories">';
    shared.forEach(function (c) {
      const isSel = String(c.id) === String(selectedId) ? ' selected' : '';
      html += '<option value="' + esc(c.id) + '"' + isSel + '>' + esc(c.name) + ' (' + esc(c.team_name) + ')</option>';
    });
    html += '</optgroup>';
  }

  html += '<option value="__new__">+ Add New Category...</option>';
  return html;
}

function openAddLinkForm(defaultCatId, defaultFolderId, defaultCatName, defaultFolderName) {
  if (appCategoriesCache === null) {
    fetchCategoriesList(function (cats) {
      renderAddLinkModal(defaultCatId, defaultFolderId, defaultCatName, defaultFolderName, cats);
    });
  } else {
    renderAddLinkModal(defaultCatId, defaultFolderId, defaultCatName, defaultFolderName, appCategoriesCache);
    // Background refresh in case categories were added elsewhere
    fetchCategoriesList(function (freshCats) {
      const sel = $('m_category_select');
      if (sel && sel.value !== '__new__') {
        const currVal = sel.value;
        sel.innerHTML = buildCategorySelectOptions(freshCats, currVal);
      }
    });
  }
}

function renderAddLinkModal(defaultCatId, defaultFolderId, defaultCatName, defaultFolderName, categoriesList) {
  let targetInfo = '';
  if (defaultCatName || defaultFolderName) {
    const loc = (defaultCatName ? defaultCatName : '') + (defaultFolderName ? ' > ' + defaultFolderName : '');
    targetInfo =
      '<div class="note-box" style="margin-bottom:var(--space-3);">' +
        'Adding link into: <strong>' + esc(loc) + '</strong>' +
      '</div>';
  }

  let catField = '';
  if (!defaultCatId && !defaultFolderId) {
    catField =
      '<div class="field" id="m_cat_field_wrapper">' +
        '<label for="m_category_select">Category</label>' +
        '<div style="display:flex; gap:8px; align-items:center;">' +
          '<select class="input select" id="m_category_select" name="category_id" style="flex:1;">' +
            buildCategorySelectOptions(categoriesList, '') +
          '</select>' +
          '<button type="button" class="btn btn-sm" id="btn_new_cat_toggle" title="Add a new category" style="padding:10px 14px; white-space:nowrap;">+ New</button>' +
        '</div>' +
        '<div id="m_new_cat_container" style="display:none; margin-top:8px; padding:10px 12px; background:var(--accent-soft); border:1px solid var(--border-soft); border-radius:var(--radius-sm);">' +
          '<label for="m_new_category_name" style="font-size:12px; font-weight:600; display:block; margin-bottom:6px; color:var(--text-strong);">New Category Name</label>' +
          '<div style="display:flex; gap:8px;">' +
            '<input class="input" id="m_new_category_name" placeholder="e.g. Work, College, Inspiration" style="flex:1; padding:8px 12px; font-size:13px;">' +
            '<button type="button" class="btn btn-sm btn-primary" id="btn_save_inline_cat" style="padding:8px 14px;">Add</button>' +
          '</div>' +
          '<span class="hint" id="m_new_cat_hint" style="margin-top:4px; display:block; font-size:11px;">Type category name and click Add to immediately include in dropdown.</span>' +
        '</div>' +
        '<span class="hint" id="m_cat_hint">Select an existing category or create a new one.</span>' +
      '</div>';
  }

  const bodyHtml =
    targetInfo +
    '<div class="field">' +
      '<label for="m_title">Title *</label>' +
      '<input class="input" id="m_title" name="title" placeholder="e.g. Documentation" required>' +
    '</div>' +
    '<div class="field">' +
      '<label for="m_url">Destination URL *</label>' +
      '<input class="input" id="m_url" name="url" type="url" placeholder="https://example.com" required>' +
    '</div>' +
    catField +
    '<div class="field">' +
      '<label for="m_tags">Tags</label>' +
      '<input class="input" id="m_tags" name="tags" placeholder="dev, tools, python">' +
      '<span class="hint">Comma-separated tags</span>' +
    '</div>' +
    '<div class="field">' +
      '<label for="m_desc">Description</label>' +
      '<textarea class="input" id="m_desc" name="description" rows="2" placeholder="Optional notes..."></textarea>' +
    '</div>';

  openModal('Add Link', bodyHtml, 'Save Link', function (form) {
    const title = String(form.get('title') || '').trim();
    const url = String(form.get('url') || '').trim();
    const selCatVal = String(form.get('category_id') || '').trim();
    const newCatInput = $('m_new_category_name');
    const newCatVal = newCatInput ? String(newCatInput.value || '').trim() : '';
    const tags = String(form.get('tags') || '').trim();
    const description = String(form.get('description') || '').trim();

    if (!title) { return 'Please enter a title for the link.'; }
    if (!url) { return 'Please enter a destination URL.'; }
    if (!isValidUrl(url)) { return 'Please enter a valid web address starting with http:// or https://'; }

    // Submit link with category and folder
    const submitLink = function (catId, fldId) {
      fetch('/links/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title,
          url: url,
          category_id: catId || null,
          folder_id: fldId || null,
          tags: tags,
          description: description
        })
      }).then(function (res) {
        if (res.ok) {
          toast('Link created successfully.');
          closeModal();
          window.location.reload();
        } else {
          res.json().then(function (data) {
            $('formError').textContent = data.error || 'Failed to save link.';
            const sub = $('modalSubmit'); if (sub) { sub.disabled = false; }
          });
        }
      }).catch(function () {
        $('formError').textContent = 'Network error saving link.';
        const sub = $('modalSubmit'); if (sub) { sub.disabled = false; }
      });
    };

    if (defaultCatId || defaultFolderId) {
      submitLink(defaultCatId, defaultFolderId);
    } else if (selCatVal === '__new__' || newCatVal) {
      if (newCatVal) {
        fetch('/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newCatVal })
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (data && data.id) {
              if (!appCategoriesCache) { appCategoriesCache = []; }
              if (!appCategoriesCache.some(function (c) { return String(c.id) === String(data.id); })) {
                appCategoriesCache.push({ id: data.id, name: data.name, team_name: data.team_name || null });
              }
              submitLink(data.id, null);
            } else {
              submitLink(null, null);
            }
          })
          .catch(function () {
            submitLink(null, null);
          });
      } else {
        submitLink(null, null);
      }
    } else if (selCatVal) {
      submitLink(selCatVal, null);
    } else {
      submitLink(null, null);
    }
  });

  // Attach interactive category controls inside modal
  setTimeout(function () {
    const catSelect = $('m_category_select');
    const toggleBtn = $('btn_new_cat_toggle');
    const newCatContainer = $('m_new_cat_container');
    const newCatInput = $('m_new_category_name');
    const saveCatBtn = $('btn_save_inline_cat');

    if (catSelect && newCatContainer && newCatInput) {
      const showNewCat = function () {
        newCatContainer.style.display = 'block';
        newCatInput.focus();
      };
      const hideNewCat = function () {
        newCatContainer.style.display = 'none';
        newCatInput.value = '';
      };

      if (toggleBtn) {
        toggleBtn.addEventListener('click', function (e) {
          e.preventDefault();
          if (newCatContainer.style.display === 'none') {
            showNewCat();
          } else {
            hideNewCat();
          }
        });
      }

      catSelect.addEventListener('change', function () {
        if (catSelect.value === '__new__') {
          showNewCat();
        } else {
          newCatContainer.style.display = 'none';
        }
      });

      const handleAddCategory = function () {
        const catName = String(newCatInput.value || '').trim();
        if (!catName) {
          toast('Please enter a category name.', true);
          newCatInput.focus();
          return;
        }
        if (saveCatBtn) { saveCatBtn.disabled = true; }

        fetch('/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: catName })
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (saveCatBtn) { saveCatBtn.disabled = false; }
            if (data && data.id) {
              if (!appCategoriesCache) { appCategoriesCache = []; }
              const exists = appCategoriesCache.some(function (c) { return String(c.id) === String(data.id); });
              if (!exists) {
                appCategoriesCache.push({ id: data.id, name: data.name, team_name: data.team_name || null });
              }
              catSelect.innerHTML = buildCategorySelectOptions(appCategoriesCache, data.id);
              catSelect.value = String(data.id);
              hideNewCat();
              toast('Category "' + esc(data.name) + '" added to dropdown.');
            } else {
              toast((data && data.error) || 'Failed to add category.', true);
            }
          })
          .catch(function () {
            if (saveCatBtn) { saveCatBtn.disabled = false; }
            toast('Network error adding category.', true);
          });
      };

      if (saveCatBtn) {
        saveCatBtn.addEventListener('click', function (e) {
          e.preventDefault();
          handleAddCategory();
        });
      }

      newCatInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAddCategory();
        }
      });
    }
  }, 40);
}

function openEditLinkForm(linkId) {
  fetch('/links/' + linkId + '/edit')
    .then(function (res) { return res.json(); })
    .then(function (link) {
      const cats = appCategoriesCache || [];
      const bodyHtml =
        '<div class="field">' +
          '<label for="m_edit_title">Title *</label>' +
          '<input class="input" id="m_edit_title" name="title" value="' + esc(link.title) + '" required>' +
        '</div>' +
        '<div class="field">' +
          '<label for="m_edit_url">Destination URL *</label>' +
          '<input class="input" id="m_edit_url" name="url" type="url" value="' + esc(link.url) + '" required>' +
        '</div>' +
        '<div class="field">' +
          '<label for="m_edit_category">Category</label>' +
          '<select class="input select" id="m_edit_category" name="category_id">' +
            buildCategorySelectOptions(cats, link.category_id || '') +
          '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="m_edit_tags">Tags</label>' +
          '<input class="input" id="m_edit_tags" name="tags" value="' + esc(Array.isArray(link.tags) ? link.tags.join(', ') : link.tags) + '">' +
        '</div>' +
        '<div class="field">' +
          '<label for="m_edit_desc">Description</label>' +
          '<textarea class="input" id="m_edit_desc" name="description" rows="2">' + esc(link.description || '') + '</textarea>' +
        '</div>';

      openModal('Edit Link', bodyHtml, 'Save Changes', function (form) {
        const title = String(form.get('title') || '').trim();
        const url = String(form.get('url') || '').trim();
        const categoryId = String(form.get('category_id') || '').trim();
        const tags = String(form.get('tags') || '').trim();
        const description = String(form.get('description') || '').trim();

        if (!title) { return 'Please enter a title.'; }
        if (!url) { return 'Please enter a valid URL.'; }

        fetch('/links/' + linkId + '/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title,
            url: url,
            category_id: categoryId || null,
            tags: tags,
            description: description
          })
        }).then(function (res) {
          if (res.ok) {
            toast('Link updated.');
            closeModal();
            window.location.reload();
          } else {
            res.json().then(function (err) {
              $('formError').textContent = err.error || 'Error saving changes.';
            });
          }
        }).catch(function () {
          $('formError').textContent = 'Network error saving changes.';
        });
      });
    }).catch(function () {
      toast('Failed to load link data.', true);
    });
}
}

function toggleFavourite(linkId) {
  fetch('/links/' + linkId + '/favorite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  })
    .then(function (res) {
      if (!res.ok) { throw new Error('Status ' + res.status); }
      return res.json();
    })
    .then(function (data) {
      toast(data.is_favourite ? 'Added to Favourites.' : 'Removed from Favourites.');
      window.location.reload();
    }).catch(function (err) {
      console.error('Favourite toggle error:', err);
      toast('Could not update favourite status.', true);
    });
}

function checkLinkHealth(linkId) {
  toast('Verifying link health...');
  fetch('/links/' + linkId + '/health-check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  })
    .then(function (res) {
      if (!res.ok) { throw new Error('Status ' + res.status); }
      return res.json();
    })
    .then(function (data) {
      toast('Health check complete: ' + (data.health_status || 'Verified'));
      window.location.reload();
    })
    .catch(function (err) {
      console.error('Health check error:', err);
      toast('Could not complete health check.', true);
    });
}

function archiveLink(linkId) {
  fetch('/links/' + linkId + '/archive', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  })
    .then(function () {
      toast('Moved to Archive.');
      window.location.reload();
    }).catch(function () {
      toast('Could not archive link.', true);
    });
}

function restoreLink(linkId) {
  fetch('/links/' + linkId + '/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }).then(function (res) {
    if (res.ok) {
      toast('Link restored to Active.');
      const btn = document.querySelector('[data-action="restoreLink"][data-id="' + linkId + '"]');
      const card = btn ? btn.closest('.link-card, article') : null;
      if (card) { card.remove(); } else { window.location.reload(); }
    } else {
      toast('Could not restore link.', true);
    }
  }).catch(function () {
    toast('Network error restoring link.', true);
  });
}

function deleteLink(linkId) {
  confirmBox('Delete Link?', 'Move this link to Trash? It will be removed from your active collection.', 'Delete', function () {
    fetch('/links/' + linkId + '/trash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).then(function (res) {
      if (res.ok) {
        toast('Link deleted.');
        const btn = document.querySelector('[data-id="' + linkId + '"]');
        const card = btn ? btn.closest('.link-card, article') : null;
        if (card) { card.remove(); } else { window.location.reload(); }
      } else {
        toast('Could not delete link.', true);
      }
    }).catch(function () {
      toast('Network error deleting link.', true);
    });
  }, true);
}

function purgeLink(linkId) {
  confirmBox('Permanently Delete?', 'This will permanently delete this link from the database. This cannot be undone.', 'Delete Permanently', function () {
    fetch('/links/' + linkId + '/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).then(function (res) {
      if (res.ok) {
        toast('Link permanently deleted.');
        const btn = document.querySelector('[data-action="purgeLink"][data-id="' + linkId + '"]');
        const card = btn ? btn.closest('.link-card, article') : null;
        if (card) { card.remove(); } else { window.location.reload(); }
      } else {
        toast('Could not delete link.', true);
      }
    }).catch(function () {
      toast('Network error deleting link.', true);
    });
  }, true);
}

function copyUrl(text) {
  if (!text) { return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      toast('URL copied to clipboard.');
    }).catch(function () {
      toast('Failed to copy URL.', true);
    });
  } else {
    toast('URL: ' + text);
  }
}

function copyShort(shortCode) {
  if (!shortCode) { return; }
  const fullUrl = window.location.origin + '/s/' + shortCode;
  copyUrl(fullUrl);
}

function showShortUrl(linkId) {
  const card = document.querySelector('[data-link-id="' + linkId + '"]');
  if (!card) { return; }
  const urlEl = card.querySelector('.card-url');
  const destinationUrl = urlEl ? urlEl.getAttribute('href') : '';
  const title = card.querySelector('.card-title') ? card.querySelector('.card-title').textContent : 'Link';
  const shortCodeEl = card.querySelector('.card-short code');
  let shortCode = '';
  if (shortCodeEl) {
    const parts = shortCodeEl.textContent.trim().split('/');
    shortCode = parts[parts.length - 1];
  }

  const fullShortUrl = window.location.origin + '/s/' + shortCode;

  const body =
    '<p class="card-meta" style="margin-bottom:12px">Short URL generated for this link. You can copy, share, or open the link directly.</p>' +
    '<div class="field">' +
      '<label>Short URL</label>' +
      '<div class="copy-row">' +
        '<code>' + esc(fullShortUrl) + '</code>' +
        '<button type="button" class="btn btn-sm btn-primary" onclick="copyShort(\'' + esc(shortCode) + '\')">Copy Short URL</button>' +
      '</div>' +
    '</div>' +
    '<div class="field">' +
      '<label>Original Destination URL</label>' +
      '<div class="copy-row">' +
        '<code>' + esc(destinationUrl) + '</code>' +
        '<button type="button" class="btn btn-sm" onclick="copyUrl(\'' + esc(destinationUrl) + '\')">Copy Destination URL</button>' +
      '</div>' +
    '</div>' +
    '<div style="margin-top:14px;display:flex;gap:8px;">' +
      '<a href="' + esc(destinationUrl) + '" target="_blank" rel="noopener noreferrer" class="btn btn-sm">Visit Destination</a>' +
      '<a href="' + esc(fullShortUrl) + '" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary">Test Short Redirect</a>' +
    '</div>';

  openModal('Short URL for "' + title + '"', body, null, null);
}
