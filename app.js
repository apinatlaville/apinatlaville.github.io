window.addEventListener('unhandledrejection', function(event) {
  const time = new Date().toLocaleTimeString();
  const raw = event.reason;
  const errorMsg = raw && raw.message ? raw.message : (raw != null ? String(raw) : 'Erreur asynchrone inconnue');
  const errStr = String(errorMsg);
  const isNetwork = /fetch|network|failed to fetch|offline|firestore|firebase|timeout|connexion|networkerror/i.test(errStr);

  if(!window.appErrors) window.appErrors = [];
  window.appErrors.push({ time: time, msg: errorMsg, source: 'Async', lineno: 0 });

  const toast = document.getElementById('errorToast');
  const toastMsg = document.getElementById('errorToastMsg');
  if(toast && toastMsg) {
    toastMsg.textContent = (isNetwork ? 'Erreur réseau : ' : 'Erreur : ') + errStr;
    toast.classList.remove('hidden');
  }
  if(typeof window.renderErrorLogs === 'function') {
    window.renderErrorLogs();
  }
});

window.$ = window.$ || (id => document.getElementById(id));
const bindClick = (id, fn) => { const el = window.$(id); if(el) el.addEventListener('click', fn); };
const bindInput = (id, fn) => { const el = window.$(id); if(el) el.addEventListener('input', fn); };
const bindChange = (id, fn) => { const el = window.$(id); if(el) el.addEventListener('change', fn); };
const bindKey = (id, key, fn) => { const el = window.$(id); if(el) el.addEventListener('keydown', e => { if(e.key === key) fn(e); }); };
/** Bloque les actions UI tant que window.D n'est pas initialisé (race auth Cloud) */
const withD = fn => (...args) => { if (!window.D || !window.D.settings) return; return fn(...args); };

window.BACKDROP_BLUR_LEVELS = [
  { id: 'off', label: 'Désactivé', px: 0 },
  { id: 'light', label: 'Léger', px: 24 },
  { id: 'medium', label: 'Moyen', px: 48 },
  { id: 'strong', label: 'Fort', px: 72 }
];

window.D = null; 
window.appReady = false;
window.cloudConnected = false; 
window.sysAlert = function(msg, title="Information") {
  if(window.$('sysDialogTitle')) window.$('sysDialogTitle').textContent = title;
  if(window.$('sysDialogMsg')) window.$('sysDialogMsg').innerHTML = msg.replace(/\n/g, '<br>');
  if(window.$('sysDialogActs')) {
    const btn = typeof window.uiBtnAccent === 'function'
      ? window.uiBtnAccent('OK', { onclick: 'window.closeSysDialog()', attrs: ' style="width:100%;flex:1;"' })
      : `<button class="bp ui-btn-accent" onclick="window.closeSysDialog()" style="width:100%;">OK</button>`;
    window.$('sysDialogActs').innerHTML = btn;
  }
  if(window.$('ovSysDialog')) window.$('ovSysDialog').classList.remove('hidden');
};

window.sysConfirm = function(msg, onConfirm, title="Attention") {
  if(window.$('sysDialogTitle')) window.$('sysDialogTitle').textContent = title;
  if(window.$('sysDialogMsg')) window.$('sysDialogMsg').innerHTML = msg.replace(/\n/g, '<br>');
  
  window._sysConfirmCallback = () => {
    window.closeSysDialog();
    if (onConfirm) onConfirm();
  };

  if(window.$('sysDialogActs')) {
    if (typeof window.uiDialogActions === 'function') {
      window.$('sysDialogActs').innerHTML = window.uiDialogActions({
        confirmClick: 'window._sysConfirmCallback()',
        confirmDanger: true
      });
    } else {
      window.$('sysDialogActs').innerHTML = `
        <button class="bs ui-btn-surface" onclick="window.closeSysDialog()" style="flex:1;">Annuler</button>
        <button class="bp ui-btn-accent" onclick="window._sysConfirmCallback()" style="flex:1; background:var(--red); color:#fff; border-color:var(--red);">Confirmer</button>
      `;
    }
  }
  if(window.$('ovSysDialog')) window.$('ovSysDialog').classList.remove('hidden');
};

window.closeSysDialog = function() {
  if(window.$('ovSysDialog')) window.$('ovSysDialog').classList.add('hidden');
};

window.updateCloudIndicator = function() {
  const d = window.$('cDot');
  const t = window.$('cTxt');
  const extra = window.$('cTxtExtra');
  const box = window.$('cloudStatus');
  if(!d || !t) return;

  const name = (window.D && window.D.settings && window.D.settings.userName)
    ? String(window.D.settings.userName).trim()
    : '';
  const displayName = name || 'Étudiant';

  if(window.cloudConnected) {
    d.style.background = 'var(--grn)';
    d.style.boxShadow = '0 0 8px var(--grn)';
    t.textContent = 'En ligne';
    if (extra) extra.textContent = ', ' + displayName;
    if (box) {
      box.classList.add('cloud-status--online');
      box.removeAttribute('title');
    }
  } else {
    d.style.background = 'var(--red)';
    d.style.boxShadow = '0 0 8px var(--red)';
    t.textContent = 'Local';
    if (extra) extra.textContent = '';
    if (box) {
      box.classList.remove('cloud-status--online');
      box.removeAttribute('title');
    }
  }
};

window.triggerHaptic = function() {
  if (navigator.vibrate) {
    try { navigator.vibrate(50); } catch(e) {}
  }
};

window.updateClock = function() {
  const now = new Date();
  const timeEl = window.$('hdrClockTime');
  const dateEl = window.$('hdrClockDate');
  const showSec = !!(window.D && window.D.settings && window.D.settings.headerClockSeconds !== false);
  if (timeEl) {
    const timeOpts = { hour: '2-digit', minute: '2-digit' };
    if (showSec) timeOpts.second = '2-digit';
    timeEl.textContent = now.toLocaleTimeString('fr-FR', timeOpts);
  }
  if (dateEl) {
    let dateStr = now.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
    dateEl.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  }
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
  let dtStr = now.toLocaleString('fr-FR', options);
  const el = window.$('dateTimeDisp');
  if (el) el.textContent = dtStr.charAt(0).toUpperCase() + dtStr.slice(1);
};

window.applyHeaderClock = function() {
  const on = !!(window.D && window.D.settings && window.D.settings.showHeaderClock);
  const showSec = !!(window.D && window.D.settings && window.D.settings.headerClockSeconds !== false);
  const box = document.getElementById('pageTitleClock');
  if (!box) return;
  box.hidden = !on;
  box.setAttribute('aria-hidden', on ? 'false' : 'true');
  box.classList.toggle('page-title-clock--sec', showSec);
  box.classList.toggle('page-title-clock--no-sec', !showSec);
  if (on && typeof window.updateClock === 'function') window.updateClock();
};
setInterval(window.updateClock, 1000); 
window.updateClock();

window.closeLocPopup = function() { 
  const lp = window.$('locPopup'); 
  if(lp) lp.classList.remove('open'); 
  const bd = window.$('locBackdrop');
  if(bd) bd.style.display = 'none';
};
window.closeModalCours = function() { const ov = window.$('ovCours'); if(ov) ov.classList.add('hidden'); };
window.closeQRModal = function() { const ov = window.$('ovQR'); if(ov) ov.classList.add('hidden'); };
window.closePrintConfirm = function() { const ov = window.$('ovPrintConfirm'); if(ov) ov.classList.add('hidden'); };

document.addEventListener('click', function(e) {
  document.querySelectorAll('.ov').forEach(ov => {
    if (e.target === ov) {
      if (ov.id === 'ovCam') window.stopCam();
      else if (ov.id === 'ovQR') window.closeQRModal();
      else if (ov.id === 'ovCours') window.closeModalCours();
      else if (ov.id === 'ovPrintConfirm') window.closePrintConfirm();
      else if (ov.id === 'ovEditCl') ov.classList.add('hidden');
      else if (ov.id === 'ovSysDialog') window.closeSysDialog(); 
      else if (ov.id === 'ovMove') ov.classList.add('hidden');
      else if (ov.id === 'ovExo' || ov.id === 'ovDevoir') ov.classList.add('hidden');
    }
  });
  const w = window.$('fabWrapper');
  if (w && w.classList.contains('open') && !w.contains(e.target)) {
    w.classList.remove('open');
  }
});

