/**
 * boot-loader.js — Chargement optimisé : parallèle, scripts différés, auth après app.js
 * Cache : window.__BOOT_CACHE_V (bump à chaque publish) — ne pas utiliser Date.now() à chaque visite.
 */
(function () {
  'use strict';

  var v = window.__BOOT_CACHE_V || window.__bootCacheV || '1';
  window.__bootCacheV = v;
  var _lazyLoaded = {};
  var _lazyLoading = {};
  var _scriptPromises = {};

  var CRITICAL_SCRIPTS = {
    'ui-appearance.js': true,
    'ui-components.js': true,
    'cloud.js': true,
    'device-session.js': true,
    'data.js': true,
    'profiles-io.js': true,
    'app.js': true
  };

  /** Bundles chargés à l'ouverture d'un onglet (pas au splash) */
  var TAB_BUNDLES = {
    flashcards: ['anki-quick.js'],
    /* app-v2 avant card-ui : le FAB (fin de card-ui) doit trouver les modales déjà définies */
    ankiV2: ['anki-app-v2.js', 'anki-card-ui.js'],
    ankiVizV2: ['anki-viz-v2.js'],
    print: ['scanner.js'],
    test: ['scanner.js'],
    latexTest: ['latex-test.js']
  };

  var DEFERRED_AFTER_BOOT = [
    'demo-data.js',
    'anki-smoke.js'
  ];

  var SCANNER_LIBS = [
    'JsBarcode.all.min.js',
    'html5-qrcode.js'
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

  function cacheV() {
    return window.__BOOT_CACHE_V || window.__bootCacheV || v || '1';
  }

  function loadScript(src) {
    var name = src.split('/').pop();
    if (_lazyLoaded[name]) return Promise.resolve({ ok: true, name: name });
    if (_scriptPromises[name]) return _scriptPromises[name];
    _scriptPromises[name] = new Promise(function (resolve) {
      if (window.bootProfiler) window.bootProfiler.scriptStart(name);
      var s = document.createElement('script');
      s.src = src + '?v=' + encodeURIComponent(cacheV());
      s.async = false;
      s.onload = function () {
        _lazyLoaded[name] = true;
        if (window.bootProfiler) window.bootProfiler.scriptEnd(name);
        resolve({ ok: true, name: name });
      };
      s.onerror = function () {
        /* Permettre un nouvel essai (réseau, etc.) */
        delete _scriptPromises[name];
        onScriptError(name);
        resolve({ ok: false, name: name, critical: isCritical(name) });
      };
      document.body.appendChild(s);
    });
    return _scriptPromises[name];
  }

  function loadSequential(list, stopOnFail) {
    return list.reduce(function (p, src) {
      return p.then(function (results) {
        if (stopOnFail && results.length && results[results.length - 1] && !results[results.length - 1].ok) {
          return results;
        }
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
      var failed = reportFailed(results);
      if (failed.length) {
        window._formLibsReady = null;
        return;
      }
      if (typeof window.enhanceFormControls === 'function') {
        window.enhanceFormControls(document);
      }
      if (window.bootMark) window.bootMark('boot.formLibs.done');
    });
    return window._formLibsReady;
  }

  window.ensureFormLibs = loadFormLibs;

  /** JsBarcode + html5-qrcode (hors head — ~430 Ko) */
  window.ensureScannerLibs = function () {
    if (window._scannerLibsReady) return window._scannerLibsReady;
    window._scannerLibsReady = loadParallel(SCANNER_LIBS).then(function (results) {
      var failed = reportFailed(results);
      if (failed.length) {
        window._scannerLibsReady = null;
      }
      return results;
    });
    return window._scannerLibsReady;
  };

  window.ensureScanner = function () {
    if (_lazyLoading.scannerBundle) return _lazyLoading.scannerBundle;
    _lazyLoading.scannerBundle = window.ensureScannerLibs().then(function () {
      return loadScript('scanner.js');
    }).then(function (r) {
      delete _lazyLoading.scannerBundle;
      reportFailed([r]);
      return r;
    });
    return _lazyLoading.scannerBundle;
  };

  /** UI Anki (card-ui + app-v2) — pas au splash ; algos restent en boot pour migrateData */
  window.ensureAnkiUi = function () {
    if (window._ankiUiReady) return window._ankiUiReady;
    if (_lazyLoading.ankiUi) return _lazyLoading.ankiUi;
    _lazyLoading.ankiUi = loadSequential(['anki-app-v2.js', 'anki-card-ui.js'], true).then(function (results) {
      reportFailed(results);
      delete _lazyLoading.ankiUi;
      var failed = (results || []).some(function (r) { return r && !r.ok; });
      if (failed) return;
      window._ankiUiReady = Promise.resolve();
      if (typeof window.ensureCardCreateFab === 'function') window.ensureCardCreateFab();
      if (typeof window.renderSyncSessionDock === 'function') window.renderSyncSessionDock();
    });
    return _lazyLoading.ankiUi;
  };

  window.ensureScriptsForTab = function (tab) {
    var list = TAB_BUNDLES[tab];
    if (!list || !list.length) return Promise.resolve();
    var key = tab;
    if (_lazyLoading[key]) return _lazyLoading[key];
    if (window.bootMark) window.bootMark('lazy.tab.start', { tab: tab, files: list });

    var prep = Promise.resolve();
    if (tab === 'print' || tab === 'test') {
      prep = window.ensureScannerLibs();
    }
    if (tab === 'ankiV2' || tab === 'flashcards') {
      prep = window.ensureAnkiUi();
    }

    _lazyLoading[key] = prep.then(function () {
      var toLoad = list.filter(function (src) {
        var name = src.split('/').pop();
        return !_lazyLoaded[name];
      });
      if (!toLoad.length) return [];
      return loadSequential(toLoad, tab === 'ankiV2');
    }).then(function (results) {
      reportFailed(results || []);
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
      s.src = 'app.js?v=' + encodeURIComponent(cacheV());
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
    /* Précharge Anki UI en fond après le splash (FAB + dock) sans bloquer le boot */
    setTimeout(function () {
      if (typeof window.ensureAnkiUi === 'function') window.ensureAnkiUi();
    }, 1200);
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

    return loadParallel(['ui-appearance.js', 'ui-components.js'])
      .then(function (rs) { track(rs); })
      .then(function () { return loadParallel(['cloud.js', 'data.js', 'nav-config.js']); })
      .then(function (rs) { track(rs); })
      .then(function () { return loadScript('profiles-io.js'); })
      .then(function (r) { track([r]); })
      .then(function () {
        return loadParallel(['device-session.js', 'anki-algo.js', 'anki-algo-v2.js']);
      })
      .then(function (rs) { track(rs); })
      .then(loadAppModule)
      .then(function (r) { track([r]); })
      .then(function () {
        if (window.bootMark) window.bootMark('boot.loader.scripts.done');
        if (bootFailures.length && typeof window.notifyScriptLoadFailures === 'function') {
          window.notifyScriptLoadFailures(bootFailures);
        }
        var fatal = bootFailures.some(function (r) {
          return r && r.critical;
        });
        if (fatal) {
          if (window.bootMark) window.bootMark('boot.loader.fatal', { failures: bootFailures });
          if (typeof window.forceLoginScreen === 'function') window.forceLoginScreen();
          return { fatal: true };
        }
        var next = typeof window.checkSavedSession === 'function'
          ? window.checkSavedSession()
          : Promise.resolve();
        return Promise.resolve(next).then(function () { return { fatal: false }; });
      })
      .then(function (result) {
        if (result && result.fatal) return;
        loadDeferredBackground();
        if (window.bootMark) window.bootMark('boot.loader.complete');
      })
      .catch(function (err) {
        console.error('Boot loader:', err);
        if (window.bootMark) window.bootMark('boot.loader.error', { error: String(err && err.message ? err.message : err) });
        var M = window.APP_MSG || {};
        if (typeof window.sysAlert === 'function') {
          window.sysAlert(
            'Le chargement de l\'application a échoué : ' + window.escHtml(err && err.message ? err.message : err) + '.<br><br>' + (M.RELOAD_SHORT || 'Recharge la page.'),
            M.BOOT_TITLE || 'Erreur de démarrage'
          );
        }
      });
  };
})();
