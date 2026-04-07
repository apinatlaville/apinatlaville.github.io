/**
 * =========================================================================================
 * 🧠 MASTER PROJECT CONTEXT & DOCUMENTATION (AI CONTEXT RETAINER)
 * =========================================================================================
 * NOM DU PROJET : Mes Cours - PC* Edition
 * FICHIER ACTUEL : app.js (Cœur et Orchestrateur)
 * * 🏗️ ARCHITECTURE MULTI-FICHIERS (TRÈS IMPORTANT POUR L'IA) :
 * L'application est divisée en plusieurs fichiers pour sécuriser les modifications :
 * 1. app.js      : [CE FICHIER] Base de données Firebase, État global (window.D), 
 * Navigation (Onglets), Paramètres, Thèmes couleurs.
 * 2. data.js     : Gestion des données (Cours, Classeurs, Matières) et UI.
 * 3. scanner.js  : Scanner de codes-barres 1D et logique d'impression.
 * * 👉 RÈGLE POUR L'IA : Ne rien enlever, ajouter uniquement la détection d'erreurs (try/catch).
 * =========================================================================================
 */
/**
 * =========================================================================================
 * 🧠 MASTER PROJECT CONTEXT & DOCUMENTATION (AI CONTEXT RETAINER)
 * =========================================================================================
 * NOM DU PROJET : Mes Cours - PC* Edition
 * FICHIER ACTUEL : app.js (Cœur et Orchestrateur)
 * * 🏗️ ARCHITECTURE MULTI-FICHIERS (TRÈS IMPORTANT POUR L'IA) :
 * L'application est divisée en plusieurs fichiers pour sécuriser les modifications :
 * 1. app.js      : [CE FICHIER] Base de données Firebase, État global (window.D), 
 * Navigation (Onglets), Paramètres, Thèmes couleurs.
 * 2. data.js     : Gestion des données (Cours, Classeurs, Matières) et UI.
 * 3. scanner.js  : Scanner de codes-barres 1D et logique d'impression.
 * * 👉 RÈGLE POUR L'IA : Ne rien enlever, ajouter uniquement la détection d'erreurs (try/catch).
 * =========================================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

window.addEventListener('unhandledrejection', function(event) {
  const time = new Date().toLocaleTimeString();
  const errorMsg = event.reason ? event.reason.message || event.reason : "Erreur asynchrone inconnue";
  
  if(!window.appErrors) window.appErrors = [];
  window.appErrors.push({ time: time, msg: errorMsg, source: 'Firebase/Network', lineno: 0 });
  
  const toast = document.getElementById('errorToast');
  const toastMsg = document.getElementById('errorToastMsg');
  if(toast && toastMsg) {
    toastMsg.textContent = "Erreur Réseau : " + errorMsg;
    toast.classList.remove('hidden');
  }
  if(typeof window.renderErrorLogs === 'function') {
    window.renderErrorLogs();
  }
});

const firebaseConfig = {
  apiKey: "AIzaSyD4pMz1ydaWgNWLX0C4HTauRE7eHkrcAfA",
  authDomain: "cours-pc-application.firebaseapp.com",
  projectId: "cours-pc-application",
  storageBucket: "cours-pc-application.firebasestorage.app",
  messagingSenderId: "889951150073",
  appId: "1:889951150073:web:34ebc4f3c265144e3a6728",
  measurementId: "G-T4BHM2QHZ9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
window.docRef = doc(db, "app_data", "my_cours"); 

window.$ = window.$ || (id => document.getElementById(id));
const bindClick = (id, fn) => { const el = window.$(id); if(el) el.addEventListener('click', fn); };
const bindInput = (id, fn) => { const el = window.$(id); if(el) el.addEventListener('input', fn); };
const bindChange = (id, fn) => { const el = window.$(id); if(el) el.addEventListener('change', fn); };
const bindKey = (id, key, fn) => { const el = window.$(id); if(el) el.addEventListener('keydown', e => { if(e.key === key) fn(e); }); };

window.D = null; 
window.cloudConnected = false; 
window.pomoInterval = null; 
window.pomoTimeLeft = 25 * 60; 
window.pomoRunning = false; 
window.pomoMode = 'work'; 

window.sysAlert = function(msg, title="Information") {
  if(window.$('sysDialogTitle')) window.$('sysDialogTitle').innerHTML = title;
  if(window.$('sysDialogMsg')) window.$('sysDialogMsg').innerHTML = msg.replace(/\n/g, '<br>');
  if(window.$('sysDialogActs')) {
    window.$('sysDialogActs').innerHTML = `<button class="bp" onclick="window.closeSysDialog()" style="width:100%;">OK</button>`;
  }
  if(window.$('ovSysDialog')) window.$('ovSysDialog').classList.remove('hidden');
};

window.sysConfirm = function(msg, onConfirm, title="Attention") {
  if(window.$('sysDialogTitle')) window.$('sysDialogTitle').innerHTML = title;
  if(window.$('sysDialogMsg')) window.$('sysDialogMsg').innerHTML = msg.replace(/\n/g, '<br>');
  
  window._sysConfirmCallback = () => {
    window.closeSysDialog();
    if (onConfirm) onConfirm();
  };

  if(window.$('sysDialogActs')) {
    window.$('sysDialogActs').innerHTML = `
      <button class="bs" onclick="window.closeSysDialog()" style="flex:1;">Annuler</button>
      <button class="bp" onclick="window._sysConfirmCallback()" style="flex:1; background:var(--red); color:#fff; border-color:var(--red);">Confirmer</button>
    `;
  }
  if(window.$('ovSysDialog')) window.$('ovSysDialog').classList.remove('hidden');
};

window.closeSysDialog = function() {
  if(window.$('ovSysDialog')) window.$('ovSysDialog').classList.add('hidden');
};

window.updateCloudIndicator = function() {
  const d = window.$('cDot');
  const t = window.$('cTxt');
  if(!d || !t) return;
  
  if(window.cloudConnected) {
    d.style.background = 'var(--grn)';
    d.style.boxShadow = '0 0 8px var(--grn)';
    t.textContent = 'En ligne';
  } else {
    d.style.background = 'var(--red)';
    d.style.boxShadow = '0 0 8px var(--red)';
    t.textContent = 'Local';
  }
};

window.save = async function() { 
  localStorage.setItem('mc_v28', JSON.stringify(window.D)); 
  try {
    await setDoc(window.docRef, window.D);
    if(!window.cloudConnected) {
      window.cloudConnected = true;
      window.updateCloudIndicator();
    }
  } catch(e) {
    if(window.cloudConnected) {
      window.cloudConnected = false;
      window.updateCloudIndicator();
    }
  }
};

window.triggerHaptic = function() {
  if (navigator.vibrate) {
    try { navigator.vibrate(50); } catch(e) {}
  }
};

window.updateClock = function() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
  let dtStr = new Date().toLocaleString('fr-FR', options);
  const el = window.$('dateTimeDisp');
  if(el) el.textContent = dtStr.charAt(0).toUpperCase() + dtStr.slice(1);
};
setInterval(window.updateClock, 1000); 
window.updateClock();

window.closeLocPopup = function() { const lp = window.$('locPopup'); if(lp) lp.classList.remove('open'); };
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
  if (window.D.settings.theme === 'light') {
    document.body.classList.add('theme-light'); 
  } else {
    document.body.classList.remove('theme-light');
  }
  
  document.body.classList.remove('tmpl-default', 'tmpl-glass', 'tmpl-neo');
  document.body.classList.add('tmpl-' + window.D.settings.template);

  if (window.D.settings.compact) {
    document.body.classList.add('mode-compact'); 
  } else {
    document.body.classList.remove('mode-compact');
  }

  if(window.$('statsBand')) window.$('statsBand').classList.toggle('hidden-ui', !window.D.settings.showStats);
  if(window.$('matChips')) window.$('matChips').classList.toggle('hidden-ui', !window.D.settings.showChips);
  if(window.$('dashHeroArea')) window.$('dashHeroArea').style.display = window.D.settings.showDashHero ? 'block' : 'none';
  if(window.$('dashRevArea')) window.$('dashRevArea').style.display = window.D.settings.showDashRev ? 'block' : 'none';
  if(window.$('dashOverviewArea')) window.$('dashOverviewArea').style.display = window.D.settings.showDashOver ? 'block' : 'none';
  if(window.$('pomoWidget')) window.$('pomoWidget').style.display = window.D.settings.showPomo ? 'flex' : 'none';
  
  if(window.$('btnThemeToggle')) window.$('btnThemeToggle').textContent = window.D.settings.theme === 'light' ? 'Passer Sombre' : 'Passer Clair';
  if(window.$('btnCompactToggle')) window.$('btnCompactToggle').textContent = window.D.settings.compact ? 'Activé' : 'Désactivé';
  if(window.$('btnStatsToggle')) window.$('btnStatsToggle').textContent = window.D.settings.showStats ? 'Affiché' : 'Masqué';
  if(window.$('btnChipsToggle')) window.$('btnChipsToggle').textContent = window.D.settings.showChips ? 'Affiché' : 'Masqué';
  if(window.$('btnDashHeroToggle')) window.$('btnDashHeroToggle').textContent = window.D.settings.showDashHero ? 'Oui' : 'Non';
  if(window.$('btnDashRevToggle')) window.$('btnDashRevToggle').textContent = window.D.settings.showDashRev ? 'Oui' : 'Non';
  if(window.$('btnDashOverToggle')) window.$('btnDashOverToggle').textContent = window.D.settings.showDashOver ? 'Oui' : 'Non';
  if(window.$('btnPomoVisToggle')) window.$('btnPomoVisToggle').textContent = window.D.settings.showPomo ? 'Affiché' : 'Masqué';
  
  if(window.$('setUserName')) window.$('setUserName').value = window.D.settings.userName;
  if(window.$('setTemplate')) window.$('setTemplate').value = window.D.settings.template;
  if(window.$('setPomoWork')) window.$('setPomoWork').value = window.D.settings.pomoWork;
  if(window.$('setPomoBreak')) window.$('setPomoBreak').value = window.D.settings.pomoBreak;
  if(window.$('greeting')) window.$('greeting').textContent = `Bonjour, ${window.D.settings.userName}`;
};

window.loadDemo = function() {
  window.sysConfirm("Activer les tests va remplacer tes données actuelles.\n\nContinuer ?", async () => {
    window.D = JSON.parse(JSON.stringify(window.demoData)); 
    await window.save(); 
    location.reload();
  }, "Mode Démonstration");
};

window.resetData = function() {
  window.sysConfirm("⚠ ATTENTION !\n\nCette action va TOUT effacer pour repartir de ZÉRO (app vide).\n\nEs-tu sûr ?", async () => {
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

window.updatePomoUI = function() {
  if(window.$('pomoTime')) window.$('pomoTime').textContent = window.formatTime(window.pomoTimeLeft);
  if(window.$('btnPomoToggle')) window.$('btnPomoToggle').textContent = window.pomoRunning ? '⏸' : '▶';
  if(window.$('pomoWidget')) window.$('pomoWidget').className = `pomo-widget ${window.pomoMode}`;
};

window.pomoToggle = function() {
  if(window.pomoRunning) {
    clearInterval(window.pomoInterval);
    window.pomoRunning = false;
  } else {
    window.pomoRunning = true;
    window.pomoInterval = setInterval(() => {
      window.pomoTimeLeft--;
      if(window.pomoTimeLeft <= 0) {
        clearInterval(window.pomoInterval);
        window.pomoRunning = false;
        window.triggerHaptic(); 
        if(window.pomoMode === 'work') { 
          window.pomoMode = 'break'; 
          window.pomoTimeLeft = window.D.settings.pomoBreak * 60; 
          window.sysAlert("⏳ Fin du temps de travail ! Prends ta pause.", "Pomodoro"); 
        } else { 
          window.pomoMode = 'work'; 
          window.pomoTimeLeft = window.D.settings.pomoWork * 60; 
          window.sysAlert("⏳ Fin de la pause ! Au boulot.", "Pomodoro"); 
        }
      }
      window.updatePomoUI();
    }, 1000);
  }
  window.updatePomoUI();
};

window.pomoReset = function() {
  clearInterval(window.pomoInterval);
  window.pomoRunning = false;
  window.pomoMode = 'work';
  window.pomoTimeLeft = window.D.settings.pomoWork * 60;
  window.updatePomoUI();
};

window.genUid = function(matId) {
  try {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
    let rnd = '';
    for (let i = 0; i < 3; i++) {
      rnd += chars[Math.floor(Math.random() * chars.length)];
    }
    let prefix = matId.substring(0, 2).toUpperCase();
    while (prefix.length < 2) prefix += 'X'; 
    
    return prefix + '-' + rnd; 
  } catch(e) {
    if(window.appErrors) window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "Erreur genUid: " + e.message, source: 'app.js' });
    return 'XX-000';
  }
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

window.switchTab = function(tab, overrideResetFilters = false) {
  document.querySelectorAll('.tab').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === tab);
  });
  
  const map = {
    home:'paneHome',
    cours:'paneCours',
    notes:'paneNotes',
    flashcards:'paneFlashcards',
    print:'panePrint',
    classeurs:'paneClasseurs',
    matieres:'paneMatieres',
    settings:'paneSettings',
    logs:'paneLogs',
    test:'paneTest'
  };
  
  Object.values(map).forEach(id => { 
    const el = window.$(id);
    if(el) {
      el.classList.remove('on');
      el.classList.add('hidden');
    }
  });
  
  const target = window.$(map[tab]);
  if(target) {
    target.classList.remove('hidden');
    target.classList.add('on');
  }
  
  if(tab === 'home') {
    if(window.$('topSearchBar')) window.$('topSearchBar').classList.add('hidden-on-home');
    window.renderDashboard();
  } else {
    if(window.$('topSearchBar')) window.$('topSearchBar').classList.remove('hidden-on-home');
  }

  if (tab === 'cours') {
    if(overrideResetFilters) window.resetFilters();
    else window.renderCours();
  }
  if (tab === 'notes') window.renderNotes();
  if (tab === 'flashcards') window.renderFlashcards();
  if (tab === 'print') window.renderPrintGrid();
  if (tab === 'classeurs') {
    window.isEditingCl = false;
    window.renderClasseurs();
  }
  if (tab === 'matieres') {
    window.isEditingMat = false;
    window.renderMatieres();
  }
  if (tab === 'logs') window.renderErrorLogs();
  
  window.scrollTo(0,0);
  
  if (tab !== 'test' && typeof window.stopDebugScanner === 'function') {
    window.stopDebugScanner();
  }
};

window.renderDashboard = function() {
  const redCount = window.D.cours.filter(c => c.rev === 'red').length;
  const orangeCount = window.D.cours.filter(c => c.rev === 'orange').length;
  const greenCount = window.D.cours.filter(c => c.rev === 'green').length;

  if(window.$('dashRevGrid')) {
    window.$('dashRevGrid').innerHTML = `
      <div class="dash-card dash-red" onclick="window.switchTab('cours', true); document.getElementById('fltRev').value='red'; window.renderCours();">
        <div class="dash-num">${redCount}</div><div class="dash-lbl">À revoir urg.</div>
      </div>
      <div class="dash-card" onclick="window.switchTab('cours', true); document.getElementById('fltRev').value='orange'; window.renderCours();">
        <div class="dash-num" style="color:var(--gold); text-shadow: 0 0 10px rgba(240,192,96,0.4);">${orangeCount}</div><div class="dash-lbl">En cours</div>
      </div>
      <div class="dash-card" onclick="window.switchTab('cours', true); document.getElementById('fltRev').value='green'; window.renderCours();">
        <div class="dash-num" style="color:var(--grn); text-shadow: 0 0 10px rgba(80,216,144,0.4);">${greenCount}</div><div class="dash-lbl">Maîtrisés</div>
      </div>
    `;
  }

  if(window.$('dashOverviewGrid')) {
    window.$('dashOverviewGrid').innerHTML = `
      <div class="dash-card dash-acc" onclick="window.switchTab('cours', true);">
        <div class="dash-num">${window.D.cours.length}</div><div class="dash-lbl">Docs Totaux</div>
      </div>
      <div class="dash-card" onclick="window.switchTab('cours', true); document.getElementById('fltType').value='FICHE'; window.renderCours();">
        <div class="dash-num">${window.D.cours.filter(c => c.type === 'FICHE').length}</div><div class="dash-lbl">Fiches</div>
      </div>
      <div class="dash-card" onclick="window.switchTab('cours', true); document.getElementById('fltType').value='DS'; window.renderCours();">
        <div class="dash-num">${window.D.cours.filter(c => c.type === 'DS').length}</div><div class="dash-lbl">Sujets DS</div>
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
      window.$('todoList').innerHTML = '<div style="color:var(--mut); font-size:13px; text-align:center; padding:10px; background:var(--s2); border-radius:10px;">🎉 Rien d\'urgent ! Tout est maîtrisé.</div>';
    } else {
      window.$('todoList').innerHTML = todos.map(c => `
        <div class="todo-item" onclick="window.doLocate('${c.uid}')" style="border-left-color: ${c.rev === 'red' ? 'var(--red)' : 'var(--gold)'};">
          <div>
            <div class="todo-tit">${c.title}</div>
            <div class="todo-sub">${c.mat} • ${c.type}</div>
          </div>
          <button class="cbt">Go ➔</button>
        </div>
      `).join('');
    }
  }
};

window.drawKholle = function() {
  const toReview = window.D.cours.filter(c => c.rev === 'red' || c.rev === 'orange');
  if(!toReview.length) return window.sysAlert("Bravo ! Aucun document urgent à réviser.", "Khôlle");
  const winner = toReview[Math.floor(Math.random() * toReview.length)];
  window.doLocate(winner.uid);
};

window.renderNotes = function() {
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
      <div class="chart-bar-group" onclick="window.doLocate('${c.uid}')" title="${c.title} : ${c.note}/20">
        <div class="chart-bar" style="height: ${Math.max(5, heightPct)}%; background: linear-gradient(to top, transparent, ${colorClass}); border-top: 2px solid ${colorClass};">
          <span class="chart-val" style="color:${colorClass}">${c.note}</span>
        </div>
        <div class="chart-lbl">${c.mat}</div>
      </div>
    `;
  });
  wrapper.innerHTML = html;
};

window.renderFlashcards = function() {
  const grid = window.$('fcGrid');
  if(!grid) return;
  grid.innerHTML = window.PC_FLASHCARDS.map((fc) => `
    <div class="fc-card" onclick="this.classList.toggle('flipped')">
      <div class="fc-inner">
        <div class="fc-front">
          <div class="fc-mat">${fc.mat}</div>
          <div class="fc-text">${fc.q}</div>
        </div>
        <div class="fc-back">
          <div class="fc-ans">${fc.a}</div>
        </div>
      </div>
    </div>
  `).join('');
};

window.renderStats = function() {
  const pending = window.D.cours.filter(c => c.stat === 'pending').length;
  const printed = window.D.cours.filter(c => c.stat === 'printed').length;
  if(window.$('statsBand')) {
    window.$('statsBand').innerHTML =
      '<div class="stc"><span class="dot" style="background:#5b8df7"></span>' + window.D.cours.length + ' cours</div>' +
      '<div class="stc"><span class="dot" style="background:#50d890"></span>' + window.D.classeurs.length + ' classeurs</div>' +
      (pending ? '<div class="stc"><span class="dot" style="background:#f06060"></span>' + pending + ' À impr.</div>' : '') +
      (printed ? '<div class="stc"><span class="dot" style="background:#f0c060"></span>' + printed + ' À scanner</div>' : '');
  }
};

window.exportCsv = function() {
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
    container.innerHTML = '<div style="text-align:center; color:var(--mut); margin-top:50px;">Aucune erreur détectée ! 🎉</div>';
    return;
  }
  
  container.innerHTML = window.appErrors.map(e => `
    <div style="background:rgba(240,96,96,.1); border-left:4px solid var(--red); padding:10px; border-radius:4px;">
      <div style="font-size:11px; color:var(--mut);">${e.time} — Source: ${e.source}</div>
      <div style="font-family:'DM Mono', monospace; font-size:13px; color:var(--red); margin-top:4px;">${e.msg}</div>
    </div>
  `).reverse().join(''); 
};

window.clearErrorLogs = function() {
  window.sysConfirm("Vider l'historique des erreurs ?", () => {
    window.appErrors = [];
    window.renderErrorLogs();
  }, "Logs");
};

// ATTACHEMENT DYNAMIQUE DES ÉVÉNEMENTS
bindClick('btnOpenSettings', () => window.switchTab('settings'));
bindClick('btnRefresh', () => location.reload());
bindClick('btnThemeToggle', () => { window.D.settings.theme = window.D.settings.theme === 'light' ? 'dark' : 'light'; window.save(); window.applySettings(); });
bindClick('btnCompactToggle', () => { window.D.settings.compact = !window.D.settings.compact; window.save(); window.applySettings(); });
bindClick('btnStatsToggle', () => { window.D.settings.showStats = !window.D.settings.showStats; window.save(); window.applySettings(); });
bindClick('btnChipsToggle', () => { window.D.settings.showChips = !window.D.settings.showChips; window.save(); window.applySettings(); });
bindClick('btnDashHeroToggle', () => { window.D.settings.showDashHero = !window.D.settings.showDashHero; window.save(); window.applySettings(); });
bindClick('btnDashRevToggle', () => { window.D.settings.showDashRev = !window.D.settings.showDashRev; window.save(); window.applySettings(); });
bindClick('btnDashOverToggle', () => { window.D.settings.showDashOver = !window.D.settings.showDashOver; window.save(); window.applySettings(); });
bindClick('btnPomoVisToggle', () => { window.D.settings.showPomo = !window.D.settings.showPomo; window.save(); window.applySettings(); });

bindChange('setTemplate', (e) => { window.D.settings.template = e.target.value; window.save(); window.applySettings(); });
bindInput('setPomoWork', (e) => { window.D.settings.pomoWork = parseInt(e.target.value) || 25; window.save(); window.pomoReset(); });
bindInput('setPomoBreak', (e) => { window.D.settings.pomoBreak = parseInt(e.target.value) || 5; window.save(); window.pomoReset(); });
bindInput('setUserName', (e) => { window.D.settings.userName = e.target.value.trim() || "Étudiant"; window.save(); window.applySettings(); });

bindClick('btnPomoToggle', () => window.pomoToggle());
bindClick('btnPomoReset', () => window.pomoReset());
bindClick('btnHomeCam', () => window.openCam());
bindClick('btnKholleDraw', () => window.drawKholle());

// 🚨 ÉCOUTEURS RESTAURÉS
bindClick('btnHomeSearch', () => window.checkHomeCode(true));
bindInput('mainSearchText', () => window.renderCours());
bindInput('mainSearchCode', (e) => { window.doAutoFmtScan(e.target); });

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

async function initApp() {
  try {
    const docSnap = await getDoc(window.docRef);
    if (docSnap.exists()) {
      window.D = docSnap.data();
      window.cloudConnected = true;
    } else {
      const rawData = localStorage.getItem('mc_v28');
      window.D = rawData ? JSON.parse(rawData) : null;
      window.cloudConnected = true;
    }
  } catch (e) {
    const rawData = localStorage.getItem('mc_v28');
    window.D = rawData ? JSON.parse(rawData) : null;
    window.cloudConnected = false;
  }

  window.updateCloudIndicator();

  if(!window.D) window.D = JSON.parse(JSON.stringify(window.emptyData));
  if(!window.D.cours) window.D.cours = [];
  if(!window.D.classeurs) window.D.classeurs = JSON.parse(JSON.stringify(window.emptyData.classeurs));
  
  if(window.D.settings.showInitWarn === undefined) window.D.settings.showInitWarn = true;
  if(!window.D.settings.appColor) window.D.settings.appColor = '#5b8df7';

  window.D.classeurs.forEach(cl => {
    if(!cl.interNames) cl.interNames = {};
    if(!cl.maxInter) cl.maxInter = 12;
  });
  
  if(!window.D.matieres) window.D.matieres = JSON.parse(JSON.stringify(window.emptyData.matieres));
  if(!window.D.settings) window.D.settings = JSON.parse(JSON.stringify(window.emptyData.settings));
  
  // 🚨 RESTAURATION DU DÉMARRAGE DES CASES 2FA
  window.setupCodeBoxes();

  window.applySettings();
  
  window.renderMatieres();
  window.renderClasseurs();
  
  window.renderStats();
  window.switchTab('home');
}

initApp();