window.toggleFab = function() {
  const w = window.$('fabWrapper');
  if(w) w.classList.toggle('open');
};

window.closeFab = function() {
  const w = window.$('fabWrapper');
  if(w) w.classList.remove('open');
};

window.applySettings = function() {
  if (!window.D || !window.D.settings) return;

  window.D.settings.template = 'glass';
  document.body.classList.remove('tmpl-default', 'tmpl-neo');
  document.body.classList.add('tmpl-glass');

  if (window.D.settings.navLayout === 'sidebar-right') window.D.settings.navLayout = 'sidebar-left';
  const navLayout = window.D.settings.navLayout === 'sidebar-left' ? 'sidebar-left' : 'top';
  window.D.settings.navLayout = navLayout;
  document.body.classList.remove('nav-sidebar-right');
  document.body.classList.toggle('nav-sidebar-left', navLayout === 'sidebar-left');
  if (window.$('btnNavLayoutToggle')) {
    window.$('btnNavLayoutToggle').textContent = navLayout === 'sidebar-left' ? 'Barre latérale' : 'Barre du haut';
  }

  if (typeof window.applyAppearance === 'function') {
    window.applyAppearance(window.D.settings);
  } else if (window.D.settings.theme === 'light') {
    document.body.classList.add('theme-light');
    document.body.classList.remove('theme-dark');
  } else {
    document.body.classList.remove('theme-light');
    document.body.classList.add('theme-dark');
  }

  if (window.D.settings.compact) {
    document.body.classList.add('mode-compact'); 
  } else {
    document.body.classList.remove('mode-compact');
  }

  if(window.$('matChips')) window.$('matChips').classList.toggle('hidden-ui', !window.D.settings.showChips);
  if(window.$('dashHeroArea')) window.$('dashHeroArea').style.display = window.D.settings.showDashHero ? 'block' : 'none';
  if(window.$('dashRevArea')) window.$('dashRevArea').style.display = window.D.settings.showDashRev ? 'block' : 'none';
  if(window.$('dashOverviewArea')) window.$('dashOverviewArea').style.display = window.D.settings.showDashOver ? 'block' : 'none';
  if(window.$('btnCompactToggle')) window.$('btnCompactToggle').textContent = window.D.settings.compact ? 'Activé' : 'Désactivé';
  if(window.$('btnHeaderClockToggle')) window.$('btnHeaderClockToggle').textContent = window.D.settings.showHeaderClock ? 'Activé' : 'Désactivé';
  const secBtn = window.$('btnHeaderClockSecondsToggle');
  if (secBtn) {
    secBtn.textContent = window.D.settings.headerClockSeconds !== false ? 'Affichées' : 'Masquées';
    secBtn.disabled = !window.D.settings.showHeaderClock;
  }
  const secRow = secBtn && secBtn.closest('.set-row');
  if (secRow) secRow.style.opacity = window.D.settings.showHeaderClock ? '' : '0.45';
  if (typeof window.applyHeaderClock === 'function') window.applyHeaderClock();
  if (typeof window.hydrateAppLogos === 'function') window.hydrateAppLogos();
  if(window.$('btnStatsToggle')) window.$('btnStatsToggle').textContent = window.D.settings.showStats ? 'Affiché' : 'Masqué';
  if(window.$('btnChipsToggle')) window.$('btnChipsToggle').textContent = window.D.settings.showChips ? 'Affiché' : 'Masqué';
  if(window.$('btnDashHeroToggle')) window.$('btnDashHeroToggle').textContent = window.D.settings.showDashHero ? 'Oui' : 'Non';
  if(window.$('btnDashRevToggle')) window.$('btnDashRevToggle').textContent = window.D.settings.showDashRev ? 'Oui' : 'Non';
  if(window.$('btnDashOverToggle')) window.$('btnDashOverToggle').textContent = window.D.settings.showDashOver ? 'Oui' : 'Non';
  if(window.$('setUserName')) window.$('setUserName').value = window.D.settings.userName;
  if(window.$('greeting')) window.$('greeting').textContent = `Bonjour, ${window.D.settings.userName}`;
  if (typeof window.updateCloudIndicator === 'function') window.updateCloudIndicator();
  if(window.$('btnInitWarnToggle')) window.$('btnInitWarnToggle').textContent = window.D.settings.showInitWarn ? 'Activé' : 'Désactivé';

  var activeTheme = window.D.settings.themePreset || 'minimaliste';
  if (activeTheme !== 'minimaliste' && activeTheme !== 'classique'
    && activeTheme !== 'origine' && activeTheme !== 'juin20') {
    activeTheme = 'minimaliste';
  }
  document.querySelectorAll('[data-theme-preset]').forEach(function (el) {
    el.classList.toggle('is-active', el.getAttribute('data-theme-preset') === activeTheme);
  });

  const searchTxt = window.$('mainSearchText');
  const searchCode = window.$('mainSearchCode');
  if (searchTxt) searchTxt.placeholder = navLayout === 'sidebar-left' ? 'Rechercher…' : 'Titre, Note, Mots...';
  if (searchCode) searchCode.placeholder = navLayout === 'sidebar-left' ? 'Code PH-8X2' : 'Code (PH-8X2)';
  if (typeof window.layoutNav === 'function') window.layoutNav();
  if (typeof window.layoutChrome === 'function') window.layoutChrome();
  const pageFloat = document.getElementById('pageTitleFloat');
  if (pageFloat) {
    const showPageTitle = navLayout === 'sidebar-left';
    pageFloat.classList.toggle('hidden', !showPageTitle);
    pageFloat.setAttribute('aria-hidden', showPageTitle ? 'false' : 'true');
    if (showPageTitle && typeof window.updateHdrPageTitle === 'function') window.updateHdrPageTitle();
  }
  if(window.$('statsBand')) {
    const hideStats = !window.D.settings.showStats || document.body.classList.contains('nav-chrome-sidebar');
    window.$('statsBand').classList.toggle('hidden-ui', hideStats);
  }
  if (typeof window.renderAppNav === 'function') window.renderAppNav(window._activeTab || 'home');
  if (typeof window.syncNavSubMenu === 'function') window.syncNavSubMenu();
  if (typeof window.syncMobileSidebarPanel === 'function') window.syncMobileSidebarPanel();

};

window.loadDemoPCStar = function() {
  window.sysConfirm(
    "Charger la simulation mi-année PC* ?\n\n" +
    "~190 cartes : ~130 X- par chapitre (QU/exos/formules), 50 anglais, devoirs.\n" +
    "Remplace tes données actuelles.",
    async () => {
      await window.ensureDemoData();
      if (!window.demoDataPCStar) {
        window.sysAlert("Fichier demo-data.js non chargé.", "Erreur");
        return;
      }
      window.D = JSON.parse(JSON.stringify(window.demoDataPCStar));
      await window.save();
      location.reload();
    },
    "Simulation PC*"
  );
};

window.loadDemo = function() {
  window.sysConfirm("Activer les tests va remplacer tes données actuelles.\n\nContinuer ?", async () => {
    await window.ensureDemoData();
    if (!window.demoData) {
      window.sysAlert("Fichier demo-data.js non chargé.", "Erreur");
      return;
    }
    window.D = JSON.parse(JSON.stringify(window.demoData));
    await window.save();
    location.reload();
  }, "Mode Démonstration");
};

window.loadDemoXP = function() {
  window.sysConfirm("Charger les données de démo « expérimenté » ?\n\nSimule 3 semaines d'usage : historique riche, ease variés, stats peuplées.\n\nCela remplace tes données actuelles.", async () => {
    await window.ensureDemoData();
    if (!window.demoDataXP) {
      window.sysAlert("Fichier demo-data.js non chargé.", "Erreur");
      return;
    }
    window.D = JSON.parse(JSON.stringify(window.demoDataXP));
    await window.save();
    location.reload();
  }, "Démo expérimenté");
};

window.ensureDemoData = function() {
  if (window.demoData && window.demoDataXP && window.demoDataPCStar) {
    return Promise.resolve();
  }
  return new Promise(function(resolve) {
    var s = document.createElement('script');
    s.src = 'demo-data.js?v=' + (window.__bootCacheV || Date.now());
    s.onload = resolve;
    s.onerror = resolve;
    document.body.appendChild(s);
  });
};

