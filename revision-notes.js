/**
 * revision-notes.js — Onglet Révisions (isolé).
 * Tableau des matières → post-its colorés par groupe.
 */
(function () {
  'use strict';

  var PREFIX_NOTE = 'RN-';
  var PREFIX_ITEM = 'RI-';
  var activeMat = null;

  var GROUPS = [
    { id: 'urgent', label: 'À réviser absolument', short: 'Absolument' },
    { id: 'revoir', label: 'À revoir', short: 'À revoir' },
    { id: 'consolider', label: 'À consolider', short: 'Consolider' },
    { id: 'voir', label: 'À voir', short: 'À voir' },
    { id: 'autre', label: 'Autre', short: 'Autre' }
  ];
  var GROUP_IDS = GROUPS.map(function (g) { return g.id; });

  function esc(s) {
    return typeof window.escHtml === 'function'
      ? window.escHtml(s)
      : String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
  }

  function icon(name, size) {
    return typeof window.iconHtml === 'function'
      ? window.iconHtml(name, size || 16)
      : '';
  }

  function ensureStore() {
    if (!window.D) return [];
    if (!Array.isArray(window.D.revisionNotes)) window.D.revisionNotes = [];
    return window.D.revisionNotes;
  }

  function newId(prefix) {
    return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function canEdit() {
    if (window.TabLock && typeof window.TabLock.isReadOnly === 'function' && window.TabLock.isReadOnly()) return false;
    if (window.DeviceSession && typeof window.DeviceSession.canFullSave === 'function' && !window.DeviceSession.canFullSave()) return false;
    return true;
  }

  function persist() {
    if (typeof window.save === 'function') {
      try { return window.save(); } catch (e) { return Promise.reject(e); }
    }
    return Promise.resolve();
  }

  function applyNoteEdits(note, edits) {
    if (!note || !edits) return note;
    if (edits.title != null) {
      note.title = String(edits.title || '').trim() || 'Sans titre';
    }
    if (Array.isArray(edits.items)) {
      edits.items.forEach(function (it) {
        if (!it || !it.id) return;
        var found = findItem(note, it.id);
        if (!found) return;
        var text = String(it.text || '').trim();
        if (!text) found.arr.splice(found.arr.indexOf(found.item), 1);
        else found.item.text = text;
      });
    }
    if (edits.add) addItem(note, edits.add);
    return note;
  }

  function setNoteGroup(note, g) {
    if (!note || GROUP_IDS.indexOf(g) === -1) return false;
    note.group = g;
    return true;
  }

  function harvestNoteEl(el, commitAdd) {
    if (!el) return null;
    var note = findNote(el.getAttribute('data-id'));
    if (!note) return null;
    var titleEl = el.querySelector('.rev-title');
    var items = [];
    var lis = el.querySelectorAll('.rev-item');
    for (var i = 0; i < lis.length; i++) {
      var li = lis[i];
      var inp = li.querySelector('.rev-item-text');
      items.push({
        id: li.getAttribute('data-item'),
        text: inp ? inp.value : ''
      });
    }
    var addEl = el.querySelector('.rev-add-item');
    var add = '';
    if (commitAdd && addEl) {
      add = String(addEl.value || '').trim();
      if (add) addEl.value = '';
    }
    applyNoteEdits(note, {
      title: titleEl ? titleEl.value : null,
      items: items,
      add: add
    });
    return note;
  }

  function harvestOpenNotes(commitAdd) {
    var root = document.getElementById('paneRevisions');
    if (!root) return;
    var notes = root.querySelectorAll('.rev-note');
    for (var i = 0; i < notes.length; i++) harvestNoteEl(notes[i], commitAdd);
  }

  function applyGroupInPlace(el, g) {
    if (!el || GROUP_IDS.indexOf(g) === -1) return;
    el.setAttribute('data-group', g);
    var dots = el.querySelectorAll('.rev-gdot');
    for (var i = 0; i < dots.length; i++) {
      var on = dots[i].getAttribute('data-group') === g;
      dots[i].classList.toggle('is-on', on);
      dots[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    var lab = el.querySelector('.rev-group-label');
    if (lab) lab.textContent = groupDef(g).label;
  }

  function findNote(id) {
    return ensureStore().find(function (n) { return n && n.id === id; }) || null;
  }

  function noteGroup(note) {
    var g = note && note.group;
    if (g && GROUP_IDS.indexOf(g) !== -1) return g;
    if (note && Array.isArray(note.consolidate) && note.consolidate.length
        && !(Array.isArray(note.review) && note.review.length)) {
      return 'consolider';
    }
    if (note && Array.isArray(note.review) && note.review.length) return 'revoir';
    return 'autre';
  }

  function groupDef(id) {
    return GROUPS.find(function (g) { return g.id === id; }) || GROUPS[GROUPS.length - 1];
  }

  function listItems(note) {
    if (!note) return [];
    if (!Array.isArray(note.review)) note.review = [];
    if (!Array.isArray(note.consolidate)) note.consolidate = [];
    return note.review.concat(note.consolidate);
  }

  function findItem(note, itemId) {
    var lists = [note.review, note.consolidate];
    for (var i = 0; i < lists.length; i++) {
      var arr = lists[i];
      if (!Array.isArray(arr)) continue;
      for (var j = 0; j < arr.length; j++) {
        if (arr[j] && arr[j].id === itemId) return { arr: arr, item: arr[j] };
      }
    }
    return null;
  }

  function matieres() {
    if (typeof window.listSelectableMatieres === 'function') {
      return window.listSelectableMatieres({ includeSystem: false }) || [];
    }
    return ((window.D && window.D.matieres) || []).filter(function (m) {
      return m && m.id && m.enabled !== false;
    });
  }

  function matById(id) {
    if (!id) return { id: '', name: 'Sans matière', color: '#8892a8' };
    return matieres().find(function (m) { return m && m.id === id; })
      || ((window.D && window.D.matieres) || []).find(function (m) { return m && m.id === id; })
      || { id: id, name: id, color: '#8892a8' };
  }

  function notesForMat(matId) {
    return ensureStore().filter(function (n) {
      if (!n || !n.id) return false;
      if (!matId) return !n.mat;
      return n.mat === matId;
    });
  }

  function createNote(matId, title, group) {
    var note = {
      id: newId(PREFIX_NOTE),
      mat: matId || '',
      title: String(title || '').trim() || 'Sans titre',
      group: GROUP_IDS.indexOf(group) !== -1 ? group : 'autre',
      review: [],
      consolidate: [],
      createdAt: Date.now()
    };
    ensureStore().push(note);
    return note;
  }

  function addItem(note, text, maybeText) {
    if (!note) return null;
    if (!Array.isArray(note.review)) note.review = [];
    if (!Array.isArray(note.consolidate)) note.consolidate = [];
    var dest = 'review';
    var t = text;
    if ((text === 'review' || text === 'consolidate') && maybeText != null) {
      dest = text;
      t = maybeText;
    }
    t = String(t || '').trim();
    if (!t) return null;
    var item = { id: newId(PREFIX_ITEM), text: t, done: false };
    note[dest].push(item);
    return item;
  }

  function renderItem(item, editable) {
    var done = item && item.done ? ' checked' : '';
    var dis = editable ? '' : ' disabled';
    return '<li class="rev-item' + (item.done ? ' is-done' : '') + '" data-item="' + esc(item.id) + '">' +
      '<label class="rev-check"><input type="checkbox" data-fc-skip' + done + dis + ' data-rev-act="toggle"></label>' +
      '<input class="rev-item-text" type="text" value="' + esc(item.text) + '"' + dis + ' data-rev-act="item-text" maxlength="240">' +
      (editable ? '<button type="button" class="rev-item-del" data-rev-act="del-item" title="Retirer" aria-label="Retirer">' + icon('x', 14) + '</button>' : '') +
      '</li>';
  }

  function renderGroupPicker(note, editable) {
    var cur = noteGroup(note);
    var html = '<div class="rev-groups" role="group" aria-label="Groupe du post-it">';
    GROUPS.forEach(function (g) {
      var on = g.id === cur ? ' is-on' : '';
      html += '<button type="button" class="rev-gdot' + on + '" data-rev-act="set-group" data-group="' + g.id + '"' +
        (editable ? '' : ' disabled') + ' title="' + esc(g.label) + '" aria-label="' + esc(g.label) + '"' +
        (g.id === cur ? ' aria-pressed="true"' : ' aria-pressed="false"') + '></button>';
    });
    html += '<span class="rev-group-label">' + esc(groupDef(cur).label) + '</span>';
    html += '</div>';
    return html;
  }

  function renderNote(note, editable) {
    if (!note || !note.id) return '';
    var title = note.title || 'Sans titre';
    var g = noteGroup(note);
    var items = listItems(note);
    var html = '<article class="rev-note" data-id="' + esc(note.id) + '" data-group="' + g + '">';
    html += '<span class="rev-tape" aria-hidden="true"></span>';
    html += '<header class="rev-note-hd">';
    html += '<input class="rev-title" type="text" value="' + esc(title) + '"' + (editable ? '' : ' disabled') + ' data-rev-act="title" maxlength="80" aria-label="Nom du post-it">';
    if (editable) {
      html += '<button type="button" class="rev-note-del" data-rev-act="del-note" title="Supprimer le post-it" aria-label="Supprimer">' + icon('x', 14) + '</button>';
    }
    html += '</header>';
    html += renderGroupPicker(note, editable);
    html += '<ul class="rev-list">';
    items.forEach(function (it) { if (it) html += renderItem(it, editable); });
    html += '</ul>';
    if (editable) {
      html += '<input class="rev-add-item" type="text" placeholder="+ Ajouter" maxlength="240" data-rev-act="add-item">';
    }
    html += '</article>';
    return html;
  }

  function renderMini(note, i) {
    var g = noteGroup(note);
    var rot = ((i % 5) - 2) * 3;
    return '<span class="rev-mini" data-group="' + g + '" style="transform:rotate(' + rot + 'deg)" title="' +
      esc((note.title || 'Sans titre') + ' — ' + groupDef(g).label) + '"></span>';
  }

  function notesByGroup(notes) {
    var map = Object.create(null);
    GROUPS.forEach(function (g) { map[g.id] = []; });
    notes.forEach(function (n) {
      var g = noteGroup(n);
      (map[g] || (map.autre = map.autre || [])).push(n);
    });
    return map;
  }

  function renderTableRow(mat, notes) {
    var color = (mat && mat.color) || '#5b8df7';
    var name = (mat && (mat.name || mat.label || mat.id)) || 'Sans matière';
    var id = (mat && mat.id) || '';
    var byG = notesByGroup(notes);
    var html = '<tr class="rev-row' + (notes.length ? '' : ' is-empty') + '" data-rev-act="open-mat" data-mat="' +
      esc(id) + '" style="--mat-color:' + esc(color) + '" tabindex="0">';
    html += '<th scope="row" class="rev-th-mat">';
    html += '<span class="rev-mat-pip" aria-hidden="true"></span>';
    html += '<span class="rev-cell-name">' + esc(name) + '</span>';
    html += '</th>';
    GROUPS.forEach(function (g) {
      var list = byG[g.id] || [];
      html += '<td class="rev-td" data-group="' + g.id + '">';
      html += '<div class="rev-mosaic' + (list.length ? '' : ' is-empty') + '">';
      if (!list.length) {
        html += '<span class="rev-mosaic-empty">—</span>';
      } else {
        list.forEach(function (note, i) { html += renderMini(note, i); });
      }
      html += '</div></td>';
    });
    html += '<td class="rev-td-total">' + notes.length + '</td>';
    html += '</tr>';
    return html;
  }

  function renderBoard() {
    var mats = matieres();
    var all = ensureStore().filter(function (n) { return n && n.id; });
    var used = Object.create(null);
    var html = '<p class="rev-page-sub">Clique une ligne pour ouvrir la matière. Les cases se remplissent avec tes post-its.</p>';
    html += '<div class="rev-table-wrap">';
    html += '<table class="rev-table">';
    html += '<thead><tr><th class="rev-th-mat">Matière</th>';
    GROUPS.forEach(function (g) {
      html += '<th data-group="' + g.id + '"><span class="rev-legend-swatch"></span>' + esc(g.short) + '</th>';
    });
    html += '<th class="rev-th-total">Total</th></tr></thead><tbody>';
    mats.forEach(function (m) {
      var notes = all.filter(function (n) { return n.mat === m.id; });
      notes.forEach(function (n) { used[n.id] = true; });
      html += renderTableRow(m, notes);
    });
    var orphan = all.filter(function (n) { return !used[n.id]; });
    if (orphan.length) {
      html += renderTableRow({ id: '', name: 'Sans matière', color: '#8892a8' }, orphan);
    }
    html += '</tbody></table></div>';
    if (!mats.length) {
      html += '<p class="rev-empty-page">Crée d’abord une matière (onglet Matières) pour classer tes post-its.</p>';
    }
    return html;
  }

  function renderMatView(matId, editable) {
    var mat = matById(matId);
    var notes = notesForMat(matId);
    var color = mat.color || '#5b8df7';
    var name = mat.name || mat.label || mat.id || 'Sans matière';
    var html = '<div class="rev-mat-view" data-mat="' + esc(matId || '') + '" style="--mat-color:' + esc(color) + '">';
    html += '<div class="rev-mat-toolbar">';
    html += '<button type="button" class="rev-back" data-rev-act="back-board">' + icon('arrow-left', 16) + ' Tableau</button>';
    html += '<span class="rev-mat-pip" aria-hidden="true"></span>';
    html += '<h3 class="rev-mat-name">' + esc(name) + '</h3>';
    html += '<span class="rev-mat-count">' + notes.length + '</span>';
    if (editable) {
      html += '<button type="button" class="rev-add" data-rev-act="add-note">' + icon('plus', 14) + ' Post-it</button>';
    }
    html += '</div>';
    html += '<div class="rev-grid">';
    if (!notes.length) {
      html += '<div class="rev-empty">';
      html += '<div class="rev-empty-ghost" aria-hidden="true"></div>';
      html += '<p>Aucun post-it ici. Clique <b>Post-it</b>, donne un nom, choisis un groupe de couleur.</p>';
      html += '</div>';
    } else {
      notes.forEach(function (n) { html += renderNote(n, editable); });
    }
    html += '</div></div>';
    return html;
  }

  function render() {
    var root = document.getElementById('paneRevisions');
    if (!root) return;
    harvestOpenNotes(true);
    ensureStore();
    var editable = canEdit();
    var html = '<div class="rev-wrap' + (editable ? '' : ' is-readonly') + '">';
    html += '<header class="rev-page-hd">';
    html += '<h2 class="rev-page-title">' + icon('sticky-note', 22) + ' Post-it</h2>';
    html += '</header>';
    html += activeMat === null ? renderBoard() : renderMatView(activeMat, editable);
    html += '</div>';
    root.innerHTML = html;
    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(root);
  }

  function noteFromEvent(t) {
    var art = t && t.closest ? t.closest('.rev-note') : null;
    if (!art) return { el: null, note: null };
    return { el: art, note: findNote(art.getAttribute('data-id')) };
  }

  function bind() {
    var root = document.getElementById('paneRevisions');
    if (!root || root._revBound) return;
    root._revBound = true;

    root.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || t.getAttribute('data-rev-act') !== 'toggle' || !canEdit()) return;
      var ctx = noteFromEvent(t);
      var li = t.closest('.rev-item');
      if (!ctx.note || !li) return;
      var found = findItem(ctx.note, li.getAttribute('data-item'));
      if (!found) return;
      found.item.done = !!t.checked;
      persist();
      render();
    });

    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-rev-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-rev-act');
      if (act === 'toggle' || act === 'title' || act === 'item-text' || act === 'add-item') return;

      if (act === 'open-mat') {
        activeMat = btn.getAttribute('data-mat') || '';
        render();
        return;
      }
      if (act === 'back-board') {
        activeMat = null;
        render();
        return;
      }

      if (!canEdit()) return;

      if (act === 'add-note') {
        var view = btn.closest('.rev-mat-view');
        var matId = view ? view.getAttribute('data-mat') : (activeMat || '');
        var note = createNote(matId, '', 'autre');
        persist();
        render();
        var inp = root.querySelector('.rev-note[data-id="' + note.id + '"] .rev-title');
        if (inp) { inp.focus(); inp.select(); }
        return;
      }

      var ctx = noteFromEvent(btn);
      if (!ctx.note) return;

      if (act === 'set-group') {
        var g = btn.getAttribute('data-group');
        if (GROUP_IDS.indexOf(g) === -1) return;
        harvestNoteEl(ctx.el, false);
        if (!setNoteGroup(ctx.note, g)) return;
        applyGroupInPlace(ctx.el, g);
        persist();
        return;
      }

      if (act === 'del-note') {
        var go = function () {
          window.D.revisionNotes = ensureStore().filter(function (n) { return n && n.id !== ctx.note.id; });
          persist();
          render();
        };
        if (typeof window.sysConfirm === 'function') {
          window.sysConfirm('Supprimer le post-it « ' + (ctx.note.title || 'Sans titre') + ' » ?', go);
        } else if (window.confirm('Supprimer ce post-it ?')) go();
        return;
      }

      if (act === 'del-item') {
        var liDel = btn.closest('.rev-item');
        if (!liDel) return;
        var foundDel = findItem(ctx.note, liDel.getAttribute('data-item'));
        if (!foundDel) return;
        foundDel.arr.splice(foundDel.arr.indexOf(foundDel.item), 1);
        persist();
        render();
      }
    });

    root.addEventListener('keydown', function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains('rev-row') && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        activeMat = t.getAttribute('data-mat') || '';
        render();
        return;
      }
      if (!t || !canEdit()) return;
      var act = t.getAttribute('data-rev-act');
      if (e.key === 'Enter' && act === 'add-item') {
        e.preventDefault();
        var ctx = noteFromEvent(t);
        if (!ctx.note) return;
        if (!addItem(ctx.note, t.value)) return;
        t.value = '';
        persist();
        render();
        var again = root.querySelector('.rev-note[data-id="' + ctx.note.id + '"] .rev-add-item');
        if (again) again.focus();
        return;
      }
      if (e.key === 'Enter' && (act === 'title' || act === 'item-text')) {
        e.preventDefault();
        t.blur();
      }
    });

    root.addEventListener('input', function (e) {
      var t = e.target;
      if (!t || !canEdit()) return;
      var act = t.getAttribute('data-rev-act');
      var ctx = noteFromEvent(t);
      if (!ctx.note) return;
      if (act === 'title') {
        ctx.note.title = String(t.value || '').trim() || 'Sans titre';
        return;
      }
      if (act === 'item-text') {
        var liLive = t.closest('.rev-item');
        if (!liLive) return;
        var foundLive = findItem(ctx.note, liLive.getAttribute('data-item'));
        if (!foundLive) return;
        foundLive.item.text = String(t.value || '');
      }
    });

    root.addEventListener('focusout', function (e) {
      var t = e.target;
      if (!t || !canEdit()) return;
      var act = t.getAttribute('data-rev-act');
      var ctx = noteFromEvent(t);
      if (!ctx.note) return;
      if (act === 'title') {
        var next = String(t.value || '').trim() || 'Sans titre';
        if (next === ctx.note.title) return;
        ctx.note.title = next;
        t.value = next;
        persist();
        return;
      }
      if (act === 'item-text') {
        var li = t.closest('.rev-item');
        if (!li) return;
        var found = findItem(ctx.note, li.getAttribute('data-item'));
        if (!found) return;
        var text = String(t.value || '').trim();
        if (!text) {
          found.arr.splice(found.arr.indexOf(found.item), 1);
          persist();
          render();
          return;
        }
        if (text === found.item.text) return;
        found.item.text = text;
        persist();
      }
    });
  }

  window.renderRevisions = function () {
    bind();
    activeMat = null;
    render();
  };

  window._revisionNotesApi = {
    ensureStore: ensureStore,
    createNote: createNote,
    addItem: addItem,
    findNote: findNote,
    noteGroup: noteGroup,
    applyNoteEdits: applyNoteEdits,
    setNoteGroup: setNoteGroup,
    harvestNoteEl: harvestNoteEl,
    applyGroupInPlace: applyGroupInPlace,
    newId: newId,
    GROUPS: GROUPS,
    setActiveMat: function (id) { activeMat = id; },
    getActiveMat: function () { return activeMat; }
  };
})();
