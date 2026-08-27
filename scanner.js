/**
 * =========================================================================================
 * MASTER PROJECT CONTEXT & DOCUMENTATION (AI CONTEXT RETAINER)
 * =========================================================================================
 * NOM DU PROJET : Mes Cours - PC* Edition
 * FICHIER ACTUEL : scanner.js (Caméra, Code-barres 1D et Impression)
 * ARCHITECTURE MULTI-FICHIERS (TRÈS IMPORTANT POUR L'IA) :
 * 1. app.js      : Cœur (Firebase, État global window.D, Navigation, Paramètres).
 * 2. data.js     : Gestion des données (Cours, Classeurs, Matières) et grilles HTML.
 * 3. scanner.js  : [CE FICHIER] Scanner de codes-barres 1D et logique d'impression.
 * =========================================================================================
 */

window.$ = window.$ || (id => document.getElementById(id));
/* Ne pas réinitialiser si le script est réinjecté (course lazy load) */
if (!window.printSel) window.printSel = new Set();
if (window.curQRUid === undefined) window.curQRUid = null;
if (window.html5QrCode === undefined) window.html5QrCode = null;

// UTILITAIRE : GÉNÉRATEUR DE CODE-BARRES 1D
window.getBarcodeURL = function(text) {
  try {
    const canvas = document.createElement('canvas');
    window.JsBarcode(canvas, text, {
      format: "CODE128",
      width: 2,
      height: 60,
      displayValue: false,
      margin: 10,
      background: "#ffffff",
      lineColor: "#000000"
    });
    return canvas.toDataURL("image/png");
  } catch(e) {
    if(window.appErrors) window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "Erreur JsBarcode: " + e.message, source: 'scanner.js' });
    return '';
  }
};

window.showQR = function(uid) {
  if (!window.D || !Array.isArray(window.D.cours)) return;
  const c = window.D.cours.find(x => x.uid===uid);
  if (!c) return;
  window.curQRUid = uid;
  
  if(window.$('qrTitle')) window.$('qrTitle').innerHTML = window.iconLabel('qr-code', 'Code-Barres');
  if(window.$('qrSub')) window.$('qrSub').textContent = c.title || '';
  if(window.$('qrLbl')) window.$('qrLbl').textContent = uid;
  
  if(window.$('qrBox')) {
    window.$('qrBox').innerHTML = `<img src="${window.getBarcodeURL(uid)}" style="border-radius:6px; margin:0 auto; width:100%; max-width:250px;">`;
  }
  
  if(window.$('btnMarkOnePrinted')) {
    if(c.stat === 'pending') window.$('btnMarkOnePrinted').innerHTML = window.iconLabel('check', 'Marquer Imprimé');
    else if(c.stat === 'printed') window.$('btnMarkOnePrinted').innerHTML = window.statusLabel('green', 'Marquer Initialisé');
    else window.$('btnMarkOnePrinted').innerHTML = window.iconLabel('undo-2', "Remettre à l'état Imprimé");
  }
  
  if(window.$('ovQR')) window.$('ovQR').classList.remove('hidden');
};

window.markOnePrinted = function() {
  if (!window.D || !Array.isArray(window.D.cours)) return;
  const c = window.D.cours.find(x => x.uid===window.curQRUid);
  if (!c) return;

  const nextStat = c.stat === 'pending' ? 'printed'
    : c.stat === 'printed' ? 'active'
    : 'printed';
  const uid = c.uid;

  if (window.DeviceSession && window.DeviceSession.canSecondaryPatch
      && window.DeviceSession.canSecondaryPatch()) {
    window.DeviceSession.saveSecondaryPatch(function (data) {
      if (!Array.isArray(data.cours)) throw new Error('cours cloud manquant');
      const row = data.cours.find(x => x.uid === uid);
      if (!row) throw new Error('Document introuvable dans le cloud');
      row.stat = nextStat;
    }).then(function () {
      window.renderCours && window.renderCours();
      window.showQR(uid);
      window.renderPrintGrid && window.renderPrintGrid();
    }).catch(function (err) {
      console.warn('Scan secondaire:', err);
      if (typeof window.sysAlert === 'function') {
        window.sysAlert('Impossible de synchroniser le statut depuis cet appareil.', 'Mode Secondaire');
      }
    });
    return;
  }

  if (window.DeviceSession && typeof window.DeviceSession.canFullSave === 'function'
      && !window.DeviceSession.canFullSave()) {
    if (typeof window.sysAlert === 'function') {
      window.sysAlert('Impossible de synchroniser le statut depuis cet appareil.', 'Mode Secondaire');
    }
    return;
  }

  c.stat = nextStat;
  window.save();
  window.renderCours();
  window.showQR(window.curQRUid);
  window.renderPrintGrid();
};