window.resetData = function() {
  window.sysConfirm(window.iconLabel('alert-triangle', 'ATTENTION !') + "<br><br>Cette action va TOUT effacer pour repartir de ZÉRO (app vide).<br><br>Es-tu sûr ?", async () => {
    window.D = JSON.parse(JSON.stringify(window.emptyData)); 
    await window.save(); 
    location.reload();
  }, "Réinitialisation Totale");
};

window.formatTime = function(s) {
  const m = Math.floor(s / 60); 
  const sc = s % 60;
  return `${m.toString().padStart(2,'0')}:${sc.toString().padStart(2,'0')}`;
};


// =========================================================================
// 🛡️ MOTEUR ANTI-COLLISION (Écrase l'ancienne version)
// =========================================================================
window.genUid = function(prefixeMatiere) {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let nouveauCode = "";
  let estUnique = false;

  if (!window.D.cours) window.D.cours = [];
  if (!window.D.exercices) window.D.exercices = [];

  while (!estUnique) {
    let suffixe = "";
    for (let i = 0; i < 3; i++) {
      let indexAleatoire = Math.floor(Math.random() * caracteres.length);
      suffixe += caracteres.charAt(indexAleatoire);
    }
    
    // Formate le préfixe (ex: PH)
    const prefixe = prefixeMatiere.substring(0, 2).toUpperCase();
    nouveauCode = prefixe + "-" + suffixe;

    // Vérifie partout s'il y a un doublon
    const collisionCours = window.D.cours.some(c => c.uid === nouveauCode);
    const collisionExos = window.D.exercices.some(e => e.id === nouveauCode);
    const collisionDevoirs = (window.D.devoirs || []).some(e => e.id === nouveauCode);

    if (!collisionCours && !collisionExos && !collisionDevoirs) {
      estUnique = true; 
    }
  }
  return nouveauCode;
};

window.doAutoFmtScan = function(inputEl) {
  if(!inputEl) return;
  try {
    let val = inputEl.value;
    if (val.includes(' ')) return; 
    
    const raw = val.toUpperCase().replace(/[^A-Z0-9]/g,'').substring(0, 5);
    
    if(raw.length > 0 && /^[A-Z]{1,2}[A-Z0-9]{0,3}$/.test(raw)) {
      let res = raw;
      if(raw.length > 2) {
        res = raw.substring(0, 2) + '-' + raw.substring(2); 
      }
      
      if(inputEl.value !== res) {
        inputEl.value = res; 
      }

      if (res.length === 6) {
        inputEl.blur(); 
        if (inputEl.id === 'manualCamInput' && typeof window.processScan === 'function') {
            window.processScan(res);
        } else {
            window.doLocate(res); 
            // 🛡️ FIX : Effacement de l'input après la recherche
            setTimeout(() => { inputEl.value = ''; }, 150);
        }
      }
      
    } else if (raw.length === 0) {
      inputEl.value = '';
    }
  } catch(e) {
     if(window.appErrors) window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "Erreur AutoFormat: " + e.message, source: 'app.js' });
  }
};

// 🚨 RESTAURATION DES CASES 2FA !
window.setupCodeBoxes = function() {
  const boxes = [window.$('cb1'), window.$('cb2'), window.$('cb3'), window.$('cb4'), window.$('cb5')];
  boxes.forEach((box, i) => {
    if(!box) return;
    
    box.addEventListener('input', (e) => {
      box.value = box.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if(box.value && i < 4) {
        boxes[i+1].focus();
      }
      window.checkHomeCode();
    });
    
    box.addEventListener('keydown', (e) => {
      if(e.key === 'Backspace' && !box.value && i > 0) {
        boxes[i-1].focus();
      }
    });
    
    box.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 5);
        for(let j=0; j<pasted.length; j++) {
            if(boxes[j]) boxes[j].value = pasted[j];
        }
        if(pasted.length > 0 && pasted.length < 5) boxes[pasted.length].focus();
        else if(pasted.length === 5) boxes[4].blur(); 
        window.checkHomeCode();
    });
  });
};

window.checkHomeCode = function(forceAlert = false) {
  const code = [1,2,3,4,5].map(i => window.$('cb'+i)?window.$('cb'+i).value:'').join('');
  if(code.length === 5) {
    const fullCode = code.substring(0,2) + '-' + code.substring(2);
    window.doLocate(fullCode); 
    [1,2,3,4,5].forEach(i => { if(window.$('cb'+i)) window.$('cb'+i).value = ''; });
  } else if(forceAlert) {
    window.sysAlert("Veuillez remplir les 5 cases pour chercher un code-barres.", "Code incomplet");
  }
};

window.layoutNav = function() {
  const nav = window.$('appNav');
  const side = window.$('navSlotSide');
  const top = window.$('navSlotTop');
  if (!nav || !side || !top) return;
  const slot = document.body.classList.contains('nav-sidebar-left') ? side : top;
  if (nav.parentElement !== slot) slot.appendChild(nav);
};

window.updateHdrPageTitle = function() {
  const el = document.getElementById('hdrPageTitle');
  if (!el) return;
  const tab = window._activeTab || 'home';
  el.textContent = (window.APP_TAB_TITLES && window.APP_TAB_TITLES[tab]) || tab;
};

window.layoutChrome = function() {
  const actions = document.getElementById('hdrActions');
  const footer = document.getElementById('sidebarFooter');
  const pageFloat = document.getElementById('pageTitleFloat');
  const hdrContent = document.querySelector('.hdr-content');
  const sidebar = window.navSidebarActive();

  if (!actions) return;

  if (sidebar && footer) {
    if (actions.parentElement !== footer) footer.appendChild(actions);
    if (pageFloat) {
      pageFloat.classList.remove('hidden');
      pageFloat.setAttribute('aria-hidden', 'false');
      window.updateHdrPageTitle();
    }
    document.body.classList.add('nav-chrome-sidebar');
  } else {
    if (hdrContent && actions.parentElement !== hdrContent) hdrContent.appendChild(actions);
    if (pageFloat) {
      pageFloat.classList.add('hidden');
      pageFloat.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('nav-chrome-sidebar');
  }

  if (typeof window.syncMobileSidebarPanel === 'function') window.syncMobileSidebarPanel();
};

/** Panneau Finder mobile : flèche dans le bandeau titre → plein écran */
window.setMobileSidebarExpanded = function (expanded) {
  const btn = document.getElementById('btnSidebarMobileToggle');
  const scrim = document.getElementById('mobileNavScrim');
  document.body.classList.toggle('mobile-sidebar-expanded', !!expanded);
  if (scrim) {
    scrim.hidden = !expanded;
    scrim.setAttribute('aria-hidden', expanded ? 'false' : 'true');
  }
  if (!btn) return;
  btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  btn.setAttribute('aria-label', expanded ? 'Fermer la navigation' : 'Ouvrir la navigation');
  const icon = btn.querySelector('[data-icon]');
  if (icon) icon.setAttribute('data-icon', expanded ? 'chevron-up' : 'chevron-down');
  if (typeof window.hydrateIcons === 'function') window.hydrateIcons(btn);
};

window.toggleMobileSidebarPanel = function () {
  if (!document.body.classList.contains('nav-sidebar-left')) return;
  window.setMobileSidebarExpanded(!document.body.classList.contains('mobile-sidebar-expanded'));
};

window.syncMobileSidebarPanel = function () {
  const btn = document.getElementById('btnSidebarMobileToggle');
  const mobile = window.matchMedia('(max-width: 767px)').matches;
  const sidebar = document.body.classList.contains('nav-sidebar-left');
  if (typeof window.layoutMobileNavExtras === 'function') window.layoutMobileNavExtras();
  if (!btn) return;
  if (!mobile || !sidebar) {
    btn.hidden = true;
    document.body.classList.remove('mobile-sidebar-expanded');
    return;
  }
  btn.hidden = false;
  if (!btn.dataset.mobileNavReady) {
    btn.dataset.mobileNavReady = '1';
    window.setMobileSidebarExpanded(false);
  } else if (typeof window.hydrateIcons === 'function') {
    window.hydrateIcons(btn);
  }
};

/** Sur mobile : dock Synchrotron + FAB dans le panneau navigation */
window.layoutMobileNavExtras = function () {
  const extras = document.getElementById('navMobileExtras');
  const syncRow = document.getElementById('navMobileSyncRow');
  const actionsRow = document.getElementById('navMobileActionsRow');
  const bar = document.getElementById('syncDockBar');
  const fab = document.getElementById('fabWrapper');
  const shell = document.getElementById('appShell');
  if (!extras || !bar || !fab || !shell) return;

  const mobile = window.matchMedia('(max-width: 767px)').matches;
  const sidebar = document.body.classList.contains('nav-sidebar-left');
  const inExtras = bar.parentElement === syncRow || bar.parentElement === extras || bar.parentElement === actionsRow;
  const fabInExtras = fab.parentElement === actionsRow || fab.parentElement === extras || fab.parentElement === syncRow;

  if (mobile && sidebar && syncRow && actionsRow) {
    if (bar.parentElement !== syncRow) syncRow.appendChild(bar);
    if (fab.parentElement !== actionsRow) actionsRow.appendChild(fab);
    fab.classList.remove('open');
    document.body.classList.add('nav-mobile-extras-inline');
  } else {
    document.body.classList.remove('nav-mobile-extras-inline');
    if (inExtras) shell.insertAdjacentElement('afterend', bar);
    if (fabInExtras) bar.insertAdjacentElement('afterend', fab);
  }
};

(function initMobileSidebarToggle() {
  if (window._mobileSidebarToggleInit) return;
  window._mobileSidebarToggleInit = true;
  const btn = document.getElementById('btnSidebarMobileToggle');
  const scrim = document.getElementById('mobileNavScrim');
  if (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      window.toggleMobileSidebarPanel();
    });
  }
  if (scrim) {
    scrim.addEventListener('click', function () {
      if (typeof window.setMobileSidebarExpanded === 'function') {
        window.setMobileSidebarExpanded(false);
      }
    });
  }
  const mq = window.matchMedia('(max-width: 767px)');
  if (mq.addEventListener) {
    mq.addEventListener('change', function () {
      if (typeof window.layoutMobileNavExtras === 'function') window.layoutMobileNavExtras();
      if (typeof window.syncMobileSidebarPanel === 'function') window.syncMobileSidebarPanel();
      if (!mq.matches && typeof window.setMobileSidebarExpanded === 'function') {
        window.setMobileSidebarExpanded(false);
      }
    });
  }
})();

