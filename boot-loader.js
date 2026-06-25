/**
 * boot-loader.js — Chargement optimisé : parallèle, scripts différés, auth après app.js
 */
(function () {
  'use strict';

  var v = window.__bootCacheV || String(Date.now());
  var _lazyLoaded = {};
  var _lazyLoading = {};

  var TAB_BUNDLES = {
    flashcards: ['anki-quick.js'],
    anki: ['anki-app.js'],
    ankiViz: ['anki-viz.js'],
    ankiVizV2: ['anki-viz-v2.js'],
    ankiCompare: ['anki-viz-compare.js'],
    print: ['scanner.js'],
    cours: ['scanner.js'],
    test: ['scanner.js']
  };

  var DEFERRED_AFTER_BOOT = [
    'demo-pcstar.js',
    'anki-smoke.js'
  ];

  function loadScript(src) {
    var name = src.split('/').pop();
    if (_lazyLoaded[name]) return Promise.resolve();
    return new Promise(function (resolve) {
      if (window.bootProfiler) window.bootProfiler.scriptStart(name);
      var s = document.createElement('script');
      s.src = src + '?v=' + v;
      s.async = false;
      s.onload = function () {
        _lazyLoaded[name] = true;
        if (window.bootProfiler) window.bootProfiler.scriptEnd(name);
        resolve();
      };
      s.onerror = function () {
        if (window.bootProfiler) window.bootProfiler.scriptError(name);
        resolve();
      };
      document.body.appendChild(s);
    });
  }

  function loadSequential(list) {
    return list.reduce(function (p, src) {
      return p.then(function () { return loadScript(src); });
    }, Promise.resolve());
  }

  function loadParallel(list) {
    var unique = list.filter(function (s, i, a) { return a.indexOf(s) === i; });
    return Promise.all(unique.map(loadScript));
  }

  function loadFormLibs() {
    if (window._formLibsReady) return window._formLibsReady;
    window._formLibsReady = loadSequential([
      'flatpickr.min.js',
      'flatpickr-fr.js',
      'choices.min.js',
      'form-controls.js'
    ]).then(function () {
      if (typeof window.enhanceFormControls === 'function') {
        window.enhanceFormControls(document);
      }
      if (window.bootMark) window.bootMark('boot.formLibs.done');
    });
    return window._formLibsReady;
  }

  window.ensureFormLibs = loadFormLibs;

  window.ensureScriptsForTab = function (tab) {
    var list = TAB_BUNDLES[tab];
    if (!list || !list.length) return Promise.resolve();
    var key = tab;
    if (_lazyLoading[key]) return _lazyLoading[key];
    if (window.bootMark) window.bootMark('lazy.tab.start', { tab: tab, files: list });
    _lazyLoading[key] = loadSequential(list).then(function () {
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
        resolve();
      };
      s.onerror = function () {
        if (window.bootProfiler) window.bootProfiler.scriptError('app.js');
        resolve();
      };
      document.body.appendChild(s);
    });
  }

  function loadDeferredBackground() {
    loadParallel(DEFERRED_AFTER_BOOT);
    loadFormLibs();
  }

  window.bootLoadApplication = function () {
    if (typeof window.setBootStep === 'function') window.setBootStep('scripts');
    if (window.bootMark) window.bootMark('boot.loader.start');

    return loadScript('ui-appearance.js')
      .then(function () { return loadParallel(['cloud.js', 'data.js']); })
      .then(function () {
        return loadParallel(['anki-algo.js', 'anki-algo-v2.js', 'nav-config.js']);
      })
      .then(function () { return loadScript('anki-card-ui.js'); })
      .then(function () { return loadScript('anki-app-v2.js'); })
      .then(loadAppModule)
      .then(function () {
        if (window.bootMark) window.bootMark('boot.loader.scripts.done');
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
      });
  };
})();
