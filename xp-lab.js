/**
 * xp-lab.js — Labo Progression : XP + niveaux exponentiels (cartes révisées)
 * Courbe ×1.5 · titres type classement prépa · bonus streak sur l’XP.
 */
(function () {
  'use strict';

  var BASE_XP = 40;
  var GROWTH = 1.5;
  var MAX_LEVEL = 60;
  /** +4 % d’XP par jour de streak après J1, plafond ×1,60 */
  var STREAK_STEP = 0.04;
  var STREAK_CAP = 1.6;

  /** Paliers façon classement écoles (humour prépa) — du filet de sécu au graal */
  var TITLES = [
    { min: 1,  title: 'Polytech',              blurb: 'Le filet de sécu — tu es sur le tableau' },
    { min: 3,  title: 'Textile Roubaix',       blurb: 'ENSAIT vibes — original, mais on vise plus haut' },
    { min: 6,  title: 'CCP Bourgogne',         blurb: 'Concours commun — tu tiens le rythme' },
    { min: 10, title: 'Mines Alès',            blurb: 'Groupe Mines — ça commence à sentir bon' },
    { min: 14, title: 'Phelma',                blurb: 'Grenoble INP — physique & électro, sérieux' },
    { min: 19, title: 'Ensimag',               blurb: 'Info Grenoble — tu sors du lot' },
    { min: 25, title: 'Centrale Méditerranée', blurb: 'Ex-Centrale Marseille — très bon tableau' },
    { min: 32, title: 'Centrale Lyon',         blurb: 'Top Centrale — presque le sommet' },
    { min: 38, title: 'Mines Paris',           blurb: 'ParisTech — le dream board' },
    { min: 45, title: 'Polytechnique',         blurb: 'X — le graal. Casert et bicorne mental.' }
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

  function streakMultiplier(streakDays) {
    var d = Math.max(0, streakDays | 0);
    if (d <= 1) return 1;
    return Math.min(STREAK_CAP, 1 + (d - 1) * STREAK_STEP);
  }

  function cardKind(c) {
    if (window.AnkiAlgoV2 && window.AnkiAlgoV2.cardKind) return window.AnkiAlgoV2.cardKind(c);
    if (c && c.type === 'devoir') return 'devoir';
    if (c && String(c.id || '').charAt(0) === 'Y') return 'quick';
    if (c && String(c.id || '').charAt(0) === 'W') return 'devoir';
    return 'main';
  }

  /** XP de base (sans streak) pour une entrée d’historique. */
  function xpForEntry(card, h) {
    var kind = cardKind(card);
    var base = kind === 'quick' ? 6 : (kind === 'devoir' ? 8 : 12);
    var q = (h && typeof h.qScore === 'number') ? h.qScore : 5;
    q = Math.max(0, Math.min(10, q));
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

  function parseDay(d) {
    return new Date(d + 'T12:00:00');
  }

  function daysBetween(a, b) {
    return Math.round((parseDay(b) - parseDay(a)) / 86400000);
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
          baseXp: xpForEntry(c, h),
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
    var nextTitle = titleFor(Math.min(MAX_LEVEL, level + 1));
    return {
      totalXp: totalXp,
      level: level,
      into: into,
      need: need,
      pct: pct,
      title: titleFor(level),
      nextTitle: nextTitle
    };
  }

  function compute() {
    var reviews = collectReviews();
    var byKind = { main: 0, quick: 0, devoir: 0 };
    var byDay = {};
    var today = todayISO();

    reviews.forEach(function (r) {
      byKind[r.kind] = (byKind[r.kind] || 0) + 1;
      if (r.day) byDay[r.day] = (byDay[r.day] || 0) + 1;
    });

    var days = Object.keys(byDay).sort();
    var streakAtDay = {};
    var run = 0;
    var prev = null;
    days.forEach(function (d) {
      if (prev && daysBetween(prev, d) === 1) run += 1;
      else run = 1;
      streakAtDay[d] = run;
      prev = d;
    });

    var totalXp = 0;
    var streakBonusXp = 0;
    var todayXp = 0;
    var todayCount = 0;
    var todayMult = 1;

    reviews.forEach(function (r) {
      var st = r.day ? (streakAtDay[r.day] || 1) : 1;
      var mult = streakMultiplier(st);
      var xp = Math.max(1, Math.round(r.baseXp * mult));
      var bonus = xp - r.baseXp;
      totalXp += xp;
      streakBonusXp += Math.max(0, bonus);
      if (r.day === today) {
        todayXp += xp;
        todayCount++;
        todayMult = mult;
      }
    });

    // Streak actuel (jusqu’à aujourd’hui, ou hier si pas encore révisé)
    var streak = 0;
    var cursor = new Date(today + 'T12:00:00');
    if (!byDay[today]) cursor.setDate(cursor.getDate() - 1);
    for (var i = 0; i < 400; i++) {
      var key = cursor.toISOString().slice(0, 10);
      if (!byDay[key]) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    var liveMult = streakMultiplier(Math.max(streak, byDay[today] ? streak : 0));
    if (byDay[today]) liveMult = streakMultiplier(streak);
    else if (streak > 0) liveMult = streakMultiplier(streak); // hier encore actif : prochaines cartes = streak+1 si tu révises aujourd’hui
    var nextDayMult = streakMultiplier(byDay[today] ? streak : streak + 1);

    var prog = progressFromXp(totalXp);
    var ladder = [];
    for (var L = Math.max(1, prog.level); L <= Math.min(MAX_LEVEL, prog.level + 5); L++) {
      ladder.push({ level: L, xp: xpToAdvance(L), current: L === prog.level });
    }

    return {
      reviews: reviews.length,
      totalXp: totalXp,
      streakBonusXp: streakBonusXp,
      byKind: byKind,
      todayXp: todayXp,
      todayCount: todayCount,
      todayMult: todayMult,
      streak: streak,
      liveMult: liveMult,
      nextDayMult: nextDayMult,
      prog: prog,
      ladder: ladder,
      daysActive: days.length
    };
  }

  function fmt(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  }

  function fmtMult(m) {
    return '×' + (Math.round(m * 100) / 100).toFixed(2).replace(/\.?0+$/, '').replace(/\.$/, '');
  }

  window.XpLab = {
    xpToAdvance: xpToAdvance,
    progressFromXp: progressFromXp,
    streakMultiplier: streakMultiplier,
    compute: compute,
    TITLES: TITLES,
    onReview: function (card, qScore) {
      var before = window._xpLabLastLevel;
      var snap = compute();
      window._xpLabLastLevel = snap.prog.level;
      var base = xpForEntry(card, { qScore: qScore });
      var gained = Math.max(1, Math.round(base * (snap.todayMult || snap.liveMult || 1)));
      if (before != null && snap.prog.level > before) {
        if (typeof window.showToast === 'function') {
          window.showToast(
            'Niveau ' + snap.prog.level + ' — ' + snap.prog.title.title +
              ' (+' + gained + ' XP' + (snap.todayMult > 1 ? ', streak ' + fmtMult(snap.todayMult) : '') + ')',
            { type: 'success' }
          );
        }
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

    var titlesHtml = TITLES.map(function (t, idx) {
      var unlocked = p.level >= t.min;
      var current = unlocked && (idx === TITLES.length - 1 || p.level < TITLES[idx + 1].min);
      return (
        '<div class="xplab-title-chip' + (unlocked ? ' is-on' : '') + (current ? ' is-cur' : '') + '">' +
          '<strong>' + esc(t.title) + '</strong>' +
          '<span>dès niv. ' + t.min + '</span>' +
        '</div>'
      );
    }).join('');

    var streakPct = Math.round(((d.liveMult - 1) / (STREAK_CAP - 1)) * 100);

    pane.innerHTML =
      '<div class="xplab-page">' +
        '<header class="xplab-hero">' +
          '<div class="xplab-hero-bg" aria-hidden="true"></div>' +
          '<div class="xplab-hero-inner">' +
            '<p class="xplab-lab-tag">' + icon('flame', 14) + ' Labo Progression · échelle écoles</p>' +
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
                '<p class="xplab-bar-lbl">' + fmt(p.into) + ' / ' + fmt(p.need) + ' XP → niv. ' + (p.level + 1) +
                  (p.nextTitle && p.nextTitle.title !== p.title.title
                    ? ' <span class="xplab-mut">(' + esc(p.nextTitle.title) + ')</span>'
                    : '') +
                  ' · ' + p.pct + '%</p>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</header>' +

        '<section class="xplab-streak-banner">' +
          '<div class="xplab-streak-left">' +
            '<div class="xplab-streak-fire">' + icon('flame', 22) + '</div>' +
            '<div>' +
              '<strong>' + d.streak + ' jour' + (d.streak !== 1 ? 's' : '') + ' d’affilée</strong>' +
              '<p>Bonus actif ' + fmtMult(d.liveMult) + ' sur chaque carte' +
                (d.streak < 16
                  ? ' · demain si tu enchaînes : ' + fmtMult(d.nextDayMult)
                  : ' · plafond atteint') +
              '</p>' +
            '</div>' +
          '</div>' +
          '<div class="xplab-streak-meter" title="Bonus streak">' +
            '<div class="xplab-streak-meter-fill" style="width:' + Math.max(4, streakPct) + '%"></div>' +
          '</div>' +
        '</section>' +

        '<section class="xplab-kpis">' +
          '<div class="xplab-kpi"><div class="xplab-kpi-n">' + fmt(d.totalXp) + '</div><div class="xplab-kpi-l">XP total</div></div>' +
          '<div class="xplab-kpi"><div class="xplab-kpi-n">+' + fmt(d.streakBonusXp) + '</div><div class="xplab-kpi-l">dont bonus streak</div></div>' +
          '<div class="xplab-kpi"><div class="xplab-kpi-n">' + fmt(d.reviews) + '</div><div class="xplab-kpi-l">Révisions</div></div>' +
          '<div class="xplab-kpi xplab-kpi-acc"><div class="xplab-kpi-n">+' + fmt(d.todayXp) + '</div>' +
            '<div class="xplab-kpi-l">Aujourd’hui · ' + d.todayCount + ' carte' + (d.todayCount !== 1 ? 's' : '') +
              (d.todayMult > 1 ? ' · ' + fmtMult(d.todayMult) : '') + '</div></div>' +
        '</section>' +

        '<div class="xplab-grid">' +
          '<section class="xplab-card">' +
            '<h3>Courbe exponentielle</h3>' +
            '<p class="xplab-mut">Chaque niveau coûte ×' + GROWTH + ' plus d’XP (base ' + BASE_XP + '). ' +
              '1→2 = ' + fmt(xpToAdvance(1)) + ' XP · 10→11 = ' + fmt(xpToAdvance(10)) + ' XP.</p>' +
            '<div class="xplab-ladder">' + ladderHtml + '</div>' +
          '</section>' +
          '<section class="xplab-card">' +
            '<h3>Comment gagner de l’XP</h3>' +
            '<ul class="xplab-rules">' +
              '<li><b>X-</b> ~12 XP × qualité (qScore)</li>' +
              '<li><b>Y-</b> ~6 XP · <b>W-</b> ~8 XP</li>' +
              '<li><b>Streak</b> : +4&nbsp;% / jour (max ' + fmtMult(STREAK_CAP) + ')</li>' +
              '<li>Réviser chaque jour fait monter le multiplicateur</li>' +
            '</ul>' +
            '<div class="xplab-split">' +
              '<div><span class="xplab-split-n">' + (d.byKind.main || 0) + '</span> X-</div>' +
              '<div><span class="xplab-split-n">' + (d.byKind.quick || 0) + '</span> Y-</div>' +
              '<div><span class="xplab-split-n">' + (d.byKind.devoir || 0) + '</span> W-</div>' +
            '</div>' +
          '</section>' +
        '</div>' +

        '<section class="xplab-card" style="margin-top:14px;">' +
          '<h3>Tableau des écoles</h3>' +
          '<p class="xplab-mut">Comme le fantasme du classement APB/Parcoursup ingénieurs — tu montes école par école.</p>' +
          '<div class="xplab-titles">' + titlesHtml + '</div>' +
        '</section>' +

        '<p class="xplab-foot">Labo — XP recalculé sur ton historique réel (streak inclus a posteriori).</p>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(pane);
  };
})();