window.dlQR = function() {
  if(!window.curQRUid) return;
  const a = document.createElement('a');
  a.download = `Barcode_${window.curQRUid}.png`;
  a.href = window.getBarcodeURL(window.curQRUid);
  a.click();
};

window.renderPrintGrid = function() {
  const gridPending = window.$('printGridPending');
  const gridHistory = window.$('printGridHistory');
  if (!gridPending || !gridHistory || !window.D || !Array.isArray(window.D.cours)) return;
  
  const drawCard = (c) => `
    <div class="pcard ${window.printSel.has(c.uid)?'sel':''}" onclick="window.toggleSel('${window.escapeJsStr(c.uid)}')">
      <div class="pc-check">${window.printSel.has(c.uid) ? window.iconHtml('check', 14, 'icon-sm') : window.iconHtml('square', 14, 'icon-sm')}</div>
      <div class="pc-qr">
        <img src="${window.getBarcodeURL(c.uid)}" alt="barcode" style="width:90%; height:40px; object-fit:contain; margin-top:5px;">
      </div>
      <div class="pc-uid">${window.escHtml(c.uid)}</div>
      <div class="pc-title">${window.escHtml(c.title)}</div>
    </div>
  `;

  const pendingHtml = window.D.cours.filter(c => c.stat === 'pending' && !(c.role === 'unite' || c.isUnite)).map(drawCard).join('');
  const historyHtml = window.D.cours.filter(c => c.stat !== 'pending' && !(c.role === 'unite' || c.isUnite)).map(drawCard).join('');
  
  gridPending.innerHTML = pendingHtml || '<div style="grid-column:1/-1; color:var(--mut); font-size:12px; text-align:center; padding:10px;">' + window.iconLabel('sparkles', 'Tout est imprimé !') + '</div>';
  gridHistory.innerHTML = historyHtml || '<div style="grid-column:1/-1; color:var(--mut); font-size:12px; text-align:center; padding:10px;">Aucun historique.</div>';
  
  if(window.$('pStats')) window.$('pStats').textContent = window.printSel.size + ' sélectionné(s)';
  if (window.hydrateIcons) {
    window.hydrateIcons(gridPending);
    window.hydrateIcons(gridHistory);
  }
};

window.toggleSel = function(uid) {
  if (window.printSel.has(uid)) window.printSel.delete(uid);
  else window.printSel.add(uid);
  window.renderPrintGrid();
};

window.selPending = function() {
  if (!window.D || !Array.isArray(window.D.cours)) return;
  window.printSel = new Set(window.D.cours.filter(c=>c.stat==='pending' && !(c.role === 'unite' || c.isUnite)).map(c=>c.uid));
  window.renderPrintGrid();
};
window.selAll = function() {
  if (!window.D || !Array.isArray(window.D.cours)) return;
  window.printSel = new Set(window.D.cours.map(c=>c.uid));
  window.renderPrintGrid();
};
window.selNone = function() { window.printSel.clear(); window.renderPrintGrid(); };

window.executePrint = function() {
  if (!window.D || !Array.isArray(window.D.cours)) return;
  const sel = window.D.cours.filter(c => window.printSel.has(c.uid));
  if (!sel.length) {
    if(typeof window.sysAlert === 'function') window.sysAlert('Sélectionne au moins un document pour pouvoir imprimer !', 'Impression impossible');
    return;
  }
  
  const pz = window.$('printZone');
  if(!pz) return;
  
  pz.innerHTML = '';
  sel.forEach(c => {
    pz.innerHTML += `
      <div class="print-label">
        <img src="${window.getBarcodeURL(c.uid)}">
        <div class="pl-uid">${window.escHtml(c.uid)}</div>
        <div class="pl-title">${window.escHtml(String(c.title || '').substring(0,35))}</div>
      </div>`;
  });
  
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      pz.innerHTML = '';
      if(window.$('ovPrintConfirm')) window.$('ovPrintConfirm').classList.remove('hidden');
    }, 500);
  }, 1000);
};

