/**
 * xp-lab.js — Labo Progression : XP + niveaux (cartes révisées)
 * Courbe ×1.38 · défis → multiplicateurs permanents (×2, ×3…) · streak · semaine.
 */
(function () {
  'use strict';

  var BASE_XP = 36;
  var GROWTH = 1.38;
  var MAX_LEVEL = 80;
  /** +5 % d’XP par jour de streak après J1, plafond ×1,75 */
  var STREAK_STEP = 0.05;
  var STREAK_CAP = 1.75;

  /** Paliers façon classement écoles (humour prépa) */
  var TITLES = [
    { min: 1,  title: 'Polytech',              blurb: 'Le filet — tu es sur le tableau' },
    { min: 3,  title: 'Textile Roubaix',       blurb: 'ENSAIT vibes — original, on vise plus haut' },
    { min: 5,  title: 'USMB/UGA',              blurb: 'Savoie & Grenoble — tu prends le rythme' },
    { min: 8,  title: 'CCP Bourgogne',         blurb: 'Concours commun — sérieux' },
    { min: 12, title: 'Mines Alès',            blurb: 'Groupe Mines — ça sent bon' },
    { min: 16, title: 'Phelma',                blurb: 'Grenoble INP — physique & électro' },
    { min: 21, title: 'Ensimag',               blurb: 'Info Grenoble — tu sors du lot' },
    { min: 27, title: 'Centrale Méditerranée', blurb: 'Très bon tableau' },
    { min: 33, title: 'Centrale Lyon',         blurb: 'Top Centrale — presque le sommet' },
    { min: 40, title: 'CentraleSupélec',       blurb: 'Le rêve mixte' },
    { min: 48, title: 'Mines Paris',           blurb: 'ParisTech — dream board' },
    { min: 58, title: 'Polytechnique',         blurb: 'X — le graal. Casert mental.' },
    { min: 70, title: 'X★ Ultime',             blurb: 'Au-delà du classement — légende PC*' }
  ];

  /**
   * Défis → multiplicateur permanent (le plus haut débloqué s’applique).
   * volumeStreak : N cartes/jour pendant D jours d’affilée (historique).
   * overdueCapStreak : ≤ maxOverdue X en retard pendant D jours (journal local).
   */
  var CHALLENGES = [
    {
      id: 'vol40_7',
      title: 'Semaine solide',
      desc: 'Au moins 40 cartes révisées par jour, 7 jours d’affilée.',
      mult: 2,
      kind: 'volumeStreak',
      minPerDay: 40,
      days: 7
    },
    {
      id: 'cleanX_7',
      title: 'File X propre',
      desc: 'Moins de 10 cartes X en retard, 7 jours d’affilée.',
      mult: 2,
      kind: 'overdueCapStreak',
      maxOverdue: 10,
      days: 7
    },
    {
      id: 'vol40_14',
      title: 'Quinzaine de fer',
      desc: '40+ cartes / jour pendant 14 jours d’affilée.',
      mult: 3,
      kind: 'volumeStreak',
      minPerDay: 40,
      days: 14
    },
    {
      id: 'cleanX_14',
      title: 'Synchrotron nickel',
      desc: 'Moins de 10 X en retard, 14 jours d’affilée.',
      mult: 3,
      kind: 'overdueCapStreak',
      maxOverdue: 10,
      days: 14
    },
    {
      id: 'vol60_7',
      title: 'Overdrive',
      desc: '60+ cartes / jour pendant 7 jours d’affilée.',
      mult: 4,
      kind: 'volumeStreak',
      minPerDay: 60,
      days: 7
    }
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

  function nextTitleAfter(level) {
    for (var i = 0; i < TITLES.length; i++) {
      if (TITLES[i].min > level) return TITLES[i];
    }
    return null;
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

  function durationSeconds(card, h) {
    if (h && typeof h.tempsReel === 'number' && h.tempsReel > 0) return h.tempsReel;
    if (card && typeof card.tempsCible === 'number' && card.tempsCible > 0) return card.tempsCible;
    return 60;
  }

  function xpForEntry(card, h) {
    var kind = cardKind(card);
    var q = (h && typeof h.qScore === 'number') ? h.qScore : 5;
    q = Math.max(0, Math.min(10, q));
    var qMult = 0.45 + 0.1 * q; // 0 → ×0.45 · 5 → ×0.95 · 10 → ×1.45

    if (kind === 'quick') {
      var refFiveMinX = 2 + 5 * 1.0;
      return Math.max(1, Math.round((refFiveMinX / 12) * qMult));
    }

    var min = durationSeconds(card, h) / 60;
    min = Math.max(0.5, Math.min(90, min));

    if (kind === 'devoir') {
      var baseW = 3 + min * 0.8;
      return Math.max(1, Math.round(baseW * qMult));
    }

    var baseX = 2 + min * 1.05;
    return Math.max(1, Math.round(baseX * qMult));
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

  function shiftDay(iso, delta) {
    var d = parseDay(iso);
    d.setDate(d.getDate() + delta);
    return d.toISOString().slice(0, 10);
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
        if (!h || h.type === 'undo' || h.practice) return;
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
    var nextTitle = nextTitleAfter(level) || titleFor(level);
    return {
      totalXp: totalXp,
      level: level,
      into: into,
      need: need,
      pct: pct,
      title: titleFor(level),
      nextTitle: nextTitle,
      nextSchool: nextTitleAfter(level)
    };
  }

  /* ——— État défis (persisté) ——— */

  function xpLabState() {
    if (!window.D) return { unlocked: {}, overdueLog: {} };
    if (!window.D.settings) window.D.settings = {};
    if (!window.D.settings.xpLabChallenges || typeof window.D.settings.xpLabChallenges !== 'object') {
      window.D.settings.xpLabChallenges = { unlocked: {}, overdueLog: {} };
    }
    var st = window.D.settings.xpLabChallenges;
    if (!st.unlocked || typeof st.unlocked !== 'object') st.unlocked = {};
    if (!st.overdueLog || typeof st.overdueLog !== 'object') st.overdueLog = {};
    return st;
  }

  function persistXpLabState() {
    if (typeof window.save === 'function') {
      try { window.save({ waitCloud: false }); } catch (e) { /* prefs */ }
    }
  }

  function countOverdueMainX(ref) {
    ref = ref || todayISO();
    var n = 0;
    var A = window.AnkiAlgoV2 || window.AnkiAlgo;
    (window.D && window.D.exercices || []).forEach(function (c) {
      if (!c || cardKind(c) !== 'main') return;
      if (A && typeof A.isReservoir === 'function' && A.isReservoir(c)) return;
      if (A && typeof A.isActive === 'function' && !A.isActive(c)) return;
      if (A && typeof A.windowState === 'function') {
        if (A.windowState(c, ref) === 'overdue') n++;
        return;
      }
      var due = c.dateProchaineRevision;
      if (due && String(due).slice(0, 10) < ref) n++;
    });
    return n;
  }

  function logTodayOverdue() {
    var st = xpLabState();
    var today = todayISO();
    st.overdueLog[today] = countOverdueMainX(today);
    /* garde 60 jours */
    Object.keys(st.overdueLog).forEach(function (d) {
      if (daysBetween(d, today) > 60) delete st.overdueLog[d];
    });
  }

  /** Premier jour où une fenêtre de `need` jours consécutifs satisfait pred(day). */
  function firstStreakEndDay(dayList, need, pred) {
    if (!dayList.length || need < 1) return null;
    var start = dayList[0];
    var end = dayList[dayList.length - 1];
    var run = 0;
    var cur = start;
    while (cur <= end) {
      if (pred(cur)) {
        run++;
        if (run >= need) return cur;
      } else {
        run = 0;
      }
      cur = shiftDay(cur, 1);
    }
    return null;
  }

  function currentStreakEnding(today, pred) {
    var run = 0;
    var cur = today;
    /* autorise de compter jusqu’à hier si aujourd’hui pas encore OK */
    if (!pred(today)) cur = shiftDay(today, -1);
    for (var i = 0; i < 400; i++) {
      if (!pred(cur)) break;
      run++;
      cur = shiftDay(cur, -1);
    }
    return run;
  }

  function evaluateChallenges(byDay) {
    var st = xpLabState();
    var today = todayISO();
    logTodayOverdue();
    var newly = [];
    var daysSorted = Object.keys(byDay).sort();
    if (!daysSorted.length && Object.keys(st.overdueLog).length) {
      daysSorted = Object.keys(st.overdueLog).sort();
    }
    var calStart = daysSorted[0] || today;
    var calEnd = today;
    var allDays = [];
    var c = calStart;
    while (c <= calEnd) {
      allDays.push(c);
      c = shiftDay(c, 1);
    }

    CHALLENGES.forEach(function (ch) {
      if (st.unlocked[ch.id]) return;
      var unlockDay = null;
      if (ch.kind === 'volumeStreak') {
        unlockDay = firstStreakEndDay(allDays, ch.days, function (d) {
          return (byDay[d] || 0) >= ch.minPerDay;
        });
      } else if (ch.kind === 'overdueCapStreak') {
        unlockDay = firstStreakEndDay(allDays, ch.days, function (d) {
          if (st.overdueLog[d] == null) return false;
          return Number(st.overdueLog[d]) <= ch.maxOverdue;
        });
      }
      if (unlockDay) {
        st.unlocked[ch.id] = unlockDay;
        newly.push(ch);
      }
    });

    if (newly.length) persistXpLabState();
    return { state: st, newly: newly };
  }

  function challengeMultOnDay(unlockedMap, day) {
    var best = 1;
    CHALLENGES.forEach(function (ch) {
      var since = unlockedMap[ch.id];
      if (!since) return;
      if (!day || since <= day) {
        if (ch.mult > best) best = ch.mult;
      }
    });
    return best;
  }

  function challengeProgress(ch, byDay, overdueLog, today) {
    var done = !!(xpLabState().unlocked[ch.id]);
    if (done) {
      return { done: true, cur: ch.days, need: ch.days, pct: 100, detail: 'Débloqué' };
    }
    if (ch.kind === 'volumeStreak') {
      var cur = currentStreakEnding(today, function (d) {
        return (byDay[d] || 0) >= ch.minPerDay;
      });
      var todayN = byDay[today] || 0;
      return {
        done: false,
        cur: cur,
        need: ch.days,
        pct: Math.min(100, Math.round((cur / ch.days) * 100)),
        detail: todayN + '/' + ch.minPerDay + ' cartes aujourd’hui · série ' + cur + '/' + ch.days + ' j'
      };
    }
    if (ch.kind === 'overdueCapStreak') {
      var curO = currentStreakEnding(today, function (d) {
        if (overdueLog[d] == null) return false;
        return Number(overdueLog[d]) <= ch.maxOverdue;
      });
      var todayO = overdueLog[today] != null ? Number(overdueLog[today]) : countOverdueMainX(today);
      return {
        done: false,
        cur: curO,
        need: ch.days,
        pct: Math.min(100, Math.round((curO / ch.days) * 100)),
        detail: todayO + ' X en retard (max ' + ch.maxOverdue + ') · série ' + curO + '/' + ch.days + ' j'
      };
    }
    return { done: false, cur: 0, need: ch.days, pct: 0, detail: '' };
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

    var challengeEval = evaluateChallenges(byDay);
    var unlockedMap = challengeEval.state.unlocked;
    var overdueLog = challengeEval.state.overdueLog;

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
    var challengeBonusXp = 0;
    var todayXp = 0;
    var todayCount = 0;
    var todayStreakMult = 1;
    var todayChallengeMult = 1;
    var xpByDay = {};

    reviews.forEach(function (r) {
      var st = r.day ? (streakAtDay[r.day] || 1) : 1;
      var sMult = streakMultiplier(st);
      var cMult = challengeMultOnDay(unlockedMap, r.day || today);
      var afterStreak = Math.max(1, Math.round(r.baseXp * sMult));
      var xp = Math.max(1, Math.round(r.baseXp * sMult * cMult));
      streakBonusXp += Math.max(0, afterStreak - r.baseXp);
      challengeBonusXp += Math.max(0, xp - afterStreak);
      totalXp += xp;
      if (r.day) xpByDay[r.day] = (xpByDay[r.day] || 0) + xp;
      if (r.day === today) {
        todayXp += xp;
        todayCount++;
        todayStreakMult = sMult;
        todayChallengeMult = cMult;
      }
    });

    var streak = 0;
    var cursor = new Date(today + 'T12:00:00');
    if (!byDay[today]) cursor.setDate(cursor.getDate() - 1);
    for (var i = 0; i < 400; i++) {
      var key = cursor.toISOString().slice(0, 10);
      if (!byDay[key]) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    var liveMult = streakMultiplier(streak || 0);
    if (byDay[today]) liveMult = streakMultiplier(streak);
    var nextDayMult = streakMultiplier(byDay[today] ? streak : streak + 1);

    var week = [];
    var weekXp = 0;
    var weekMax = 1;
    for (var w = 6; w >= 0; w--) {
      var dKey = shiftDay(today, -w);
      var dXp = xpByDay[dKey] || 0;
      weekXp += dXp;
      if (dXp > weekMax) weekMax = dXp;
      var label = '';
      try {
        label = parseDay(dKey).toLocaleDateString('fr-FR', { weekday: 'narrow' });
      } catch (eL) {
        label = dKey.slice(8);
      }
      week.push({ day: dKey, xp: dXp, label: label, isToday: dKey === today });
    }

    var prog = progressFromXp(totalXp);
    var challengeMult = challengeMultOnDay(unlockedMap, today);
    var todayMult = (todayStreakMult || 1) * (todayChallengeMult || 1);

    var challengeCards = CHALLENGES.map(function (ch) {
      var progCh = challengeProgress(ch, byDay, overdueLog, today);
      return {
        id: ch.id,
        title: ch.title,
        desc: ch.desc,
        mult: ch.mult,
        unlocked: !!unlockedMap[ch.id],
        unlockedOn: unlockedMap[ch.id] || null,
        progress: progCh
      };
    });

    var ladder = [];
    for (var L = Math.max(1, prog.level); L <= Math.min(MAX_LEVEL, prog.level + 6); L++) {
      ladder.push({ level: L, xp: xpToAdvance(L), current: L === prog.level });
    }

    var recentDays = days.slice(-14);
    var recentXp = 0;
    recentDays.forEach(function (d) { recentXp += (xpByDay[d] || 0); });
    var avgPerActiveDay = recentDays.length ? recentXp / recentDays.length : 0;
    var remain = Math.max(0, prog.need - prog.into);
    var etaDays = avgPerActiveDay > 0 ? Math.ceil(remain / avgPerActiveDay) : null;

    var school = prog.nextSchool;
    var schoolPct = 100;
    var schoolLevelsLeft = 0;
    if (school) {
      schoolLevelsLeft = Math.max(0, school.min - prog.level);
      var spanStart = prog.title.min || 1;
      var span = Math.max(1, school.min - spanStart);
      schoolPct = Math.min(100, Math.round(((prog.level - spanStart) / span) * 100));
    }

    return {
      reviews: reviews.length,
      totalXp: totalXp,
      streakBonusXp: streakBonusXp,
      challengeBonusXp: challengeBonusXp,
      byKind: byKind,
      todayXp: todayXp,
      todayCount: todayCount,
      todayMult: todayMult,
      todayStreakMult: todayStreakMult,
      todayChallengeMult: todayChallengeMult,
      streak: streak,
      liveMult: liveMult,
      nextDayMult: nextDayMult,
      challengeMult: challengeMult,
      challenges: challengeCards,
      newlyUnlocked: challengeEval.newly,
      overdueToday: overdueLog[today] != null ? Number(overdueLog[today]) : countOverdueMainX(today),
      prog: prog,
      ladder: ladder,
      daysActive: days.length,
      week: week,
      weekXp: weekXp,
      weekMax: weekMax,
      avgPerActiveDay: avgPerActiveDay,
      etaDays: etaDays,
      schoolPct: schoolPct,
      schoolLevelsLeft: schoolLevelsLeft
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
    challengeMultOnDay: challengeMultOnDay,
    countOverdueMainX: countOverdueMainX,
    compute: compute,
    TITLES: TITLES,
    CHALLENGES: CHALLENGES,
    GROWTH: GROWTH,
    BASE_XP: BASE_XP,
    onReview: function (card, qScore) {
      var before = window._xpLabLastLevel;
      var beforeCh = window._xpLabLastChallengeMult;
      var snap = compute();
      window._xpLabLastLevel = snap.prog.level;
      window._xpLabLastChallengeMult = snap.challengeMult;
      var base = xpForEntry(card, { qScore: qScore });
      var gained = Math.max(1, Math.round(base * (snap.todayMult || 1)));
      if (snap.newlyUnlocked && snap.newlyUnlocked.length) {
        snap.newlyUnlocked.forEach(function (ch) {
          if (typeof window.showToast === 'function') {
            window.showToast(
              'Défi « ' + ch.title + ' » → boost permanent ' + fmtMult(ch.mult) + ' !',
              { type: 'success' }
            );
          }
        });
      } else if (beforeCh != null && snap.challengeMult > beforeCh) {
        if (typeof window.showToast === 'function') {
          window.showToast('Boost défis ' + fmtMult(snap.challengeMult) + ' actif !', { type: 'success' });
        }
      } else if (before != null && snap.prog.level > before) {
        if (typeof window.showToast === 'function') {
          window.showToast(
            'Niveau ' + snap.prog.level + ' — ' + snap.prog.title.title +
              ' (+' + gained + ' XP' +
              (snap.challengeMult > 1 ? ', défi ' + fmtMult(snap.challengeMult) : '') +
              (snap.todayStreakMult > 1 ? ', streak ' + fmtMult(snap.todayStreakMult) : '') +
              ')',
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

  function titleTier(idx) {
    if (idx >= 11) return 'x';
    if (idx >= 8) return 'or';
    if (idx >= 4) return 'argent';
    return 'bronze';
  }

  function ringSvg(pct) {
    var r = 46;
    var c = 2 * Math.PI * r;
    var p = Math.max(0, Math.min(100, pct | 0));
    var off = c * (1 - p / 100);
    return (
      '<svg class="xplab-ring" viewBox="0 0 112 112" aria-hidden="true">' +
        '<circle class="xplab-ring-track" cx="56" cy="56" r="' + r + '"/>' +
        '<circle class="xplab-ring-fill" cx="56" cy="56" r="' + r + '"' +
          ' stroke-dasharray="' + c.toFixed(2) + '"' +
          ' stroke-dashoffset="' + off.toFixed(2) + '"/>' +
      '</svg>'
    );
  }

  window.renderXpLab = function () {
    var pane = document.getElementById('paneXpLab');
    if (!pane) return;
    var d = compute();
    var p = d.prog;
    window._xpLabLastLevel = p.level;
    window._xpLabLastChallengeMult = d.challengeMult;

    var ladderHtml = d.ladder.map(function (row) {
      return (
        '<div class="xplab-ladder-row' + (row.current ? ' is-cur' : '') + '">' +
          '<span class="xplab-ladder-lv">Niv.&nbsp;' + row.level + '</span>' +
          '<span class="xplab-ladder-bar"><i style="width:' +
            (row.current ? p.pct : (row.level < p.level ? 100 : 0)) + '%"></i></span>' +
          '<span class="xplab-ladder-xp">' + fmt(row.xp) + '</span>' +
        '</div>'
      );
    }).join('');

    var pathHtml = TITLES.map(function (t, idx) {
      var unlocked = p.level >= t.min;
      var current = unlocked && (idx === TITLES.length - 1 || p.level < TITLES[idx + 1].min);
      var tier = titleTier(idx);
      return (
        '<li class="xplab-path-node tier-' + tier +
          (unlocked ? ' is-on' : '') + (current ? ' is-cur' : '') + '">' +
          '<span class="xplab-path-dot" aria-hidden="true"></span>' +
          '<div class="xplab-path-body">' +
            '<div class="xplab-path-top">' +
              '<strong>' + esc(t.title) + '</strong>' +
              '<span class="xplab-path-lv">niv. ' + t.min + '</span>' +
            '</div>' +
            '<p>' + esc(t.blurb) + '</p>' +
            (current ? '<em class="xplab-path-you">Position actuelle</em>' : '') +
          '</div>' +
        '</li>'
      );
    }).join('');

    var weekHtml = d.week.map(function (day) {
      var h = d.weekMax ? Math.max(10, Math.round((day.xp / d.weekMax) * 100)) : 10;
      if (!day.xp) h = 5;
      return (
        '<div class="xplab-week-col' + (day.isToday ? ' is-today' : '') + (day.xp ? ' has-xp' : '') +
          '" title="' + esc(day.day) + ' · +' + fmt(day.xp) + ' XP">' +
          '<span class="xplab-week-val">' + (day.xp ? fmt(day.xp) : '') + '</span>' +
          '<div class="xplab-week-bar" style="height:' + h + '%"></div>' +
          '<span class="xplab-week-d">' + esc(day.label) + '</span>' +
        '</div>'
      );
    }).join('');

    var challengesHtml = (d.challenges || []).map(function (ch) {
      var pr = ch.progress || {};
      return (
        '<li class="xplab-challenge' + (ch.unlocked ? ' is-on' : '') + '">' +
          '<div class="xplab-challenge-top">' +
            '<strong>' + esc(ch.title) + '</strong>' +
            '<span class="xplab-challenge-mult">' + fmtMult(ch.mult) + '</span>' +
          '</div>' +
          '<p class="xplab-challenge-desc">' + esc(ch.desc) + '</p>' +
          (ch.unlocked
            ? '<em class="xplab-challenge-done">Débloqué' +
                (ch.unlockedOn ? ' · ' + esc(ch.unlockedOn) : '') + '</em>'
            : '<div class="xplab-challenge-meter" title="' + esc(pr.detail || '') + '">' +
                '<div class="xplab-challenge-meter-fill" style="width:' + Math.max(4, pr.pct || 0) + '%"></div>' +
              '</div>' +
              '<span class="xplab-challenge-hint">' + esc(pr.detail || '') + '</span>') +
        '</li>'
      );
    }).join('');

    var streakPct = Math.round(((d.liveMult - 1) / (STREAK_CAP - 1)) * 100);
    var school = p.nextSchool;
    var curTier = 'bronze';
    for (var ti = 0; ti < TITLES.length; ti++) {
      if (p.level >= TITLES[ti].min) curTier = titleTier(ti);
    }

    pane.innerHTML =
      '<div class="xplab-page">' +
        '<header class="xplab-hero tier-' + curTier + '">' +
          '<div class="xplab-hero-bg" aria-hidden="true"></div>' +
          '<div class="xplab-hero-grid" aria-hidden="true"></div>' +
          '<div class="xplab-hero-inner">' +
            '<p class="xplab-lab-tag"><span class="xplab-lab-dot"></span> Labo Progression · test</p>' +
            '<div class="xplab-level-row">' +
              '<div class="xplab-medal" aria-label="Niveau ' + p.level + ', ' + p.pct + ' %">' +
                ringSvg(p.pct) +
                '<div class="xplab-medal-core">' +
                  '<span class="xplab-level-n">' + p.level + '</span>' +
                  '<span class="xplab-level-lbl">Niveau</span>' +
                '</div>' +
              '</div>' +
              '<div class="xplab-level-meta">' +
                '<p class="xplab-school-eyebrow">Classement</p>' +
                '<h2 class="xplab-school-name">' + esc(p.title.title) + '</h2>' +
                '<p class="xplab-school-blurb">' + esc(p.title.blurb) + '</p>' +
                '<div class="xplab-bar" role="progressbar" aria-valuenow="' + p.pct +
                  '" aria-valuemin="0" aria-valuemax="100">' +
                  '<div class="xplab-bar-fill" style="width:' + p.pct + '%"></div>' +
                '</div>' +
                '<div class="xplab-bar-meta">' +
                  '<span>' + fmt(p.into) + ' <small>/ ' + fmt(p.need) + ' XP</small></span>' +
                  '<span class="xplab-bar-pct">' + p.pct + '%</span>' +
                  '<span>→ niv. ' + Math.min(MAX_LEVEL, p.level + 1) + '</span>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</header>' +

        (school
          ? '<section class="xplab-school">' +
              '<div class="xplab-school-mark" aria-hidden="true"></div>' +
              '<div class="xplab-school-txt">' +
                '<strong>Prochain palier</strong>' +
                '<span>' + esc(school.title) + '</span>' +
              '</div>' +
              '<div class="xplab-school-mid">' +
                '<div class="xplab-school-bar"><i style="width:' + d.schoolPct + '%"></i></div>' +
                '<span class="xplab-school-hint">encore ' + d.schoolLevelsLeft +
                  ' niveau' + (d.schoolLevelsLeft !== 1 ? 'x' : '') + ' · dès niv. ' + school.min + '</span>' +
              '</div>' +
              '<span class="xplab-school-pct">' + d.schoolPct + '%</span>' +
            '</section>'
          : '') +

        '<section class="xplab-boost-banner' + (d.challengeMult > 1 ? ' is-hot' : '') + '">' +
          '<div class="xplab-boost-left">' +
            '<div class="xplab-boost-badge">' + fmtMult(d.challengeMult) + '</div>' +
            '<div>' +
              '<strong>Boost défis</strong>' +
              '<p>' + (d.challengeMult > 1
                ? 'Multiplicateur permanent actif sur tes XP'
                : 'Complète un défi ci-dessous pour activer ×2, ×3…') +
                ' · ' + d.overdueToday + ' X en retard aujourd’hui</p>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<section class="xplab-card xplab-challenges-card">' +
          '<div class="xplab-week-head">' +
            '<h3>Défis → multiplicateurs</h3>' +
            '<span class="xplab-mut">Le plus haut débloqué compte</span>' +
          '</div>' +
          '<ul class="xplab-challenges">' + challengesHtml + '</ul>' +
        '</section>' +

        '<section class="xplab-streak-banner' + (d.streak > 0 ? ' is-hot' : '') + '">' +
          '<div class="xplab-streak-left">' +
            '<div class="xplab-streak-fire">' + icon('flame', 20) + '</div>' +
            '<div>' +
              '<strong>' + d.streak + ' jour' + (d.streak !== 1 ? 's' : '') + ' d’affilée</strong>' +
              '<p>Bonus streak ' + fmtMult(d.liveMult) +
                (d.liveMult < STREAK_CAP
                  ? ' · demain ' + fmtMult(d.nextDayMult)
                  : ' · plafond') +
              '</p>' +
            '</div>' +
          '</div>' +
          '<div class="xplab-streak-meter" title="Bonus streak">' +
            '<div class="xplab-streak-meter-fill" style="width:' + Math.max(4, streakPct) + '%"></div>' +
          '</div>' +
        '</section>' +

        '<section class="xplab-kpis">' +
          '<div class="xplab-kpi"><div class="xplab-kpi-n">' + fmt(d.totalXp) + '</div><div class="xplab-kpi-l">XP total</div></div>' +
          '<div class="xplab-kpi"><div class="xplab-kpi-n">+' + fmt(d.weekXp) + '</div><div class="xplab-kpi-l">7 jours</div></div>' +
          '<div class="xplab-kpi"><div class="xplab-kpi-n">' + fmt(d.reviews) + '</div><div class="xplab-kpi-l">Révisions</div></div>' +
          '<div class="xplab-kpi xplab-kpi-acc"><div class="xplab-kpi-n">+' + fmt(d.todayXp) + '</div>' +
            '<div class="xplab-kpi-l">Aujourd’hui · ' + d.todayCount +
              (d.todayMult > 1 ? ' · ' + fmtMult(d.todayMult) : '') + '</div></div>' +
        '</section>' +

        '<section class="xplab-card xplab-week-card">' +
          '<div class="xplab-week-head">' +
            '<h3>Activité</h3>' +
            '<span class="xplab-mut">' +
              (d.etaDays != null
                ? '~' + d.etaDays + ' j actifs → prochain niveau'
                : 'Révise pour estimer le rythme') +
            '</span>' +
          '</div>' +
          '<div class="xplab-week">' + weekHtml + '</div>' +
        '</section>' +

        '<section class="xplab-card xplab-path-card">' +
          '<div class="xplab-week-head">' +
            '<h3>Parcours des écoles</h3>' +
            '<span class="xplab-mut">Du filet au X</span>' +
          '</div>' +
          '<ol class="xplab-path">' + pathHtml + '</ol>' +
        '</section>' +

        '<div class="xplab-grid">' +
          '<section class="xplab-card">' +
            '<h3>Courbe</h3>' +
            '<p class="xplab-mut">×' + GROWTH + ' par niveau · base ' + BASE_XP +
              ' · max ' + MAX_LEVEL + '</p>' +
            '<div class="xplab-ladder">' + ladderHtml + '</div>' +
          '</section>' +
          '<section class="xplab-card">' +
            '<h3>Gagner de l’XP</h3>' +
            '<ul class="xplab-rules">' +
              '<li><b>X-</b> ~1 XP/min × qualité</li>' +
              '<li><b>Y-</b> ~1/12 d’une X- de 5 min</li>' +
              '<li><b>W-</b> ~0,8 XP/min × qualité</li>' +
              '<li><b>Streak</b> +5&nbsp;%/j (max ' + fmtMult(STREAK_CAP) + ')</li>' +
              '<li><b>Défis</b> ×2 / ×3 / ×4 permanents</li>' +
            '</ul>' +
            '<div class="xplab-split">' +
              '<div><span class="xplab-split-n">' + (d.byKind.main || 0) + '</span>X-</div>' +
              '<div><span class="xplab-split-n">' + (d.byKind.quick || 0) + '</span>Y-</div>' +
              '<div><span class="xplab-split-n">' + (d.byKind.devoir || 0) + '</span>W-</div>' +
            '</div>' +
          '</section>' +
        '</div>' +

        '<p class="xplab-foot">Labo — XP recalculé sur l’historique. Défis « file X » suivis jour par jour à partir d’aujourd’hui.</p>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(pane);
  };
})();
