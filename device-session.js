/**
 * device-session.js — Présence multi-appareils + rôles Principal / Secondaire
 *
 * Règles métier (modifiables via CONFIG) :
 * - Pas de promotion automatique en Principal (ni au démarrage si déjà Secondaire,
 *   ni si le Primary disparaît).
 * - Préférence de rôle mémorisée localement ; changement uniquement via boutons.
 * - Statut affiché en texte (panneau Appareils connectés), pas de modal récurrent.
 * - Heartbeat + TTL : un onglet fermé disparaît de la liste sans basculer les autres.
 *
 * Mode local : toujours Principal, pas de présence cloud.
 */
(function () {
  'use strict';

  var CONFIG = {
    HEARTBEAT_MS: 15000,
    TTL_MS: 60000,
    STORAGE_DEVICE_ID: 'mc_device_id',
    STORAGE_ROLE_PREF: 'mc_device_role',
    PRESENCE_COLLECTION: 'presence',
    PRESENCE_DOC: 'hub',
    ROLES: { PRIMARY: 'primary', SECONDARY: 'secondary' }
  };

  var state = {
    started: false,
    userId: null,
    deviceId: null,
    label: '',
    preferredRole: null,
    effectiveRole: CONFIG.ROLES.PRIMARY,
    hub: null,
    unsubHub: null,
    unsubData: null,
    heartbeatTimer: null,
    listeners: [],
    firstRunHint: false
  };

  function now() { return Date.now(); }

  function esc(s) {
    return typeof window.escHtml === 'function'
      ? window.escHtml(s)
      : String(s == null ? '' : s);
  }

  function guessLabel() {
    try {
      var ua = navigator.userAgent || '';
      var mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
      var browser = /Edg\//.test(ua) ? 'Edge'
        : /Chrome\//.test(ua) ? 'Chrome'
        : /Safari\//.test(ua) && !/Chrome\//.test(ua) ? 'Safari'
        : /Firefox\//.test(ua) ? 'Firefox'
        : 'Navigateur';
      return (mobile ? 'Téléphone' : 'Ordinateur') + ' · ' + browser;
    } catch (e) {
      return 'Cet appareil';
    }
  }

  function getDeviceId() {
    if (state.deviceId) return state.deviceId;
    try {
      var id = localStorage.getItem(CONFIG.STORAGE_DEVICE_ID);
      if (!id) {
        id = (window.crypto && crypto.randomUUID)
          ? crypto.randomUUID()
          : 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(CONFIG.STORAGE_DEVICE_ID, id);
      }
      state.deviceId = id;
      return id;
    } catch (e) {
      state.deviceId = 'dev-fallback-' + String(now());
      return state.deviceId;
    }
  }

  function readPreferredRole() {
    try {
      var v = localStorage.getItem(CONFIG.STORAGE_ROLE_PREF);
      if (v === CONFIG.ROLES.PRIMARY || v === CONFIG.ROLES.SECONDARY) return v;
    } catch (e) { /* ignore */ }
    return null;
  }

  function writePreferredRole(role) {
    if (role !== CONFIG.ROLES.PRIMARY && role !== CONFIG.ROLES.SECONDARY) return;
    try { localStorage.setItem(CONFIG.STORAGE_ROLE_PREF, role); } catch (e) { /* ignore */ }
    state.preferredRole = role;
  }

  function presenceRef() {
    if (!window.db || !window.doc || !state.userId) return null;
    return window.doc(
      window.db,
      'utilisateurs',
      state.userId,
      CONFIG.PRESENCE_COLLECTION,
      CONFIG.PRESENCE_DOC
    );
  }

  function isFresh(ts) {
    if (!ts) return false;
    return (now() - Number(ts)) <= CONFIG.TTL_MS;
  }

  function livingDevices(hub) {
    var devices = (hub && hub.devices) || {};
    var out = [];
    Object.keys(devices).forEach(function (id) {
      var d = devices[id];
      if (!d || !isFresh(d.lastSeen)) return;
      out.push({
        deviceId: id,
        label: d.label || id,
        role: d.role || CONFIG.ROLES.SECONDARY,
        lastSeen: d.lastSeen,
        self: id === getDeviceId()
      });
    });
    out.sort(function (a, b) {
      if (a.self !== b.self) return a.self ? -1 : 1;
      return (b.lastSeen || 0) - (a.lastSeen || 0);
    });
    return out;
  }

  function remotePrimaryAlive(hub) {
    if (!hub || !hub.primaryDeviceId) return null;
    if (!isFresh(hub.primaryUpdatedAt)) return null;
    var devices = hub.devices || {};
    var d = devices[hub.primaryDeviceId];
    if (d && !isFresh(d.lastSeen)) return null;
    return hub.primaryDeviceId;
  }

  function computeEffectiveRole(hub) {
    var pref = state.preferredRole || CONFIG.ROLES.PRIMARY;
    if (pref === CONFIG.ROLES.SECONDARY) return CONFIG.ROLES.SECONDARY;
    var remotePrimary = remotePrimaryAlive(hub);
    if (remotePrimary && remotePrimary !== getDeviceId()) {
      return CONFIG.ROLES.SECONDARY;
    }
    return CONFIG.ROLES.PRIMARY;
  }

  function getStatus() {
    var hub = state.hub || { devices: {}, primaryDeviceId: null, primaryUpdatedAt: 0 };
    var devices = livingDevices(hub);
    var remotePrimary = remotePrimaryAlive(hub);
    var primaryLabel = null;
    if (remotePrimary) {
      var match = devices.filter(function (d) { return d.deviceId === remotePrimary; })[0];
      primaryLabel = match ? match.label : remotePrimary;
    }
    return {
      enabled: state.started && !window.isLocalMode,
      deviceId: getDeviceId(),
      label: state.label,
      preferredRole: state.preferredRole,
      effectiveRole: state.effectiveRole,
      isPrimary: state.effectiveRole === CONFIG.ROLES.PRIMARY,
      isSecondary: state.effectiveRole === CONFIG.ROLES.SECONDARY,
      devices: devices,
      primaryDeviceId: remotePrimary,
      primaryLabel: primaryLabel,
      primaryAlive: !!remotePrimary,
      weAreClaimedPrimary: remotePrimary === getDeviceId(),
      firstRunHint: state.firstRunHint,
      ttlMs: CONFIG.TTL_MS
    };
  }

  function emit() {
    var snap = getStatus();
    state.listeners.forEach(function (fn) {
      try { fn(snap); } catch (e) { console.error('DeviceSession listener', e); }
    });
    if (typeof window.renderDeviceSessionPanel === 'function') window.renderDeviceSessionPanel(snap);
    if (typeof window.applyDeviceRoleUi === 'function') window.applyDeviceRoleUi(snap);
  }

  function buildHubWrite(partialDevices, claimPrimary, releasePrimary) {
    var hub = state.hub ? JSON.parse(JSON.stringify(state.hub)) : {
      devices: {},
      primaryDeviceId: null,
      primaryUpdatedAt: 0
    };
    if (!hub.devices) hub.devices = {};
    var id = getDeviceId();
    var prev = hub.devices[id] || {};
    hub.devices[id] = Object.assign({}, prev, partialDevices || {}, {
      label: state.label,
      lastSeen: now(),
      userAgent: (navigator.userAgent || '').slice(0, 180)
    });

    if (claimPrimary) {
      hub.primaryDeviceId = id;
      hub.primaryUpdatedAt = now();
      hub.devices[id].role = CONFIG.ROLES.PRIMARY;
    } else if (releasePrimary && hub.primaryDeviceId === id) {
      hub.primaryDeviceId = null;
      hub.primaryUpdatedAt = 0;
      hub.devices[id].role = CONFIG.ROLES.SECONDARY;
    } else {
      hub.devices[id].role = state.preferredRole || CONFIG.ROLES.SECONDARY;
      if (hub.primaryDeviceId === id) {
        hub.primaryUpdatedAt = now();
        hub.devices[id].role = CONFIG.ROLES.PRIMARY;
      }
    }
    hub.updatedAt = now();
    return hub;
  }

  function writeHub(hub) {
    var ref = presenceRef();
    if (!ref || !window.setDoc) return Promise.resolve();
    return window.setDoc(ref, hub).then(function () {
      state.hub = hub;
    }).catch(function (err) {
      console.warn('DeviceSession presence write:', err);
    });
  }

  function refreshEffectiveFromHub() {
    var next = computeEffectiveRole(state.hub);
    var changed = next !== state.effectiveRole;
    state.effectiveRole = next;
    if (changed) emit();
    else if (typeof window.renderDeviceSessionPanel === 'function') {
      window.renderDeviceSessionPanel(getStatus());
    }
  }

  function heartbeat() {
    if (!state.started || window.isLocalMode) return;
    if (document.visibilityState && document.visibilityState !== 'visible') return;

    var wantClaim = state.preferredRole === CONFIG.ROLES.PRIMARY
      && state.effectiveRole === CONFIG.ROLES.PRIMARY;
    var remotePrimary = remotePrimaryAlive(state.hub);
    if (wantClaim && remotePrimary && remotePrimary !== getDeviceId()) {
      wantClaim = false;
    }

    var hub = buildHubWrite({
      role: state.effectiveRole
    }, wantClaim && (!remotePrimary || remotePrimary === getDeviceId()), false);

    writeHub(hub).then(function () { refreshEffectiveFromHub(); });
  }

  function onHubSnapshot(snap) {
    if (snap && snap.exists && snap.exists()) {
      state.hub = snap.data() || { devices: {} };
    } else {
      state.hub = { devices: {}, primaryDeviceId: null, primaryUpdatedAt: 0 };
    }
    refreshEffectiveFromHub();
    emit();
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeat();
    state.heartbeatTimer = setInterval(heartbeat, CONFIG.HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
  }

  function markOfflineBestEffort() {
    if (!state.started || window.isLocalMode) return;
    try {
      var hub = buildHubWrite({ role: 'offline', lastSeen: now() - CONFIG.TTL_MS - 1000 }, false, true);
      var ref = presenceRef();
      if (ref && window.setDoc) window.setDoc(ref, hub);
    } catch (e) { /* best-effort */ }
  }

  function onVisibility() {
    if (document.visibilityState === 'visible') heartbeat();
  }

  function bindPageLifecycle() {
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', markOfflineBestEffort);
  }

  function unbindPageLifecycle() {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', markOfflineBestEffort);
  }

  function start(userId) {
    if (state.started) stop();

    state.userId = userId || null;
    state.label = guessLabel();
    getDeviceId();

    if (window.isLocalMode || !userId) {
      state.started = true;
      state.preferredRole = CONFIG.ROLES.PRIMARY;
      state.effectiveRole = CONFIG.ROLES.PRIMARY;
      state.hub = null;
      emit();
      return Promise.resolve(getStatus());
    }

    var pref = readPreferredRole();
    if (!pref) {
      pref = CONFIG.ROLES.PRIMARY;
      writePreferredRole(pref);
      state.firstRunHint = true;
    } else {
      state.preferredRole = pref;
      state.firstRunHint = false;
    }

    state.started = true;
    state.effectiveRole = computeEffectiveRole(state.hub);

    var ref = presenceRef();
    if (ref && window.onSnapshot) {
      state.unsubHub = window.onSnapshot(ref, onHubSnapshot, function (err) {
        console.warn('DeviceSession presence listen:', err);
      });
    } else if (ref && window.getDoc) {
      window.getDoc(ref).then(function (snap) {
        onHubSnapshot(snap);
        startHeartbeat();
      }).catch(function () {
        state.hub = { devices: {}, primaryDeviceId: null, primaryUpdatedAt: 0 };
        startHeartbeat();
        emit();
      });
      bindPageLifecycle();
      return Promise.resolve(getStatus());
    }

    startHeartbeat();
    bindPageLifecycle();
    emit();
    return Promise.resolve(getStatus());
  }

  function stop() {
    stopHeartbeat();
    unbindPageLifecycle();
    if (typeof state.unsubHub === 'function') {
      try { state.unsubHub(); } catch (e) { /* ignore */ }
      state.unsubHub = null;
    }
    if (typeof state.unsubData === 'function') {
      try { state.unsubData(); } catch (e) { /* ignore */ }
      state.unsubData = null;
    }
    state.started = false;
  }

  function claimPrimary() {
    writePreferredRole(CONFIG.ROLES.PRIMARY);
    state.firstRunHint = false;
    state.effectiveRole = CONFIG.ROLES.PRIMARY;
    var hub = buildHubWrite({ role: CONFIG.ROLES.PRIMARY }, true, false);
    return writeHub(hub).then(function () {
      emit();
      return getStatus();
    });
  }

  function switchToSecondary() {
    writePreferredRole(CONFIG.ROLES.SECONDARY);
    state.firstRunHint = false;
    state.effectiveRole = CONFIG.ROLES.SECONDARY;
    var hub = buildHubWrite({ role: CONFIG.ROLES.SECONDARY }, false, true);
    return writeHub(hub).then(function () {
      emit();
      return getStatus();
    });
  }

  function canFullSave() {
    if (window.isLocalMode) return true;
    if (!state.started) return true;
    return state.effectiveRole === CONFIG.ROLES.PRIMARY;
  }

  function canSecondaryPatch() {
    if (window.isLocalMode) return false;
    return state.started && state.effectiveRole === CONFIG.ROLES.SECONDARY;
  }

  function onChange(fn) {
    if (typeof fn === 'function') state.listeners.push(fn);
    return function () {
      state.listeners = state.listeners.filter(function (f) { return f !== fn; });
    };
  }

  function saveSecondaryPatch(mutator) {
    if (!canSecondaryPatch()) {
      return Promise.reject(new Error('Patch secondaire indisponible'));
    }
    if (!window.docRef || !window.getDoc || !window.setDoc) {
      return Promise.reject(new Error('Cloud indisponible'));
    }
    return window.getDoc(window.docRef).then(function (snap) {
      var data = snap.exists() ? (snap.data() || {}) : (window.D ? JSON.parse(JSON.stringify(window.D)) : {});
      if (!data.meta) data.meta = {};
      mutator(data);
      data.meta.revision = (Number(data.meta.revision) || 0) + 1;
      data.meta.updatedAt = now();
      data.meta.updatedBy = getDeviceId();
      data.meta.updatedByRole = CONFIG.ROLES.SECONDARY;
      return window.setDoc(window.docRef, data).then(function () {
        window.D = data;
        try { localStorage.setItem('backup_local_cours', JSON.stringify(data)); } catch (e) { /* ignore */ }
        return data;
      });
    });
  }

  function watchUserData(docRef) {
    if (typeof state.unsubData === 'function') {
      try { state.unsubData(); } catch (e) { /* ignore */ }
      state.unsubData = null;
    }
    if (!docRef || !window.onSnapshot || window.isLocalMode) return;

    state.unsubData = window.onSnapshot(docRef, function (snap) {
      if (!snap.exists()) return;
      if (state.effectiveRole !== CONFIG.ROLES.SECONDARY) return;
      var data = snap.data();
      if (!data) return;
      window.D = data;
      try { localStorage.setItem('backup_local_cours', JSON.stringify(data)); } catch (e) { /* ignore */ }
      if (typeof window.renderDeviceSecondarySession === 'function') {
        window.renderDeviceSecondarySession();
      }
    }, function (err) {
      console.warn('DeviceSession data listen:', err);
    });
  }

  window.DeviceSession = {
    CONFIG: CONFIG,
    start: start,
    stop: stop,
    getStatus: getStatus,
    getDeviceId: getDeviceId,
    claimPrimary: claimPrimary,
    switchToSecondary: switchToSecondary,
    canFullSave: canFullSave,
    canSecondaryPatch: canSecondaryPatch,
    saveSecondaryPatch: saveSecondaryPatch,
    watchUserData: watchUserData,
    onChange: onChange,
    isPrimary: function () { return getStatus().isPrimary; },
    isSecondary: function () { return getStatus().isSecondary; }
  };

  window.renderDeviceSessionPanel = function (status) {
    var roots = [
      document.getElementById('deviceSessionPanel'),
      document.getElementById('deviceSessionPanelLite')
    ];
    status = status || (window.DeviceSession && window.DeviceSession.getStatus());
    if (!status) return;

    roots.forEach(function (root) {
      if (!root) return;
      root.innerHTML = buildPanelHtml(status);
      if (typeof window.hydrateIcons === 'function') window.hydrateIcons(root);
      bindPanelButtons(root);
    });

    var chip = document.getElementById('deviceRoleChip');
    if (chip) {
      if (!status.enabled) {
        chip.hidden = true;
      } else {
        chip.hidden = false;
        chip.textContent = status.isPrimary ? 'Principal' : 'Secondaire';
        chip.classList.toggle('device-role-chip--primary', status.isPrimary);
        chip.classList.toggle('device-role-chip--secondary', status.isSecondary);
        chip.title = status.isPrimary
          ? 'Cet appareil est en mode Principal (écriture complète)'
          : 'Cet appareil est en mode simplifié (Secondaire)';
      }
    }
  };

  function buildPanelHtml(status) {
    if (!status.enabled) {
      return '<p class="device-session-muted">Mode local : un seul appareil, rôle Principal.</p>';
    }

    var roleTxt = status.isPrimary ? 'Principal' : 'Secondaire';
    var primaryTxt = status.primaryAlive
      ? ('Principal actif : <b>' + esc(status.primaryLabel || status.primaryDeviceId) + '</b>')
      : '<span class="device-session-warn">Aucun appareil principal actif</span>';

    var list = (status.devices || []).map(function (d) {
      var tag = d.self ? ' (cet appareil)' : '';
      var role = d.role === 'primary' ? 'Principal' : (d.role === 'offline' ? 'Hors ligne' : 'Secondaire');
      var age = Math.max(0, Math.round((now() - d.lastSeen) / 1000));
      return '<li><span class="device-session-dev-label">' + esc(d.label) + tag +
        '</span> <span class="device-session-dev-meta">' + esc(role) + ' · vu il y a ' + age + 's</span></li>';
    }).join('');

    if (!list) {
      list = '<li class="device-session-muted">Aucun autre appareil détecté pour l’instant.</li>';
    }

    var hint = status.firstRunHint
      ? '<p class="device-session-hint">Tu peux garder cet appareil en Principal, ou passer en mode simplifié pour scanner / consulter depuis un second écran.</p>'
      : '';

    var actions = status.isSecondary
      ? '<button type="button" class="bp device-session-btn" data-device-action="claim">Devenir principal</button>'
      : '<button type="button" class="bs device-session-btn" data-device-action="secondary">Passer en mode simplifié</button>';

    return (
      '<div class="device-session-status">' +
        '<div class="device-session-role">Cet appareil : <b>' + esc(roleTxt) + '</b></div>' +
        '<div class="device-session-primary-line">' + primaryTxt + '</div>' +
        hint +
        '<ul class="device-session-list">' + list + '</ul>' +
        '<div class="device-session-actions">' + actions + '</div>' +
      '</div>'
    );
  }

  function bindPanelButtons(root) {
    var claim = root.querySelector('[data-device-action="claim"]');
    var sec = root.querySelector('[data-device-action="secondary"]');
    if (claim) {
      claim.addEventListener('click', function () {
        window.DeviceSession.claimPrimary().then(function () {
          if (typeof window.applyDeviceRoleUi === 'function') {
            window.applyDeviceRoleUi(window.DeviceSession.getStatus());
          }
        });
      });
    }
    if (sec) {
      sec.addEventListener('click', function () {
        window.DeviceSession.switchToSecondary().then(function () {
          if (typeof window.applyDeviceRoleUi === 'function') {
            window.applyDeviceRoleUi(window.DeviceSession.getStatus());
          }
        });
      });
    }
  }

  window.applyDeviceRoleUi = function (status) {
    status = status || (window.DeviceSession && window.DeviceSession.getStatus());
    if (!status) return;
    var secondary = !!(status.enabled && status.isSecondary);
    document.body.classList.toggle('device-role-secondary', secondary);
    document.body.classList.toggle('device-role-primary', !secondary);

    var shell = document.getElementById('deviceSecondaryShell');
    if (shell) {
      shell.hidden = !secondary;
      shell.setAttribute('aria-hidden', secondary ? 'false' : 'true');
    }

    if (secondary) {
      if (typeof window.renderDeviceSecondarySession === 'function') {
        window.renderDeviceSecondarySession();
      }
      if (window.docRef && window.DeviceSession.watchUserData) {
        window.DeviceSession.watchUserData(window.docRef);
      }
    }

    window.renderDeviceSessionPanel(status);
  };

  window.renderDeviceSecondarySession = function () {
    var el = document.getElementById('deviceLiteSession');
    if (!el || !window.D) return;
    var sess = window.D.sessionEnCoursV2 || window.D.sessionEnCours || null;
    if (!sess || !sess.queue || !sess.queue.length) {
      el.innerHTML = '<p class="device-session-muted">Aucune session Synchrotron en cours sur le Principal.</p>';
      return;
    }
    var done = Number(sess.doneCount || sess.index || 0);
    var total = sess.queue.length;
    var cur = sess.queue[Math.min(done, total - 1)];
    var title = cur && (cur.titre || cur.question || cur.id)
      ? (cur.titre || String(cur.question || cur.id).slice(0, 80))
      : 'Carte en cours';
    el.innerHTML =
      '<div class="device-lite-session-card">' +
        '<div class="device-lite-session-label">Session en cours</div>' +
        '<div class="device-lite-session-progress">' + esc(String(done)) + ' / ' + esc(String(total)) + '</div>' +
        '<div class="device-lite-session-title">' + esc(title) + '</div>' +
        '<p class="device-session-muted">Lecture seule — les réponses se font sur l’appareil Principal.</p>' +
      '</div>';
  };

  window.deviceLiteSearch = function () {
    var input = document.getElementById('deviceLiteSearchInput');
    if (!input || !window.D || !window.D.cours) return;
    var q = String(input.value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!q) {
      if (typeof window.sysAlert === 'function') {
        window.sysAlert('Entre un code (ex. PH-8X2) ou une partie du titre.', 'Recherche');
      }
      return;
    }
    var qNorm = q.replace(/-/g, '');
    var byUid = window.D.cours.find(function (c) {
      var uid = String(c.uid || '').toUpperCase();
      return uid === q || uid.replace(/-/g, '').indexOf(qNorm) >= 0;
    });
    if (byUid) {
      if (typeof window.doLocate === 'function') window.doLocate(byUid.uid);
      return;
    }
    var byTitle = window.D.cours.find(function (c) {
      return String(c.title || '').toUpperCase().indexOf(q) >= 0;
    });
    if (byTitle) {
      if (typeof window.doLocate === 'function') window.doLocate(byTitle.uid);
      return;
    }
    if (typeof window.sysAlert === 'function') {
      window.sysAlert('Aucun document trouvé pour « ' + esc(q) + ' ».', 'Recherche');
    }
  };
})();