window.confirmPrintSuccess = function(success) {
  window.closePrintConfirm();
  if (!success) return;
  if (!window.D || !Array.isArray(window.D.cours)) return;

  const uids = Array.from(window.printSel || []);
  const markPrinted = function (cours) {
    if (!Array.isArray(cours)) return 0;
    let n = 0;
    uids.forEach(function (uid) {
      const x = cours.find(function (d) { return d.uid === uid; });
      if (x && x.stat === 'pending') { x.stat = 'printed'; n++; }
    });
    return n;
  };
  const onOk = function () {
    window.printSel.clear();
    if (typeof window.renderCours === 'function') window.renderCours();
    if (typeof window.renderPrintGrid === 'function') window.renderPrintGrid();
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
  };
  const onFail = function (err) {
    console.warn('confirmPrintSuccess:', err);
    if (typeof window.sysAlert === 'function') {
      window.sysAlert('Impossible d’enregistrer le statut imprimé (mode lecture ou sync).', 'Enregistrement');
    }
  };

  if (window.DeviceSession && window.DeviceSession.canSecondaryPatch
      && window.DeviceSession.canSecondaryPatch()) {
    window.DeviceSession.saveSecondaryPatch(function (data) {
      if (!Array.isArray(data.cours)) throw new Error('cours cloud manquant');
      markPrinted(data.cours);
    }).then(onOk).catch(onFail);
    return;
  }

  if (typeof window.refuseSecondaryFullMutation === 'function'
      && window.refuseSecondaryFullMutation('Appareil secondaire : confirmation d’impression indisponible.')) {
    return;
  }
  if (window.DeviceSession && typeof window.DeviceSession.canFullSave === 'function'
      && !window.DeviceSession.canFullSave()) {
    onFail(new Error('SECONDARY_READ_ONLY'));
    return;
  }

  const prevByUid = Object.create(null);
  uids.forEach(function (uid) {
    const x = window.D.cours.find(function (d) { return d.uid === uid; });
    if (x) prevByUid[uid] = x.stat;
  });
  markPrinted(window.D.cours);
  Promise.resolve(window.save()).then(onOk).catch(function (err) {
    const msg = String(err && err.message || err || '');
    if (/SECONDARY_READ_ONLY|localStorage save failed|Sauvegarde refusée|corrompues|anti-wipe/i.test(msg)) {
      uids.forEach(function (uid) {
        const x = window.D.cours.find(function (d) { return d.uid === uid; });
        if (x && Object.prototype.hasOwnProperty.call(prevByUid, uid)) x.stat = prevByUid[uid];
      });
      onFail(err);
      return;
    }
    onOk();
  });
};

window._camLifecycle = Promise.resolve();

window.openCam = function() {
  if(window.$('manualCamInput')) window.$('manualCamInput').value = '';
  if(window.$('ovCam')) window.$('ovCam').classList.remove('hidden');

  if(window.$('camSt')) {
    window.$('camSt').style.color = 'var(--gold)';
    window.$('camSt').innerHTML = 'Démarrage de la caméra arrière...';
  }

  function begin() {
    if (typeof window.Html5Qrcode !== 'function') {
      const M = window.APP_MSG || {};
      const msg = M.SCANNER_LIB_MISSING || 'Le module caméra n\'est pas chargé. Utilise la saisie manuelle ou recharge la page.';
      if (window.$('camSt')) {
        window.$('camSt').style.color = 'var(--red)';
        window.$('camSt').innerHTML = window.iconLabel('circle-x', msg);
      }
      if (typeof window.sysAlert === 'function') window.sysAlert(msg, M.ERROR || 'Erreur');
      return;
    }
    window._camLifecycle = (window._camLifecycle || Promise.resolve()).catch(function() {}).then(function() {
      return window._openCamImpl();
    });
  }

  if (typeof window.Html5Qrcode === 'function') {
    begin();
    return;
  }
  var load = typeof window.ensureScannerLibs === 'function' ? window.ensureScannerLibs() : Promise.resolve();
  Promise.resolve(load).then(begin);
};

window._openCamImpl = function() {
  function stopExisting() {
    if (!window.html5QrCode) return Promise.resolve();
    const inst = window.html5QrCode;
    window.html5QrCode = null;
    return inst.stop().then(function() {
      try { inst.clear(); } catch(e) {}
    }).catch(function() {
      try { inst.clear(); } catch(e) {}
    });
  }

  return stopExisting().then(function() {
    try {
      window.html5QrCode = new window.Html5Qrcode("reader");
      const config = { fps: 15 };
      return window.html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          if(window.$('camSt')) {
            window.$('camSt').style.color = 'var(--grn)';
            window.$('camSt').innerHTML = window.iconLabel('check', 'Code-barres trouvé !');
          }
          window.processScan(decodedText.trim().toUpperCase());
        },
        () => {
          if(window.$('camSt') && window.$('camSt').innerHTML.includes('Démarrage')) {
            window.$('camSt').style.color = 'var(--mut)';
            window.$('camSt').innerHTML = 'Analyse en cours... Place le code-barres dans le cadre.';
          }
        }
      ).catch((err) => {
        if(window.$('camSt')) {
          window.$('camSt').style.color = 'var(--red)';
          window.$('camSt').innerHTML = window.iconLabel('circle-x', "Erreur d'accès à la caméra.");
        }
      });
    } catch(e) {
      if(window.$('camSt')) window.$('camSt').innerHTML = window.iconLabel('circle-x', 'Erreur : ' + window.escHtml(e.message));
      if (typeof window.recordAppError === 'function') {
        window.recordAppError('HTML5-QRCode: ' + e.message, 'scanner.js');
      }
    }
  });
};