window.navSidebarActive = function() {
  return window.D?.settings?.navLayout === 'sidebar-left';
};

window.syncNavSubMenu = function() {
  const sub = window.$('navSubNav');
  if (!sub) return;
  if (!window.navSidebarActive()) {
    sub.classList.add('hidden');
    sub.innerHTML = '';
    return;
  }
  const tab = window._activeTab;
  let source = null;
  if (tab === 'ankiV2') {
    source = document.querySelector('#paneAnkiV2 .anki-nav');
  }
  if (!source) {
    sub.classList.add('hidden');
    sub.innerHTML = '';
    return;
  }
  sub.classList.remove('hidden');
  sub.innerHTML = `<div class="nav-sub-items">${source.innerHTML}</div>`;
  if (typeof window.hydrateIcons === 'function') window.hydrateIcons(sub);
};

/** Rendu déclenché à l'affichage d'un onglet — lié au registre nav-config.js */
window.runTabShow = function(tab, overrideResetFilters) {
  switch (tab) {
    case 'home': window.renderDashboard(); break;
    case 'cours':
      if (overrideResetFilters) window.resetFilters();
      else window.renderCours();
      break;
    case 'notes': window.renderNotes(); break;
    case 'flashcards': window.renderFlashcards(); break;
    case 'ankiV2': if (typeof window.renderAnkiV2 === 'function') window.renderAnkiV2(); break;
    case 'ankiVizV2': if (typeof window.renderAnkiVizV2 === 'function') window.renderAnkiVizV2(); break;
    case 'print': window.renderPrintGrid(); break;
    case 'classeurs':
      window.isEditingCl = false;
      window.renderClasseurs();
      break;
    case 'matieres':
      window.isEditingMat = false;
      window.renderMatieres();
      break;
    case 'settings': window.applySettings(); break;
    case 'logs': window.renderErrorLogs(); break;
    case 'test': break;
    default: break;
  }
};

window.switchTab = function(tab, overrideResetFilters = false) {
  if (!tab) return;

  if (typeof window.resolveTabId === 'function') {
    tab = window.resolveTabId(tab);
  }

  const def = typeof window.getTabDef === 'function' ? window.getTabDef(tab) : null;
  const paneId = def ? def.pane : (typeof window.getTabPaneId === 'function' ? window.getTabPaneId(tab) : null);
  if (!paneId) return;

  document.querySelectorAll('.tab').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === tab);
  });

  if (typeof window.getTabPaneId === 'function') {
    Object.keys(window.APP_TAB_REGISTRY || {}).forEach(function(tabId) {
      const id = window.getTabPaneId(tabId);
      const el = id ? window.$(id) : null;
      if (el) el.classList.remove('on');
    });
  }

  const target = window.$(paneId);
  if (target) {
    target.classList.add('on');
  }

  const viewport = document.getElementById('appViewport');
  if (viewport) viewport.dataset.activeTab = tab;

  if (tab === 'home') {
    if (window.$('topSearchBar')) window.$('topSearchBar').classList.add('hidden-on-home');
  } else {
    if (window.$('topSearchBar')) window.$('topSearchBar').classList.remove('hidden-on-home');
  }

  const dataReady = !!(window.D && window.appReady);
  const needsData = typeof window.getTabsNeedingData === 'function'
    ? window.getTabsNeedingData()
    : [];

  function runTabShowNow() {
    if (dataReady && (def ? def.needsData !== false : needsData.includes(tab))) {
      window.runTabShow(tab, overrideResetFilters);
    } else if (!dataReady && needsData.includes(tab)) {
      window._pendingTab = tab;
      window._pendingTabReset = overrideResetFilters;
    } else if (def && def.needsData === false) {
      window.runTabShow(tab, overrideResetFilters);
    }
  }

  var prep = [];
  if (typeof window.ensureScriptsForTab === 'function') prep.push(window.ensureScriptsForTab(tab));
  if (['cours', 'notes', 'settings', 'ankiV2'].indexOf(tab) >= 0 && typeof window.ensureFormLibs === 'function') {
    prep.push(window.ensureFormLibs());
  }
  if (prep.length) Promise.all(prep).then(runTabShowNow);
  else runTabShowNow();

  if (window._activeTab !== tab) {
    window._activeTab = tab;
    window.scrollTo(0, 0);
    const content = document.getElementById('appContent');
    if (content) content.scrollTop = 0;
  }

  if (tab !== 'test' && typeof window.stopDebugScanner === 'function') {
    window.stopDebugScanner();
  }

  if (typeof window.renderSyncSessionDock === 'function') window.renderSyncSessionDock();
  if (typeof window.syncNavSubMenu === 'function') window.syncNavSubMenu();
  if (typeof window.updateHdrPageTitle === 'function') window.updateHdrPageTitle();
  if (
    typeof window.setMobileSidebarExpanded === 'function'
    && window.matchMedia('(max-width: 767px)').matches
    && document.body.classList.contains('nav-sidebar-left')
  ) {
    window.setMobileSidebarExpanded(false);
  }
};

