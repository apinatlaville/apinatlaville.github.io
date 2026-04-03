/**
 * =========================================================================================
 * 🧠 MASTER PROJECT CONTEXT & DOCUMENTATION (AI CONTEXT RETAINER)
 * =========================================================================================
 * NOM DU PROJET : Mes Cours - PC* Edition
 * TYPE : Module métier Javascript (app.js)
 * * * 🛡️ GESTIONNAIRE D'ERREURS (WATCHDOG) INTÉGRÉ :
 * Ce fichier écoute les évènements `unhandledrejection` (erreurs réseau/Firebase).
 * Il possède les fonctions `renderErrorLogs()` et `clearErrorLogs()` pour afficher
 * toutes les anomalies stockées par le script Watchdog (situé dans index.html).
 * * * 🔒 MODE ÉDITION (SÉCURITÉ UX) :
 * Les listes de Matières et de Classeurs possèdent un mode "Édition" (isEditingMat / isEditingCl)
 * pour cacher les boutons de suppression par défaut et éviter les clics accidentels.
 * * * 📷 SCANNER DE DIAGNOSTIC AVANCÉ (ANTI-BUG IOS) :
 * Le scanner affiche désormais le `<canvas>` (miniature bordée de rouge) pour s'assurer
 * que Safari iOS ne passe pas un flux vidéo vide/transparent (Bug Canvas Fantôme).
 * Des trackings d'erreurs stricts sont rajoutés sur `getImageData`.
 * L'autofocus est forcé via `advanced: [{ focusMode: "continuous" }]`.
 * * * 🗂️ BASE DE DONNÉES RELATIONNELLE (NOMS D'INTERCALAIRES) :
 * Les classeurs (D.classeurs) possèdent maintenant une propriété `interNames` (Objet).
 * Clé : le numéro (ex: "01"), Valeur : le nom custom (ex: "Mécanique").
 * La fonction utilitaire `getInterName(cl, ns)` gère le rendu dynamique partout.
 * * * ✏️ ÉDITION INLINE (SANS PROMPT NAVIGATEUR) :
 * L'édition d'un classeur déclenche la modale `ovEditCl` pour modifier le nom, l'icône, 
 * le nombre MAX d'intercalaires, ET le nom de chaque intercalaire individuellement.
 * =========================================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// 🛡️ INTERCEPTEUR DES ERREURS ASYNCHRONES
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
const docRef = doc(db, "app_data", "my_cours"); 

const $ = id => document.getElementById(id);
const bindClick = (id, fn) => { const el = $(id); if(el) el.addEventListener('click', fn); };
const bindInput = (id, fn) => { const el = $(id); if(el) el.addEventListener('input', fn); };
const bindChange = (id, fn) => { const el = $(id); if(el) el.addEventListener('change', fn); };
const bindKey = (id, key, fn) => { const el = $(id); if(el) el.addEventListener('keydown', e => { if(e.key === key) fn(e); }); };

const COLORS = ['#5b8df7','#f0c060','#50d890','#f06060','#b06af7','#f06ab0','#60d0f0','#f09060'];

const PC_FLASHCARDS = [
  { mat: 'Physique', q: 'Loi de Fourier (Conduction thermique)', a: 'jQ = - λ . grad(T)' },
  { mat: 'Physique', q: 'Équation de Maxwell-Faraday', a: 'rot(E) = - ∂B / ∂t' },
  { mat: 'Physique', q: 'Équation de Maxwell-Ampère', a: 'rot(B) = μ0.j + μ0.ε0.(∂E/∂t)' },
  { mat: 'Chimie', q: 'Rendement du cycle de Carnot', a: 'η = 1 - (Tf / Tc)' },
  { mat: 'Chimie Orga', q: 'Oxydation douce d\'un alcool primaire', a: 'Donne un Aldéhyde (puis Acide carboxylique si oxydant en excès)' },
  { mat: 'Chimie Orga', q: 'Règle de Markovnikov (Add. électrophile)', a: 'Le proton s\'additionne sur le carbone le plus hydrogéné de la double liaison.' }
];

const emptyData = {
  settings: { userName: "Étudiant", theme: 'dark', template: 'glass', compact: false, showStats: true, showChips: true, showDashHero: true, showDashRev: true, showDashOver: true, showPomo: true, pomoWork: 25, pomoBreak: 5 },
  matieres: [
    {id:'PHYS', label:'PHYS', name:'Physique', color:'#5b8df7'},
    {id:'MATH', label:'MATH', name:'Mathématiques', color:'#f0c060'},
    {id:'CHIM', label:'CHIM', name:'Chimie', color:'#50d890'},
  ],
  classeurs: [
    {id:'A', name:'Classeur Phys A', icon:'📘', color:'#5b8df7', maxInter: 12, interNames: {}},
    {id:'B', name:'Classeur Maths B', icon:'📙', color:'#f0c060', maxInter: 12, interNames: {}},
    {id:'C', name:'Classeur Chim C', icon:'📗', color:'#50d890', maxInter: 12, interNames: {}},
  ],
  cours: [] 
};

let D = null; 
let cloudConnected = false; 

let editUid = null; 
let chipFilter = null; 
let newColor = COLORS[0];
let printSel = new Set(); 
let camStream = null; 
let camTick = null; 
let curQRUid = null;
let pomoInterval = null; 
let pomoTimeLeft = 25 * 60; 
let pomoRunning = false; 
let pomoMode = 'work'; 

let isEditingMat = false;
let isEditingCl = false;

// VARIABLES GLOBALES POUR L'ÉDITION DE CLASSEUR
let currentEditClId = null;

// 🗂️ UTILITAIRE : Récupère le nom personnalisé d'un intercalaire
function getInterName(cl, ns) {
  if (cl && cl.interNames && cl.interNames[ns]) {
    return cl.interNames[ns];
  }
  return `Intercalaire ${ns}`;
}

function toggleEditMat() {
  isEditingMat = !isEditingMat;
  renderMatieres();
}

function toggleEditCl() {
  isEditingCl = !isEditingCl;
  renderClasseurs();
}

function updateCloudIndicator() {
  const d = $('cDot');
  const t = $('cTxt');
  if(!d || !t) return;
  
  if(cloudConnected) {
    d.style.background = 'var(--grn)';
    d.style.boxShadow = '0 0 8px var(--grn)';
    t.textContent = 'En ligne';
    $('cloudStatus').title = 'Connecté à Firebase (Sauvegarde automatique)';
  } else {
    d.style.background = 'var(--red)';
    d.style.boxShadow = '0 0 8px var(--red)';
    t.textContent = 'Local';
    $('cloudStatus').title = 'Mode Hors-Ligne (Données en local uniquement)';
  }
}

const save = async function() { 
  localStorage.setItem('mc_v28', JSON.stringify(D)); 
  try {
    await setDoc(docRef, D);
    if(!cloudConnected) {
      cloudConnected = true;
      updateCloudIndicator();
    }
  } catch(e) {
    console.error("Erreur de sauvegarde Firebase :", e);
    if(cloudConnected) {
      cloudConnected = false;
      updateCloudIndicator();
    }
  }
};

const fmtD = d => {
  if(!d) return '';
  const [y,m,j] = d.split('-');
  return j+'/'+m+'/'+y;
};

function triggerHaptic() {
  if (navigator.vibrate) {
    try { navigator.vibrate(50); } catch(e) {}
  }
}

function updateClock() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
  let dtStr = now.toLocaleString('fr-FR', options);
  dtStr = dtStr.charAt(0).toUpperCase() + dtStr.slice(1);
  const el = $('dateTimeDisp');
  if(el) el.textContent = dtStr;
}
setInterval(updateClock, 1000); 
updateClock();

function stopCam() {
  try {
    if (camTick) {
      clearInterval(camTick);
      camTick = null;
    }
    if (camStream && typeof camStream.getTracks === 'function') {
      camStream.getTracks().forEach(t => { try { t.stop(); } catch(e){} });
    }
    camStream = null;
    const v = $('camVideo'); 
    if (v) {
      v.srcObject = null;
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
  } catch(e) {}
  const ov = $('ovCam');
  if(ov) ov.classList.add('hidden');
}

function closeLocPopup() {
  const lp = $('locPopup');
  if(lp) lp.classList.remove('open');
}

function closeModalCours() {
  const ov = $('ovCours');
  if(ov) ov.classList.add('hidden');
}

function closeQRModal() {
  const ov = $('ovQR');
  if(ov) ov.classList.add('hidden');
}

function closePrintConfirm() {
  const ov = $('ovPrintConfirm');
  if(ov) ov.classList.add('hidden');
}

document.addEventListener('click', function(e) {
  document.querySelectorAll('.ov').forEach(ov => {
    if (e.target === ov) {
      if (ov.id === 'ovCam') stopCam();
      else if (ov.id === 'ovQR') closeQRModal();
      else if (ov.id === 'ovCours') closeModalCours();
      else if (ov.id === 'ovPrintConfirm') closePrintConfirm();
      else if (ov.id === 'ovEditCl') ov.classList.add('hidden');
    }
  });
  const w = $('fabWrapper');
  if (w && w.classList.contains('open') && !w.contains(e.target)) {
    w.classList.remove('open');
  }
});

function toggleFab() {
  const w = $('fabWrapper');
  if(w) w.classList.toggle('open');
}

function closeFab() {
  const w = $('fabWrapper');
  if(w) w.classList.remove('open');
}

function applySettings() {
  if (D.settings.theme === 'light') {
    document.body.classList.add('theme-light'); 
  } else {
    document.body.classList.remove('theme-light');
  }
  
  document.body.classList.remove('tmpl-default', 'tmpl-glass', 'tmpl-neo');
  document.body.classList.add('tmpl-' + D.settings.template);

  if (D.settings.compact) {
    document.body.classList.add('mode-compact'); 
  } else {
    document.body.classList.remove('mode-compact');
  }

  if($('statsBand')) $('statsBand').classList.toggle('hidden-ui', !D.settings.showStats);
  if($('matChips')) $('matChips').classList.toggle('hidden-ui', !D.settings.showChips);
  if($('dashHeroArea')) $('dashHeroArea').style.display = D.settings.showDashHero ? 'block' : 'none';
  if($('dashRevArea')) $('dashRevArea').style.display = D.settings.showDashRev ? 'block' : 'none';
  if($('dashOverviewArea')) $('dashOverviewArea').style.display = D.settings.showDashOver ? 'block' : 'none';
  if($('pomoWidget')) $('pomoWidget').style.display = D.settings.showPomo ? 'flex' : 'none';
  
  if($('btnThemeToggle')) $('btnThemeToggle').textContent = D.settings.theme === 'light' ? 'Passer Sombre' : 'Passer Clair';
  if($('btnCompactToggle')) $('btnCompactToggle').textContent = D.settings.compact ? 'Activé' : 'Désactivé';
  if($('btnStatsToggle')) $('btnStatsToggle').textContent = D.settings.showStats ? 'Affiché' : 'Masqué';
  if($('btnChipsToggle')) $('btnChipsToggle').textContent = D.settings.showChips ? 'Affiché' : 'Masqué';
  if($('btnDashHeroToggle')) $('btnDashHeroToggle').textContent = D.settings.showDashHero ? 'Oui' : 'Non';
  if($('btnDashRevToggle')) $('btnDashRevToggle').textContent = D.settings.showDashRev ? 'Oui' : 'Non';
  if($('btnDashOverToggle')) $('btnDashOverToggle').textContent = D.settings.showDashOver ? 'Oui' : 'Non';
  if($('btnPomoVisToggle')) $('btnPomoVisToggle').textContent = D.settings.showPomo ? 'Affiché' : 'Masqué';
  
  if($('setUserName')) $('setUserName').value = D.settings.userName;
  if($('setTemplate')) $('setTemplate').value = D.settings.template;
  if($('setPomoWork')) $('setPomoWork').value = D.settings.pomoWork;
  if($('setPomoBreak')) $('setPomoBreak').value = D.settings.pomoBreak;
  if($('greeting')) $('greeting').textContent = `Bonjour, ${D.settings.userName}`;
}

function loadDemo() {
  if(confirm("Activer les tests va remplacer tes données actuelles par les cours de démonstration.\n\nContinuer ?")) {
    D = JSON.parse(JSON.stringify(emptyData)); 
    D.cours = DEMO_COURS;
    save(); 
    location.reload();
  }
}

function resetData() {
  if(confirm("⚠ ATTENTION !\n\nCette action va TOUT effacer pour repartir de ZÉRO (app vide).\n\nEs-tu sûr ?")) {
    D = JSON.parse(JSON.stringify(emptyData)); 
    save(); 
    location.reload();
  }
}

function formatTime(s) {
  const m = Math.floor(s / 60); 
  const sc = s % 60;
  return `${m.toString().padStart(2,'0')}:${sc.toString().padStart(2,'0')}`;
}

function updatePomoUI() {
  if($('pomoTime')) $('pomoTime').textContent = formatTime(pomoTimeLeft);
  if($('btnPomoToggle')) $('btnPomoToggle').textContent = pomoRunning ? '⏸' : '▶';
  if($('pomoWidget')) $('pomoWidget').className = `pomo-widget ${pomoMode}`;
}

function pomoToggle() {
  if(pomoRunning) {
    clearInterval(pomoInterval);
    pomoRunning = false;
  } else {
    pomoRunning = true;
    pomoInterval = setInterval(() => {
      pomoTimeLeft--;
      if(pomoTimeLeft <= 0) {
        clearInterval(pomoInterval);
        pomoRunning = false;
        triggerHaptic(); 
        if(pomoMode === 'work') { 
          pomoMode = 'break'; 
          pomoTimeLeft = D.settings.pomoBreak * 60; 
          alert("⏳ Fin du temps de travail ! Prends ta pause."); 
        } else { 
          pomoMode = 'work'; 
          pomoTimeLeft = D.settings.pomoWork * 60; 
          alert("⏳ Fin de la pause ! Au boulot."); 
        }
      }
      updatePomoUI();
    }, 1000);
  }
  updatePomoUI();
}

function pomoReset() {
  clearInterval(pomoInterval);
  pomoRunning = false;
  pomoMode = 'work';
  pomoTimeLeft = D.settings.pomoWork * 60;
  updatePomoUI();
}

function genUid(matId) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rnd = '';
  for (let i = 0; i < 4; i++) {
    rnd += chars[Math.floor(Math.random() * chars.length)];
  }
  return matId.slice(0,4) + '-' + rnd;
}

function doAutoFmtScan(inputEl) {
  if(!inputEl) return;
  const raw = inputEl.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
  let s1='', s2='';
  let i = 0;
  while(i < raw.length && /[A-Z]/.test(raw[i]) && s1.length < 4) {
    s1 += raw[i++];
  }
  while(i < raw.length && s2.length < 4) {
    s2 += raw[i++];
  }
  let res = s1;
  if(s2) res += '-' + s2;
  
  if(raw.length > 0 && raw.length <= 8 && /^[A-Z]{1,4}[A-Z0-9]{0,4}$/.test(raw)) {
    if(inputEl.value !== res) {
      inputEl.value = res;
      inputEl.selectionStart = inputEl.selectionEnd = res.length;
    }
  }
}

function switchTab(tab, overrideResetFilters = false) {
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
    logs:'paneLogs'
  };
  
  Object.values(map).forEach(id => { 
    const el = $(id);
    if(el) {
      el.classList.remove('on');
      el.classList.add('hidden');
    }
  });
  
  const target = $(map[tab]);
  if(target) {
    target.classList.remove('hidden');
    target.classList.add('on');
  }
  
  if(tab === 'home') {
    if($('topSearchBar')) $('topSearchBar').classList.add('hidden-on-home');
    renderDashboard();
  } else {
    if($('topSearchBar')) $('topSearchBar').classList.remove('hidden-on-home');
  }

  if (tab === 'cours') {
    if(overrideResetFilters) resetFilters();
    else renderCours();
  }
  if (tab === 'notes') renderNotes();
  if (tab === 'flashcards') renderFlashcards();
  if (tab === 'print') renderPrintGrid();
  if (tab === 'classeurs') {
    isEditingCl = false;
    renderClasseurs();
  }
  if (tab === 'matieres') {
    isEditingMat = false;
    renderMatieres();
  }
  if (tab === 'logs') renderErrorLogs();
  
  window.scrollTo(0,0);
}

function renderDashboard() {
  const redCount = D.cours.filter(c => c.rev === 'red').length;
  const orangeCount = D.cours.filter(c => c.rev === 'orange').length;
  const greenCount = D.cours.filter(c => c.rev === 'green').length;

  if($('dashRevGrid')) {
    $('dashRevGrid').innerHTML = `
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

  if($('dashOverviewGrid')) {
    $('dashOverviewGrid').innerHTML = `
      <div class="dash-card dash-acc" onclick="window.switchTab('cours', true);">
        <div class="dash-num">${D.cours.length}</div><div class="dash-lbl">Docs Totaux</div>
      </div>
      <div class="dash-card" onclick="window.switchTab('cours', true); document.getElementById('fltType').value='FICHE'; window.renderCours();">
        <div class="dash-num">${D.cours.filter(c => c.type === 'FICHE').length}</div><div class="dash-lbl">Fiches</div>
      </div>
      <div class="dash-card" onclick="window.switchTab('cours', true); document.getElementById('fltType').value='DS'; window.renderCours();">
        <div class="dash-num">${D.cours.filter(c => c.type === 'DS').length}</div><div class="dash-lbl">Sujets DS</div>
      </div>
    `;
  }

  const todos = D.cours.filter(c => c.rev === 'red' || c.rev === 'orange')
                       .sort((a,b) => {
                          if(a.rev === 'red' && b.rev !== 'red') return -1;
                          if(a.rev !== 'red' && b.rev === 'red') return 1;
                          return new Date(a.date) - new Date(b.date);
                       }).slice(0, 5);
  
  if($('todoList')) {
    if(!todos.length) {
      $('todoList').innerHTML = '<div style="color:var(--mut); font-size:13px; text-align:center; padding:10px; background:var(--s2); border-radius:10px;">🎉 Rien d\'urgent ! Tout est maîtrisé.</div>';
    } else {
      $('todoList').innerHTML = todos.map(c => `
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
}

function drawKholle() {
  const toReview = D.cours.filter(c => c.rev === 'red' || c.rev === 'orange');
  if(!toReview.length) return alert("Bravo ! Aucun document urgent à réviser.");
  const winner = toReview[Math.floor(Math.random() * toReview.length)];
  doLocate(winner.uid);
}

function renderNotes() {
  const notesDocs = D.cours.filter(c => (c.type === 'DS' || c.type === 'KHOLLE') && c.note !== '' && c.note !== undefined);
  notesDocs.sort((a,b) => new Date(a.date) - new Date(b.date));
  
  const wrapper = $('chartWrapper');
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
}

function renderFlashcards() {
  const grid = $('fcGrid');
  if(!grid) return;
  grid.innerHTML = PC_FLASHCARDS.map((fc) => `
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
}

function renderStats() {
  const pending = D.cours.filter(c => c.stat === 'pending').length;
  const printed = D.cours.filter(c => c.stat === 'printed').length;
  if($('statsBand')) {
    $('statsBand').innerHTML =
      '<div class="stc"><span class="dot" style="background:#5b8df7"></span>' + D.cours.length + ' cours</div>' +
      '<div class="stc"><span class="dot" style="background:#50d890"></span>' + D.classeurs.length + ' classeurs</div>' +
      (pending ? '<div class="stc"><span class="dot" style="background:#f06060"></span>' + pending + ' À impr.</div>' : '') +
      (printed ? '<div class="stc"><span class="dot" style="background:#f0c060"></span>' + printed + ' À scanner</div>' : '');
  }
}

function resetFilters() {
  ['fltType', 'fltRev', 'fltMat', 'fltCl', 'fltQr', 'mainSearch'].forEach(id => {
    if($(id)) $(id).value = '';
  });
  chipFilter = null;
  renderCours();
}

function renderCours() {
  try {
    const allM = [...new Set(D.cours.map(c => c.mat))];
    const allC = [...new Set(D.cours.map(c => c.cl))];
    const ms = $('fltMat');
    const cs = $('fltCl');
    
    if(ms && cs) {
      const mv = ms.value, cv = cs.value;
      ms.innerHTML = '<option value="">Toutes matières</option>' + allM.map(m => {
        const mo = D.matieres.find(x => x.id===m) || {name:m};
        return `<option value="${m}" ${m===mv?'selected':''}>${mo.name}</option>`;
      }).join('');
      cs.innerHTML = '<option value="">Tous classeurs</option>' + allC.map(c => {
        const co = D.classeurs.find(x => x.id===c) || {name:c};
        return `<option value="${c}" ${c===cv?'selected':''}>${co.name}</option>`;
      }).join('');
    }
    
    if($('matChips')) {
      $('matChips').innerHTML = '<button class="chip' + (chipFilter===null?' on':'') + '" data-chip="null">Tous</button>' +
        D.matieres.map(m => `
          <button class="chip${chipFilter===m.id?' on':''}" data-chip="${m.id}" style="${chipFilter===m.id ? 'background:'+m.color+';border-color:'+m.color : 'border-color:'+m.color+'60;color:'+m.color}">${m.label}</button>
        `).join('');
        
      $('matChips').querySelectorAll('.chip').forEach(btn => {
        btn.addEventListener('click', () => {
          chipFilter = btn.dataset.chip==='null' ? null : btn.dataset.chip;
          renderCours();
        });
      });
    }

    const q = $('mainSearch') ? $('mainSearch').value.toLowerCase().trim() : '';
    const qrf = $('fltQr') ? $('fltQr').value : '';
    const fType = $('fltType') ? $('fltType').value : '';
    const fRev = $('fltRev') ? $('fltRev').value : '';
    
    const list = D.cours.filter(c => {
      const mo = D.matieres.find(x => x.id===c.mat) || {name:''};
      return (!q || c.title.toLowerCase().includes(q) || c.uid.toLowerCase().includes(q) || mo.name.toLowerCase().includes(q) || (c.desc||'').toLowerCase().includes(q))
        && (!ms || !ms.value || c.mat===ms.value)
        && (!cs || !cs.value || c.cl===cs.value)
        && (!chipFilter || c.mat===chipFilter)
        && (!qrf || c.stat === qrf)
        && (!fType || c.type === fType)
        && (!fRev || c.rev === fRev);
    });

    list.sort((a,b) => {
      if(a.mat !== b.mat) return a.mat.localeCompare(b.mat);
      if(a.cl !== b.cl) return a.cl.localeCompare(b.cl);
      return a.inter.localeCompare(b.inter);
    });

    const grid = $('coursGrid');
    if(grid) {
      if (!list.length) {
        grid.innerHTML = '<div class="empty"><h3>Aucun document trouvé</h3></div>';
        renderStats();
        return;
      }

      let html = '';
      let currentMat = '';

      list.forEach(c => {
        const mo = D.matieres.find(x => x.id===c.mat) || {color:'#6a6a88', label:c.mat, name:c.mat};
        const co = D.classeurs.find(x => x.id===c.cl) || {name:c.cl, icon:'📁'};
        
        // 🗂️ AFFICHAGE DU NOM D'INTERCALAIRE PERSONNALISÉ SUR LA CARTE
        const interNameDisplay = getInterName(co, c.inter);

        if (c.mat !== currentMat) {
          html += `<div style="grid-column: 1/-1; margin-top: 15px; border-bottom: 2px solid ${mo.color}; padding-bottom: 5px;"><h3 style="font-family: 'Syne'; color: ${mo.color};">${mo.name}</h3></div>`;
          currentMat = c.mat;
        }

        let warnHtml = '';
        if (c.stat === 'pending') warnHtml = '<div class="qr-warn">🔴 À imprimer</div>';
        else if (c.stat === 'printed') warnHtml = '<div class="qr-scan-req">🟠 Imprimé. Scanne pour initialiser.</div>';

        html += `
        <div class="card" style="border-left-color:${mo.color}" onclick="window.doLocate('${c.uid}')">
          <div class="rev-dot rev-${c.rev}"></div>
          <div class="uid-badge">${c.uid}</div>
          <div class="ctop">
            <div class="cbadges">
              <span class="bm" style="background:${mo.color}20;color:${mo.color};border:1px solid ${mo.color}60">${mo.label}</span>
              <span class="bm badge-type">${c.type}</span>
            </div>
          </div>
          <div class="ctitle">${c.title}</div>
          <div class="clocs">
            <span class="cloc cloc-a">${co.icon} ${co.name}</span>
            <span class="cloc cloc-b">📑 ${interNameDisplay}</span>
          </div>
          ${c.desc ? `<div class="cdesc">${c.desc}</div>` : ''}
          ${c.note ? `<div class="cnote">Note : ${c.note}/20</div>` : ''}
          <div class="cacts" onclick="event.stopPropagation();">
              <button class="cbt" onclick="window.showQR('${c.uid}')" title="Voir QR">🔳</button>
              <button class="cbt" onclick="window.editCours('${c.uid}')" title="Modifier">✏️</button>
              <button class="cbt" style="color:var(--red); border-color:var(--red);" onclick="window.delCours('${c.uid}')" title="Supprimer">🗑️</button>
          </div>
          ${warnHtml}
        </div>`;
      });
      grid.innerHTML = html;
    }
    renderStats();
  } catch(e) {
    if(window.appErrors) {
      window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "Crash renderCours: " + e.message, source: 'app.js', lineno: 0 });
    }
  }
}

function doLocate(uid) {
  const c = D.cours.find(x => x.uid === uid);
  if (!c) {
    if($('locContent')) {
      $('locContent').innerHTML = `
        <div style="text-align:center;padding:10px 0">
          <div style="font-size:32px;margin-bottom:8px">❌</div>
          <div style="font-family:'DM Mono',monospace;font-size:22px;color:var(--red);margin-bottom:6px;font-weight:bold;">${uid}</div>
          <div style="color:var(--mut);font-size:13px">Code introuvable.</div>
        </div>`;
    }
    if($('locPopup')) $('locPopup').classList.add('open');
    return;
  }
  
  triggerHaptic();

  let validationMsg = '';
  if (c.stat === 'printed') {
    c.stat = 'active';
    save();
    renderCours();
    renderDashboard();
    validationMsg = '<div style="background:rgba(80,216,144,.15);border:1px solid var(--grn);color:var(--grn);padding:10px;border-radius:10px;text-align:center;font-weight:bold;margin-bottom:15px;">✅ Document initialisé et classé !</div>';
  }

  const mo = D.matieres.find(m => m.id === c.mat) || {name: c.mat, color:'#5b8df7'};
  const co = D.classeurs.find(x => x.id === c.cl) || {name: c.cl, icon: '📁'};
  
  // 🗂️ AFFICHAGE DU NOM D'INTERCALAIRE PERSONNALISÉ
  const interNameDisplay = getInterName(co, c.inter);
  
  if($('locContent')) {
    $('locContent').innerHTML = validationMsg + `
      <div class="loc-code">${c.uid}</div>
      <div class="loc-title">${c.title}</div>
      <div class="loc-cards">
        <div class="loc-c" style="background:rgba(91,141,247,.15);color:var(--acc);border:1px solid var(--acc);">${co.icon} ${co.name}</div>
        <div class="loc-c" style="background:rgba(240,192,96,.15);color:var(--gold);border:1px solid var(--gold);">📑 ${interNameDisplay}</div>
      </div>
      <div style="text-align:center;margin-top:5px;font-size:12px;font-weight:bold;color:${mo.color}">${c.type}</div>
      ${c.note ? `<div style="text-align:center;font-weight:bold;font-size:16px;color:var(--acc);margin-top:10px;">Note : ${c.note}/20</div>` : ''}
      ${c.desc ? `<div class="loc-desc">${c.desc}</div>` : ''}
    `;
  }
  if($('locPopup')) $('locPopup').classList.add('open');
}

function delCours(uid) {
  if (!confirm('Supprimer le document ' + uid + ' ?')) return;
  D.cours = D.cours.filter(c => c.uid !== uid);
  save();
  renderCours();
  renderDashboard();
  renderNotes();
  renderClasseurs();
}

function toggleNoteField() {
  const t = $('fType') ? $('fType').value : '';
  if($('fgNote')) {
    if(t === 'DS' || t === 'KHOLLE') {
      $('fgNote').style.display = 'block';
    } else {
      $('fgNote').style.display = 'none';
      if($('fNote')) $('fNote').value = '';
    }
  }
}

function toggleManualUid() {
  const isManual = $('fManualUidToggle').checked;
  if (isManual) {
    $('uidBox').style.display = 'none';
    $('fUidInput').style.display = 'block';
    $('fUidInput').focus();
  } else {
    $('uidBox').style.display = 'block';
    $('fUidInput').style.display = 'none';
  }
}

// 🗂️ MISE À JOUR DYNAMIQUE DES INTERCALAIRES LORS DE L'AJOUT
function updateIntercalairesDropdown() {
  const clId = $('fCl') ? $('fCl').value : '';
  const cl = D.classeurs.find(c => c.id === clId);
  const maxI = cl ? (cl.maxInter || 12) : 12;
  
  if($('fInter')) {
    $('fInter').innerHTML = '<option value="">—</option>' + 
      Array.from({length: maxI}, (_, i) => {
        const val = String(i + 1).padStart(2, '0');
        const customName = getInterName(cl, val);
        return `<option value="${val}">${val} - ${customName}</option>`;
      }).join('');
  }
}

function openModalCours() {
  editUid = null;
  if($('mTitle')) $('mTitle').textContent = '✨ Ajouter un document';
  if($('fTitle')) $('fTitle').value = ''; 
  if($('fDesc')) $('fDesc').value = ''; 
  if($('fMat')) $('fMat').innerHTML = '<option value="">— Choisir —</option>' + D.matieres.map(m => `<option value="${m.id}">${m.label} — ${m.name}</option>`).join('');
  if($('fCl')) $('fCl').innerHTML = '<option value="">— Choisir —</option>' + D.classeurs.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  updateIntercalairesDropdown(); 
  if($('fInter')) $('fInter').value = ''; 
  if($('fType')) $('fType').value = 'COURS'; 
  if($('fRev')) $('fRev').value = 'green';
  if($('fNote')) $('fNote').value = '';
  toggleNoteField();
  
  if($('fManualUidToggle')) {
    $('fManualUidToggle').checked = false;
    $('lblManualUid').style.display = 'flex'; 
  }
  if($('fUidInput')) {
    $('fUidInput').value = '';
    $('fUidInput').style.display = 'none';
  }
  if($('uidBox')) {
    $('uidBox').style.display = 'block';
    $('uidBox').innerHTML = '—<br><small style="font-size:10px; font-weight:normal; color:var(--mut);">QR code généré automatiquement</small>';
  }
  
  if($('ovCours')) $('ovCours').classList.remove('hidden');
}

function editCours(uid) {
  const c = D.cours.find(x => x.uid===uid);
  if (!c) return;
  editUid = uid;
  if($('mTitle')) $('mTitle').textContent = '✏️ Modifier le document';
  if($('fTitle')) $('fTitle').value = c.title; 
  if($('fDesc')) $('fDesc').value = c.desc || ''; 
  if($('fType')) $('fType').value = c.type || 'COURS'; 
  if($('fRev')) $('fRev').value = c.rev || 'green';
  if($('fNote')) $('fNote').value = c.note || '';
  toggleNoteField();
  if($('fMat')) $('fMat').innerHTML = D.matieres.map(m => `<option value="${m.id}" ${m.id===c.mat?'selected':''}>${m.label}</option>`).join('');
  if($('fCl')) $('fCl').innerHTML = D.classeurs.map(x => `<option value="${x.id}" ${x.id===c.cl?'selected':''}>${x.icon} ${x.name}</option>`).join('');
  updateIntercalairesDropdown();
  if($('fInter')) $('fInter').value = c.inter;
  
  if($('lblManualUid')) $('lblManualUid').style.display = 'none';
  if($('fUidInput')) $('fUidInput').style.display = 'none';
  if($('uidBox')) {
    $('uidBox').style.display = 'block';
    $('uidBox').innerHTML = c.uid + '<br><small style="font-size:10px; font-weight:normal; color:var(--mut);">Code permanent</small>';
  }
  
  if($('ovCours')) $('ovCours').classList.remove('hidden');
}

function saveCours() {
  const title = $('fTitle')?$('fTitle').value.trim():'';
  const mat = $('fMat')?$('fMat').value:'';
  const cl = $('fCl')?$('fCl').value:'';
  const inter = $('fInter')?$('fInter').value:'';
  
  if (!title || !mat || !cl || !inter) {
    alert('Remplis tous les champs obligatoires');
    return;
  }
  
  const obj = {
    title, 
    type:$('fType')?$('fType').value:'', 
    rev:$('fRev')?$('fRev').value:'', 
    mat, 
    cl, 
    inter, 
    note:$('fNote')?$('fNote').value:'', 
    desc: $('fDesc')?$('fDesc').value.trim():''
  };
  
  if(!obj.date) obj.date = new Date().toISOString().split('T')[0];

  if (editUid) {
    const idx = D.cours.findIndex(c => c.uid===editUid);
    if(idx > -1) {
      obj.uid = D.cours[idx].uid;
      obj.stat = D.cours[idx].stat; 
      if(D.cours[idx].date) obj.date = D.cours[idx].date;
      D.cours[idx] = obj;
    }
  } else {
    let newUid = '';
    if ($('fManualUidToggle') && $('fManualUidToggle').checked) {
      newUid = $('fUidInput').value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (!newUid) {
        alert("Veuillez saisir un identifiant valide.");
        return;
      }
      if (D.cours.find(c => c.uid === newUid)) {
        alert("Code déjà utilisé !");
        return;
      }
    } else {
      newUid = genUid(mat);
    }
    obj.uid = newUid;
    obj.stat = 'pending'; 
    D.cours.unshift(obj);
  }
  
  save();
  closeModalCours();
  renderCours();
  renderDashboard();
  renderClasseurs();
}

function renderClasseurs() {
  try {
    const g = $('clGrid');
    if(!g) return;

    let html = '<div style="display:flex; justify-content:flex-end; margin-bottom:10px;"><button class="bs" onclick="window.toggleEditCl()" style="padding:6px 12px; font-size:12px; border-color:var(--bd);">' + (isEditingCl ? '✅ Terminer' : '✏️ Modifier') + '</button></div>';

    if (!D.classeurs.length) {
      g.innerHTML = html + '<div class="empty"><h3>Aucun classeur</h3></div>';
      return;
    }
    
    html += D.classeurs.map(cl => {
      const cc = D.cours.filter(c => c.cl===cl.id);
      cc.sort((a,b) => a.inter.localeCompare(b.inter)); 

      let editBtns = isEditingCl ? `
        <button class="cbt" style="padding:4px 8px; margin-left:10px; background:var(--acc); color:#fff; border:none;" onclick="event.stopPropagation(); window.editClasseur('${cl.id}')">✏️ Éditer</button>
        <button class="cbt" style="color:var(--red); border-color:var(--red); padding:4px 8px; margin-left:5px;" onclick="event.stopPropagation(); window.delCl('${cl.id}')">✕</button>
      ` : '';

      let coursesList = cc.length ? cc.map(c => {
        // 🗂️ AFFICHAGE DU NOM D'INTERCALAIRE PERSONNALISÉ DANS LA LISTE
        const interNameDisplay = getInterName(cl, c.inter);
        return `
        <div class="irow" onclick="window.doLocate('${c.uid}')">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--txt);">${c.title}</div>
            <div style="font-size:11px; color:var(--mut);">[${interNameDisplay}] • ${c.type}</div>
          </div>
          <div style="color:var(--acc); font-size:18px;">➔</div>
        </div>
      `}).join('') : '<div class="irow" style="color:var(--mut); justify-content:center;">Classeur vide</div>';

      return `
        <div class="cl-card">
          <div class="cl-hdr" onclick="this.nextElementSibling.classList.toggle('open')">
            <div class="cl-ico" style="background:${cl.color}20">${cl.icon}</div>
            <div class="cl-info" style="flex:1;"><div class="cl-nm">${cl.name}</div><div class="cl-sb">${cl.maxInter || 12} inter. max</div></div>
            ${editBtns}
            <div style="color:var(--mut); font-size:12px; margin-left:8px;">▼</div>
          </div>
          <div class="ilist" id="ili_${cl.id}">
            ${coursesList}
          </div>
        </div>`;
    }).join('');

    g.innerHTML = html;
  } catch(e) {
    if(window.appErrors) {
      window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "Crash renderClasseurs: " + e.message, source: 'app.js', lineno: 0 });
    }
  }
}

// ✏️ SYSTÈME D'ÉDITION INLINE DES CLASSEURS ET INTERCALAIRES
window.editClasseur = function(id) {
  const cl = D.classeurs.find(c => c.id === id);
  if(!cl) return;
  currentEditClId = id;
  
  if($('eClNm')) $('eClNm').value = cl.name;
  if($('eClIc')) $('eClIc').value = cl.icon;
  if($('eClMax')) $('eClMax').value = cl.maxInter || 12;
  
  window.renderEditClInters(); // Dessine la liste des inputs
  
  if($('ovEditCl')) $('ovEditCl').classList.remove('hidden');
};

window.renderEditClInters = function() {
  const cl = D.classeurs.find(c => c.id === currentEditClId);
  const container = $('eClInterList');
  const max = parseInt($('eClMax').value) || 12;
  
  if(!cl || !container) return;
  
  let html = '';
  for(let i=1; i<=max; i++) {
    const val = String(i).padStart(2, '0');
    const existingName = (cl.interNames && cl.interNames[val]) ? cl.interNames[val] : '';
    html += `
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="font-family:'DM Mono', monospace; font-size:12px; color:var(--gold); font-weight:bold;">${val}</div>
        <input type="text" id="eClInter_${val}" placeholder="Ex: Thermodynamique" value="${existingName}" style="flex:1; background:var(--bg); border:1px solid var(--bd); padding:8px 10px; border-radius:6px; color:var(--txt); font-size:12px; outline:none;">
      </div>
    `;
  }
  container.innerHTML = html;
};

window.saveClEdit = function() {
  const cl = D.classeurs.find(c => c.id === currentEditClId);
  if(!cl) return;
  
  cl.name = $('eClNm').value.trim() || cl.name;
  cl.icon = $('eClIc').value.trim() || cl.icon;
  cl.maxInter = parseInt($('eClMax').value) || 12;
  
  // Sauvegarde dynamique des noms d'intercalaires
  if(!cl.interNames) cl.interNames = {};
  for(let i=1; i<=cl.maxInter; i++) {
    const val = String(i).padStart(2, '0');
    const input = $(`eClInter_${val}`);
    if(input && input.value.trim() !== '') {
      cl.interNames[val] = input.value.trim();
    } else {
      delete cl.interNames[val];
    }
  }
  
  save(); 
  if($('ovEditCl')) $('ovEditCl').classList.add('hidden');
  renderClasseurs(); 
  renderCours();
};

function renderMatieres() {
  const el = $('mgMat');
  if(!el) return;

  let html = '<div style="display:flex; justify-content:flex-end; margin-bottom:10px;"><button class="bs" onclick="window.toggleEditMat()" style="padding:6px 12px; font-size:12px; border-color:var(--bd);">' + (isEditingMat ? '✅ Terminer' : '✏️ Modifier') + '</button></div>';

  html += D.matieres.map(m => {
    let delBtn = isEditingMat ? `<button class="mdel" onclick="window.delMat('${m.id}')">✕</button>` : '';
    return `
    <div class="mr">
      <div class="mdot" style="background:${m.color}"></div>
      <div class="mlbl">${m.label}</div><div class="mnm" style="flex:1;">${m.name}</div>
      ${delBtn}
    </div>`
  }).join('');
  
  el.innerHTML = html;
  
  if($('swMat')) {
    $('swMat').innerHTML = COLORS.map(c => `
      <div class="sw${c===newColor?' on':''}" style="background:${c}" onclick="window.setNewColor('${c}')"></div>
    `).join('');
  }
}

function setNewColor(col) {
  newColor = col;
  renderMatieres();
}

function addCl() {
  const id = $('nClId').value.trim().toUpperCase();
  const name = $('nClNm').value.trim();
  const icon = $('nClIc').value.trim() || '📁';
  
  if(id.length !== 1) {
    alert("Identifiant : 1 seule lettre !");
    return;
  }
  if(D.classeurs.find(c=>c.id===id)) {
    alert("Ce classeur existe déjà !");
    return;
  }
  if(!name) {
    alert("Le nom est obligatoire");
    return;
  }
  
  D.classeurs.push({id, name, icon, color:newColor, maxInter: 12, interNames: {}}); 
  save(); 
  renderClasseurs(); 
  renderCours();
  
  $('nClId').value=''; 
  $('nClNm').value='';
  alert("Classeur ajouté avec succès !");
}

function addMat() {
  const lbl = $('nMlbl').value.trim().toUpperCase();
  const name = $('nMname').value.trim();
  
  if(lbl.length !== 4) {
    alert("Code matière : exactement 4 lettres !");
    return;
  }
  if(D.matieres.find(m=>m.id===lbl)) {
    alert("Cette matière existe déjà !");
    return;
  }
  
  D.matieres.push({id:lbl, label:lbl, name:name||lbl, color:newColor}); 
  save(); 
  renderMatieres(); 
  renderCours();
  
  $('nMlbl').value=''; 
  $('nMname').value='';
  alert("Matière ajoutée avec succès !");
}

function delMat(id) {
  if(!D.cours.filter(c=>c.mat===id).length || confirm('Cette matière contient des cours. Supprimer quand même ?')) {
    D.matieres = D.matieres.filter(m=>m.id!==id);
    save();
    renderMatieres();
    renderCours();
  }
}

function delCl(id) {
  if(!D.cours.filter(c=>c.cl===id).length || confirm('Ce classeur contient des cours. Supprimer quand même ?')) {
    D.classeurs = D.classeurs.filter(c=>c.id!==id);
    save();
    renderClasseurs();
    renderCours();
  }
}

function showQR(uid) {
  const c = D.cours.find(x => x.uid===uid);
  if (!c) return;
  curQRUid = uid;
  if($('qrLbl')) $('qrLbl').textContent = uid;
  if($('qrBox')) $('qrBox').innerHTML = `<img src="${window._QR.makeImageURL(uid, 180)}" style="border-radius:6px; margin:0 auto;">`;
  
  if($('btnMarkOnePrinted')) {
    if(c.stat === 'pending') $('btnMarkOnePrinted').textContent = '✅ Marquer Imprimé';
    else if(c.stat === 'printed') $('btnMarkOnePrinted').textContent = '🟢 Marquer Initialisé';
    else $('btnMarkOnePrinted').textContent = '↩️ Remettre à l\'état Imprimé';
  }
  
  if($('ovQR')) $('ovQR').classList.remove('hidden');
}

function markOnePrinted() {
  const c = D.cours.find(x => x.uid===curQRUid);
  if (!c) return;
  
  if(c.stat === 'pending') c.stat = 'printed';
  else if(c.stat === 'printed') c.stat = 'active';
  else c.stat = 'printed';
  
  save();
  renderCours();
  showQR(curQRUid); 
}

function dlQR() {
  if(!curQRUid) return;
  const a = document.createElement('a');
  a.download = `QR_${curQRUid}.png`;
  a.href = window._QR.makeImageURL(curQRUid, 250);
  a.click();
}

function renderPrintGrid() {
  const grid = $('printGrid');
  if(!grid) return;
  
  grid.innerHTML = D.cours.map(c => `
    <div class="pcard ${printSel.has(c.uid)?'sel':''}" onclick="window.toggleSel('${c.uid}')">
      <div class="pc-check">${printSel.has(c.uid)?'✅':'⬜'}</div>
      <div class="pc-qr"><img src="${window._QR.makeImageURL(c.uid, 80)}" alt="qr"></div>
      <div class="pc-uid">${c.uid}</div>
      <div class="pc-title">${c.title}</div>
    </div>
  `).join('');
  
  if($('pStats')) $('pStats').textContent = printSel.size + ' sélectionné(s)';
}

function toggleSel(uid) {
  if (printSel.has(uid)) printSel.delete(uid);
  else printSel.add(uid);
  renderPrintGrid();
}

function selPending() {
  printSel = new Set(D.cours.filter(c=>c.stat==='pending').map(c=>c.uid));
  renderPrintGrid();
}

function selAll() {
  printSel = new Set(D.cours.map(c=>c.uid));
  renderPrintGrid();
}

function selNone() {
  printSel.clear();
  renderPrintGrid();
}

function executePrint() {
  const sel = D.cours.filter(c => printSel.has(c.uid));
  if (!sel.length) {
    alert('Sélectionne au moins un document !');
    return;
  }
  
  const pz = $('printZone');
  if(!pz) return;
  
  pz.innerHTML = '';
  sel.forEach(c => {
    pz.innerHTML += `
      <div class="print-label">
        <img src="${window._QR.makeImageURL(c.uid, 150)}">
        <div class="pl-uid">${c.uid}</div>
        <div class="pl-title">${c.title.substring(0,35)}</div>
      </div>`;
  });
  
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      pz.innerHTML = '';
      if($('ovPrintConfirm')) $('ovPrintConfirm').classList.remove('hidden');
    }, 500);
  }, 800);
}

function confirmPrintSuccess(success) {
  closePrintConfirm();
  if(success) {
    printSel.forEach(uid => {
      const x = D.cours.find(d=>d.uid===uid);
      if(x && x.stat==='pending') x.stat = 'printed';
    });
    save();
    printSel.clear();
    renderCours();
    renderPrintGrid();
    renderDashboard();
  }
}

// 📸 LE SCANNER DE DIAGNOSTIC AVANCÉ (ANTI-BUG IOS)
function openCam() {
  if($('manualCamInput')) $('manualCamInput').value = '';
  if($('ovCam')) $('ovCam').classList.remove('hidden');

  let frameCount = 0;
  if($('camSt')) {
    $('camSt').style.color = 'var(--gold)';
    $('camSt').innerHTML = 'Initialisation du diagnostic avancé...';
  }

  try {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      if($('camSt')) $('camSt').innerHTML = "⚠️ Caméra bloquée. Saisie manuelle requise.";
      return;
    }

    // On demande l'autofocus et une résolution HD
    const constraints = {
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        advanced: [{ focusMode: "continuous" }]
      }
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        camStream = stream;
        const v = $('camVideo');
        if(!v) return;

        v.srcObject = stream;
        v.setAttribute("playsinline", true); // Vital pour iOS
        v.play().catch(e => {
            if(window.appErrors) window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "Video Play: " + e.message, source: 'app.js', lineno: 0 });
        });

        const jsqrStatus = typeof jsQR !== 'undefined' ? '✅ Actif' : '❌ Non trouvé';

        // 🚨 NOUVEAUTÉ : On affiche le canvas en miniature pour voir si iOS nous bloque (Bug Canvas Fantôme)
        const cv = $('camCanvas');
        cv.style.display = 'block'; 
        cv.style.width = '100px';
        cv.style.height = 'auto';
        cv.style.border = '2px solid red';
        cv.style.margin = '0 auto 10px auto';
        cv.style.borderRadius = '8px';

        camTick = setInterval(() => {
          if(v.readyState !== 4 || v.videoWidth === 0 || v.videoHeight === 0) return;
          frameCount++;

          cv.width = v.videoWidth;
          cv.height = v.videoHeight;
          const ctx = cv.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(v, 0, 0, cv.width, cv.height);

          let imgData;
          let isCanvasBlank = false;
          try {
              imgData = ctx.getImageData(0, 0, cv.width, cv.height);
              // Vérification si le canvas est noir ou transparent (Bug iOS Safari)
              const centerIdx = (Math.floor(cv.height/2) * cv.width + Math.floor(cv.width/2)) * 4;
              if (imgData.data[centerIdx+3] === 0) isCanvasBlank = true; // Alpha = 0
          } catch(e) {
              if(window.appErrors) window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "GetImageData: " + e.message, source: 'app.js', lineno: 0 });
              return;
          }

          if($('camSt')) {
            $('camSt').innerHTML = `
              <div style="font-size:11px; text-align:left; background:rgba(0,0,0,0.5); padding:8px; border-radius:6px; color:#fff;">
                <b>jsQR:</b> ${jsqrStatus}<br>
                <b>Résolution:</b> ${v.videoWidth} x ${v.videoHeight}<br>
                <b>Frames analysées:</b> ${frameCount}<br>
                <b>Canvas Vide ?:</b> ${isCanvasBlank ? '🚨 OUI (BUG iOS)' : 'NON (Image OK)'}<br>
                <b>État:</b> Diagnostic en cours... Regarde la miniature rouge ⬆️
              </div>`;
          }

          try {
            if(typeof jsQR !== 'undefined' && !isCanvasBlank) {
              const code = jsQR(imgData.data, imgData.width, imgData.height, {inversionAttempts:'attemptBoth'});
              if(code && code.data) {
                if($('camSt')) $('camSt').innerHTML = "✅ Code trouvé !";
                processScan(code.data.trim().toUpperCase());
              }
            }
          } catch(e) {
            if(window.appErrors) window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "jsQR crash: " + e.message, source: 'app.js', lineno: 0 });
          }
        }, 250); 

      }).catch(err => {
        if($('camSt')) $('camSt').innerHTML = `❌ Erreur caméra: ${err.message}`;
        if(window.appErrors) window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "GetUserMedia: " + err.message, source: 'app.js', lineno: 0 });
      });
  } catch(e) {
    if($('camSt')) $('camSt').innerHTML = `❌ Crash: ${e.message}`;
    if(window.appErrors) window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "openCam: " + e.message, source: 'app.js', lineno: 0 });
  }
}

function manualScan() {
  const v = $('manualCamInput') ? $('manualCamInput').value.trim().toUpperCase() : '';
  if(v) processScan(v);
}

function processScan(uid) {
  stopCam();
  if($('mainSearch')) $('mainSearch').value = uid;
  doLocate(uid);
}

function exportCsv() {
  const hdr = ['Code','Titre','Type','Matiere','Classeur','Intercalaire','Maitrise','Note','Date','Statut_QR'];
  const esc = v => '"' + String(v||'').replace(/"/g,'""') + '"';
  
  const rows = D.cours.map(c => {
    const mo = D.matieres.find(m=>m.id===c.mat)||{name:c.mat};
    const co = D.classeurs.find(x=>x.id===c.cl)||{name:c.cl};
    return [c.uid, c.title, c.type, mo.name, co.name, c.inter, c.rev, c.note||'', c.date||'', c.stat].map(esc).join(',');
  });
  
  const csv = [hdr.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='mes-cours-prepa.csv';
  a.click();
}

function homeGo() {
  const v = $('homeSearch') ? $('homeSearch').value.trim().toUpperCase() : '';
  if(v.includes('-') && v.length >= 8) {
    doLocate(v);
  } else {
    switchTab('cours');
    if($('mainSearch')) $('mainSearch').value = v;
    renderCours();
    triggerHaptic();
  }
}

function renderErrorLogs() {
  const container = $('errorLogContainer');
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
}

function clearErrorLogs() {
  if(!confirm("Vider l'historique des erreurs ?")) return;
  window.appErrors = [];
  renderErrorLogs();
}

// EXPOSITION DES FONCTIONS GLOBALES (Pour les onclick HTML)
window.switchTab = switchTab;
window.renderCours = renderCours;
window.doLocate = doLocate;
window.showQR = showQR;
window.editCours = editCours;
window.delCours = delCours;
window.delCl = delCl;
window.delMat = delMat;
window.setNewColor = setNewColor;
window.toggleSel = toggleSel;
window.addCl = addCl;
window.addMat = addMat;
window.manualScan = manualScan;
window.stopCam = stopCam;
window.saveCours = saveCours;
window.loadDemo = loadDemo;
window.resetData = resetData;
window.toggleFab = toggleFab;
window.closeFab = closeFab;
window.triggerHaptic = triggerHaptic;
window.exportCsv = exportCsv;
window.openModalCours = openModalCours;
window.openCam = openCam;
window.toggleManualUid = toggleManualUid; 
window.renderErrorLogs = renderErrorLogs;
window.clearErrorLogs = clearErrorLogs;
window.toggleEditMat = toggleEditMat; 
window.toggleEditCl = toggleEditCl;   
window.editClasseur = editClasseur;   
window.renderEditClInters = renderEditClInters; 
window.saveClEdit = saveClEdit; 

// ATTACHEMENT DYNAMIQUE DES ÉVÉNEMENTS
bindClick('btnOpenSettings', () => switchTab('settings'));
bindClick('btnRefresh', () => location.reload());
bindClick('btnThemeToggle', () => { D.settings.theme = D.settings.theme === 'light' ? 'dark' : 'light'; save(); applySettings(); });
bindClick('btnCompactToggle', () => { D.settings.compact = !D.settings.compact; save(); applySettings(); });
bindClick('btnStatsToggle', () => { D.settings.showStats = !D.settings.showStats; save(); applySettings(); });
bindClick('btnChipsToggle', () => { D.settings.showChips = !D.settings.showChips; save(); applySettings(); });
bindClick('btnDashHeroToggle', () => { D.settings.showDashHero = !D.settings.showDashHero; save(); applySettings(); });
bindClick('btnDashRevToggle', () => { D.settings.showDashRev = !D.settings.showDashRev; save(); applySettings(); });
bindClick('btnDashOverToggle', () => { D.settings.showDashOver = !D.settings.showDashOver; save(); applySettings(); });
bindClick('btnPomoVisToggle', () => { D.settings.showPomo = !D.settings.showPomo; save(); applySettings(); });

bindChange('setTemplate', (e) => { D.settings.template = e.target.value; save(); applySettings(); });
bindInput('setPomoWork', (e) => { D.settings.pomoWork = parseInt(e.target.value) || 25; save(); pomoReset(); });
bindInput('setPomoBreak', (e) => { D.settings.pomoBreak = parseInt(e.target.value) || 5; save(); pomoReset(); });
bindInput('setUserName', (e) => { D.settings.userName = e.target.value.trim() || "Étudiant"; save(); applySettings(); });

bindClick('btnPomoToggle', pomoToggle);
bindClick('btnPomoReset', pomoReset);
bindInput('homeSearch', () => { doAutoFmtScan($('homeSearch')); });
bindKey('homeSearch', 'Enter', homeGo);
bindClick('btnHomeSearch', homeGo);
bindClick('btnHomeCam', openCam);
bindClick('btnKholleDraw', drawKholle);

bindInput('mainSearch', () => { doAutoFmtScan($('mainSearch')); renderCours(); });
bindKey('mainSearch', 'Enter', () => { const v = $('mainSearch').value.trim().toUpperCase(); if(v) doLocate(v); });
bindClick('btnLocate', () => { const v = $('mainSearch') ? $('mainSearch').value.trim().toUpperCase() : ''; if(v) doLocate(v); });

bindClick('btnCancelCours', closeModalCours);
bindChange('fType', toggleNoteField);

bindClick('btnAddCl', addCl);
bindClick('btnAddMat', addMat);

['fltMat', 'fltCl', 'fltQr', 'fltType', 'fltRev'].forEach(id => { bindChange(id, renderCours); });
bindClick('btnResetFilters', resetFilters);

bindClick('btnSelPending', selPending);
bindClick('btnSelAll', selAll);
bindClick('btnDesel', selNone);
bindClick('btnDoPrint', executePrint);
bindClick('btnConfirmPrintYes', () => confirmPrintSuccess(true));
bindClick('btnConfirmPrintNo', () => confirmPrintSuccess(false));

bindClick('btnCloseLocPopup', closeLocPopup);
bindClick('btnMarkOnePrinted', markOnePrinted);
bindClick('btnCloseQR', closeQRModal);
bindClick('btnDlQR', dlQR);

// MISE À JOUR DYNAMIQUE DES INTERCALAIRES LORS DU CHOIX D'UN CLASSEUR
bindChange('fCl', updateIntercalairesDropdown);

// LANCEMENT DE L'APPLICATION AVEC RÉCUPÉRATION FIRESTORE
async function initApp() {
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      D = docSnap.data();
      cloudConnected = true;
    } else {
      const rawData = localStorage.getItem('mc_v28');
      D = rawData ? JSON.parse(rawData) : null;
      cloudConnected = true;
    }
  } catch (e) {
    const rawData = localStorage.getItem('mc_v28');
    D = rawData ? JSON.parse(rawData) : null;
    cloudConnected = false;
  }

  updateCloudIndicator();

  if(!D) D = JSON.parse(JSON.stringify(emptyData));
  if(!D.cours) D.cours = [];
  if(!D.classeurs) D.classeurs = JSON.parse(JSON.stringify(emptyData.classeurs));
  
  // 🗂️ MIGRATION BDD : On s'assure que les anciens classeurs ont bien la propriété "interNames"
  D.classeurs.forEach(cl => {
    if(!cl.interNames) cl.interNames = {};
    if(!cl.maxInter) cl.maxInter = 12;
  });
  
  if(!D.matieres) D.matieres = JSON.parse(JSON.stringify(emptyData.matieres));
  if(!D.settings) D.settings = JSON.parse(JSON.stringify(emptyData.settings));
  
  applySettings();
  switchTab('home');
}

initApp();
