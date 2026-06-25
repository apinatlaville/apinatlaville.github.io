/**
 * boot-profiler.js — Mesure le temps de chaque étape au démarrage.
 * Activer le panneau : ?bootlog=1 ou localStorage.setItem('boot_profiler','1')
 * Console : bootProfiler.copyLog() · bootProfiler.downloadLog()
 */
(function () {
  'use strict';

  var T0 = (typeof performance !== 'undefined' && performance.timeOrigin)
    ? performance.timeOrigin
    : Date.now();
  var marks = [];
  var scripts = {};
  var notes = [];
  var panelEl = null;

  function enabled() {
    try {
      if (localStorage.getItem('boot_profiler') === '1') return true;
    } catch (e) { /* ignore */ }
    return /(?:\?|&)bootlog=1(?:&|$)/.test(location.search);
  }

  function nowMs() {
    return Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now() - T0));
  }

  function sinceStartMs() {
    return Math.round(Date.now() - T0);
  }

  function mark(name, meta) {
    var entry = {
      t: sinceStartMs(),
      perf: nowMs(),
      name: name,
      meta: meta || null
    };
    marks.push(entry);
    if (enabled()) {
      console.log('[boot]', entry.t + 'ms', name, meta || '');
    }
    return entry;
  }

  function note(text) {
    notes.push({ t: sinceStartMs(), text: text });
  }

  function scriptStart(name) {
    scripts[name] = { name: name, start: sinceStartMs(), end: null, error: false };
  }

  function scriptEnd(name) {
    var s = scripts[name];
    if (!s) s = scripts[name] = { name: name, start: sinceStartMs() };
    s.end = sinceStartMs();
    s.duration = s.end - s.start;
    mark('script.loaded', { file: name, ms: s.duration });
  }

  function scriptError(name) {
    var s = scripts[name] || { name: name, start: sinceStartMs() };
    s.error = true;
    s.end = sinceStartMs();
    s.duration = s.end - s.start;
    scripts[name] = s;
    mark('script.error', { file: name, ms: s.duration });
  }

  function measureAsync(name, fn) {
    var t0 = sinceStartMs();
    return Promise.resolve().then(fn).then(function (result) {
      mark(name, { ms: sinceStartMs() - t0, ok: true });
      return result;
    }, function (err) {
      mark(name, { ms: sinceStartMs() - t0, ok: false, error: String(err && err.message ? err.message : err) });
      throw err;
    });
  }

  function measureSync(name, fn) {
    var t0 = sinceStartMs();
    try {
      var result = fn();
      mark(name, { ms: sinceStartMs() - t0, ok: true });
      return result;
    } catch (err) {
      mark(name, { ms: sinceStartMs() - t0, ok: false, error: String(err && err.message ? err.message : err) });
      throw err;
    }
  }

  function resourceScripts() {
    if (typeof performance === 'undefined' || !performance.getEntriesByType) return [];
    return performance.getEntriesByType('resource')
      .filter(function (e) { return e.initiatorType === 'script' || /\.js(\?|$)/.test(e.name); })
      .map(function (e) {
        return {
          name: e.name.split('/').pop().split('?')[0],
          durationMs: Math.round(e.duration),
          transferSize: e.transferSize || 0,
          startMs: Math.round(e.startTime)
        };
      })
      .sort(function (a, b) { return b.durationMs - a.durationMs; });
  }

  function buildReport() {
    var mode = 'inconnu';
    try {
      if (localStorage.getItem('active_mode') === 'local') mode = 'local';
      else if (window.isLocalMode) mode = 'local';
      else if (window.cloudConnected) mode = 'cloud';
      else if (window.currentUser) mode = 'cloud';
    } catch (e) { /* ignore */ }

    var scriptList = Object.keys(scripts).map(function (k) { return scripts[k]; })
      .filter(function (s) { return s.end != null; })
      .sort(function (a, b) { return (b.duration || 0) - (a.duration || 0); });

    var dataMeta = null;
    try {
      if (window.D) {
        dataMeta = {
          cours: (window.D.cours || []).length,
          exercices: (window.D.exercices || []).length,
          devoirs: (window.D.devoirs || []).length
        };
      }
      var backup = localStorage.getItem('backup_local_cours');
      if (backup) dataMeta = dataMeta || {};
      if (backup) dataMeta.localBackupKb = Math.round(backup.length / 1024);
    } catch (e) { /* ignore */ }

    return {
      generatedAt: new Date().toISOString(),
      url: location.href,
      userAgent: navigator.userAgent,
      mode: mode,
      appReady: !!window.appReady,
      appLaunched: !!window.appLaunched,
      isLocalMode: !!window.isLocalMode,
      cloudConnected: !!window.cloudConnected,
      currentUser: window.currentUser ? window.currentUser.email : null,
      totalMs: sinceStartMs(),
      data: dataMeta,
      marks: marks.slice(),
      scripts: scriptList,
      resourceScripts: resourceScripts().slice(0, 40),
      notes: notes.slice(),
      errors: (window.appErrors || []).slice()
    };
  }

  function formatText(report) {
    var lines = [
      '=== BOOT PROFILE Synchrotron ===',
      'Généré : ' + report.generatedAt,
      'URL : ' + report.url,
      'Total : ' + report.totalMs + ' ms',
      'Mode : ' + report.mode + ' | appReady=' + report.appReady + ' | appLaunched=' + report.appLaunched,
      'Utilisateur : ' + (report.currentUser || '(aucun)') + ' | cloud=' + report.cloudConnected
    ];
    if (report.data) {
      lines.push('Données : ' + JSON.stringify(report.data));
    }
    lines.push('', '--- Étapes (ms depuis début) ---');
    report.marks.forEach(function (m) {
      var extra = m.meta ? ' ' + JSON.stringify(m.meta) : '';
      lines.push(m.t + '\t' + m.name + extra);
    });
    if (report.scripts.length) {
      lines.push('', '--- Scripts (chargement séquentiel) ---');
      report.scripts.forEach(function (s) {
        lines.push((s.duration || 0) + ' ms\t' + s.name + (s.error ? ' [ERREUR]' : ''));
      });
    }
    var slowRes = report.resourceScripts.filter(function (r) { return r.durationMs > 100; }).slice(0, 15);
    if (slowRes.length) {
      lines.push('', '--- Ressources lentes (>100ms) ---');
      slowRes.forEach(function (r) {
        lines.push(r.durationMs + ' ms\t' + r.name + (r.transferSize ? ' (' + Math.round(r.transferSize / 1024) + ' Ko)' : ''));
      });
    }
    if (report.errors.length) {
      lines.push('', '--- Erreurs JS ---');
      report.errors.forEach(function (e) {
        lines.push((e.time || '') + ' ' + (e.source || '') + ': ' + e.msg);
      });
    }
    if (report.notes.length) {
      lines.push('', '--- Notes ---');
      report.notes.forEach(function (n) {
        lines.push(n.t + ' ms\t' + n.text);
      });
    }
    lines.push('', '--- JSON (à renvoyer à l\'assistant) ---');
    lines.push(JSON.stringify(report, null, 2));
    return lines.join('\n');
  }

  function copyLog() {
    var text = formatText(buildReport());
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () {
        note('Log copié dans le presse-papiers');
        return text;
      });
    }
    return Promise.resolve(text);
  }

  function downloadLog() {
    var text = formatText(buildReport());
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'boot-profile-' + Date.now() + '.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    return text;
  }

  function injectStyles() {
    if (document.getElementById('bootProfilerStyles')) return;
    var s = document.createElement('style');
    s.id = 'bootProfilerStyles';
    s.textContent =
      '#bootProfilerPanel{position:fixed;right:12px;bottom:12px;z-index:10002;max-width:min(320px,calc(100vw - 24px));' +
      'font:12px/1.4 Inter,system-ui,sans-serif;color:#e8ecf4;background:rgba(16,20,30,.94);' +
      'border:0.5px solid rgba(255,255,255,.16);border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.45);' +
      'backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}' +
      '#bootProfilerPanel .boot-profiler-head{padding:8px 12px;font-weight:700;font-size:11px;text-transform:uppercase;' +
      'letter-spacing:.05em;color:rgba(255,255,255,.55);border-bottom:0.5px solid rgba(255,255,255,.08)}' +
      '#bootProfilerPanel .boot-profiler-body{padding:8px 12px;font-size:11px;color:rgba(232,236,244,.88)}' +
      '#bootProfilerPanel .boot-profiler-recent{margin-top:6px;color:rgba(255,255,255,.45);font-size:10px;line-height:1.5}' +
      '#bootProfilerPanel .boot-profiler-actions{display:flex;gap:6px;padding:8px 12px 10px;border-top:0.5px solid rgba(255,255,255,.08)}' +
      '#bootProfilerPanel button{flex:1;padding:6px 8px;border-radius:8px;border:0.5px solid rgba(255,255,255,.18);' +
      'background:rgba(255,255,255,.08);color:#fff;font:inherit;font-weight:600;cursor:pointer}' +
      '#bootProfilerPanel button:hover{background:rgba(255,255,255,.14)}';
    document.head.appendChild(s);
  }

  function renderPanel() {
    if (!enabled() || panelEl) return;
    injectStyles();
    panelEl = document.createElement('div');
    panelEl.id = 'bootProfilerPanel';
    panelEl.setAttribute('aria-label', 'Profileur de démarrage');
    panelEl.innerHTML =
      '<div class="boot-profiler-head">Boot profiler</div>' +
      '<div class="boot-profiler-body" id="bootProfilerBody"></div>' +
      '<div class="boot-profiler-actions">' +
        '<button type="button" id="bootProfilerCopy">Copier le log</button>' +
        '<button type="button" id="bootProfilerDl">Télécharger</button>' +
      '</div>';
    document.body.appendChild(panelEl);
    document.getElementById('bootProfilerCopy').onclick = function () {
      copyLog().then(function () {
        var b = document.getElementById('bootProfilerCopy');
        if (b) { b.textContent = 'Copié !'; setTimeout(function () { b.textContent = 'Copier le log'; }, 1500); }
      });
    };
    document.getElementById('bootProfilerDl').onclick = downloadLog;
    refreshPanel();
  }

  function refreshPanel() {
    if (!panelEl) return;
    var body = document.getElementById('bootProfilerBody');
    if (!body) return;
    var r = buildReport();
    var last = r.marks.slice(-8).map(function (m) {
      return m.t + ' ms — ' + m.name;
    }).join('<br>');
    body.innerHTML =
      '<div><b>' + r.totalMs + ' ms</b> · mode ' + r.mode +
      ' · ready=' + (r.appReady ? 'oui' : 'non') + '</div>' +
      '<div class="boot-profiler-recent">' + (last || '…') + '</div>';
  }

  mark('profiler.start');

  var prevOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    mark('js.error', {
      message: String(message),
      source: source ? String(source).split('/').pop() : '',
      line: lineno
    });
    if (typeof prevOnError === 'function') return prevOnError.apply(this, arguments);
    return false;
  };

  window.bootProfiler = {
    enabled: enabled,
    mark: mark,
    note: note,
    scriptStart: scriptStart,
    scriptEnd: scriptEnd,
    scriptError: scriptError,
    measureAsync: measureAsync,
    measureSync: measureSync,
    buildReport: buildReport,
    formatText: formatText,
    copyLog: copyLog,
    downloadLog: downloadLog,
    refreshPanel: refreshPanel
  };
  window.bootMark = mark;

  window.setBootStep = function (step, label) {
    mark('boot.' + step, label ? { label: label } : null);
    refreshPanel();
  };

  document.addEventListener('DOMContentLoaded', function () {
    mark('dom.ready');
    refreshPanel();
  });

  window.addEventListener('load', function () {
    mark('window.load');
    refreshPanel();
  });

  window.addEventListener('app-js-ready', function () {
    mark('event.app-js-ready');
    refreshPanel();
  });

  setTimeout(function () {
    mark('watch.8s');
    if (!window.appReady) {
      note('Après 8s : app pas prête — risque écran login forcé');
      console.warn('[boot] App non prête après 8s. bootProfiler.copyLog() pour exporter.');
    }
    refreshPanel();
  }, 8000);

  setTimeout(function () {
    mark('watch.12s');
    if (!window.appReady) {
      note('Après 12s : app toujours pas prête — timeout core-utils');
    }
    refreshPanel();
  }, 12000);

  if (document.readyState !== 'loading') {
    mark('dom.already-ready');
  }

  if (enabled()) {
    if (document.body) renderPanel();
    else document.addEventListener('DOMContentLoaded', renderPanel);
  }
})();