window.renderDashboard = function() {
  if (!window.D || !window.D.cours) return;
  const redCount = window.D.cours.filter(c => c.rev === 'red').length;
  const orangeCount = window.D.cours.filter(c => c.rev === 'orange').length;
  const greenCount = window.D.cours.filter(c => c.rev === 'green').length;

  if(window.$('dashRevGrid')) {
    window.$('dashRevGrid').innerHTML = `
      <div class="dash-card dash-red" onclick="window.switchTab('cours', true); document.getElementById('fltRev').value='red'; window.renderCours();">
        <div class="dash-num">${redCount}</div><div class="dash-lbl">${window.statusLabel('red', 'À revoir urg.')}</div>
      </div>
      <div class="dash-card" onclick="window.switchTab('cours', true); document.getElementById('fltRev').value='orange'; window.renderCours();">
        <div class="dash-num" style="color:var(--gold);">${orangeCount}</div><div class="dash-lbl">${window.statusLabel('orange', 'En cours')}</div>
      </div>
      <div class="dash-card" onclick="window.switchTab('cours', true); document.getElementById('fltRev').value='green'; window.renderCours();">
        <div class="dash-num" style="color:var(--grn);">${greenCount}</div><div class="dash-lbl">${window.statusLabel('green', 'Maîtrisés')}</div>
      </div>
    `;
  }

  if(window.$('dashOverviewGrid')) {
    window.$('dashOverviewGrid').innerHTML = `
      <div class="dash-card dash-acc" onclick="window.switchTab('cours', true);">
        <div class="dash-num">${window.D.cours.length}</div><div class="dash-lbl">${window.iconLabel('book-open', 'Docs Totaux')}</div>
      </div>
      <div class="dash-card" onclick="window.switchTab('cours', true); document.getElementById('fltType').value='FICHE'; window.renderCours();">
        <div class="dash-num">${window.D.cours.filter(c => c.type === 'FICHE').length}</div><div class="dash-lbl">${window.iconLabel('file-text', 'Fiches')}</div>
      </div>
      <div class="dash-card" onclick="window.switchTab('cours', true); document.getElementById('fltType').value='DS'; window.renderCours();">
        <div class="dash-num">${window.D.cours.filter(c => c.type === 'DS').length}</div><div class="dash-lbl">${window.iconLabel('graduation-cap', 'Sujets DS')}</div>
      </div>
    `;
  }

  const todos = window.D.cours.filter(c => c.rev === 'red' || c.rev === 'orange')
                       .sort((a,b) => {
                          if(a.rev === 'red' && b.rev !== 'red') return -1;
                          if(a.rev !== 'red' && b.rev === 'red') return 1;
                          return new Date(a.date) - new Date(b.date);
                       }).slice(0, 5);
  
  if(window.$('todoList')) {
    if(!todos.length) {
      window.$('todoList').innerHTML = '<div style="color:var(--mut); font-size:13px; text-align:center; padding:10px; background:var(--s2); border-radius:10px;">' + window.iconLabel('sparkles', 'Rien d\'urgent ! Tout est maîtrisé.') + '</div>';
    } else {
      window.$('todoList').innerHTML = todos.map(c => `
        <div class="todo-item" onclick="window.doLocate('${window.escHtml(c.uid)}')" style="border-left-color: ${c.rev === 'red' ? 'var(--red)' : 'var(--gold)'};">
          <div>
            <div class="todo-tit">${window.escHtml(c.title)}</div>
            <div class="todo-sub">${window.statusDot(c.rev === 'red' ? 'red' : 'orange')} ${window.escHtml(c.mat)} • ${window.escHtml(c.type)}</div>
          </div>
          <button class="cbt">${window.iconLabel('arrow-right', 'Go')}</button>
        </div>
      `).join('');
    }
  }
  if (typeof window.hydrateIcons === 'function') {
    const dashRoot = window.$('paneHome');
    if (dashRoot) window.hydrateIcons(dashRoot);
  }
};

window.drawKholle = function() {
  if (!window.D || !window.D.cours) return;
  const toReview = window.D.cours.filter(c => c.rev === 'red' || c.rev === 'orange');
  if(!toReview.length) return window.sysAlert("Bravo ! Aucun document urgent à réviser.", "Khôlle");
  const winner = toReview[Math.floor(Math.random() * toReview.length)];
  window.doLocate(winner.uid);
};

window.renderNotes = function() {
  if (!window.D || !window.D.cours) return;
  const notesDocs = window.D.cours.filter(c => (c.type === 'DS' || c.type === 'KHOLLE') && c.note !== '' && c.note !== undefined);
  notesDocs.sort((a,b) => new Date(a.date) - new Date(b.date));
  
  const wrapper = window.$('chartWrapper');
  if(!wrapper) return;

  if(!notesDocs.length) {
    wrapper.innerHTML = `<div style="color:var(--mut); font-size:13px; width:100%; text-align:center; padding-bottom:20px;">Aucune note enregistrée pour le moment.<br>Ajoute un DS ou une Khôlle avec une note pour voir le graphique.</div>`;
    return;
  }

  let html = '';
  notesDocs.forEach(c => {
    const noteNum = parseFloat(c.note);
    const heightPct = (noteNum / 20) * 100;
    let colorClass = noteNum >= 10 ? 'var(--acc)' : 'var(--red)';
    if(noteNum >= 15) colorClass = 'var(--grn)';

    html += `
      <div class="chart-bar-group" onclick="window.doLocate('${window.escHtml(c.uid)}')" title="${window.escHtml(c.title)} : ${window.escHtml(c.note)}/20">
        <div class="chart-bar" style="height: ${Math.max(5, heightPct)}%; background: linear-gradient(to top, transparent, ${colorClass}); border-top: 2px solid ${colorClass};">
          <span class="chart-val" style="color:${colorClass}">${window.escHtml(c.note)}</span>
        </div>
        <div class="chart-lbl">${window.escHtml(c.mat)}</div>
      </div>
    `;
  });
  wrapper.innerHTML = html;
};

window.renderStats = function() {
  if (!window.D || !window.D.cours) return;
  const pending = window.D.cours.filter(c => c.stat === 'pending').length;
  const printed = window.D.cours.filter(c => c.stat === 'printed').length;
  if(window.$('statsBand')) {
    window.$('statsBand').innerHTML =
      '<div class="stc">' + window.iconLabel('book-open', window.D.cours.length + ' cours') + '</div>' +
      '<div class="stc">' + window.statusDot('green') + window.D.classeurs.length + ' classeurs</div>' +
      (pending ? '<div class="stc">' + window.statusDot('red') + pending + ' À impr.</div>' : '') +
      (printed ? '<div class="stc">' + window.statusDot('orange') + printed + ' À scanner</div>' : '');
  }
};

