/**
 * tab-lock.js — Un seul onglet actif par profil (même navigateur).
 *
 * Au démarrage, l’onglet demande (ping) si un autre onglet détient déjà le
 * profil. Si oui : lecture seule + « Prendre la main ». Prendre la main recharge
 * la page (données fraîches) puis annonce la prise (claim) ; l’ancien onglet
 * envoie ses données au cloud et passe en lecture seule.
 * Transport : BroadcastChannel, repli sur l’événement « storage ».
 */
(function () {
  'use strict';

  var CHANNEL = 'mes-cours-tabs';
  var MSG_KEY = 'mc_tab_msg';
  var OWNER_PREFIX = 'mc_tab_owner__';
  var TAKEOVER_KEY = 'mc_tab_takeover';
  var PING_WAIT_MS = 350;
  var HEARTBEAT_MS = 2000;
  var OWNER_STALE_MS = 7000;
  var YIELD_WAIT_MS = 3500;

  var tabId = 'T' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  var state = {
    profileId: null,
    status: 'idle', // idle | owner | locked | lost
    heartbeat: null,
    pongWaiters: [],
    yieldWaiters: []
  };
  var bc = null;
  try {
    if (typeof BroadcastChannel === 'function') bc = new BroadcastChannel(CHANNEL);
  } catch (e) { bc = null; }

  function lsGet(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, v); return true; } catch (e) { return false; }
  }
  function lsRemove(k) {
    try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
  }
  function ssGet(k) {
    try { return sessionStorage.getItem(k); } catch (e) { return null; }
  }
  function ssSet(k, v) {
    try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ }
  }
  function ssRemove(k) {
    try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ }
  }

  function post(msg) {
    msg.from = tabId;
    msg.at = Date.now();
    if (bc) {
      try { bc.postMessage(msg); return; } catch (e) { /* repli storage */ }
    }
    lsSet(MSG_KEY, JSON.stringify(msg));
    lsRemove(MSG_KEY);
  }

  function ownerKey(pid) { return OWNER_PREFIX + pid; }

  function readOwner(pid) {
    try {
      var o = JSON.parse(lsGet(ownerKey(pid)) || 'null');
      return o && o.tabId ? o : null;
    } catch (e) { return null; }
  }

  function writeOwner() {
    if (state.status !== 'owner' || !state.profileId) return;
    if (!checkStillOwner()) return;
    lsSet(ownerKey(state.profileId), JSON.stringify({ tabId: tabId, at: Date.now() }));
  }

  /** Onglet gelé / restauré qui a manqué le « claim » : la clé propriétaire fait foi. */
  function checkStillOwner() {
    if (state.status !== 'owner' || !state.profileId) return state.status === 'owner';
    var o = readOwner(state.profileId);
    if (o && o.tabId !== tabId) {
      loseOwnership('owner-key-taken');
      return false;
    }
    return true;
  }

  function loseOwnership(reason) {
    state.status = 'lost';
    stopHeartbeat();
    var o = readOwner(state.profileId);
    if (o && o.tabId === tabId) lsRemove(ownerKey(state.profileId));
    event('TAB_LOCKED', { reason: reason });
    if (typeof window.flushCloudOnHide === 'function') {
      try { window.flushCloudOnHide('tab-lost'); } catch (e) { /* ignore */ }
    }
    showOverlay('lost');
  }

  function afterSaves() {
    function settle(chain) {
      return chain && typeof chain.then === 'function'
        ? chain.then(function () {}, function () {})
        : Promise.resolve();
    }
    var both = Promise.all([settle(window._saveLocalChain), settle(window._saveCloudChain)]);
    return Promise.race([both, new Promise(function (r) { setTimeout(r, YIELD_WAIT_MS); })]);
  }

  function event(code, detail) {
    if (typeof window.recordDataEvent === 'function') {
      try { window.recordDataEvent(code, detail); } catch (e) { /* ignore */ }
    }
  }

  function becomeOwner() {
    state.status = 'owner';
    lsSet(ownerKey(state.profileId), JSON.stringify({ tabId: tabId, at: Date.now() }));
    if (state.heartbeat) clearInterval(state.heartbeat);
    state.heartbeat = setInterval(writeOwner, HEARTBEAT_MS);
    post({ type: 'claim', pid: state.profileId });
    hideOverlay();
  }

  function stopHeartbeat() {
    if (state.heartbeat) clearInterval(state.heartbeat);
    state.heartbeat = null;
  }

  function onMessage(msg) {
    if (!msg || msg.from === tabId || !state.profileId || msg.pid !== state.profileId) return;
    if (msg.type === 'ping' && state.status === 'owner') {
      post({ type: 'pong', pid: state.profileId });
      return;
    }
    if (msg.type === 'pong') {
      var waiters = state.pongWaiters.slice();
      state.pongWaiters.length = 0;
      waiters.forEach(function (fn) { fn(true); });
      return;
    }
    if (msg.type === 'yielded') {
      var yw = state.yieldWaiters.slice();
      state.yieldWaiters.length = 0;
      yw.forEach(function (fn) { fn(); });
      return;
    }
    if (msg.type === 'claim' && state.status === 'owner') {
      loseOwnership('claimed-by-other-tab');
      afterSaves().then(function () {
        post({ type: 'yielded', pid: state.profileId });
      });
    }
  }

  if (bc) {
    bc.onmessage = function (ev) { onMessage(ev && ev.data); };
  }
  window.addEventListener('storage', function (ev) {
    if (!ev || ev.key !== MSG_KEY || !ev.newValue) return;
    try { onMessage(JSON.parse(ev.newValue)); } catch (e) { /* ignore */ }
  });

  window.addEventListener('pagehide', function () {
    if (state.status !== 'owner' || !state.profileId) return;
    var o = readOwner(state.profileId);
    if (o && o.tabId === tabId) lsRemove(ownerKey(state.profileId));
    post({ type: 'release', pid: state.profileId });
  });

  /* Retour via l’historique (bfcache) : la clé a été rendue au pagehide et les données
     en mémoire peuvent être périmées → rechargement complet. */
  window.addEventListener('pageshow', function (ev) {
    if (!ev || !ev.persisted || !state.profileId || state.status === 'idle') return;
    try { location.reload(); } catch (e) { /* ignore */ }
  });

  function askOwner() {
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) {
        if (done) return;
        done = true;
        resolve(v);
      }
      state.pongWaiters.push(finish);
      post({ type: 'ping', pid: state.profileId });
      setTimeout(function () { finish(false); }, PING_WAIT_MS);
    });
  }

  /** Démarre le verrou pour le profil de la session. Résout le statut final. */
  function start(profileId) {
    state.profileId = profileId || 'default';
    if (ssGet(TAKEOVER_KEY) === state.profileId) {
      ssRemove(TAKEOVER_KEY);
      becomeOwner();
      event('TAB_TAKEOVER', { profileId: state.profileId });
      return Promise.resolve(state.status);
    }
    return askOwner().then(function (answered) {
      var owner = readOwner(state.profileId);
      var ownerAlive = owner && owner.tabId !== tabId && (Date.now() - Number(owner.at || 0)) < OWNER_STALE_MS;
      if (answered || (!bc && ownerAlive)) {
        state.status = 'locked';
        event('TAB_LOCKED', { reason: 'already-open', profileId: state.profileId });
        showOverlay('locked');
      } else {
        becomeOwner();
      }
      return state.status;
    });
  }

  /**
   * Annonce la prise avant de recharger : l’ancien onglet passe en lecture seule,
   * termine ses écritures locales puis répond « yielded ». Le rechargement lit
   * donc ses dernières données.
   */
  function takeOver() {
    if (!state.profileId) return Promise.resolve();
    ssSet(TAKEOVER_KEY, state.profileId);
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        resolve();
      }
      state.yieldWaiters.push(finish);
      post({ type: 'claim', pid: state.profileId });
      setTimeout(finish, YIELD_WAIT_MS + 300);
    }).then(function () {
      try { location.reload(); } catch (e) { /* ignore */ }
    });
  }

  function isReadOnly() {
    if (state.status === 'owner') checkStillOwner();
    return state.status === 'locked' || state.status === 'lost';
  }

  var overlayEl = null;
  function hideOverlay() {
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = null;
  }

  function showOverlay(kind) {
    if (typeof document === 'undefined' || !document.body) return;
    hideOverlay();
    var title = kind === 'lost'
      ? 'Ce profil a été ouvert dans un autre onglet'
      : 'Ce profil est déjà ouvert dans un autre onglet';
    var text = kind === 'lost'
      ? 'Tes modifications de cet onglet sont enregistrées. Pour éviter tout conflit, cet onglet est maintenant en lecture seule.'
      : 'Pour éviter que deux onglets s’écrasent mutuellement, celui-ci est en lecture seule tant que l’autre est ouvert.';
    var el = document.createElement('div');
    el.id = 'tabLockOverlay';
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-modal', 'true');
    el.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;'
      + 'background:rgba(8,10,16,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);padding:20px;';
    var box = document.createElement('div');
    box.style.cssText = 'max-width:440px;width:100%;background:var(--bg2,#1b1f2a);color:var(--text,#e8ecf3);'
      + 'border:1px solid var(--border,rgba(255,255,255,.12));border-radius:16px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.45);'
      + 'font-family:inherit;';
    var h = document.createElement('h3');
    h.textContent = title;
    h.style.cssText = 'margin:0 0 10px;font-size:1.1rem;';
    var p = document.createElement('p');
    p.textContent = text;
    p.style.cssText = 'margin:0 0 18px;line-height:1.45;opacity:.85;';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'tabLockTakeover';
    btn.className = 'bp';
    btn.textContent = 'Prendre la main ici';
    btn.onclick = takeOver;
    box.appendChild(h);
    box.appendChild(p);
    box.appendChild(btn);
    el.appendChild(box);
    document.body.appendChild(el);
    overlayEl = el;
  }

  window.TabLock = {
    start: start,
    takeOver: takeOver,
    isReadOnly: isReadOnly,
    getState: function () { return state.status; },
    getTabId: function () { return tabId; },
    _onMessage: onMessage
  };
})();
