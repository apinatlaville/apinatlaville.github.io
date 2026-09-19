/**
 * xp-lab.js — Labo Progression : XP + niveaux exponentiels (cartes révisées)
 * Source : historique des cartes (X- / Y- / W-). Courbe : ~×1.5 par niveau.
 */
(function () {
  'use strict';

  var BASE_XP = 40;       // XP pour passer 1 → 2
  var GROWTH = 1.5;       // exponentiel
  var MAX_LEVEL = 60;

  var TITLES = [
    { min: 1, title: 'Apprenti', blurb: 'Premiers tours de manivelle' },
    { min: 3, title: 'Cadet', blurb: 'La file commence à tourner' },
    { min: 5, title: 'Élève PC*', blurb: 'Rythme de prépa' },
    { min: 8, title: 'Khôlleux', blurb: 'Tu tiens le colloscope' },
    { min: 12, title: 'Cubiste', blurb: 'Les paliers s’enchaînent' },
    { min: 16, title: 'Taupin', blurb: 'Régulier, presque mécanique' },
    { min: 22, title: 'Synchrotron', blurb: 'La machine tourne toute seule' },
    { min: 30, title: 'Maître PC*', blurb: 'Niveau légendaire' },
    { min: 40, title: 'Légende collée', blurb: 'Au-delà du concours' }
  ];

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

  /** XP requis pour passer de `level` à `level+1`. */
  function xpToAdvance(level) {
    var L = Math.max(1, Math.min(MAX_LEVEL, level | 0));
    return Math.round(BASE_XP * Math.pow(GROWTH, L - 1));
  }

  function titleFor(level) {
    var t = TITLES[0];
    for (var i = 0; i < TITLES.length; i++) {
      if (level >= TITLES[i].min) t = TITLES[i];
    }
    return t;
  }

  function cardKind(c) {
    if (window.AnkiAlgoV2 && window.AnkiAlgoV2.cardKind) return window.AnkiAlgoV2.cardKind(c);
    if (c && c.type === 'devoir') return 'devoir';
    if (c && String(c.id || '').charAt(0) === 'Y') return 'quick';
    if (c && String(c.id || '').charAt(0) === 'W') return 'devoir';
    return 'main';
  }

  /** XP gagné pour une entrée d’historique. */
  function xpForEntry(card, h) {
    var kind = cardKind(card);
    var base = kind === 'quick' ? 6 : (kind === 'devoir' ? 8 : 12);
    var q = (h && typeof h.qScore === 'number') ? h.qScore : 5;
    q = Math.max(0, Math.min(10, q));
    // 0 → ×0.4 · 5 → ×0.9 · 10 → ×1.4
    var mult = 0.4 + 0.1 * q;
    return Math.max(1, Math.round(base * mult));
  }

  function dayKey(iso) {
    if (!iso) return '';
    return String(iso).slice(0, 10);
  }

  function todayISO() {
    if (window.AnkiAlgoV2 && window.AnkiAlgoV2.todayISO) return window.AnkiAlgoV2.todayISO();
    return new Date().toISOString().slice(0, 10);
  }

  function collectReviews() {
    var list = [];
    var pools = [];
    if (window.D) {
      pools = pools.concat(window.D.exercices || []).concat(window.D.devoirs || []);
    }
    pools.forEach(function (c) {
      if (!c || !Array.isArray(c.historique)) return;
      c.historique.forEach(function (h) {
        if (!h) return;
        list.push({
          card: c,
          h: h,
          day: dayKey(h.date),
          xp: xpForEntry(c, h),
          kind: cardKind(c),
          q: typeof h.qScore === 'number' ? h.qScore : null
        });
      });
    });
    list.sort(function (a, b) {
      return String(a.h.date || '').localeCompare(String(b.h.date || ''));
    });
    return list;
  }

  function progressFromXp(totalXp) {
    var remaining = Math.max(0, totalXp | 0);
    var level = 1;
    var into = 0;
    var need = xpToAdvance(1);
    while (level < MAX_LEVEL) {
      need = xpToAdvance(level);
      if (remaining < need) {
        into = remaining;
        break;
      }
      remaining -= need;
      level++;
      into = remaining;
      need = xpToAdvance(level);
    }
    if (level >= MAX_LEVEL) {
      level = MAX_LEVEL;
      into = need;
    }
    var pct = need ? Math.min(100, Math.round((into / need) * 100)) : 100;
    return {
      totalXp: totalXp,
      level: level,
      into: into,
      need: need,
      pct: pct,
      title: titleFor(level)
    };
  }

  function compute() {
    var reviews = collectReviews();
    var totalXp = 0;
    var byKind = { main: 0, quick: 0, devoir: 0 };
    var byDay = {};
    var today = todayISO();
    var todayXp = 0;
    var todayCount = 0;

    reviews.forEach(function (r) {
      totalXp += r.xp;
      byKind[r.kind] = (byKind[r.kind] || 0) + 1;
      if (r.day) byDay[r.day] = (byDay[r.day] || 0) + 1;
      if (r.day === today) {
        todayXp += r.xp;
        todayCount++;
      }
    });

    // Streak : jours consécutifs jusqu’à aujourd’hui (ou hier si pas encore révisé)
    var streak = 0;
    var cursor = new Date(today + 'T12:00:00');
    if (!byDay[today]) {
      cursor.setDate(cursor.getDate() - 1);
    }
    for (var i = 0; i < 400; i++) {
      var key = cursor.toISOString().slice(0, 10);
      if (!byDay[key]) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    var prog = progressFromXp(totalXp);
    var ladder = [];
    for (var L = Math.max(1, prog.level); L <= Math.min(MAX_LEVEL, prog.level + 5); L++) {
      ladder.push({ level: L, xp: xpToAdvance(L), current: L === prog.level });
    }

    return {
      reviews: reviews.length,
      totalXp: totalXp,
      byKind: byKind,
      todayXp: todayXp,
      todayCount: todayCount,
      streak: streak,
      prog: prog,
      ladder: ladder,
      daysActive: Object.keys(byDay).length
    };
  }

  function fmt(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  }

  window.XpLab = {
    xpToAdvance: xpToAdvance,
    progressFromXp: progressFromXp,
    compute: compute,
    /** Appelé après une révision (Synchrotron) — toast si level-up. */
    onReview: function (card, qScore) {
      var before = null;
      try {
        before = window._xpLabLastLevel;
      } catch (e) { before = null; }
      var snap = compute();
      window._xpLabLastLevel = snap.prog.level;
      var gained = xpForEntry(card, { qScore: qScore });
      if (before != null && snap.prog.level > before) {
        if (typeof window.showToast === 'function') {
          window.showToast(
            'Niveau ' + snap.prog.level + ' — ' + snap.prog.title.title + ' (+' + gained + ' XP)',
            { type: 'success' }
          );
        }
      } else if (typeof window.showToast === 'function' && gained >= 10) {
        // discret : seulement si gros gain (bonne X-)
        /* no spam */
      }
      var pane = document.getElementById('paneXpLab');
      if (pane && pane.classList.contains('on') && typeof window.renderXpLab === 'function') {
        window.renderXpLab();
      }
    }
  };

  window.renderXpLab = function () {
    var pane = document.getElementById('paneXpLab');
    if (!pane) return;
    var d = compute();
    var p = d.prog;
    window._xpLabLastLevel = p.level;

    var ladderHtml = d.ladder.map(function (row) {
      return (
        '<div class="xplab-ladder-row' + (row.current ? ' is-cur' : '') + '">' +
          '<span class="xplab-ladder-lv">Niv. ' + row.level + ' → ' + (row.level + 1) + '</span>' +
          '<span class="xplab-ladder-bar"><i style="width:' +
            (row.current ? p.pct : (row.level < p.level ? 100 : 0)) + '%"></i></span>' +
          '<span class="xplab-ladder-xp">' + fmt(row.xp) + ' XP</span>' +
        '</div>'
      );
    }).join('');

    var titlesHtml = TITLES.map(function (t) {
      var unlocked = p.level >= t.min;
      return (
        '<div class="xplab-title-chip' + (unlocked ? ' is-on' : '') + '">' +
          '<strong>' + esc(t.title) + '</strong>' +
          '<span>dès niv. ' + t.min + '</span>' +
        '</div>'
      );
    }).join('');

    pane.innerHTML =
      '<div class="xplab-page">' +
        '<header class="xplab-hero">' +
          '<div class="xplab-hero-bg" aria-hidden="true"></div>' +
          '<div class="xplab-hero-inner">' +
            '<p class="xplab-lab-tag">' + icon('flame', 14) + ' Labo Progression</p>' +
            '<div class="xplab-level-row">' +
              '<div class="xplab-level-badge">' +
                '<span class="xplab-level-n">' + p.level + '</span>' +
                '<span class="xplab-level-lbl">Niveau</span>' +
              '</div>' +
              '<div class="xplab-level-meta">' +
                '<h2>' + esc(p.title.title) + '</h2>' +
                '<p>' + esc(p.title.blurb) + '</p>' +
                '<div class="xplab-bar" role="progressbar" aria-valuenow="' + p.pct + '" aria-valuemin="0" aria-valuemax="100">' +
                  '<div class="xplab-bar-fill" style="width:' + p.pct + '%"></div>' +
                '</div>' +
                '<p class="xplab-bar-lbl">' + fmt(p.into) + ' / ' + fmt(p.need) + ' XP vers le niveau ' + (p.level + 1) +
                  ' <span class="xplab-mut">(' + p.pct + '%)</span></p>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</header>' +

        '<section class="xplab-kpis">' +
          '<div class="xplab-kpi"><div class="xplab-kpi-n">' + fmt(d.totalXp) + '</div><div class="xplab-kpi-l">XP total</div></div>' +
          '<div class="xplab-kpi"><div class="xplab-kpi-n">' + fmt(d.reviews) + '</div><div class="xplab-kpi-l">Révisions</div></div>' +
          '<div class="xplab-kpi"><div class="xplab-kpi-n">' + d.streak + '</div><div class="xplab-kpi-l">Jours d’affilée</div></div>' +
          '<div class="xplab-kpi xplab-kpi-acc"><div class="xplab-kpi-n">+' + fmt(d.todayXp) + '</div><div class="xplab-kpi-l">XP aujourd’hui · ' + d.todayCount + ' carte' + (d.todayCount !== 1 ? 's' : '') + '</div></div>' +
        '</section>' +

        '<div class="xplab-grid">' +
          '<section class="xplab-card">' +
            '<h3>Courbe exponentielle</h3>' +
            '<p class="xplab-mut">Chaque niveau coûte ×' + GROWTH + ' plus d’XP que le précédent (base ' + BASE_XP + ' XP). ' +
              'Passer 1→2 est facile ; 10→11 demande déjà ' + fmt(xpToAdvance(10)) + ' XP.</p>' +
            '<div class="xplab-ladder">' + ladderHtml + '</div>' +
          '</section>' +
          '<section class="xplab-card">' +
            '<h3>D’où vient l’XP ?</h3>' +
            '<ul class="xplab-rules">' +
              '<li><b>X-</b> (principale) : ~12 XP × qualité (qScore)</li>' +
              '<li><b>Y-</b> (rapide) : ~6 XP × qualité</li>' +
              '<li><b>W-</b> (devoir) : ~8 XP × qualité</li>' +
              '<li>qScore 10 ≈ ×1,4 · qScore 0 ≈ ×0,4</li>' +
            '</ul>' +
            '<div class="xplab-split">' +
              '<div><span class="xplab-split-n">' + (d.byKind.main || 0) + '</span> X-</div>' +
              '<div><span class="xplab-split-n">' + (d.byKind.quick || 0) + '</span> Y-</div>' +
              '<div><span class="xplab-split-n">' + (d.byKind.devoir || 0) + '</span> W-</div>' +
            '</div>' +
            '<p class="xplab-mut" style="margin-top:12px;">Calculé sur l’historique réel de tes cartes — pas de compteur fictif.</p>' +
          '</section>' +
        '</div>' +

        '<section class="xplab-card" style="margin-top:14px;">' +
          '<h3>Titres</h3>' +
          '<div class="xplab-titles">' + titlesHtml + '</div>' +
        '</section>' +

        '<p class="xplab-foot">Labo — on pourra coller un bandeau XP sur l’Accueil / Synchrotron quand tu valideras le système.</p>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(pane);
  };
})();
