/**
 * =========================================================================================
 * 🧠 MASTER PROJECT CONTEXT & DOCUMENTATION (AI CONTEXT RETAINER)
 * =========================================================================================
 * NOM DU PROJET : Mes Cours - PC* Edition
 * FICHIER ACTUEL : scanner.js (Caméra, Code-barres 1D et Impression)
 * * 🏗️ ARCHITECTURE MULTI-FICHIERS (TRÈS IMPORTANT POUR L'IA) :
 * 1. app.js      : Cœur (Firebase, État global window.D, Navigation, Paramètres).
 * 2. data.js     : Gestion des données (Cours, Classeurs, Matières) et grilles HTML.
 * 3. scanner.js  : [CE FICHIER] Scanner de codes-barres 1D et logique d'impression.
 * =========================================================================================
 */

window.$ = window.$ || (id => document.getElementById(id));
window.printSel = new Set();
window.curQRUid = null;
window.html5QrCode = null;

// 🖨️ UTILITAIRE : GÉNÉRATEUR DE CODE-BARRES 1D
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
  
  if(window.$('qrLbl')) window.$('qrLbl').textContent = uid;
  
  if(window.$('qrBox')) {
    window.$('qrBox').innerHTML = `<img src="${window.getBarcodeURL(uid)}" style="border-radius:6px; margin:0 auto; width:100%; max-width:250px;">`;
  }
  
  if(window.$('btnMarkOnePrinted')) {
    if(c.stat === 'pending') window.$('btnMarkOnePrinted').textContent = '✅ Marquer Imprimé';
    else if(c.stat === 'printed') window.$('btnMarkOnePrinted').textContent = '🟢 Marquer Initialisé';
    else window.$('btnMarkOnePrinted').textContent = '↩️ Remettre à l\'état Imprimé';
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
};

window.dlQR = function() {
  if(!window.curQRUid) return;
  const a = document.createElement('a');
  a.download = `Barcode_${window.curQRUid}.png`;
  a.href = window.getBarcodeURL(window.curQRUid);
  a.click();
};

window.renderPrintGrid = function() {
  const grid = window.$('printGrid');
  if(!grid) return;
  
  grid.innerHTML = window.D.cours.map(c => `
    <div class="pcard ${window.printSel.has(c.uid)?'sel':''}" onclick="window.toggleSel('${c.uid}')">
      <div class="pc-check">${window.printSel.has(c.uid)?'✅':'⬜'}</div>
      <div class="pc-qr">
        <img src="${window.getBarcodeURL(c.uid)}" alt="barcode" style="width:90%; height:40px; object-fit:contain; margin-top:5px;">
      </div>
      <div class="pc-uid">${c.uid}</div>
      <div class="pc-title">${c.title}</div>
    </div>
  `).join('');
  
  if(window.$('pStats')) window.$('pStats').textContent = window.printSel.size + ' sélectionné(s)';
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
    alert('Sélectionne au moins un document !');
    return;
  }
  
  const pz = window.$('printZone');
  if(!pz) return;
  
  pz.innerHTML = '';
  sel.forEach(c => {
    pz.innerHTML += `
      <div class="print-label">
        <img src="${window.getBarcodeURL(c.uid)}">
        <div class="pl-uid">${c.uid}</div>
        <div class="pl-title">${c.title.substring(0,35)}</div>
      </div>`;
  });
  
  // 1 seconde de délai pour s'assurer que Safari a le temps de dessiner l'image
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      pz.innerHTML = '';
      if(window.$('ovPrintConfirm')) window.$('ovPrintConfirm').classList.remove('hidden');
    }, 500);
  }, 1000);
};

// 🚨 LA FONCTION QUI MANQUAIT EST ICI 🚨
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

  if (window.html5QrCode) { try { window.html5QrCode.clear(); } catch(e) {} }

  try {
    window.html5QrCode = new window.Html5Qrcode("reader");
    const config = { fps: 15 };

    window.html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText, decodedResult) => {
        if(window.$('camSt')) {
          window.$('camSt').style.color = 'var(--grn)';
          window.$('camSt').innerHTML = '✅ Code-barres trouvé !';
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
        window.$('camSt').innerHTML = `❌ Erreur d'accès à la caméra.`;
      }
    });

  } catch(e) {
    if(window.$('camSt')) window.$('camSt').innerHTML = `❌ Erreur : ${e.message}`;
    if(window.appErrors) window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "HTML5-QRCode: " + e.message, source: 'scanner.js', lineno: 0 });
  }
};

window.manualScan = function() {
  const v = window.$('manualCamInput') ? window.$('manualCamInput').value.trim().toUpperCase() : '';
  if(v) window.processScan(v);
};

window.processScan = function(uid) {
  window.stopCam();
  if(window.$('mainSearch')) window.$('mainSearch').value = uid;
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
