/**
 * boot-loader.js — Chargement optimisé : parallèle, scripts différés, auth après app.js
 */
(function () {
  'use strict';

  var v = window.__bootCacheV || String(Date.now());
  var _lazyLoaded = {};
  var _lazyLoading = {};

  var CRITICAL_SCRIPTS = {
    'ui-appearance.js': true,
    'ui-components.js': true,
    'cloud.js': true,
    'device-session.js': true,
    'data.js': true,
    'anki-app-v2.js': true,
    'app.js': true
  };

  var TAB_BUNDLES = {
    flashcards: ['anki-quick.js'],
    ankiVizV2: ['anki-viz-v2.js'],
    print: ['scanner.js'],
    cours: ['scanner.js'],
    test: ['scanner.js']
  };

  var DEFERRED_AFTER_BOOT = [
    'demo-data.js',
    'anki-smoke.js'
  ];

  function isCritical(name) {
    return !!CRITICAL_SCRIPTS[name];
  }

  function onScriptError(name) {
    if (window.bootProfiler) window.bootProfiler.scriptError(name);
    var entry = typeof window.recordScriptLoadError === 'function'
      ? window.recordScriptLoadError(name, isCritical(name))
      : { name: name, critical: isCritical(name) };
    return entry;
  }

  function loadScript(src) {
    var name = src.split('/').pop();
    if (_lazyLoaded[name]) return Promise.resolve({ ok: true, name: name });
    return new Promise(function (resolve) {
      if (window.bootProfiler) window.bootProfiler.scriptStart(name);
      var s = document.createElement('script');
      s.src = src + '?v=' + v;
      s.async = false;
      s.onload = function () {
        _lazyLoaded[name] = true;
        if (window.bootProfiler) window.bootProfiler.scriptEnd(name);
        resolve({ ok: true, name: name });
      };
      s.onerror = function () {
        onScriptError(name);
        resolve({ ok: false, name: name, critical: isCritical(name) });
      };
      document.body.appendChild(s);
    });
  }

  function loadSequential(list) {
    return list.reduce(function (p, src) {
      return p.then(function (results) {
        return loadScript(src).then(function (r) {
          results.push(r);
          return results;
        });
      });
    }, Promise.resolve([]));
  }

  function loadParallel(list) {
    var unique = list.filter(function (s, i, a) { return a.indexOf(s) === i; });
    return Promise.all(unique.map(loadScript));
  }

  function reportFailed(results) {
    var failed = (results || []).filter(function (r) { return r && !r.ok; });
    if (failed.length && typeof window.notifyScriptLoadFailures === 'function') {
      window.notifyScriptLoadFailures(failed);
    }
    return failed;
  }

  function loadFormLibs() {
    if (window._formLibsReady) return window._formLibsReady;
    window._formLibsReady = loadSequential([
      'flatpickr.min.js',
      'flatpickr-fr.js',
      'choices.min.js',
      'form-controls.js'
    ]).then(function (results) {
      reportFailed(results);
      if (typeof window.enhanceFormControls === 'function') {
        window.enhanceFormControls(document);
      }
      if (window.bootMark) window.bootMark('boot.formLibs.done');
    });
    return window._formLibsReady;
  }

  window.ensureFormLibs = loadFormLibs;

  window.ensureScanner = function () {
    if (_lazyLoaded['scanner.js']) return Promise.resolve({ ok: true, name: 'scanner.js' });
    if (_lazyLoading.scanner) return _lazyLoading.scanner;
    _lazyLoading.scanner = loadScript('scanner.js').then(function (r) {
      delete _lazyLoading.scanner;
      reportFailed([r]);
      return r;
    });
    return _lazyLoading.scanner;
  };

  window.ensureScriptsForTab = function (tab) {
    var list = TAB_BUNDLES[tab];
    if (!list || !list.length) return Promise.resolve();
    var key = tab;
    if (_lazyLoading[key]) return _lazyLoading[key];
    if (window.bootMark) window.bootMark('lazy.tab.start', { tab: tab, files: list });
    _lazyLoading[key] = loadSequential(list).then(function (results) {
      reportFailed(results);
      if (window.bootMark) window.bootMark('lazy.tab.done', { tab: tab });
      delete _lazyLoading[key];
    });
    return _lazyLoading[key];
  };

  function loadAppModule() {
    if (window.bootProfiler) window.bootProfiler.scriptStart('app.js');
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.type = 'module';
      s.src = 'app.js?v=' + v;
      s.onload = function () {
        if (window.bootProfiler) window.bootProfiler.scriptEnd('app.js');
        resolve({ ok: true, name: 'app.js' });
      };
      s.onerror = function () {
        onScriptError('app.js');
        resolve({ ok: false, name: 'app.js', critical: true });
      };
      document.body.appendChild(s);
    });
  }

  function loadDeferredBackground() {
    loadParallel(DEFERRED_AFTER_BOOT).then(reportFailed);
    loadFormLibs();
  }

  window.bootLoadApplication = function () {
    if (typeof window.setBootStep === 'function') window.setBootStep('scripts');
    if (window.bootMark) window.bootMark('boot.loader.start');

    var bootFailures = [];

    function track(results) {
      (results || []).forEach(function (r) {
        if (r && !r.ok) bootFailures.push(r);
      });
    }

    return loadScript('ui-appearance.js')
      .then(function (r) { track([r]); })
      .then(function () { return loadScript('ui-components.js'); })
      .then(function (r) { track([r]); })
      .then(function () { return loadParallel(['cloud.js', 'data.js']); })
      .then(function (rs) { track(rs); })
      .then(function () { return loadScript('device-session.js'); })
      .then(function (r) { track([r]); })
      .then(function () {
        return loadParallel(['anki-algo.js', 'anki-algo-v2.js', 'nav-config.js']);
      })
      .then(function (rs) { track(rs); })
      .then(function () { return loadScript('anki-card-ui.js'); })
      .then(function (r) { track([r]); })
      .then(function () { return loadScript('anki-app-v2.js'); })
      .then(function (r) { track([r]); })
      .then(loadAppModule)
      .then(function (r) { track([r]); })
      .then(function () {
        if (window.bootMark) window.bootMark('boot.loader.scripts.done');
        if (bootFailures.length && typeof window.notifyScriptLoadFailures === 'function') {
          window.notifyScriptLoadFailures(bootFailures);
        }
        if (typeof window.checkSavedSession === 'function') {
          return window.checkSavedSession();
        }
      })
      .then(function () {
        loadDeferredBackground();
        if (window.bootMark) window.bootMark('boot.loader.complete');
      })
      .catch(function (err) {
        console.error('Boot loader:', err);
        if (window.bootMark) window.bootMark('boot.loader.error', { error: String(err && err.message ? err.message : err) });
        if (typeof window.sysAlert === 'function') {
          window.sysAlert(
            'Le chargement de l\'application a échoué : ' + window.escHtml(err && err.message ? err.message : err) + '.<br><br>Recharge la page.',
            'Erreur de démarrage'
          );
        }
      });
  };
})();
