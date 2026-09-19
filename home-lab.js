/**
 * home-lab.js — Labo Accueil : maquettes plein écran (comme le vrai Accueil)
 */
(function () {
  'use strict';

  var IDEAS = [
    {
      id: 'code',
      title: 'Code au centre',
      pitch: 'Ouvrir un doc = geste principal'
    },
    {
      id: 'portes',
      title: 'Trois portes',
      pitch: 'Base Doc · Sync · Rapide'
    },
    {
      id: 'jour',
      title: 'Aujourd’hui',
      pitch: 'Ce qui presse, d’abord'
    },
    {
      id: 'sync',
      title: 'Révision d’abord',
      pitch: 'Synchrotron en tête'
    }
  ];

  var _view = null;
  var _pick = null;
  try {
    _pick = localStorage.getItem('homeLabPick') || null;
    _view = localStorage.getItem('homeLabView') || _pick || 'portes';
  } catch (e) {
    _pick = null;
    _view = 'portes';
  }
  if (!IDEAS.some(function (i) { return i.id === _view; })) _view = 'portes';

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

  function userName() {
    var n = window.D && window.D.settings && window.D.settings.userName;
    return n ? String(n) : '';
  }

  function dateLabel() {
    try {
      return new Date().toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long'
      });
    } catch (e) {
      return '';
    }
  }

  function stats() {
    var cours = (window.D && window.D.cours) || [];
    var exos = (window.D && window.D.exercices) || [];
    var devoirs = (window.D && window.D.devoirs) || [];
    var today = (window.AnkiAlgoV2 && window.AnkiAlgoV2.todayISO)
      ? window.AnkiAlgoV2.todayISO()
      : new Date().toISOString().slice(0, 10);

    var qrTodo = cours.filter(function (c) {
      if (typeof window.isCoursUnite === 'function' && window.isCoursUnite(c)) return false;
      return c.stat === 'pending' || c.stat === 'printed';
    }).length;

    var dueX = 0;
    var dueY = 0;
    exos.forEach(function (c) {
      if (!c || c.statut !== 'actif') return;
      var due = c.dateProchaineRevision;
      if (!due || due > today) return;
      var kind = window.AnkiAlgoV2 && window.AnkiAlgoV2.cardKind
        ? window.AnkiAlgoV2.cardKind(c)
        : (String(c.id || '').charAt(0) === 'Y' ? 'quick' : 'main');
      if (kind === 'quick') dueY++;
      else if (kind !== 'devoir') dueX++;
    });

    var dmDue = devoirs.filter(function (d) {
      if (!d || d.statut === 'archive' || d.statut === 'fait') return false;
      var lim = d.dateLimite || d.dateProchaineRevision;
      return lim && lim <= today;
    }).length;

    var orphans = 0;
    if (typeof window.countOrphans === 'function') {
      var oc = window.countOrphans();
      orphans = (oc.cours || 0) + (oc.anki || 0);
    }

    return {
      docs: cours.length,
      fiches: cours.filter(function (c) { return c.type === 'FICHE'; }).length,
      qrTodo: qrTodo,
      dueX: dueX,
      dueY: dueY,
      dmDue: dmDue,
      orphans: orphans,
      today: today
    };
  }

  function codeBoxesHtml() {
    return (
      '<div class="hlab-code" id="hlabCodeBoxes">' +
        '<input type="text" class="hlab-code-box code-box" maxlength="1" id="hlab_cb1" inputmode="text" autocomplete="off" aria-label="Lettre 1">' +
        '<input type="text" class="hlab-code-box code-box" maxlength="1" id="hlab_cb2" inputmode="text" autocomplete="off" aria-label="Lettre 2">' +
        '<span class="hlab-code-dash">-</span>' +
        '<input type="text" class="hlab-code-box code-box" maxlength="1" id="hlab_cb3" inputmode="numeric" autocomplete="off" aria-label="Chiffre 1">' +
        '<input type="text" class="hlab-code-box code-box" maxlength="1" id="hlab_cb4" inputmode="numeric" autocomplete="off" aria-label="Chiffre 2">' +
        '<input type="text" class="hlab-code-box code-box" maxlength="1" id="hlab_cb5" inputmode="numeric" autocomplete="off" aria-label="Chiffre 3">' +
      '</div>'
    );
  }

  function brandBlock(name, sub) {
    return (
      '<div class="hlab-brand-block">' +
        '<div class="hlab-brand">Mes Cours <span class="hlab-edition">PC*</span></div>' +
        '<p class="hlab-greet">' +
          (name ? 'Bonjour, <b>' + esc(name) + '</b>' : 'Bonjour') +
          (sub ? ' <span class="hlab-dot">·</span> ' + esc(sub) : '') +
        '</p>' +
      '</div>'
    );
  }

  function mockCode(s, name) {
    return (
      '<div class="hlab-stage hlab-stage-code">' +
        '<div class="hlab-stage-bg" aria-hidden="true"></div>' +
        '<div class="hlab-stage-inner">' +
          brandBlock(name, dateLabel()) +
          '<h3 class="hlab-hero-title">Ouvrir un document</h3>' +
          '<p class="hlab-hero-sub">Tape le code barre du polycopié — comme sur l’Accueil.</p>' +
          codeBoxesHtml() +
          '<div class="hlab-cta-row">' +
            '<button type="button" class="bp hlab-cta-main" id="hlabBtnOpen">Ouvrir</button>' +
            '<button type="button" class="bs" id="hlabBtnCam">' + icon('camera', 16) + ' Scanner</button>' +
          '</div>' +
          '<div class="hlab-rail">' +
            '<button type="button" class="hlab-rail-btn" data-go="ankiV2">' +
              icon('dna', 16) + '<span>Synchrotron</span>' +
              (s.dueX + s.dueY ? '<em>' + (s.dueX + s.dueY) + '</em>' : '') +
            '</button>' +
            '<button type="button" class="hlab-rail-btn" data-go="cours">' +
              icon('clipboard-list', 16) + '<span>Base Doc</span>' +
            '</button>' +
            '<button type="button" class="hlab-rail-btn" id="hlabBtnKholle">' +
              icon('dice-5', 16) + '<span>Khôlle</span>' +
            '</button>' +
          '</div>' +
          (s.qrTodo
            ? '<p class="hlab-foot-note">' + icon('qr-code', 14) + ' ' + s.qrTodo + ' QR à initialiser</p>'
            : '<p class="hlab-foot-note hlab-ok">' + icon('sparkles', 14) + ' Tous les QR sont à jour</p>') +
        '</div>' +
      '</div>'
    );
  }

  function mockPortes(s, name) {
    var due = s.dueX + s.dueY;
    return (
      '<div class="hlab-stage hlab-stage-portes">' +
        '<div class="hlab-stage-bg" aria-hidden="true"></div>' +
        '<div class="hlab-stage-orb hlab-orb-a" aria-hidden="true"></div>' +
        '<div class="hlab-stage-orb hlab-orb-b" aria-hidden="true"></div>' +
        '<div class="hlab-stage-inner hlab-stage-inner-portes">' +
          '<header class="hlab-portes-head">' +
            '<div class="hlab-brand hlab-brand-xl">Mes Cours <span class="hlab-edition">PC*</span></div>' +
            '<p class="hlab-greet hlab-greet-lg">' +
              (name ? 'Bonjour, <b>' + esc(name) + '</b>' : 'Bonjour') +
              ' <span class="hlab-dot">·</span> ' + esc(dateLabel()) +
            '</p>' +
            '<p class="hlab-portes-tagline">Choisis ta porte — docs, révision, ou flash rapide.</p>' +
          '</header>' +
          '<div class="hlab-portals" role="navigation" aria-label="Accès principaux">' +
            '<button type="button" class="hlab-portal hlab-portal-doc" data-go="cours" style="--i:0">' +
              '<span class="hlab-portal-num" aria-hidden="true">01</span>' +
              '<span class="hlab-portal-ico">' + icon('clipboard-list', 32) + '</span>' +
              '<strong class="hlab-portal-title">Base Doc</strong>' +
              '<span class="hlab-portal-metric">' + s.docs + ' document' + (s.docs !== 1 ? 's' : '') + '</span>' +
              '<span class="hlab-portal-hint">' +
                (s.fiches ? s.fiches + ' fiches' : 'Cours, TD, DS') +
                (s.orphans ? ' · ' + s.orphans + ' à ranger' : '') +
              '</span>' +
              '<span class="hlab-portal-cta">Entrer ' + icon('arrow-right', 14) + '</span>' +
            '</button>' +
            '<button type="button" class="hlab-portal hlab-portal-sync" data-go="ankiV2" style="--i:1">' +
              '<span class="hlab-portal-num" aria-hidden="true">02</span>' +
              '<span class="hlab-portal-ico">' + icon('dna', 32) + '</span>' +
              '<strong class="hlab-portal-title">Synchrotron</strong>' +
              '<span class="hlab-portal-metric">' + due + ' due' + (due !== 1 ? 's' : '') + ' aujourd’hui</span>' +
              '<span class="hlab-portal-hint">' + s.dueX + ' X- · ' + s.dueY + ' Y-' +
                (s.dmDue ? ' · ' + s.dmDue + ' DM' : '') + '</span>' +
              '<span class="hlab-portal-cta">Réviser ' + icon('arrow-right', 14) + '</span>' +
            '</button>' +
            '<button type="button" class="hlab-portal hlab-portal-rapide" data-go="flashcards" style="--i:2">' +
              '<span class="hlab-portal-num" aria-hidden="true">03</span>' +
              '<span class="hlab-portal-ico">' + icon('zap', 32) + '</span>' +
              '<strong class="hlab-portal-title">Rapide</strong>' +
              '<span class="hlab-portal-metric">' + s.dueY + ' Y- due' + (s.dueY !== 1 ? 's' : '') + '</span>' +
              '<span class="hlab-portal-hint">Vocab, formules — session courte</span>' +
              '<span class="hlab-portal-cta">Lancer ' + icon('arrow-right', 14) + '</span>' +
            '</button>' +
          '</div>' +
          '<div class="hlab-portes-dock">' +
            '<div class="hlab-dock-label">' +
              '<span class="hlab-slim-lbl">Code document</span>' +
              '<span class="hlab-dock-sub">XX-XXX · scanner ou taper</span>' +
            '</div>' +
            codeBoxesHtml() +
            '<div class="hlab-dock-actions">' +
              '<button type="button" class="bp" id="hlabBtnOpen">Ouvrir</button>' +
              '<button type="button" class="bs" id="hlabBtnCam">' + icon('camera', 14) + ' Scan</button>' +
              '<button type="button" class="bs" id="hlabBtnKholle">' + icon('dice-5', 14) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function mockJour(s, name) {
    var rows = [];
    if (s.dmDue) rows.push({ tone: 'red', label: 'Devoirs', detail: s.dmDue + ' à traiter', go: 'agenda', ico: 'clipboard-list' });
    if (s.dueX || s.dueY) {
      rows.push({
        tone: 'acc', label: 'Révisions', detail: s.dueX + ' X- · ' + s.dueY + ' Y-', go: 'ankiV2', ico: 'dna'
      });
    }
    if (s.qrTodo) rows.push({ tone: 'gold', label: 'QR', detail: s.qrTodo + ' à imprimer ou scanner', go: 'print', ico: 'qr-code' });
    if (s.orphans) rows.push({ tone: 'gold', label: 'À ranger', detail: s.orphans + ' élément' + (s.orphans !== 1 ? 's' : ''), go: 'orphelins', ico: 'inbox' });
    if (!rows.length) {
      rows.push({ tone: 'ok', label: 'Rien d’urgent', detail: 'Ouvre un doc ou lance une session libre', go: 'cours', ico: 'sparkles' });
    }
    var list = rows.map(function (r) {
      return (
        '<button type="button" class="hlab-day-row hlab-tone-' + r.tone + '" data-go="' + r.go + '">' +
          '<span class="hlab-day-ico">' + icon(r.ico, 18) + '</span>' +
          '<span class="hlab-day-txt">' +
            '<span class="hlab-day-lab">' + esc(r.label) + '</span>' +
            '<span class="hlab-day-det">' + esc(r.detail) + '</span>' +
          '</span>' +
          '<span class="hlab-day-go">' + icon('arrow-right', 16) + '</span>' +
        '</button>'
      );
    }).join('');

    return (
      '<div class="hlab-stage hlab-stage-jour">' +
        '<div class="hlab-stage-bg" aria-hidden="true"></div>' +
        '<div class="hlab-stage-inner hlab-stage-inner-wide">' +
          brandBlock(name, dateLabel()) +
          '<h3 class="hlab-hero-title">Aujourd’hui</h3>' +
          '<div class="hlab-day-list">' + list + '</div>' +
          '<div class="hlab-slim-bar" style="margin-top:22px;">' +
            '<span class="hlab-slim-lbl">Code</span>' +
            codeBoxesHtml() +
            '<button type="button" class="bp" id="hlabBtnOpen">Go</button>' +
            '<button type="button" class="bs" id="hlabBtnKholle">' + icon('dice-5', 14) + ' Khôlle</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function mockSync(s, name) {
    var due = s.dueX + s.dueY;
    return (
      '<div class="hlab-stage hlab-stage-sync">' +
        '<div class="hlab-stage-bg" aria-hidden="true"></div>' +
        '<div class="hlab-stage-inner">' +
          brandBlock(name, 'Révision') +
          '<div class="hlab-sync-hero">' +
            '<div class="hlab-sync-count">' + due + '</div>' +
            '<div class="hlab-sync-meta">' +
              '<strong>Cartes dues</strong>' +
              '<span>' + s.dueX + ' principales · ' + s.dueY + ' rapides' +
                (s.dmDue ? ' · ' + s.dmDue + ' DM' : '') + '</span>' +
            '</div>' +
            '<button type="button" class="bp hlab-sync-go" data-go="ankiV2">' +
              icon('play', 16) + ' Lancer Synchrotron</button>' +
          '</div>' +
          '<div class="hlab-slim-bar">' +
            '<span class="hlab-slim-lbl">Doc</span>' +
            codeBoxesHtml() +
            '<button type="button" class="bp" id="hlabBtnOpen">Ouvrir</button>' +
            '<button type="button" class="bs" data-go="cours">Base Doc</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderStage(id, s, name) {
    if (id === 'portes') return mockPortes(s, name);
    if (id === 'jour') return mockJour(s, name);
    if (id === 'sync') return mockSync(s, name);
    return mockCode(s, name);
  }

  function checkLabCode(force) {
    var code = [1, 2, 3, 4, 5].map(function (i) {
      var el = document.getElementById('hlab_cb' + i);
      return el ? el.value : '';
    }).join('');
    if (code.length === 5) {
      var full = code.substring(0, 2) + '-' + code.substring(2);
      if (typeof window.doLocate === 'function') window.doLocate(full);
      [1, 2, 3, 4, 5].forEach(function (i) {
        var el = document.getElementById('hlab_cb' + i);
        if (el) el.value = '';
      });
    } else if (force && typeof window.sysAlert === 'function') {
      window.sysAlert('Remplis les 5 cases pour chercher un code.', 'Code incomplet');
    }
  }

  function setupLabCodeBoxes() {
    var boxes = [1, 2, 3, 4, 5].map(function (i) {
      return document.getElementById('hlab_cb' + i);
    });
    boxes.forEach(function (box, i) {
      if (!box || box.dataset.hlabBound === '1') return;
      box.dataset.hlabBound = '1';
      box.addEventListener('input', function () {
        box.value = box.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (box.value && i < 4 && boxes[i + 1]) boxes[i + 1].focus();
        checkLabCode(false);
      });
      box.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !box.value && i > 0 && boxes[i - 1]) boxes[i - 1].focus();
        if (e.key === 'Enter') checkLabCode(true);
      });
      box.addEventListener('paste', function (e) {
        e.preventDefault();
        var pasted = ((e.clipboardData || window.clipboardData).getData('text') || '')
          .toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 5);
        for (var j = 0; j < pasted.length; j++) {
          if (boxes[j]) boxes[j].value = pasted[j];
        }
        if (pasted.length && pasted.length < 5 && boxes[pasted.length]) boxes[pasted.length].focus();
        checkLabCode(false);
      });
    });
  }

  function bind(root) {
    root.querySelectorAll('[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _view = btn.getAttribute('data-view');
        try { localStorage.setItem('homeLabView', _view); } catch (e) { /* ignore */ }
        window.renderHomeLab();
      });
    });
    var prefer = root.querySelector('[data-prefer]');
    if (prefer) {
      prefer.addEventListener('click', function () {
        _pick = _view;
        try { localStorage.setItem('homeLabPick', _pick); } catch (e) { /* ignore */ }
        window.renderHomeLab();
      });
    }
    root.querySelectorAll('[data-go]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var go = btn.getAttribute('data-go');
        if (go && typeof window.switchTab === 'function') window.switchTab(go);
      });
    });
    var open = root.querySelector('#hlabBtnOpen');
    if (open) open.addEventListener('click', function () { checkLabCode(true); });
    var cam = root.querySelector('#hlabBtnCam');
    if (cam) {
      cam.addEventListener('click', function () {
        if (typeof window.startScanner === 'function') window.startScanner();
        else if (typeof window.switchTab === 'function') window.switchTab('test');
      });
    }
    var kh = root.querySelector('#hlabBtnKholle');
    if (kh) {
      kh.addEventListener('click', function () {
        if (typeof window.drawKholle === 'function') window.drawKholle();
      });
    }
    setupLabCodeBoxes();
  }

  window.renderHomeLab = function () {
    var pane = document.getElementById('paneHomeLab');
    if (!pane) return;
    var s = stats();
    var name = userName();
    var idea = IDEAS.find(function (i) { return i.id === _view; }) || IDEAS[0];
    var isPicked = _pick === idea.id;

    var switcher = IDEAS.map(function (i) {
      return (
        '<button type="button" class="hlab-sw' + (_view === i.id ? ' is-on' : '') + '" data-view="' + i.id + '">' +
          '<strong>' + esc(i.title) + '</strong>' +
          '<span>' + esc(i.pitch) + '</span>' +
        '</button>'
      );
    }).join('');

    pane.innerHTML =
      '<div class="hlab-shell">' +
        '<div class="hlab-toolbar">' +
          '<div class="hlab-toolbar-left">' +
            '<span class="hlab-lab-tag">' + icon('layout-list', 14) + ' Labo</span>' +
            '<div class="hlab-switcher" role="tablist">' + switcher + '</div>' +
          '</div>' +
          '<button type="button" class="bp hlab-prefer' + (isPicked ? ' is-picked' : '') + '" data-prefer="1">' +
            (isPicked ? icon('check', 14) + ' Préférence' : 'Je préfère celle-ci') +
          '</button>' +
        '</div>' +
        '<div class="hlab-canvas">' + renderStage(idea.id, s, name) + '</div>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(pane);
    bind(pane);
  };
})();
