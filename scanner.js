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
window.printSel = new Set();
window.curQRUid = null;
window.html5QrCode = null;

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
  const c = window.D.cours.find(x => x.uid===uid);
  if (!c) return;
  window.curQRUid = uid;
  
  if(window.$('qrTitle')) window.$('qrTitle').innerHTML = window.iconLabel('qr-code', 'Code-Barres');
  if(window.$('qrSub')) window.$('qrSub').textContent = window.escHtml(c.title);
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
  const c = window.D.cours.find(x => x.uid===window.curQRUid);
  if (!c) return;
  
  if(c.stat === 'pending') c.stat = 'printed';
  else if(c.stat === 'printed') c.stat = 'active';
  else c.stat = 'printed';
  
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
  if(!gridPending || !gridHistory) return;
  
  const drawCard = (c) => `
    <div class="pcard ${window.printSel.has(c.uid)?'sel':''}" onclick="window.toggleSel('${c.uid}')">
      <div class="pc-check">${window.printSel.has(c.uid) ? window.iconHtml('check', 14, 'icon-sm') : window.iconHtml('square', 14, 'icon-sm')}</div>
      <div class="pc-qr">
        <img src="${window.getBarcodeURL(c.uid)}" alt="barcode" style="width:90%; height:40px; object-fit:contain; margin-top:5px;">
      </div>
      <div class="pc-uid">${window.escHtml(c.uid)}</div>
      <div class="pc-title">${window.escHtml(c.title)}</div>
    </div>
  `;

  const pendingHtml = window.D.cours.filter(c => c.stat === 'pending').map(drawCard).join('');
  const historyHtml = window.D.cours.filter(c => c.stat !== 'pending').map(drawCard).join('');
  
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

window.selPending = function() { window.printSel = new Set(window.D.cours.filter(c=>c.stat==='pending').map(c=>c.uid)); window.renderPrintGrid(); };
window.selAll = function() { window.printSel = new Set(window.D.cours.map(c=>c.uid)); window.renderPrintGrid(); };
window.selNone = function() { window.printSel.clear(); window.renderPrintGrid(); };

window.executePrint = function() {
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
        <div class="pl-title">${window.escHtml(c.title.substring(0,35))}</div>
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
  if(success) {
    window.printSel.forEach(uid => {
      const x = window.D.cours.find(d=>d.uid===uid);
      if(x && x.stat==='pending') x.stat = 'printed';
    });
    window.save(); 
    window.printSel.clear(); 
    window.renderCours(); 
    window.renderPrintGrid(); 
    window.renderDashboard();
  }
};

window.openCam = function() {
  if(window.$('manualCamInput')) window.$('manualCamInput').value = '';
  if(window.$('ovCam')) window.$('ovCam').classList.remove('hidden');

  if(window.$('camSt')) {
    window.$('camSt').style.color = 'var(--gold)';
    window.$('camSt').innerHTML = 'Démarrage de la caméra arrière...';
  }

  const startScanner = function() {
    try {
      window.html5QrCode = new window.Html5Qrcode("reader");
      const config = { fps: 15 };

      window.html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText, decodedResult) => {
          if(window.$('camSt')) {
            window.$('camSt').style.color = 'var(--grn)';
            window.$('camSt').innerHTML = window.iconLabel('check', 'Code-barres trouvé !');
          }
          window.processScan(decodedText.trim().toUpperCase());
        },
        (errorMessage) => {
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
      if(window.$('camSt')) window.$('camSt').innerHTML = window.iconLabel('circle-x', 'Erreur : ' + e.message);
      if(window.appErrors) window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "HTML5-QRCode: " + e.message, source: 'scanner.js', lineno: 0 });
    }
  };

  if (window.html5QrCode) {
    window.html5QrCode.stop().then(function() {
      try { window.html5QrCode.clear(); } catch(e) {}
      window.html5QrCode = null;
      startScanner();
    }).catch(function() {
      try { window.html5QrCode.clear(); } catch(e) {}
      window.html5QrCode = null;
      startScanner();
    });
  } else {
    startScanner();
  }
};

window.manualScan = function() {
  const v = window.$('manualCamInput') ? window.$('manualCamInput').value.trim().toUpperCase() : '';
  if(v) window.processScan(v);
};

window.processScan = function(uid) {
  window.stopCam();
  window.doLocate(uid);
};

window.stopCam = function() {
  if (window.html5QrCode) {
    window.html5QrCode.stop().then(() => {
        window.html5QrCode.clear();
        window.html5QrCode = null;
        if(window.$('ovCam')) window.$('ovCam').classList.add('hidden');
    }).catch(e => {
        window.html5QrCode.clear();
        window.html5QrCode = null;
        if(window.$('ovCam')) window.$('ovCam').classList.add('hidden');
    });
  } else {
    if(window.$('ovCam')) window.$('ovCam').classList.add('hidden');
  }
};

// =========================================================================
// OUTIL DE DIAGNOSTIC SCANNER (ONGLET TEST)
// =========================================================================

window.debugQrCode = null;

window.logDebug = function(msg, color = 'var(--txt)') {
  const logs = window.$('debug-logs');
  if(!logs) return;
  const time = new Date().toLocaleTimeString();
  logs.innerHTML = `<div style="color:${color}; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;"><span style="color:var(--mut)">[${time}]</span> ${msg}</div>` + logs.innerHTML;
};

window.startDebugScanner = function() {
  const logs = window.$('debug-logs');
  if(logs) logs.innerHTML = '';
  window.logDebug("Initialisation de la caméra...", "var(--gold)");

  if (window.debugQrCode) { try { window.debugQrCode.clear(); } catch(e){} }

  try {
    window.debugQrCode = new window.Html5Qrcode("debug-reader");
    
    window.debugQrCode.start(
      { facingMode: "environment" },
      { fps: 15 }, 
      (decodedText, decodedResult) => {
        const format = (decodedResult && decodedResult.result && decodedResult.result.format && decodedResult.result.format.formatName) ? decodedResult.result.format.formatName : "Inconnu";
        window.logDebug('<span class="icon-inline-label">' + window.iconHtml('check', 16, 'icon-sm') + '<b>CODE DÉTECTÉ !</b><br>Valeur : <span style="color:#fff">' + decodedText + '</span><br>Format : <span style="color:#fff">' + format + '</span></span>', "var(--grn)");
        if (navigator.vibrate) navigator.vibrate(100);
      },
      (errorMessage) => {
      }
    ).then(() => {
      window.logDebug("Caméra démarrée ! Place n'importe quel code (Paquet de pâtes, livre, QR) devant l'objectif.", "var(--grn)");
    }).catch((err) => {
      window.logDebug(window.iconLabel('circle-x', 'Erreur critique caméra (Permissions iOS ?) : ' + err), "var(--red)");
    });
  } catch(e) {
    window.logDebug(window.iconLabel('circle-x', 'Erreur de lancement : ' + e.message), "var(--red)");
  }
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