window.manualScan = function() {
  const v = window.$('manualCamInput') ? window.$('manualCamInput').value.trim().toUpperCase() : '';
  if(v) window.processScan(v);
};

window.processScan = function(uid) {
  window.stopCam();
  window.doLocate(uid);

  // Secondaire : initialiser le statut printed → active via patch cloud ciblé
  if (window.DeviceSession && window.DeviceSession.canSecondaryPatch
      && window.DeviceSession.canSecondaryPatch()
      && window.D && Array.isArray(window.D.cours)) {
    var c = window.D.cours.find(function (x) { return x.uid === uid; });
    if (c && c.stat === 'printed') {
      window.DeviceSession.saveSecondaryPatch(function (data) {
        if (!Array.isArray(data.cours)) return;
        var row = data.cours.find(function (x) { return x.uid === uid; });
        if (row && row.stat === 'printed') row.stat = 'active';
      }).catch(function (err) {
        console.warn('processScan secondaire:', err);
      });
    }
  }
};

window.stopCam = function() {
  if(window.$('ovCam')) window.$('ovCam').classList.add('hidden');
  window._camLifecycle = (window._camLifecycle || Promise.resolve()).catch(function() {}).then(function() {
    if (!window.html5QrCode) return;
    const inst = window.html5QrCode;
    window.html5QrCode = null;
    return inst.stop().then(() => {
      try { inst.clear(); } catch(e) {}
    }).catch(() => {
      try { inst.clear(); } catch(e2) {}
    });
  });
};

// =========================================================================
// OUTIL DE DIAGNOSTIC SCANNER (ONGLET TEST)
// =========================================================================

window.debugQrCode = null;

window.logDebug = function(msg, color = 'var(--txt)') {
  const logs = window.$('debug-logs');
  if(!logs) return;
  const time = new Date().toLocaleTimeString();
  const body = (typeof msg === 'string' && msg.indexOf('<') >= 0) ? msg : window.escHtml(String(msg));
  logs.innerHTML = `<div style="color:${color}; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;"><span style="color:var(--mut)">[${time}]</span> ${body}</div>` + logs.innerHTML;
};

window.startDebugScanner = function() {
  const logs = window.$('debug-logs');
  if(logs) logs.innerHTML = '';
  window.logDebug("Initialisation de la caméra...", "var(--gold)");

  function run() {
    if (window.debugQrCode) { try { window.debugQrCode.clear(); } catch(e){} }

    if (typeof window.Html5Qrcode !== 'function') {
      window.logDebug("Module Html5Qrcode manquant.", "var(--red)");
      return;
    }

    try {
      window.debugQrCode = new window.Html5Qrcode("debug-reader");
      window.debugQrCode.start(
        { facingMode: "environment" },
        { fps: 15 },
        (decodedText, decodedResult) => {
          const format = (decodedResult && decodedResult.result && decodedResult.result.format && decodedResult.result.format.formatName) ? decodedResult.result.format.formatName : "Inconnu";
          window.logDebug('<span class="icon-inline-label">' + window.iconHtml('check', 16, 'icon-sm') + '<b>CODE DÉTECTÉ !</b><br>Valeur : <span style="color:#fff">' + window.escHtml(decodedText) + '</span><br>Format : <span style="color:#fff">' + window.escHtml(format) + '</span></span>', "var(--grn)");
          if (navigator.vibrate) navigator.vibrate(100);
        },
        (errorMessage) => {}
      ).then(() => {
        window.logDebug("Caméra démarrée ! Place n'importe quel code (Paquet de pâtes, livre, QR) devant l'objectif.", "var(--grn)");
      }).catch((err) => {
        window.logDebug(window.iconLabel('circle-x', 'Erreur critique caméra (Permissions iOS ?) : ' + err), "var(--red)");
      });
    } catch(e) {
      window.logDebug(window.iconLabel('circle-x', 'Erreur de lancement : ' + e.message), "var(--red)");
    }
  }

  var load = typeof window.ensureScannerLibs === 'function' ? window.ensureScannerLibs() : Promise.resolve();
  Promise.resolve(load).then(run);
};

window.stopDebugScanner = function() {
  if (window.debugQrCode) {
    window.debugQrCode.stop().then(() => {
        window.debugQrCode.clear();
        window.debugQrCode = null;
        window.logDebug(window.iconLabel('square', 'Scanner arrêté.'), "var(--mut)");
    }).catch(e => {
        window.debugQrCode.clear();
        window.debugQrCode = null;
    });
  }
};
