/**
 * revision-notes.js — Onglet Révisions : post-its par matière,
 * listes « À réviser » / « À consolider ».
 */
(function () {
  'use strict';

  var PREFIX_NOTE = 'RN-';
  var PREFIX_ITEM = 'RI-';

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

  function findNote(id) {
    return ensureStore().find(function (n) { return n && n.id === id; }) || null;
  }

  function listItems(note, kind) {
    if (!note) return [];
    var key = kind === 'consolidate' ? 'consolidate' : 'review';
    if (!Array.isArray(note[key])) note[key] = [];
    return note[key];
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
    return ((window.D && window.D.matieres) || []).find(function (m) { return m && m.id === id; }) || null;
  }

  function createNote(matId, title) {
    var note = {
      id: newId(PREFIX_NOTE),
      mat: matId || '',
      title: String(title || '').trim() || 'Sans titre',
      review: [],
      consolidate: [],
      createdAt: Date.now()
    };
    ensureStore().push(note);
    return note;
  }

  function addItem(note, kind, text) {
    var t = String(text || '').trim();
    if (!note || !t) return null;
    var item = { id: newId(PREFIX_ITEM), text: t, done: false };
    listItems(note, kind).push(item);
    return item;
  }

  function renderItem(item, kind, editable) {
    var done = item && item.done ? ' checked' : '';
    var dis = editable ? '' : ' disabled';
    return '<li class="rev-item' + (item.done ? ' is-done' : '') + '" data-item="' + esc(item.id) + '" data-kind="' + kind + '">' +
      '<label class="rev-check"><input type="checkbox"' + done + dis + ' data-rev-act="toggle"></label>' +
      '<input class="rev-item-text" type="text" value="' + esc(item.text) + '"' + dis + ' data-rev-act="item-text" maxlength="240">' +
      (editable ? '<button type="button" class="rev-item-del" data-rev-act="del-item" title="Retirer" aria-label="Retirer">' + icon('x', 14) + '</button>' : '') +
      '</li>';
  }

  function renderCol(note, kind, label, editable) {
    var items = listItems(note, kind);
    var open = items.filter(function (it) { return it && !it.done; }).length;
    var html = '<div class="rev-col" data-kind="' + kind + '">';
    html += '<h4 class="rev-col-title">' + esc(label) + ' <span class="rev-col-count">' + open + '</span></h4>';
    html += '<ul class="rev-list">';
    items.forEach(function (it) { if (it) html += renderItem(it, kind, editable); });
    html += '</ul>';
    if (editable) {
      html += '<input class="rev-add-item" type="text" placeholder="Ajouter…" maxlength="240" data-rev-act="add-item">';
    }
    html += '</div>';
    return html;
  }

  function renderNote(note, editable) {
    if (!note || !note.id) return '';
    var title = note.title || 'Sans titre';
    var html = '<article class="rev-note" data-id="' + esc(note.id) + '">';
    html += '<header class="rev-note-hd">';
    html += '<input class="rev-title" type="text" value="' + esc(title) + '"' + (editable ? '' : ' disabled') + ' data-rev-act="title" maxlength="80" aria-label="Nom du post-it">';
    if (editable) {
      html += '<button type="button" class="rev-note-del" data-rev-act="del-note" title="Supprimer le post-it" aria-label="Supprimer">' + icon('trash-2', 14) + '</button>';
    }
    html += '</header>';
    html += '<div class="rev-cols">';
    html += renderCol(note, 'review', 'À réviser', editable);
    html += renderCol(note, 'consolidate', 'À consolider', editable);
    html += '</div></article>';
    return html;
  }

  function renderMatSection(mat, notes, editable) {
    var color = (mat && mat.color) || '#5b8df7';
    var name = (mat && (mat.name || mat.label || mat.id)) || 'Sans matière';
    var id = (mat && mat.id) || '';
    var html = '<section class="rev-mat" data-mat="' + esc(id) + '" style="--mat-color:' + esc(color) + '">';
    html += '<div class="rev-mat-hd">';
    html += '<h3 class="rev-mat-name">' + esc(name) + '</h3>';
    html += '<span class="rev-mat-count">' + notes.length + '</span>';
    if (editable) {
      html += '<button type="button" class="bp rev-add" data-rev-act="add-note">+ Post-it</button>';
    }
    html += '</div>';
    html += '<div class="rev-grid">';
    if (!notes.length) {
      html += '<p class="rev-empty">Aucun post-it. Donne-lui un nom rapide, puis liste ce qu’il faut réviser ou consolider.</p>';
    } else {
      notes.forEach(function (n) { html += renderNote(n, editable); });
    }
    html += '</div></section>';
    return html;
  }

  function render() {
    var root = document.getElementById('paneRevisions');
    if (!root) return;
    ensureStore();
    var editable = canEdit();
    var mats = matieres();
    var all = ensureStore().filter(function (n) { return n && n.id; });
    var used = Object.create(null);
    var html = '<div class="rev-wrap' + (editable ? '' : ' is-readonly') + '">';
    html += '<header class="rev-page-hd">';
    html += '<h2 class="rev-page-title">' + icon('sticky-note', 22) + ' Révisions</h2>';
    html += '<p class="rev-page-sub">Post-its par matière. Nomme-les vite, puis coche ce qu’il faut réviser ou consolider.</p>';
    html += '</header>';

    mats.forEach(function (m) {
      var notes = all.filter(function (n) { return n.mat === m.id; });
      notes.forEach(function (n) { used[n.id] = true; });
      html += renderMatSection(m, notes, editable);
    });

    var orphan = all.filter(function (n) { return !used[n.id]; });
    if (orphan.length) {
      html += renderMatSection({ id: '', name: 'Sans matière', color: '#8892a8' }, orphan, editable);
    }

    if (!mats.length) {
      html += '<p class="rev-empty">Crée d’abord une matière (onglet Matières) pour classer tes post-its.</p>';
    }

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
      var kind = li.getAttribute('data-kind');
      var itemId = li.getAttribute('data-item');
      var it = listItems(ctx.note, kind).find(function (x) { return x && x.id === itemId; });
      if (!it) return;
      it.done = !!t.checked;
      persist();
      render();
    });

    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-rev-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-rev-act');
      if (act === 'toggle' || act === 'title' || act === 'item-text' || act === 'add-item') return;
      if (!canEdit()) return;

      if (act === 'add-note') {
        var sec = btn.closest('.rev-mat');
        var matId = sec ? sec.getAttribute('data-mat') : '';
        var note = createNote(matId, '');
        persist();
        render();
        var inp = root.querySelector('.rev-note[data-id="' + note.id + '"] .rev-title');
        if (inp) { inp.focus(); inp.select(); }
        return;
      }

      var ctx = noteFromEvent(btn);
      if (!ctx.note) return;

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
        var kDel = liDel.getAttribute('data-kind');
        var idDel = liDel.getAttribute('data-item');
        var arr = listItems(ctx.note, kDel);
        ctx.note[kDel === 'consolidate' ? 'consolidate' : 'review'] = arr.filter(function (x) { return x && x.id !== idDel; });
        persist();
        render();
      }
    });

    root.addEventListener('keydown', function (e) {
      var t = e.target;
      if (!t || !canEdit()) return;
      var act = t.getAttribute('data-rev-act');
      if (e.key === 'Enter' && act === 'add-item') {
        e.preventDefault();
        var ctx = noteFromEvent(t);
        if (!ctx.note) return;
        var col = t.closest('.rev-col');
        var kind = col ? col.getAttribute('data-kind') : 'review';
        if (!addItem(ctx.note, kind, t.value)) return;
        t.value = '';
        persist();
        render();
        var again = root.querySelector('.rev-note[data-id="' + ctx.note.id + '"] .rev-col[data-kind="' + kind + '"] .rev-add-item');
        if (again) again.focus();
        return;
      }
      if (e.key === 'Enter' && (act === 'title' || act === 'item-text')) {
        e.preventDefault();
        t.blur();
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
        var kind = li.getAttribute('data-kind');
        var itemId = li.getAttribute('data-item');
        var it = listItems(ctx.note, kind).find(function (x) { return x && x.id === itemId; });
        if (!it) return;
        var text = String(t.value || '').trim();
        if (!text) {
          ctx.note[kind === 'consolidate' ? 'consolidate' : 'review'] =
            listItems(ctx.note, kind).filter(function (x) { return x && x.id !== itemId; });
          persist();
          render();
          return;
        }
        if (text === it.text) return;
        it.text = text;
        persist();
      }
    });
  }

  window.renderRevisions = function () {
    bind();
    render();
  };

  window._revisionNotesApi = {
    ensureStore: ensureStore,
    createNote: createNote,
    addItem: addItem,
    findNote: findNote,
    newId: newId
  };
})();
