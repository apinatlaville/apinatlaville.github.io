/**
 * home-lab.js — Labo Accueil : maquette « Trois portes » (test Système)
 * Base Doc · Synchrotron · Rapide + stats / XP / dock code.
 */
(function () {
  'use strict';

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
    var reservoir = 0;
    exos.forEach(function (c) {
      if (!c) return;
      if (c.statut === 'reservoir') { reservoir++; return; }
      if (c.statut !== 'actif') return;
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

    var xp = null;
    try {
      if (window.XpLab && typeof window.XpLab.compute === 'function') {
        var snap = window.XpLab.compute();
        xp = {
          level: snap.prog.level,
          title: snap.prog.title.title,
          pct: snap.prog.pct,
          into: snap.prog.into,
          need: snap.prog.need,
          streak: snap.streak,
          todayXp: snap.todayXp,
          totalXp: snap.totalXp
        };
      }
    } catch (eXp) { /* ignore */ }

    return {
      docs: cours.length,
      fiches: cours.filter(function (c) { return c.type === 'FICHE'; }).length,
      qrTodo: qrTodo,
      dueX: dueX,
      dueY: dueY,
      dmDue: dmDue,
      orphans: orphans,
      reservoir: reservoir,
      today: today,
      xp: xp
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

  function fmt(n) {
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  }

  function statsStrip(s) {
    var due = s.dueX + s.dueY;
    var chips = [
      { ico: 'clipboard-list', n: s.docs, l: 'docs', go: 'cours' },
      { ico: 'dna', n: due, l: 'dues', go: 'ankiV2', hot: due > 0 },
      { ico: 'zap', n: s.dueY, l: 'Y-', go: 'flashcards' },
      { ico: 'qr-code', n: s.qrTodo, l: 'QR', go: 'print', hot: s.qrTodo > 0 }
    ];
    if (s.xp) {
      chips.unshift({
        ico: 'flame',
        n: 'Niv.' + s.xp.level,
        l: s.xp.pct + '%',
        go: 'xpLab',
        xp: true
      });
    }
    return (
      '<div class="hlab-stats" role="group" aria-label="Aperçu rapide">' +
        chips.map(function (c) {
          return (
            '<button type="button" class="hlab-stat' +
              (c.hot ? ' is-hot' : '') + (c.xp ? ' is-xp' : '') +
              '" data-go="' + c.go + '">' +
              '<span class="hlab-stat-ico">' + icon(c.ico, 14) + '</span>' +
              '<span class="hlab-stat-n">' + esc(String(c.n)) + '</span>' +
              '<span class="hlab-stat-l">' + esc(c.l) + '</span>' +
            '</button>'
          );
        }).join('') +
        (s.xp
          ? '<div class="hlab-stat-xpbar" title="' + esc(s.xp.title) + ' · ' +
              fmt(s.xp.into) + '/' + fmt(s.xp.need) + ' XP">' +
              '<div class="hlab-stat-xpfill" style="width:' + s.xp.pct + '%"></div>' +
            '</div>'
          : '') +
      '</div>'
    );
  }

  function portalBadge(text, tone) {
    if (!text) return '';
    return '<span class="hlab-portal-badge hlab-badge-' + (tone || 'acc') + '">' + esc(text) + '</span>';
  }

  function mockPortes(s, name) {
    var due = s.dueX + s.dueY;
    var syncTone = due > 8 ? 'red' : (due > 0 ? 'grn' : 'mut');
    var syncBadge = due > 0 ? due + ' dues' : 'À jour';
    var docBadge = s.orphans ? s.orphans + ' à ranger' : (s.qrTodo ? s.qrTodo + ' QR' : null);
    var rapideBadge = s.dueY > 0 ? s.dueY + ' Y-' : null;

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
              (s.xp && s.xp.streak
                ? ' <span class="hlab-dot">·</span> ' + icon('flame', 14) + ' ' + s.xp.streak + ' j'
                : '') +
            '</p>' +
            '<p class="hlab-portes-tagline">Trois portes — docs, révision espacée, ou flash rapide.</p>' +
            statsStrip(s) +
          '</header>' +
          '<div class="hlab-portals" role="navigation" aria-label="Accès principaux">' +
            '<button type="button" class="hlab-portal hlab-portal-doc" data-go="cours" style="--i:0">' +
              portalBadge(docBadge, s.orphans ? 'gold' : 'acc') +
              '<span class="hlab-portal-num" aria-hidden="true">01</span>' +
              '<span class="hlab-portal-ico">' + icon('clipboard-list', 32) + '</span>' +
              '<strong class="hlab-portal-title">Base Doc</strong>' +
              '<span class="hlab-portal-metric">' + s.docs + ' document' + (s.docs !== 1 ? 's' : '') + '</span>' +
              '<span class="hlab-portal-hint">' +
                (s.fiches ? s.fiches + ' fiches · ' : '') +
                'Cours, TD, DS' +
                (s.qrTodo ? ' · ' + s.qrTodo + ' QR à traiter' : '') +
              '</span>' +
              '<span class="hlab-portal-cta">Entrer ' + icon('arrow-right', 14) + '</span>' +
            '</button>' +
            '<button type="button" class="hlab-portal hlab-portal-sync" data-go="ankiV2" style="--i:1">' +
              portalBadge(syncBadge, syncTone) +
              '<span class="hlab-portal-num" aria-hidden="true">02</span>' +
              '<span class="hlab-portal-ico">' + icon('dna', 32) + '</span>' +
              '<strong class="hlab-portal-title">Synchrotron</strong>' +
              '<span class="hlab-portal-metric">' + due + ' due' + (due !== 1 ? 's' : '') + ' aujourd’hui</span>' +
              '<span class="hlab-portal-hint">' + s.dueX + ' X- · ' + s.dueY + ' Y-' +
                (s.dmDue ? ' · ' + s.dmDue + ' DM' : '') +
                (s.reservoir ? ' · ' + s.reservoir + ' en réservoir' : '') +
              '</span>' +
              '<span class="hlab-portal-cta">' + (due ? 'Réviser' : 'Ouvrir') + ' ' + icon('arrow-right', 14) + '</span>' +
            '</button>' +
            '<button type="button" class="hlab-portal hlab-portal-rapide" data-go="flashcards" style="--i:2">' +
              portalBadge(rapideBadge, 'gold') +
              '<span class="hlab-portal-num" aria-hidden="true">03</span>' +
              '<span class="hlab-portal-ico">' + icon('zap', 32) + '</span>' +
              '<strong class="hlab-portal-title">Rapide</strong>' +
              '<span class="hlab-portal-metric">' +
                (s.dueY ? s.dueY + ' Y- due' + (s.dueY !== 1 ? 's' : '') : 'Session libre') +
              '</span>' +
              '<span class="hlab-portal-hint">Vocab, formules — 5 à 15 min</span>' +
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
              '<button type="button" class="bs" id="hlabBtnKholle" title="Khôlle">' + icon('dice-5', 14) + '</button>' +
            '</div>' +
          '</div>' +
          (s.xp
            ? '<p class="hlab-xp-foot">' +
                icon('flame', 14) + ' <b>Niv. ' + s.xp.level + '</b> · ' + esc(s.xp.title) +
                ' · +' + fmt(s.xp.todayXp) + ' XP aujourd’hui' +
                ' <button type="button" class="hlab-link" data-go="xpLab">Voir progression</button>' +
              '</p>'
            : '') +
        '</div>' +
      '</div>'
    );
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

    pane.innerHTML =
      '<div class="hlab-shell">' +
        '<div class="hlab-toolbar hlab-toolbar-solo">' +
          '<div class="hlab-toolbar-left">' +
            '<span class="hlab-lab-tag">' + icon('layout-list', 14) + ' Labo Accueil · test</span>' +
            '<span class="hlab-lab-note">Maquette « Trois portes » — pas encore l’Accueil officiel</span>' +
          '</div>' +
          '<button type="button" class="bs" data-go="xpLab">' + icon('flame', 14) + ' Progression</button>' +
        '</div>' +
        '<div class="hlab-canvas">' + mockPortes(s, name) + '</div>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(pane);
    bind(pane);
  };
})();
