/**
 * home-lab.js — Labo Accueil : plusieurs compositions proposées (maquettes live)
 * N’altère pas paneHome tant qu’aucune idée n’est choisie pour prod.
 */
(function () {
  'use strict';

  var IDEAS = [
    {
      id: 'code',
      title: 'Code au centre',
      pitch: 'L’accueil = ouvrir un document. Le code XX-XXX est le héros ; le reste est secondaire.',
      best: 'Quand tu arrives souvent avec un polycopié / QR en main.'
    },
    {
      id: 'portes',
      title: 'Trois portes',
      pitch: 'Base Doc · Synchrotron · Rapide en trois grands accès. Le code passe en barre fine.',
      best: 'Quand tu choisis d’abord « où travailler », pas un code précis.'
    },
    {
      id: 'jour',
      title: 'Aujourd’hui',
      pitch: 'Une file du jour : QR à faire, devoirs, cartes dues — puis les outils.',
      best: 'Quand tu veux voir ce qui presse avant de naviguer.'
    },
    {
      id: 'sync',
      title: 'Révision d’abord',
      pitch: 'Le Synchrotron ouvre la page : cartes dues + lancer une session. Docs et code en bas.',
      best: 'Soirées révision PC* où la file Anki prime.'
    }
  ];

  var _pick = null;
  try {
    _pick = localStorage.getItem('homeLabPick') || null;
  } catch (e) { _pick = null; }

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

  function codeBoxesHtml(prefix) {
    var id = prefix || 'hlab';
    return (
      '<div class="hlab-code" aria-hidden="true">' +
        '<span class="hlab-code-box">A</span>' +
        '<span class="hlab-code-box">B</span>' +
        '<span class="hlab-code-dash">-</span>' +
        '<span class="hlab-code-box">1</span>' +
        '<span class="hlab-code-box">2</span>' +
        '<span class="hlab-code-box">3</span>' +
        '<span class="hlab-mut" style="margin-left:8px;font-size:11px;">maquette · ' + esc(id) + '</span>' +
      '</div>'
    );
  }

  function mockA(s, name) {
    return (
      '<div class="hlab-mock hlab-mock-code">' +
        '<div class="hlab-brand">Mes Cours <span class="hlab-edition">PC*</span></div>' +
        '<p class="hlab-greet">' + (name ? 'Bonjour, ' + esc(name) : 'Bonjour') + '</p>' +
        '<h3 class="hlab-hero-title">Ouvrir un document</h3>' +
        codeBoxesHtml('code') +
        '<div class="hlab-cta-row">' +
          '<button type="button" class="bp hlab-fake">Ouvrir</button>' +
          '<button type="button" class="bs hlab-fake">' + icon('camera', 14) + ' Scanner</button>' +
        '</div>' +
        '<div class="hlab-sec-row">' +
          '<button type="button" class="hlab-chip hlab-fake" data-go="ankiV2">' + icon('dna', 14) + ' Synchrotron' +
            (s.dueX ? ' · ' + s.dueX : '') + '</button>' +
          '<button type="button" class="hlab-chip hlab-fake" data-go="cours">' + icon('clipboard-list', 14) + ' Base Doc</button>' +
          '<button type="button" class="hlab-chip hlab-fake" data-go="kholle">' + icon('dice-5', 14) + ' Khôlle</button>' +
        '</div>' +
        (s.qrTodo
          ? '<p class="hlab-note">' + s.qrTodo + ' QR à initialiser</p>'
          : '<p class="hlab-note hlab-ok">Tous les QR sont à jour</p>') +
      '</div>'
    );
  }

  function mockB(s, name) {
    return (
      '<div class="hlab-mock hlab-mock-portes">' +
        '<div class="hlab-brand">Mes Cours <span class="hlab-edition">PC*</span></div>' +
        '<p class="hlab-greet">' + (name ? esc(name) + ' · bureau' : 'Ton bureau') + '</p>' +
        '<div class="hlab-doors">' +
          '<button type="button" class="hlab-door hlab-fake" data-go="cours">' +
            '<span class="hlab-door-ico">' + icon('clipboard-list', 22) + '</span>' +
            '<strong>Base Doc</strong>' +
            '<span>' + s.docs + ' document' + (s.docs !== 1 ? 's' : '') + '</span>' +
          '</button>' +
          '<button type="button" class="hlab-door hlab-door-acc hlab-fake" data-go="ankiV2">' +
            '<span class="hlab-door-ico">' + icon('dna', 22) + '</span>' +
            '<strong>Synchrotron</strong>' +
            '<span>' + (s.dueX + s.dueY) + ' due' + ((s.dueX + s.dueY) !== 1 ? 's' : '') + ' aujourd’hui</span>' +
          '</button>' +
          '<button type="button" class="hlab-door hlab-fake" data-go="flashcards">' +
            '<span class="hlab-door-ico">' + icon('zap', 22) + '</span>' +
            '<strong>Rapide</strong>' +
            '<span>Y- · ' + s.dueY + ' due' + (s.dueY !== 1 ? 's' : '') + '</span>' +
          '</button>' +
        '</div>' +
        '<div class="hlab-slim-code">' +
          '<span class="hlab-slim-lbl">Code</span>' +
          codeBoxesHtml('portes') +
          '<button type="button" class="bp hlab-fake hlab-slim-go">Ouvrir</button>' +
        '</div>' +
      '</div>'
    );
  }

  function mockC(s, name) {
    var rows = [];
    if (s.dmDue) {
      rows.push({ tone: 'red', label: 'Devoirs', detail: s.dmDue + ' à rendre / en cours', go: 'agenda' });
    }
    if (s.dueX || s.dueY) {
      rows.push({
        tone: 'acc',
        label: 'Révisions',
        detail: s.dueX + ' X- · ' + s.dueY + ' Y-',
        go: 'ankiV2'
      });
    }
    if (s.qrTodo) {
      rows.push({ tone: 'gold', label: 'QR', detail: s.qrTodo + ' à imprimer ou scanner', go: 'print' });
    }
    if (s.orphans) {
      rows.push({ tone: 'gold', label: 'À ranger', detail: s.orphans + ' élément' + (s.orphans !== 1 ? 's' : ''), go: 'orphelins' });
    }
    if (!rows.length) {
      rows.push({ tone: 'ok', label: 'Rien d’urgent', detail: 'Tu peux ouvrir un doc ou réviser librement', go: 'cours' });
    }
    var list = rows.map(function (r) {
      return (
        '<button type="button" class="hlab-day-row hlab-tone-' + r.tone + ' hlab-fake" data-go="' + r.go + '">' +
          '<span class="hlab-day-lab">' + esc(r.label) + '</span>' +
          '<span class="hlab-day-det">' + esc(r.detail) + '</span>' +
          '<span class="hlab-day-go">' + icon('arrow-right', 14) + '</span>' +
        '</button>'
      );
    }).join('');

    return (
      '<div class="hlab-mock hlab-mock-jour">' +
        '<div class="hlab-brand">Mes Cours <span class="hlab-edition">PC*</span></div>' +
        '<p class="hlab-greet">' + (name ? 'Salut ' + esc(name) : 'Salut') + ' · ' + esc(s.today) + '</p>' +
        '<h3 class="hlab-hero-title">Aujourd’hui</h3>' +
        '<div class="hlab-day-list">' + list + '</div>' +
        '<div class="hlab-sec-row" style="margin-top:14px;">' +
          '<button type="button" class="hlab-chip hlab-fake" data-go="cours">' + icon('search', 14) + ' Code / Base Doc</button>' +
          '<button type="button" class="hlab-chip hlab-fake" data-go="kholle">' + icon('dice-5', 14) + ' Khôlle</button>' +
        '</div>' +
      '</div>'
    );
  }

  function mockD(s, name) {
    var due = s.dueX + s.dueY;
    return (
      '<div class="hlab-mock hlab-mock-sync">' +
        '<div class="hlab-brand">Mes Cours <span class="hlab-edition">PC*</span></div>' +
        '<p class="hlab-greet">' + (name ? esc(name) : 'Session') + ' · révision</p>' +
        '<div class="hlab-sync-hero">' +
          '<div class="hlab-sync-count">' + due + '</div>' +
          '<div class="hlab-sync-meta">' +
            '<strong>Cartes dues</strong>' +
            '<span>' + s.dueX + ' principales · ' + s.dueY + ' rapides' +
              (s.dmDue ? ' · ' + s.dmDue + ' DM' : '') + '</span>' +
          '</div>' +
          '<button type="button" class="bp hlab-fake hlab-sync-go" data-go="ankiV2">' +
            icon('play', 14) + ' Ouvrir Synchrotron</button>' +
        '</div>' +
        '<div class="hlab-slim-code">' +
          '<span class="hlab-slim-lbl">Doc</span>' +
          codeBoxesHtml('sync') +
          '<button type="button" class="bs hlab-fake" data-go="cours">Base Doc</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderMock(id, s, name) {
    if (id === 'portes') return mockB(s, name);
    if (id === 'jour') return mockC(s, name);
    if (id === 'sync') return mockD(s, name);
    return mockA(s, name);
  }

  function ideaCard(idea, s, name) {
    var selected = _pick === idea.id;
    return (
      '<article class="hlab-idea' + (selected ? ' is-picked' : '') + '" data-idea="' + idea.id + '">' +
        '<header class="hlab-idea-head">' +
          '<div>' +
            '<h3>' + esc(idea.title) + '</h3>' +
            '<p class="hlab-pitch">' + esc(idea.pitch) + '</p>' +
            '<p class="hlab-best"><span class="hlab-best-lab">Idéal si</span> ' + esc(idea.best) + '</p>' +
          '</div>' +
          '<button type="button" class="bp hlab-pick-btn" data-pick="' + idea.id + '">' +
            (selected ? icon('check', 14) + ' Choisie' : 'Je préfère celle-ci') +
          '</button>' +
        '</header>' +
        '<div class="hlab-preview-frame">' +
          '<div class="hlab-preview-label">Aperçu (données live)</div>' +
          renderMock(idea.id, s, name) +
        '</div>' +
      '</article>'
    );
  }

  function bind(root) {
    root.querySelectorAll('[data-pick]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-pick');
        _pick = id;
        try { localStorage.setItem('homeLabPick', id); } catch (e) { /* ignore */ }
        window.renderHomeLab();
      });
    });
    root.querySelectorAll('.hlab-fake[data-go]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var go = btn.getAttribute('data-go');
        if (go === 'kholle') {
          if (typeof window.drawKholle === 'function') window.drawKholle();
          return;
        }
        if (typeof window.switchTab === 'function') window.switchTab(go);
      });
    });
  }

  window.renderHomeLab = function () {
    var pane = document.getElementById('paneHomeLab');
    if (!pane) return;
    var s = stats();
    var name = userName();
    var pickMeta = IDEAS.find(function (i) { return i.id === _pick; });

    pane.innerHTML =
      '<div class="hlab-page">' +
        '<header class="hlab-intro">' +
          '<h2>' + icon('layout-list', 20) + ' Labo Accueil</h2>' +
          '<p class="anki-mut">Quatre compositions pour remplacer la page Accueil actuelle. ' +
            'Choisis celle qui te parle — on l’appliquera ensuite sur l’onglet Accueil (sans toucher aux autres écrans).</p>' +
          (pickMeta
            ? '<p class="hlab-pick-banner">Préférence enregistrée : <b>' + esc(pickMeta.title) + '</b></p>'
            : '<p class="hlab-pick-banner hlab-pick-empty">Aucune préférence pour l’instant.</p>') +
        '</header>' +
        '<div class="hlab-ideas">' +
          IDEAS.map(function (idea) { return ideaCard(idea, s, name); }).join('') +
        '</div>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(pane);
    bind(pane);
  };
})();