window.exportCsv = function() {
  if (!window.D || !window.D.cours) return;
  const hdr = ['Code','Titre','Type','Matiere','Classeur','Intercalaire','Maitrise','Note','Date','Statut_QR'];
  const esc = v => '"' + String(v||'').replace(/"/g,'""') + '"';
  
  const rows = window.D.cours.map(c => {
    const mo = window.D.matieres.find(m=>m.id===c.mat)||{name:c.mat};
    const co = window.D.classeurs.find(x=>x.id===c.cl)||{name:c.cl};
    return [c.uid, c.title, c.type, mo.name, co.name, c.inter, c.rev, c.note||'', c.date||'', c.stat].map(esc).join(',');
  });
  
  const csv = [hdr.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='mes-cours-prepa.csv';
  a.click();
};

window.renderErrorLogs = function() {
  const container = window.$('errorLogContainer');
  if(!container) return;
  
  if(!window.appErrors || window.appErrors.length === 0) {
    container.innerHTML = typeof window.uiEmpty === 'function'
      ? window.uiEmpty('Aucune erreur détectée. Tout va bien.', { icon: 'circle-check' })
      : '<div class="ui-empty">Aucune erreur détectée. Tout va bien.</div>';
    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(container);
    return;
  }
  
  container.innerHTML = window.appErrors.map(function(e) {
    return typeof window.uiLogEntry === 'function'
      ? window.uiLogEntry(e)
      : '<div class="ui-log-entry"><div class="ui-log-msg">' + window.escHtml(e.msg) + '</div></div>';
  }).reverse().join('');
};

window.clearErrorLogs = function() {
  window.sysConfirm("Vider l'historique des erreurs ?", () => {
    window.appErrors = [];
    window.renderErrorLogs();
  }, "Logs");
};

// ATTACHEMENT DYNAMIQUE DES ÉVÉNEMENTS
bindClick('btnOpenSettings', withD(() => window.switchTab('settings')));
bindClick('btnRefresh', () => location.reload());
bindClick('btnNavLayoutToggle', withD(() => {
  window.D.settings.navLayout = window.D.settings.navLayout === 'sidebar-left' ? 'top' : 'sidebar-left';
  window.save();
  window.applySettings();
}));
bindClick('btnHeaderClockToggle', withD(() => {
  window.D.settings.showHeaderClock = !window.D.settings.showHeaderClock;
  window.save();
  window.applySettings();
}));
bindClick('btnHeaderClockSecondsToggle', withD(() => {
  const cur = window.D.settings.headerClockSeconds !== false;
  window.D.settings.headerClockSeconds = !cur;
  window.save();
  window.applySettings();
}));
bindClick('btnCompactToggle', withD(() => { window.D.settings.compact = !window.D.settings.compact; window.save(); window.applySettings(); }));
bindClick('btnStatsToggle', withD(() => { window.D.settings.showStats = !window.D.settings.showStats; window.save(); window.applySettings(); }));
bindClick('btnChipsToggle', withD(() => { window.D.settings.showChips = !window.D.settings.showChips; window.save(); window.applySettings(); }));
bindClick('btnDashHeroToggle', withD(() => { window.D.settings.showDashHero = !window.D.settings.showDashHero; window.save(); window.applySettings(); }));
bindClick('btnDashRevToggle', withD(() => { window.D.settings.showDashRev = !window.D.settings.showDashRev; window.save(); window.applySettings(); }));
bindClick('btnDashOverToggle', withD(() => { window.D.settings.showDashOver = !window.D.settings.showDashOver; window.save(); window.applySettings(); }));
bindClick('btnInitWarnToggle', withD(() => { window.D.settings.showInitWarn = !window.D.settings.showInitWarn; window.save(); window.applySettings(); }));

bindInput('setUserName', withD((e) => { window.D.settings.userName = e.target.value.trim() || "Étudiant"; window.save(); window.applySettings(); }));

if (typeof window.bindSettingsThemePicker === 'function') window.bindSettingsThemePicker();

/** scanner.js est chargé à la demande — stub pour l'accueil et le FAB */
window.invokeOpenCam = function () {
  function run() {
    if (typeof window.openCam === 'function' && !window.openCam._isScannerStub) {
      return window.openCam();
    }
    if (typeof window.sysAlert === 'function') {
      window.sysAlert(
        'Impossible de charger le module scanner (<code>scanner.js</code>).<br>Recharge la page ou vérifie ta connexion.',
        'Scanner indisponible'
      );
    }
  }
  if (typeof window.openCam === 'function' && !window.openCam._isScannerStub) return run();
  var load = typeof window.ensureScanner === 'function' ? window.ensureScanner() : Promise.resolve();
  return Promise.resolve(load).then(run);
};
if (typeof window.openCam !== 'function') {
  var _openCamStub = function () { return window.invokeOpenCam(); };
  _openCamStub._isScannerStub = true;
  window.openCam = _openCamStub;
}

bindClick('btnHomeCam', () => window.openCam());
bindClick('btnKholleDraw', () => window.drawKholle());

// 🚨 ÉCOUTEURS RESTAURÉS
bindClick('btnHomeSearch', () => window.checkHomeCode(true));
bindInput('mainSearchText', () => window.renderCours());
bindInput('mainSearchCode', (e) => {
  window.doAutoFmtScan(e.target);
  const raw = e.target.value.replace(/[^A-Z0-9-]/gi, '');
  if (raw.length < 6 && window.D && window.D.cours) window.renderCours();
});

bindClick('btnCancelCours', () => window.closeModalCours());
bindChange('fType', () => window.toggleNoteField());

bindChange('fMat', () => { if(typeof window.updateUidPrefix === 'function') window.updateUidPrefix(); });

bindChange('fMoveCl', () => { if(typeof window.updateMoveIntercalairesDropdown === 'function') window.updateMoveIntercalairesDropdown(); });

bindClick('btnAddCl', () => window.addCl());
bindClick('btnAddMat', () => window.addMat());

['fltMat', 'fltCl', 'fltQr', 'fltType', 'fltRev'].forEach(id => { bindChange(id, () => window.renderCours()); });
bindClick('btnResetFilters', () => window.resetFilters());

bindClick('btnSelPending', () => window.selPending());
bindClick('btnSelAll', () => window.selAll());
bindClick('btnDesel', () => window.selNone());
bindClick('btnDoPrint', () => window.executePrint());
bindClick('btnConfirmPrintYes', () => window.confirmPrintSuccess(true));
bindClick('btnConfirmPrintNo', () => window.confirmPrintSuccess(false));

bindClick('btnCloseLocPopup', () => window.closeLocPopup());
bindClick('btnMarkOnePrinted', () => window.markOnePrinted());
bindClick('btnCloseQR', () => window.closeQRModal());
bindClick('btnDlQR', () => window.dlQR());

bindChange('fCl', () => window.updateIntercalairesDropdown());

bindInput('nMlbl', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4); });
bindInput('manualCamInput', (e) => { window.doAutoFmtScan(e.target); });
bindInput('fUidInput', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3); });


// =========================================================
// INITIALISATION CLOUD / LOCAL
// =========================================================

async function fetchCloudDoc(docRef, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      if (window.firebaseReady) await window.firebaseReady;
      if (!window.db || !window.getDoc) {
        throw new Error("Modules Firebase manquants.");
      }
      return await window.getDoc(docRef);
    } catch (e) {
      lastErr = e;
      if (isFirestorePermissionDenied(e)) throw e;
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 400 * (i + 1)));
      }
    }
  }
  throw lastErr || new Error("Modules Firebase manquants.");
}

function isFirestorePermissionDenied(err) {
  if (!err) return false;
  const code = err.code || err.code_;
  if (code === 'permission-denied') return true;
  const msg = String(err.message || err);
  return /insufficient permissions|permission.denied|missing or insufficient/i.test(msg);
}

/** Charge le document Firestore via l'UID Google (clé canonique), avec repli e-mail et migration. */
async function resolveCloudUserDoc(user) {
  if (!user || !user.sub) {
    throw new Error('Identifiant Google (UID) manquant.');
  }

  const uidRef = window.doc(window.db, 'utilisateurs', user.sub);
  let uidSnap = null;
  let uidDenied = false;

  try {
    uidSnap = await fetchCloudDoc(uidRef);
  } catch (e) {
    if (isFirestorePermissionDenied(e)) uidDenied = true;
    else throw e;
  }

  if (uidSnap && uidSnap.exists()) {
    return { docRef: uidRef, data: uidSnap.data(), migrated: false, storageKey: 'uid' };
  }

  const tryLegacyEmail = async function () {
    if (!user.email || user.email === user.sub) return null;
    const legacyRef = window.doc(window.db, 'utilisateurs', user.email);
    try {
      const legacySnap = await fetchCloudDoc(legacyRef);
      if (!legacySnap.exists()) {
        return { docRef: legacyRef, data: null, migrated: false, storageKey: 'email' };
      }
      const data = legacySnap.data();
      if (!uidDenied && window.setDoc) {
        try {
          await window.setDoc(uidRef, data);
          if (window.bootMark) {
            window.bootMark('initApp.cloud.migratedEmailToUid', { email: user.email, uid: user.sub });
          }
          console.log('☁️ Données migrées (clé e-mail → UID Google).');
          return { docRef: uidRef, data, migrated: true, storageKey: 'uid' };
        } catch (migrateErr) {
          if (!isFirestorePermissionDenied(migrateErr)) throw migrateErr;
        }
      }
      console.warn('☁️ Données sur clé e-mail (règles UID à déployer — voir firestore.rules).');
      return { docRef: legacyRef, data, migrated: false, storageKey: 'email' };
    } catch (e) {
      if (isFirestorePermissionDenied(e)) return null;
      throw e;
    }
  };

  const legacy = await tryLegacyEmail();
  if (legacy) return legacy;

  if (!uidDenied) {
    return { docRef: uidRef, data: null, migrated: false, storageKey: 'uid' };
  }

  throw new Error(
    'Accès Firestore refusé. Déploie les règles du fichier firestore.rules dans la console Firebase ' +
    '(Firestore → Règles → request.auth.uid == userId).'
  );
}

