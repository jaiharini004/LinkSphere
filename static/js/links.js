/* =====================================================================
   LinkSphere - static/js/links.js
   Link card actions, CRUD modals, copy functions, and favorites
   ===================================================================== */
'use strict';

function openAddLinkForm(defaultCatId, defaultFolderId, defaultCatName, defaultFolderName) {
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
      '<div class="field">' +
        '<label for="m_category_name">Category</label>' +
        '<input class="input" id="m_category_name" name="category_name" placeholder="e.g. Work, College, or Inspiration">' +
        '<span class="hint">Type a category name or leave empty for general.</span>' +
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
    const catName = String(form.get('category_name') || '').trim();
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
    } else if (catName) {
      fetch('/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: catName })
      }).then(function (res) {
        return res.json();
      }).then(function (data) {
        submitLink(data.id || null, null);
      }).catch(function () {
        submitLink(null, null);
      });
    } else {
      submitLink(null, null);
    }
  });
}

function openEditLinkForm(linkId) {
  fetch('/links/' + linkId + '/edit')
    .then(function (res) { return res.json(); })
    .then(function (link) {
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
