/**
 * device-session.js — Présence multi-appareils Principal / Secondaire
 *
 * - Premier appareil ouvert = Principal (garde la priorité).
 * - Appareil suivant = popup de choix (simplifié / prendre le contrôle).
 * - Les écritures secondaires ne touchent JAMAIS primary*.
 * - Heartbeat Primary rafraîchit le lease même hors focus.
 */
(function () {
  'use strict';

  var CONFIG = {
    HEARTBEAT_MS: 10000,
    TTL_MS: 45000,
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
    joinResolved: false,
    needsRoleChoice: false,
    controlStolen: false,
    myClaimedAt: null
  };

  var _writeChain = Promise.resolve();
  var _claimInFlight = false;

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
    var id = typeof window.safeLocalGet === 'function'
      ? window.safeLocalGet(CONFIG.STORAGE_DEVICE_ID)
      : (function () { try { return localStorage.getItem(CONFIG.STORAGE_DEVICE_ID); } catch (e) { return null; } })();
    if (!id) {
      id = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      if (typeof window.safeLocalSet === 'function') window.safeLocalSet(CONFIG.STORAGE_DEVICE_ID, id);
      else try { localStorage.setItem(CONFIG.STORAGE_DEVICE_ID, id); } catch (e) {}
    }
    state.deviceId = id;
    return id;
  }

  function readPreferredRole() {
    var v = typeof window.safeLocalGet === 'function'
      ? window.safeLocalGet(CONFIG.STORAGE_ROLE_PREF)
      : (function () { try { return localStorage.getItem(CONFIG.STORAGE_ROLE_PREF); } catch (e) { return null; } })();
    if (v === CONFIG.ROLES.PRIMARY || v === CONFIG.ROLES.SECONDARY) return v;
    return null;
  }

  function writePreferredRole(role) {
    if (role !== CONFIG.ROLES.PRIMARY && role !== CONFIG.ROLES.SECONDARY) return;
    if (typeof window.safeLocalSet === 'function') window.safeLocalSet(CONFIG.STORAGE_ROLE_PREF, role);
    else try { localStorage.setItem(CONFIG.STORAGE_ROLE_PREF, role); } catch (e) {}
    state.preferredRole = role;
  }

  function presenceRef() {
    if (!window.db || !window.doc || !state.userId) return null;
    return window.doc(window.db, 'utilisateurs', state.userId, CONFIG.PRESENCE_COLLECTION, CONFIG.PRESENCE_DOC);
  }

  function isFresh(ts) {
    if (!ts) return false;
    return (now() - Number(ts)) <= CONFIG.TTL_MS;
  }

  function emptyHub() {
    return { devices: {}, primaryDeviceId: null, primaryUpdatedAt: 0, primaryClaimedAt: 0, updatedAt: 0 };
  }

  function cloneHub(hub) {
    return hub ? JSON.parse(JSON.stringify(hub)) : emptyHub();
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

  function otherLiving(hub) {
    return livingDevices(hub).filter(function (d) { return !d.self; });
  }

  function remotePrimaryAlive(hub) {
    if (!hub || !hub.primaryDeviceId) return null;
    if (!isFresh(hub.primaryUpdatedAt)) return null;
    var d = (hub.devices || {})[hub.primaryDeviceId];
    if (d && !isFresh(d.lastSeen)) return null;
    return hub.primaryDeviceId;
  }

  function touchSelf(hub, role) {
    var id = getDeviceId();
    if (!hub.devices) hub.devices = {};
    var prev = hub.devices[id] || {};
    hub.devices[id] = Object.assign({}, prev, {
      label: state.label,
      role: role || prev.role || CONFIG.ROLES.SECONDARY,
      lastSeen: now(),
      userAgent: (navigator.userAgent || '').slice(0, 180)
    });
    hub.updatedAt = now();
    return hub;
  }

  function applyClaim(hub) {
    var id = getDeviceId();
    var t = now();
    hub = touchSelf(hub, CONFIG.ROLES.PRIMARY);
    hub.primaryDeviceId = id;
    hub.primaryUpdatedAt = t;
    hub.primaryClaimedAt = t;
    state.myClaimedAt = t;
    return hub;
  }

  function refreshPrimaryLease(hub) {
    var id = getDeviceId();
    hub = touchSelf(hub, CONFIG.ROLES.PRIMARY);
    if (hub.primaryDeviceId === id) hub.primaryUpdatedAt = now();
    return hub;
  }

  function applySecondaryPresence(hub) {
    return touchSelf(hub, CONFIG.ROLES.SECONDARY);
  }

  function writeHub(hub) {
    var ref = presenceRef();
    if (!ref || !window.setDoc) return Promise.resolve(hub);
    return window.setDoc(ref, hub).then(function () {
      state.hub = hub;
      return hub;
    }).catch(function (err) {
      console.warn('DeviceSession presence write:', err);
      return hub;
    });
  }

  function readHubOnce() {
    var ref = presenceRef();
    if (!ref || !window.getDoc) return Promise.resolve(emptyHub());
    // Ne pas avaler les erreurs : sinon resolveJoin croit le hub vide et
    // s’auto-proclame PRIMARY (LWW) alors que la présence est illisible.
    return window.getDoc(ref).then(function (snap) {
      if (snap && snap.exists && snap.exists()) return snap.data() || emptyHub();
      return emptyHub();
    });
  }

  function safeWritePresence(mutator, preservePrimary) {
    return readHubOnce().then(function (fresh) {
      var hub = cloneHub(fresh || emptyHub());
      var keep = {
        primaryDeviceId: hub.primaryDeviceId,
        primaryUpdatedAt: hub.primaryUpdatedAt,
        primaryClaimedAt: hub.primaryClaimedAt
      };
      hub = mutator(hub);
      if (preservePrimary) {
        var id = getDeviceId();
        if (keep.primaryDeviceId && keep.primaryDeviceId !== id) {
          hub.primaryDeviceId = keep.primaryDeviceId;
          hub.primaryUpdatedAt = keep.primaryUpdatedAt;
          hub.primaryClaimedAt = keep.primaryClaimedAt;
        }
      }
      return writeHub(hub);
    });
  }

  function enqueuePresence(fn) {
    _writeChain = _writeChain.then(fn, fn);
    return _writeChain;
  }

  function getStatus() {
    var hub = state.hub || emptyHub();
    var devices = livingDevices(hub);
    var remotePrimary = remotePrimaryAlive(hub);
    var primaryLabel = null;
    if (remotePrimary) {
      var match = devices.filter(function (d) { return d.deviceId === remotePrimary; })[0];
      primaryLabel = match ? match.label : remotePrimary;
    }
    var effective = state.joinResolved ? state.effectiveRole : CONFIG.ROLES.PRIMARY;
    return {
      enabled: state.started && !window.isLocalMode && !!state.userId,
      joinResolved: state.joinResolved,
      deviceId: getDeviceId(),
      label: state.label,
      preferredRole: state.preferredRole,
      effectiveRole: effective,
      isPrimary: effective === CONFIG.ROLES.PRIMARY,
      isSecondary: effective === CONFIG.ROLES.SECONDARY,
      devices: devices,
      primaryDeviceId: remotePrimary,
      primaryLabel: primaryLabel,
      primaryAlive: !!remotePrimary,
      weAreClaimedPrimary: remotePrimary === getDeviceId(),
      needsRoleChoice: !!(state.joinResolved && state.needsRoleChoice),
      controlStolen: !!state.controlStolen,
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

  function resolveJoin() {
    if (state.joinResolved) return Promise.resolve();

    function poll(attempt) {
      return readHubOnce().then(function (hub) {
        state.hub = hub || emptyHub();
        if (remotePrimaryAlive(state.hub) || otherLiving(state.hub).length) return state.hub;
        if (attempt >= 8) return state.hub;
        return new Promise(function (resolve) {
          setTimeout(function () { resolve(poll(attempt + 1)); }, 350);
        });
      });
    }

    return poll(1).then(function () {
      var remote = remotePrimaryAlive(state.hub);
      var others = otherLiving(state.hub);
      var pref = state.preferredRole;
      var id = getDeviceId();

      // Suivant : Primary déjà là, OU d'autres appareils déjà connectés
      if ((remote && remote !== id) || others.length > 0) {
        state.needsRoleChoice = true;
        state.controlStolen = false;
        state.effectiveRole = CONFIG.ROLES.SECONDARY;
        state.joinResolved = true;
        return safeWritePresence(function (hub) {
          return applySecondaryPresence(hub);
        }, true).then(function () { emit(); });
      }

      if (pref === CONFIG.ROLES.SECONDARY) {
        state.needsRoleChoice = false;
        state.controlStolen = false;
        state.effectiveRole = CONFIG.ROLES.SECONDARY;
        state.joinResolved = true;
        return safeWritePresence(function (hub) {
          return applySecondaryPresence(hub);
        }, true).then(function () { emit(); });
      }

      // Premier / seul → Principal
      writePreferredRole(CONFIG.ROLES.PRIMARY);
      state.needsRoleChoice = false;
      state.controlStolen = false;
      state.effectiveRole = CONFIG.ROLES.PRIMARY;
      return safeWritePresence(function (hub) {
        return applyClaim(hub);
      }, false).then(function () {
        return readHubOnce().then(function (again) {
          state.hub = again || state.hub;
          var winner = remotePrimaryAlive(state.hub) || state.hub.primaryDeviceId;
          var others2 = otherLiving(state.hub);
          if (winner && winner !== id) {
            var theirClaim = Number(state.hub.primaryClaimedAt || 0);
            var myClaim = Number(state.myClaimedAt || 0);
            if (!myClaim || theirClaim < myClaim || (theirClaim === myClaim && String(winner) < String(id))) {
              state.effectiveRole = CONFIG.ROLES.SECONDARY;
              state.needsRoleChoice = true;
              return safeWritePresence(function (hub) {
                return applySecondaryPresence(hub);
              }, true);
            }
          }
          if (others2.length && winner !== id) {
            state.effectiveRole = CONFIG.ROLES.SECONDARY;
            state.needsRoleChoice = true;
            return safeWritePresence(function (hub) {
              return applySecondaryPresence(hub);
            }, true);
          }
          return state.hub;
        });
      }).then(function () {
        state.joinResolved = true;
        emit();
      });
    }).catch(function (err) {
      console.warn('DeviceSession resolveJoin:', err);
      // Fail-closed : pas de faux PRIMARY qui LWW-écrase un vrai principal
      state.joinResolved = true;
      state.effectiveRole = CONFIG.ROLES.SECONDARY;
      state.needsRoleChoice = true;
      emit();
    });
  }

  function onHubSnapshot(snap) {
    if (snap && snap.exists && snap.exists()) state.hub = snap.data() || emptyHub();
    else state.hub = emptyHub();
    if (!state.joinResolved) return;

    var id = getDeviceId();
    var remote = remotePrimaryAlive(state.hub);

    if (remote && remote !== id && state.effectiveRole === CONFIG.ROLES.PRIMARY && !state.needsRoleChoice) {
      state.effectiveRole = CONFIG.ROLES.SECONDARY;
      state.controlStolen = true;
      state.needsRoleChoice = false;
      emit();
      return;
    }
    emit();
  }

  function heartbeat() {
    if (!state.started || window.isLocalMode || !state.userId) return;
    if (!state.joinResolved) return;
    if (_claimInFlight) return;

    // Primary : heartbeat même hors focus pour garder le lease
    var hidden = document.visibilityState && document.visibilityState !== 'visible';
    if (hidden && state.effectiveRole !== CONFIG.ROLES.PRIMARY) return;

    enqueuePresence(function () {
      return readHubOnce().then(function (fresh) {
        state.hub = fresh || emptyHub();
        var id = getDeviceId();
        var hubPrimaryId = state.hub.primaryDeviceId;
        var remote = remotePrimaryAlive(state.hub);

        if (state.effectiveRole === CONFIG.ROLES.PRIMARY && !state.needsRoleChoice) {
          // On détient encore le claim dans le hub (même lease un peu vieux) → refresh
          if (hubPrimaryId === id) {
            return safeWritePresence(function (hub) {
              return refreshPrimaryLease(hub);
            }, false).then(function () { emit(); });
          }
          if (remote && remote !== id) {
            state.effectiveRole = CONFIG.ROLES.SECONDARY;
            state.controlStolen = true;
            return safeWritePresence(function (hub) {
              return applySecondaryPresence(hub);
            }, true).then(function () { emit(); });
          }
          // Claim vide et personne d'autre → reclaim
          if (!hubPrimaryId && otherLiving(state.hub).length === 0) {
            return safeWritePresence(function (hub) {
              return applyClaim(hub);
            }, false).then(function () { emit(); });
          }
          // Sinon rester Primary localement et retenter plus tard (ne pas se rétrograder)
          return safeWritePresence(function (hub) {
            return touchSelf(hub, CONFIG.ROLES.PRIMARY);
          }, true).then(function () { emit(); });
        }

        return safeWritePresence(function (hub) {
          return applySecondaryPresence(hub);
        }, true).then(function () { emit(); });
      });
    });
  }

  function startHeartbeat() {
    stopHeartbeat();
    state.heartbeatTimer = setInterval(heartbeat, CONFIG.HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
  }

  function markOfflineBestEffort() {
    if (!state.started || window.isLocalMode || !state.userId) return;
    try {
      var hub = cloneHub(state.hub);
      var id = getDeviceId();
      hub = touchSelf(hub, 'offline');
      if (hub.devices[id]) hub.devices[id].lastSeen = now() - CONFIG.TTL_MS - 1000;
      if (hub.primaryDeviceId === id) {
        hub.primaryDeviceId = null;
        hub.primaryUpdatedAt = 0;
        hub.primaryClaimedAt = 0;
      }
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
    state.joinResolved = false;
    state.needsRoleChoice = false;
    state.controlStolen = false;
    state.myClaimedAt = null;
    state.hub = emptyHub();
    _claimInFlight = false;

    if (window.isLocalMode || !userId) {
      state.started = true;
      state.joinResolved = true;
      state.preferredRole = CONFIG.ROLES.PRIMARY;
      state.effectiveRole = CONFIG.ROLES.PRIMARY;
      emit();
      return Promise.resolve(getStatus());
    }

    state.preferredRole = readPreferredRole();
    state.started = true;
    state.effectiveRole = CONFIG.ROLES.PRIMARY;
    emit();
    bindPageLifecycle();

    return resolveJoin().then(function () {
      var ref = presenceRef();
      if (ref && window.onSnapshot) {
        state.unsubHub = window.onSnapshot(ref, onHubSnapshot, function (err) {
          console.warn('DeviceSession presence listen:', err);
        });
      }
      startHeartbeat();
      setTimeout(heartbeat, 500);
      return getStatus();
    });
  }

  function stop() {
    stopHeartbeat();
    unbindPageLifecycle();
    if (typeof state.unsubHub === 'function') { try { state.unsubHub(); } catch (e) {} state.unsubHub = null; }
    if (typeof state.unsubData === 'function') { try { state.unsubData(); } catch (e) {} state.unsubData = null; }
    state.started = false;
    state.joinResolved = false;
    state.needsRoleChoice = false;
    state.controlStolen = false;
    _claimInFlight = false;
  }

  function claimPrimary() {
    _claimInFlight = true;
    writePreferredRole(CONFIG.ROLES.PRIMARY);
    state.needsRoleChoice = false;
    state.controlStolen = false;
    state.joinResolved = true;

    function attempt(tryNo) {
      return readHubOnce().then(function (fresh) {
        state.hub = fresh || emptyHub();
        var hub = applyClaim(cloneHub(state.hub));
        return writeHub(hub).then(function () {
          return readHubOnce().then(function (verify) {
            state.hub = verify || hub;
            if (state.hub.primaryDeviceId === getDeviceId()) {
              state.effectiveRole = CONFIG.ROLES.PRIMARY;
              return getStatus();
            }
            if (tryNo < 3) {
              return new Promise(function (r) { setTimeout(r, 120 * tryNo); }).then(function () {
                return attempt(tryNo + 1);
              });
            }
            var forced = applyClaim(cloneHub(state.hub));
            return writeHub(forced).then(function () {
              state.hub = forced;
              state.effectiveRole = CONFIG.ROLES.PRIMARY;
              return getStatus();
            });
          });
        });
      });
    }

    return enqueuePresence(function () { return attempt(1); }).then(function (status) {
      _claimInFlight = false;
      state.effectiveRole = CONFIG.ROLES.PRIMARY;
      emit();
      return status || getStatus();
    }).catch(function (err) {
      _claimInFlight = false;
      console.warn('claimPrimary:', err);
      state.effectiveRole = CONFIG.ROLES.PRIMARY;
      return safeWritePresence(function (hub) { return applyClaim(hub); }, false).then(function () {
        emit();
        return getStatus();
      });
    });
  }

  function switchToSecondary() {
    writePreferredRole(CONFIG.ROLES.SECONDARY);
    state.needsRoleChoice = false;
    state.controlStolen = false;
    state.joinResolved = true;
    state.effectiveRole = CONFIG.ROLES.SECONDARY;

    return enqueuePresence(function () {
      return readHubOnce().then(function (fresh) {
        var hub = cloneHub(fresh || state.hub);
        var id = getDeviceId();
        if (hub.primaryDeviceId === id) {
          hub.primaryDeviceId = null;
          hub.primaryUpdatedAt = 0;
          hub.primaryClaimedAt = 0;
        }
        hub = applySecondaryPresence(hub);
        return writeHub(hub);
      });
    }).then(function () {
      emit();
      return getStatus();
    });
  }

  function canFullSave() {
    if (window.isLocalMode) return true;
    // Avant DeviceSession.start (initApp) : autoriser la 1ʳᵉ save
    if (!state.started || !state.userId) return true;
    // Après start : attendre la résolution du rôle — sinon faux « primary » LWW
    if (!state.joinResolved) return false;
    return state.effectiveRole === CONFIG.ROLES.PRIMARY && !state.needsRoleChoice;
  }

  function canSecondaryPatch() {
    if (window.isLocalMode) return false;
    return state.started && state.joinResolved
      && state.effectiveRole === CONFIG.ROLES.SECONDARY
      && !state.needsRoleChoice;
  }

  function saveSecondaryPatch(mutator, _retries) {
    if (!canSecondaryPatch()) return Promise.reject(new Error('Patch secondaire indisponible'));
    if (!window.docRef || !window.getDoc || !window.setDoc) return Promise.reject(new Error('Cloud indisponible'));
    var retriesLeft = (_retries == null) ? 3 : _retries;
    var pid = window._activeProfileId
      || (window.ProfilesIO && window.ProfilesIO.getSessionProfileId && window.ProfilesIO.getSessionProfileId())
      || (window.ProfilesIO && window.ProfilesIO.getActiveProfileId && window.ProfilesIO.getActiveProfileId())
      || 'default';

    var gate = Promise.resolve({ ok: true });
    if (window.ProfilesIO && typeof window.ProfilesIO.assertProfileCloudWritable === 'function' && window.currentUser) {
      gate = window.ProfilesIO.assertProfileCloudWritable(window.currentUser, pid);
    }

    return gate.then(function (writability) {
      if (!writability || !writability.ok) {
        return Promise.reject(new Error('Patch secondaire refusé : ' + ((writability && writability.reason) || 'not-writable')));
      }
      return window.getDoc(window.docRef).then(function (snap) {
        if (!snap.exists()) {
          return Promise.reject(new Error('Profil cloud absent — patch secondaire refusé (anti-recréation)'));
        }
        var data = snap.data() || {};
        if (data._account === true || data._deleted) {
          return Promise.reject(new Error('Document profil invalide (index/supprimé)'));
        }
        if (!data.meta) data.meta = {};
        var baseRev = Number(data.meta.revision) || 0;
        mutator(data);
        if (!data.meta) data.meta = {};
        data.meta.revision = baseRev + 1;
        data.meta.updatedAt = now();
        data.meta.updatedBy = getDeviceId();
        data.meta.updatedByRole = CONFIG.ROLES.SECONDARY;
        // Relecture avant écriture pour limiter les lost updates face au Principal
        return window.getDoc(window.docRef).then(function (snap2) {
          var curRev = snap2.exists() && snap2.data() && snap2.data().meta
            ? (Number(snap2.data().meta.revision) || 0)
            : 0;
          if (curRev !== baseRev) {
            if (retriesLeft > 0) return saveSecondaryPatch(mutator, retriesLeft - 1);
            return Promise.reject(new Error('Conflit de révision (patch secondaire)'));
          }
          return window.setDoc(window.docRef, data).then(function () {
            window.D = data;
            if (window.ProfilesIO && typeof window.ProfilesIO.writeLocalProfileData === 'function') {
              window.ProfilesIO.writeLocalProfileData(pid, data, { allowEmpty: true });
            } else if (typeof window.safeLocalSet === 'function') {
              window.safeLocalSet('backup_local_cours', JSON.stringify(data));
            } else try { localStorage.setItem('backup_local_cours', JSON.stringify(data)); } catch (e) {}
            return data;
          });
        });
      });
    });
  }

  function watchUserData(docRef) {
    if (typeof state.unsubData === 'function') {
      try { state.unsubData(); } catch (e) {}
      state.unsubData = null;
    }
    if (!docRef || !window.onSnapshot || window.isLocalMode) return;
    state.unsubData = window.onSnapshot(docRef, function (snap) {
      if (!snap.exists()) return;
      if (state.effectiveRole !== CONFIG.ROLES.SECONDARY) return;
      var data = snap.data();
      if (!data || data._account === true || data._deleted) return;
      window.D = data;
      var pid = window._activeProfileId
        || (window.ProfilesIO && window.ProfilesIO.getSessionProfileId && window.ProfilesIO.getSessionProfileId())
        || (window.ProfilesIO && window.ProfilesIO.getActiveProfileId && window.ProfilesIO.getActiveProfileId())
        || 'default';
      if (window.ProfilesIO && typeof window.ProfilesIO.writeLocalProfileData === 'function') {
        window.ProfilesIO.writeLocalProfileData(pid, data, { allowEmpty: true });
      } else if (typeof window.safeLocalSet === 'function') {
        window.safeLocalSet('backup_local_cours', JSON.stringify(data));
      } else try { localStorage.setItem('backup_local_cours', JSON.stringify(data)); } catch (e) {}
      if (typeof window.renderDeviceSecondarySession === 'function') window.renderDeviceSecondarySession();
    }, function (err) { console.warn('DeviceSession data listen:', err); });
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
    isPrimary: function () { return getStatus().isPrimary; },
    isSecondary: function () { return getStatus().isSecondary; }
  };

  function bindPanelButtons(root) {
    var claim = root.querySelector('[data-device-action="claim"]');
    var sec = root.querySelector('[data-device-action="secondary"]');
    if (claim) {
      claim.addEventListener('click', function () {
        claim.disabled = true;
        window.DeviceSession.claimPrimary().then(function () {
          if (typeof window.applyDeviceRoleUi === 'function') window.applyDeviceRoleUi(window.DeviceSession.getStatus());
        });
      });
    }
    if (sec) {
      sec.addEventListener('click', function () {
        sec.disabled = true;
        window.DeviceSession.switchToSecondary().then(function () {
          if (typeof window.applyDeviceRoleUi === 'function') window.applyDeviceRoleUi(window.DeviceSession.getStatus());
        });
      });
    }
  }

  function buildPanelHtml(status) {
    if (!status.enabled) return '<p class="device-session-muted">Mode local : un seul appareil, rôle Principal.</p>';
    if (!status.joinResolved) return '<p class="device-session-muted">Détection des appareils…</p>';

    var roleTxt = status.isPrimary ? 'Principal' : 'Secondaire';
    var primaryTxt = status.primaryAlive
      ? ('Principal actif : <b>' + esc(status.primaryLabel || status.primaryDeviceId) + '</b>')
      : '<span class="device-session-warn">Aucun appareil principal actif</span>';
    if (status.controlStolen && status.isSecondary) {
      primaryTxt += '<br><span class="device-session-warn">Le contrôle a été pris sur un autre appareil.</span>';
    }

    var list = (status.devices || []).map(function (d) {
      var tag = d.self ? ' (cet appareil)' : '';
      var role = d.role === 'primary' ? 'Principal' : (d.role === 'offline' ? 'Hors ligne' : 'Secondaire');
      var age = Math.max(0, Math.round((now() - d.lastSeen) / 1000));
      return '<li><span class="device-session-dev-label">' + esc(d.label) + tag +
        '</span> <span class="device-session-dev-meta">' + esc(role) + ' · vu il y a ' + age + 's</span></li>';
    }).join('');
    if (!list) list = '<li class="device-session-muted">Aucun autre appareil détecté pour l’instant.</li>';

    var hint = status.needsRoleChoice
      ? '<p class="device-session-hint">Un autre appareil est déjà <b>Principal</b> (ouvert en premier). À toi de choisir.</p>'
      : '';

    var actions = status.needsRoleChoice
      ? '<button type="button" class="bp device-session-btn" data-device-action="secondary">Rester en mode simplifié</button>' +
        '<button type="button" class="bs device-session-btn" data-device-action="claim">Prendre le contrôle ici</button>'
      : (status.isSecondary
        ? '<button type="button" class="bp device-session-btn" data-device-action="claim">Devenir principal</button>'
        : '<button type="button" class="bs device-session-btn" data-device-action="secondary">Passer en mode simplifié</button>');

    return '<div class="device-session-status">' +
      '<div class="device-session-role">Cet appareil : <b>' + esc(roleTxt) + '</b></div>' +
      '<div class="device-session-primary-line">' + primaryTxt + '</div>' +
      hint +
      '<ul class="device-session-list">' + list + '</ul>' +
      '<div class="device-session-actions">' + actions + '</div></div>';
  }

  window.renderDeviceSessionPanel = function (status) {
    status = status || (window.DeviceSession && window.DeviceSession.getStatus());
    if (!status) return;
    [document.getElementById('deviceSessionPanel'), document.getElementById('deviceSessionPanelLite')].forEach(function (root) {
      if (!root) return;
      root.innerHTML = buildPanelHtml(status);
      if (typeof window.hydrateIcons === 'function') window.hydrateIcons(root);
      bindPanelButtons(root);
    });
    var chip = document.getElementById('deviceRoleChip');
    if (chip) {
      if (!status.enabled || !status.joinResolved) chip.hidden = true;
      else {
        chip.hidden = false;
        chip.textContent = status.isPrimary ? 'Principal' : 'Secondaire';
        chip.classList.toggle('device-role-chip--primary', status.isPrimary);
        chip.classList.toggle('device-role-chip--secondary', status.isSecondary);
      }
    }
  };

  window.renderDeviceRoleChoice = function (status) {
    status = status || (window.DeviceSession && window.DeviceSession.getStatus());
    var ov = document.getElementById('deviceRoleChoiceOv');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'deviceRoleChoiceOv';
      ov.className = 'device-role-choice-ov';
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-modal', 'true');
      document.body.appendChild(ov);
    }
    if (!status || !status.enabled || !status.needsRoleChoice) {
      ov.hidden = true;
      ov.innerHTML = '';
      return;
    }
    var who = status.primaryLabel || 'un autre appareil';
    ov.hidden = false;
    ov.innerHTML =
      '<div class="device-role-choice-card">' +
        '<h2 id="deviceRoleChoiceTitle">Autre appareil déjà connecté</h2>' +
        '<p><b>' + esc(who) + '</b> a été ouvert en premier et est Principal.</p>' +
        '<p class="device-session-muted">Que veux-tu faire sur <b>cet</b> appareil ?</p>' +
        '<div class="device-role-choice-actions">' +
          '<button type="button" class="bp" data-device-action="secondary">Continuer en mode simplifié</button>' +
          '<button type="button" class="bs" data-device-action="claim">Prendre le contrôle ici</button>' +
        '</div></div>';
    bindPanelButtons(ov);
  };

  window.applyDeviceRoleUi = function (status) {
    status = status || (window.DeviceSession && window.DeviceSession.getStatus());
    if (!status) return;

    var secondary = !!(status.enabled && status.joinResolved && status.isSecondary && !status.needsRoleChoice);
    var choosing = !!(status.enabled && status.needsRoleChoice);

    document.body.classList.toggle('device-role-secondary', secondary);
    document.body.classList.toggle('device-role-primary', !secondary && !choosing);
    document.body.classList.toggle('device-role-choosing', choosing);

    if (secondary || choosing) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }

    var shell = document.getElementById('deviceSecondaryShell');
    if (shell) {
      shell.hidden = !secondary;
      shell.setAttribute('aria-hidden', secondary ? 'false' : 'true');
    }

    if (secondary) {
      if (typeof window.renderDeviceSecondarySession === 'function') window.renderDeviceSecondarySession();
      if (window.docRef && window.DeviceSession.watchUserData) window.DeviceSession.watchUserData(window.docRef);
    }

    window.renderDeviceSessionPanel(status);
    window.renderDeviceRoleChoice(status);
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
        '<p class="device-session-muted">Lecture seule — les réponses se font sur l’appareil Principal.</p></div>';
  };

  window.deviceLiteSearch = function () {
    var input = document.getElementById('deviceLiteSearchInput');
    if (!input || !window.D || !window.D.cours) return;
    var q = String(input.value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!q) {
      if (typeof window.sysAlert === 'function') window.sysAlert('Entre un code (ex. PH-8X2) ou une partie du titre.', 'Recherche');
      return;
    }
    var qNorm = q.replace(/-/g, '');
    var byUid = window.D.cours.find(function (c) {
      var uid = String(c.uid || '').toUpperCase();
      return uid === q || uid.replace(/-/g, '').indexOf(qNorm) >= 0;
    });
    if (byUid) { if (typeof window.doLocate === 'function') window.doLocate(byUid.uid); return; }
    var byTitle = window.D.cours.find(function (c) {
      return String(c.title || '').toUpperCase().indexOf(q) >= 0;
    });
    if (byTitle) { if (typeof window.doLocate === 'function') window.doLocate(byTitle.uid); return; }
    if (typeof window.sysAlert === 'function') window.sysAlert('Aucun document trouvé pour « ' + esc(q) + ' ».', 'Recherche');
  };
})();