async function initApp(user) {
  if (window.bootMark) window.bootMark('initApp.start', { local: !!window.isLocalMode, email: user && user.email });
  window._persistDisabled = false;
  let localDataCorrupt = false;
  let cloudInitFailed = false;
  let cloudInitError = null;

  try {
    if (window.isLocalMode) {
      console.log("🌸 Chargement des données locales...");
      if (window.bootMark) window.bootMark('initApp.local.read.start');
      let localData = localStorage.getItem('backup_local_cours');
      if (!localData) {
        localData = localStorage.getItem('mc_v28');
        if (localData) localStorage.setItem('backup_local_cours', localData);
      }
      if (localData) {
        try {
          window.D = window.bootProfiler
            ? window.bootProfiler.measureSync('initApp.local.parse', function () { return JSON.parse(localData); })
            : JSON.parse(localData);
        } catch (parseErr) {
          localDataCorrupt = true;
          window.D = null;
          const msg = 'Données locales illisibles : ' + (parseErr && parseErr.message ? parseErr.message : parseErr);
          if (window.appErrors) {
            window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: msg, source: 'app.js' });
          }
          console.error(msg);
        }
      } else {
        window.D = null;
      }
      if (window.bootMark) window.bootMark('initApp.local.read.done', { kb: localData ? Math.round(localData.length / 1024) : 0 });
      window.cloudConnected = false;
    } else {
      if (window.doc && window.db && window.getDoc) {
        if (window.bootMark) window.bootMark('initApp.cloud.fetch.start', { uid: user.sub, email: user.email });
        const cloud = await (window.bootProfiler
          ? window.bootProfiler.measureAsync('initApp.cloud.fetch', function () { return resolveCloudUserDoc(user); })
          : resolveCloudUserDoc(user));
        window.docRef = cloud.docRef;
        if (cloud.data) {
          window.D = cloud.data;
          window.cloudConnected = true;
          console.log('☁️ Données Cloud synchronisées (UID ' + user.sub + ')');
        } else {
          window.D = null;
          window.cloudConnected = true;
          console.log('☁️ Nouveau compte (UID ' + user.sub + ')');
        }
        if (window.bootMark) window.bootMark('initApp.cloud.fetch.done', { exists: !!cloud.data, migrated: cloud.migrated });
      } else {
        throw new Error("Modules Firebase manquants.");
      }
    }
  } catch (e) {
    if (window.isLocalMode) {
      localDataCorrupt = true;
    } else {
      cloudInitFailed = true;
      cloudInitError = e;
    }
    window.D = window.D || null;
    if(window.appErrors) window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "Erreur Init: " + e.message, source: 'app.js' });
    if (window.bootMark) window.bootMark('initApp.error', { error: e.message });
    console.error("Erreur d'initialisation :", e);
    window.cloudConnected = false;
  }

  if (localDataCorrupt) window._persistDisabled = true;
  if(!window.D) window.D = JSON.parse(JSON.stringify(window.emptyData));
  if(!window.D.cours) window.D.cours = [];
  if(!Array.isArray(window.D.exercices)) window.D.exercices = [];
  if(!Array.isArray(window.D.devoirs)) window.D.devoirs = [];
  if (window.AnkiAlgo && typeof window.AnkiAlgo.migrateData === 'function') {
    if (window.bootProfiler) window.bootProfiler.measureSync('initApp.migrateData', function () { window.AnkiAlgo.migrateData(window.D); });
    else window.AnkiAlgo.migrateData(window.D);
  }
  // Migration coursId (string) → coursIds (array) pour les anciennes cartes Anki
  const _allCardsMigr = window.AnkiAlgo ? window.AnkiAlgo.allCards(window.D) : (window.D.exercices || []).concat(window.D.devoirs || []);
  _allCardsMigr.forEach(c => {
    if (!Array.isArray(c.coursIds)) {
      c.coursIds = c.coursId ? [c.coursId] : [];
    }
    if (!c.profil) c.profil = 'COURS';
  });
  // ⚠️ v3.4 : on NE découpe PLUS en cartes séparées.
  // Le DM reste UN seul objet avec _morceauxTotal / _morceauxFaits.
  // Migration : fusionner les anciens devoir-morceau résiduels dans leur parent.
  if (Array.isArray(window.D.exercices)) {
    const legacyMorceaux = window.D.exercices.filter(c => c.type === 'devoir-morceau')
      .concat((window.D.devoirs || []).filter(c => c.type === 'devoir-morceau'));
    legacyMorceaux.forEach(m => {
      const parent = (window.D.devoirs || []).find(p => p.id === m._morceauOf)
        || window.D.exercices.find(p => p.id === m._morceauOf && p.type === 'devoir');
      if (parent) {
        const siblings = legacyMorceaux.filter(x => x._morceauOf === parent.id);
        if (!parent._morceauxTotal || parent._morceauxTotal < 2) {
          parent._morceauxTotal = Math.max(2, siblings.length + 1);
        }
        if (m.statut === 'fini' && (parent._morceauxFaits || 0) < (parent._morceauxTotal || 1)) {
          parent._morceauxFaits = (parent._morceauxFaits || 0) + 1;
        }
      }
    });
    window.D.exercices = window.D.exercices.filter(c => c.type !== 'devoir-morceau');
    window.D.devoirs = (window.D.devoirs || []).filter(c => c.type !== 'devoir-morceau');
    // Réinitialise les parents qui ont été tripotés par les versions précédentes
    (window.D.devoirs || []).forEach(c => {
      if (c.type === 'devoir' && c._isMorceauParent) {
        delete c._morceauIndex;
        delete c._isMorceauParent;
        if (c._dureeTotaleMin) c.tempsCible = c._dureeTotaleMin * 60;
      }
    });
    window.D.exercices.forEach(c => {
      if (c.type === 'devoir' && c._isMorceauParent) {
        delete c._morceauIndex;
        delete c._isMorceauParent;
        // tempsCible reflète UN morceau ; on remet la durée totale si _dureeTotaleMin présent
        if (c._dureeTotaleMin) c.tempsCible = c._dureeTotaleMin * 60;
      }
    });
  }
  if(!window.D.classeurs) window.D.classeurs = JSON.parse(JSON.stringify(window.emptyData.classeurs));
  if(!window.D.matieres) window.D.matieres = JSON.parse(JSON.stringify(window.emptyData.matieres));
  if(!window.D.settings) window.D.settings = JSON.parse(JSON.stringify(window.emptyData.settings));

  if(window.D.settings.showInitWarn === undefined) window.D.settings.showInitWarn = true;
  if(window.D.settings.showHeaderClock === undefined) window.D.settings.showHeaderClock = false;
  if(window.D.settings.headerClockSeconds === undefined) window.D.settings.headerClockSeconds = true;
  if(!window.D.settings.navLayout) window.D.settings.navLayout = 'sidebar-left';
  if (!window.D.settings.navLayoutVersion) {
    window.D.settings.navLayout = 'sidebar-left';
    window.D.settings.navLayoutVersion = 1;
  }
  if(!window.D.settings.appColor) window.D.settings.appColor = '#5b9aff';
  if(!window.D.settings.ankiQuotaMin) window.D.settings.ankiQuotaMin = 90;
  if(!window.D.settings.ankiSessionMin) window.D.settings.ankiSessionMin = 60;
  if(window.D.settings.ankiIncludeNew === undefined) window.D.settings.ankiIncludeNew = 5;
  if(!window.D.settings.ankiMaxPerDay) window.D.settings.ankiMaxPerDay = 75;

  window.D.classeurs.forEach(cl => {
    if(!cl.interNames) cl.interNames = {};
    if(!cl.maxInter) cl.maxInter = 12;
  });
  if (!window.D.settings.algoV2) {
    window.D.settings.algoV2 = { horizon: '1y', sessionMinDefault: 90, pullForward: true, margeBudget: 0.92 };
  }
  delete window.D.settings.showPomo;
  delete window.D.settings.pomoWork;
  delete window.D.settings.pomoBreak;

  if (typeof window.reconcileOrphanCours === 'function') {
    const reconciled = window.reconcileOrphanCours();
    if (reconciled && !window._persistDisabled) window.save();
  }

  if (window.isLocalMode) {
    window.D.settings.userName = "Mode Local";
    window.D.settings.appColor = '#5b9aff';
  } else if (user && user.given_name) {
    window.D.settings.userName = user.given_name;
  }

  if (typeof window.updateCloudIndicator === 'function') {
    window.updateCloudIndicator();
  }

  window.setupCodeBoxes();
  if (window.bootMark) window.bootMark('initApp.render.start');
  window.applySettings();
  if (window.bootMark) window.bootMark('initApp.render.applySettings');
  if (window.D.settings._needsAppearanceSave && !window._persistDisabled) {
    delete window.D.settings._needsAppearanceSave;
    window.save();
  } else if (window.D.settings._needsAppearanceSave) {
    delete window.D.settings._needsAppearanceSave;
  }
  window.renderMatieres();
  if (window.bootMark) window.bootMark('initApp.render.matieres');
  window.renderClasseurs();
  if (window.bootMark) window.bootMark('initApp.render.classeurs');
  window.renderStats();
  if (window.bootMark) window.bootMark('initApp.render.stats');
  window.renderDashboard();
  if (window.bootMark) window.bootMark('initApp.render.dashboard');
  window.switchTab('home');
  if (window.bootMark) window.bootMark('initApp.render.switchTab');
  if (typeof window.hydrateIcons === 'function') window.hydrateIcons();
  if (window.bootMark) window.bootMark('initApp.render.hydrateIcons');
  if (typeof window.renderSyncSessionDock === 'function') window.renderSyncSessionDock();
  window.appReady = true;
  if (window.bootMark) window.bootMark('initApp.done');
  if (typeof window.bootProfiler !== 'undefined' && window.bootProfiler.refreshPanel) window.bootProfiler.refreshPanel();
  if (typeof window.setBootStep === 'function') window.setBootStep('data');

  if (typeof window.DeviceSession !== 'undefined' && typeof window.DeviceSession.start === 'function') {
    var deviceUserId = window.isLocalMode ? null : (user && user.sub);
    Promise.resolve(window.DeviceSession.start(deviceUserId)).then(function () {
      if (typeof window.applyDeviceRoleUi === 'function') {
        window.applyDeviceRoleUi(window.DeviceSession.getStatus());
      }
      if (window.docRef && window.DeviceSession.watchUserData
          && window.DeviceSession.isSecondary && window.DeviceSession.isSecondary()) {
        window.DeviceSession.watchUserData(window.docRef);
      }
    }).catch(function (err) {
      console.warn('DeviceSession start:', err);
    });
  }

  if (window._pendingTab) {
    const pending = window._pendingTab;
    const reset = window._pendingTabReset;
    window._pendingTab = null;
    window._pendingTabReset = false;
    window.switchTab(pending, reset);
  }
  if (typeof window.unlockPage === 'function') window.unlockPage();
  else if (typeof window.dismissSplash === 'function') window.dismissSplash();

  if (localDataCorrupt) {
    window.sysAlert(
      "Tes données locales n'ont pas pu être lues (fichier corrompu ou invalide).<br><br>" +
      "L'application démarre vide. <b>Rien ne sera enregistré</b> tant que le problème n'est pas corrigé " +
      "(par ex. vider le stockage du site dans les paramètres du navigateur, puis recharger la page).",
      "Données illisibles"
    );
  } else if (cloudInitFailed) {
    const perm = cloudInitError && isFirestorePermissionDenied(cloudInitError);
    window.sysAlert(
      (perm
        ? 'Accès Firestore refusé (<b>Missing or insufficient permissions</b>).<br><br>' +
          'Ouvre la <b>console Firebase</b> → Firestore → <b>Règles</b>, colle le contenu du fichier ' +
          '<code>firestore.rules</code> du projet, puis clique sur <b>Publier</b>.<br><br>' +
          'La règle doit autoriser <code>request.auth.uid == userId</code> (compte Google).'
        : 'Impossible de charger tes données depuis le cloud.<br><br>' +
          'L\'application démarre avec des données vides. Vérifie ta connexion et recharge la page.<br><br>' +
          'Les sauvegardes cloud pourraient échouer tant que Firebase n\'est pas accessible.'),
      'Erreur de synchronisation'
    );
  }
}

/**
 * Sauvegarde locale + cloud Firestore
 */
window.save = async function() {
  if (!window.D) return;

  if (window._persistDisabled) {
    window.sysAlert(
      "Enregistrement impossible : tes données n'ont pas pu être chargées au démarrage.<br><br>" +
      "<b>Rien ne sera sauvegardé</b> dans cette session.",
      "Sauvegarde désactivée"
    );
    return;
  }

  if (window.DeviceSession && typeof window.DeviceSession.canFullSave === 'function'
      && !window.DeviceSession.canFullSave()) {
    console.warn('☁️ Save complète refusée : appareil en mode Secondaire.');
    return;
  }

  if (!window.D.meta) window.D.meta = {};
  window.D.meta.revision = (Number(window.D.meta.revision) || 0) + 1;
  window.D.meta.updatedAt = Date.now();
  if (window.DeviceSession && typeof window.DeviceSession.getDeviceId === 'function') {
    window.D.meta.updatedBy = window.DeviceSession.getDeviceId();
    window.D.meta.primaryDeviceId = window.DeviceSession.getDeviceId();
  }

  try {
    localStorage.setItem('backup_local_cours', JSON.stringify(window.D));
  } catch (e) {
    if (window.appErrors) {
      window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "Erreur sauvegarde: " + e.message, source: 'app.js' });
    }
    console.error("Échec sauvegarde locale :", e);
    window.sysAlert("Impossible d'enregistrer tes données dans le navigateur.", "Erreur de sauvegarde");
    return;
  }

  if (window.isLocalMode) {
    console.log("🌸 [Mode Local] Sauvegarde locale dans le navigateur réussie.");
    return;
  }

  if (window.cloudConnected && window.docRef && window.setDoc) {
    try {
      await window.setDoc(window.docRef, window.D);
      console.log("☁️ [Mode Cloud] Sauvegarde Firestore réussie !");
    } catch (e) {
      const errMsg = e && e.message ? e.message : String(e);
      if (window.appErrors) {
        window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "Erreur écriture cloud: " + errMsg, source: 'app.js' });
      }
      if (typeof window.renderErrorLogs === 'function') window.renderErrorLogs();
      console.error("Échec Cloud :", e);
      if (!window.isLocalMode && typeof window.sysAlert === 'function') {
        window.sysAlert(
          "La synchronisation cloud a échoué. Tes données sont enregistrées dans ce navigateur, " +
          "mais <b>pas sur le serveur</b> pour l'instant.<br><br>" +
          "Détail : " + window.escHtml(errMsg) + "<br><br>" +
          "Vérifie ta connexion et réessaie (une modification déclenchera une nouvelle sauvegarde).",
          "Erreur de synchronisation"
        );
      }
    }
  }
};

// =========================================================
// DÉMARRAGE
// =========================================================
window.initAppAfterAuth = function(user) {
    if (window.bootMark) window.bootMark('initAppAfterAuth', { email: user && user.email });
    initApp(user);
};

window.onload = function() {
  console.log("⏳ En attente de l'authentification...");
};

window.dispatchEvent(new CustomEvent('app-js-ready'));
if (typeof window.setBootStep === 'function') window.setBootStep('app');

// Secours si anki-quick.js n'est pas chargé (ne remplace pas la version Rapide)
if (typeof window.renderFlashcards !== 'function') {
  window.renderFlashcards = function() {
    const root = window.$('paneFlashcards');
    if (!root) return;
    root.innerHTML = `<p style="color:var(--mut);font-size:13px;">${window.iconLabel('zap', 'Onglet Rapide — charge anki-quick.js pour créer des cartes Y-.')}</p>`;
    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(root);
  };
}

(function initTabBar() {
  function onTabClick(e) {
    const btn = e.target.closest('#tabsBar .tab[data-tab]');
    if (!btn) return;
    e.preventDefault();
    window.switchTab(btn.dataset.tab);
  }
  document.addEventListener('click', onTabClick);
  function bootLayout() {
    if (typeof window.layoutNav === 'function') window.layoutNav();
    if (typeof window.layoutChrome === 'function') window.layoutChrome();
    if (typeof window.renderAppNav === 'function') window.renderAppNav(window._activeTab || 'home');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootLayout);
  } else {
    bootLayout();
  }
})();

(function initNavSidebarResize() {
  let t = 0;
  window.addEventListener('resize', function() {
    clearTimeout(t);
    t = setTimeout(function() {
      if (typeof window.syncNavSubMenu === 'function') window.syncNavSubMenu();
    }, 120);
  });
})();
