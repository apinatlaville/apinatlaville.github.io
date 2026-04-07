/**
 * =========================================================================================
 * 🧠 MASTER PROJECT CONTEXT & DOCUMENTATION (AI CONTEXT RETAINER)
 * =========================================================================================
 * NOM DU PROJET : Mes Cours - PC* Edition
 * FICHIER ACTUEL : data.js (Logique métier et CRUD)
 * * 🏗️ ARCHITECTURE MULTI-FICHIERS (TRÈS IMPORTANT POUR L'IA) :
 * 1. app.js      : Cœur (Firebase, État global window.D, Navigation, Paramètres).
 * 2. data.js     : [CE FICHIER] Gestion des données (Cours, Classeurs, Matières) et UI.
 * 3. scanner.js  : Scanner de codes-barres 1D et logique d'impression.
 * * 👉 RÈGLE POUR L'IA : Si l'utilisateur demande de modifier l'ajout d'un cours, l'édition 
 * d'un classeur ou le filtrage, TOUT se trouve ici. L'état global est `window.D`.
 * * 👉 NOUVEAUTÉ : Fonction "Déplacement / Modification partielle" ajoutée (openMove / saveMove).
 * =========================================================================================
 */

window.$ = window.$ || (id => document.getElementById(id));
window.COLORS = ['#5b8df7','#f0c060','#50d890','#f06060','#b06af7','#f06ab0','#60d0f0','#f09060'];

window.PC_FLASHCARDS = [
  { mat: 'Physique', q: 'Loi de Fourier (Conduction thermique)', a: 'jQ = - λ . grad(T)' },
  { mat: 'Physique', q: 'Équation de Maxwell-Faraday', a: 'rot(E) = - ∂B / ∂t' },
  { mat: 'Physique', q: 'Équation de Maxwell-Ampère', a: 'rot(B) = μ0.j + μ0.ε0.(∂E/∂t)' },
  { mat: 'Chimie', q: 'Rendement du cycle de Carnot', a: 'η = 1 - (Tf / Tc)' },
  { mat: 'Chimie Orga', q: 'Oxydation douce d\'un alcool primaire', a: 'Donne un Aldéhyde (puis Acide carboxylique si oxydant en excès)' },
  { mat: 'Chimie Orga', q: 'Règle de Markovnikov (Add. électrophile)', a: 'Le proton s\'additionne sur le carbone le plus hydrogéné de la double liaison.' }
];

window.emptyData = {
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

window.demoData = {
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
  cours: [
    { uid: 'PH-A1B', title: 'Mécanique de Newton', type: 'COURS', rev: 'green', mat: 'PHYS', cl: 'A', inter: '01', stat: 'active', date: '2026-04-01' },
    { uid: 'PH-X9Y', title: 'Thermodynamique', type: 'FICHE', rev: 'orange', mat: 'PHYS', cl: 'A', inter: '02', stat: 'printed', date: '2026-04-02' },
    { uid: 'MA-7Z3', title: 'Espaces Vectoriels', type: 'COURS', rev: 'red', mat: 'MATH', cl: 'B', inter: '01', stat: 'active', date: '2026-04-03' },
    { uid: 'MA-P4L', title: 'Séries Entières', type: 'TD', rev: 'green', mat: 'MATH', cl: 'B', inter: '02', stat: 'pending', date: '2026-04-04' },
    { uid: 'CH-W2N', title: 'Cristallographie', type: 'COURS', rev: 'orange', mat: 'CHIM', cl: 'C', inter: '01', stat: 'active', date: '2026-04-01' },
    { uid: 'CH-8M5', title: 'Cinétique Chimique', type: 'DS', rev: 'red', note: '12', mat: 'CHIM', cl: 'C', inter: '02', stat: 'active', date: '2026-04-02' },
    { uid: 'PH-3K9', title: 'Électromagnétisme', type: 'KHOLLE', rev: 'green', note: '16', mat: 'PHYS', cl: 'A', inter: '03', stat: 'active', date: '2026-04-03' },
    { uid: 'MA-V6J', title: 'Réduction des endomorphismes', type: 'FICHE', rev: 'orange', mat: 'MATH', cl: 'B', inter: '03', stat: 'active', date: '2026-04-04' },
    { uid: 'CH-T1R', title: 'Chimie Organique - Alcools', type: 'COURS', rev: 'green', mat: 'CHIM', cl: 'C', inter: '03', stat: 'pending', date: '2026-04-05' },
    { uid: 'PH-5D4', title: 'Optique Ondulatoire', type: 'TD', rev: 'red', mat: 'PHYS', cl: 'A', inter: '04', stat: 'active', date: '2026-04-05' }
  ] 
};

window.isEditingMat = false;
window.isEditingCl = false;
window.currentEditClId = null;
window.chipFilter = null;
window.newColor = window.COLORS[0];
window.newColorCl = window.COLORS[0]; 
window.editUid = null;
window.moveUid = null; // 🚨 NOUVEL ÉTAT : Sauvegarde l'id du cours qu'on déplace

window.getInterName = function(cl, ns) {
  if (cl && cl.interNames && cl.interNames[ns]) {
    return cl.interNames[ns];
  }
  return `Intercalaire ${ns}`;
};

window.toggleEditMat = function() {
  window.isEditingMat = !window.isEditingMat;
  window.renderMatieres();
};

window.toggleEditCl = function() {
  window.isEditingCl = !window.isEditingCl;
  window.renderClasseurs();
};

window.resetFilters = function() {
  ['fltType', 'fltRev', 'fltMat', 'fltCl', 'fltQr', 'mainSearchText', 'mainSearchCode'].forEach(id => {
    if(window.$(id)) window.$(id).value = '';
  });
  window.chipFilter = null;
  window.renderCours();
};

window.renderCours = function() {
  try {
    const allM = [...new Set(window.D.cours.map(c => c.mat))];
    const allC = [...new Set(window.D.cours.map(c => c.cl))];
    const ms = window.$('fltMat');
    const cs = window.$('fltCl');
    
    if(ms && cs) {
      const mv = ms.value, cv = cs.value;
      ms.innerHTML = '<option value="">Toutes matières</option>' + allM.map(m => {
        const mo = window.D.matieres.find(x => x.id===m) || {name:m};
        return `<option value="${m}" ${m===mv?'selected':''}>${mo.name}</option>`;
      }).join('');
      
      cs.innerHTML = '<option value="">Tous classeurs</option>' + allC.map(c => {
        const co = window.D.classeurs.find(x => x.id===c) || {name:c};
        return `<option value="${c}" ${c===cv?'selected':''}>${co.name}</option>`;
      }).join('');
    }
    
    if(window.$('matChips')) {
      window.$('matChips').innerHTML = '<button class="chip' + (window.chipFilter===null?' on':'') + '" data-chip="null">Tous</button>' +
        window.D.matieres.map(m => `
          <button class="chip${window.chipFilter===m.id?' on':''}" data-chip="${m.id}" style="${window.chipFilter===m.id ? 'background:'+m.color+';border-color:'+m.color : 'border-color:'+m.color+'60;color:'+m.color}">${m.label}</button>
        `).join('');
        
      window.$('matChips').querySelectorAll('.chip').forEach(btn => {
        btn.addEventListener('click', () => {
          window.chipFilter = btn.dataset.chip==='null' ? null : btn.dataset.chip;
          window.renderCours();
        });
      });
    }

    const qText = window.$('mainSearchText') ? window.$('mainSearchText').value.trim() : '';
    const qrf = window.$('fltQr') ? window.$('fltQr').value : '';
    const fType = window.$('fltType') ? window.$('fltType').value : '';
    const fRev = window.$('fltRev') ? window.$('fltRev').value : '';

    let baseList = window.D.cours;

    if (qText && typeof Fuse !== 'undefined') {
      const searchData = baseList.map(c => {
        const mo = window.D.matieres.find(x => x.id===c.mat) || {name:''};
        return { ...c, matName: mo.name };
      });

      const fuse = new Fuse(searchData, {
        keys: [
          { name: 'title', weight: 3 },     
          { name: 'matName', weight: 1 },   
          { name: 'desc', weight: 1 }       
        ],
        threshold: 0.4, 
        ignoreLocation: true,
        isCaseSensitive: false
      });

      const results = fuse.search(qText);
      baseList = results.map(r => r.item); 
    }

    const list = baseList.filter(c => {
      return (!ms || !ms.value || c.mat===ms.value)
        && (!cs || !cs.value || c.cl===cs.value)
        && (!window.chipFilter || c.mat===window.chipFilter)
        && (!qrf || c.stat === qrf)
        && (!fType || c.type === fType)
        && (!fRev || c.rev === fRev);
    });

    if (!qText) {
      list.sort((a,b) => {
        if(a.mat !== b.mat) return a.mat.localeCompare(b.mat);
        if(a.cl !== b.cl) return a.cl.localeCompare(b.cl);
        return a.inter.localeCompare(b.inter);
      });
    }

    const grid = window.$('coursGrid');
    if(grid) {
      if (!list.length) {
        grid.innerHTML = '<div class="empty"><h3>Aucun document trouvé</h3></div>';
        window.renderStats();
        return;
      }

      let html = '';
      let currentMat = '';

      list.forEach(c => {
        const mo = window.D.matieres.find(x => x.id===c.mat) || {color:'#6a6a88', label:c.mat, name:c.mat};
        const co = window.D.classeurs.find(x => x.id===c.cl) || {name:c.cl, icon:'📘'};
        
        const interNameDisplay = window.getInterName(co, c.inter);

        if (!qText && c.mat !== currentMat) {
          html += `
            <div style="grid-column: 1/-1; margin-top: 15px; border-bottom: 2px solid ${mo.color}; padding-bottom: 5px;">
              <h3 style="font-family: 'Syne'; color: ${mo.color};">${mo.name}</h3>
            </div>
          `;
          currentMat = c.mat;
        }

        let warnHtml = '';
        if (c.stat === 'pending') {
          warnHtml = '<div class="qr-warn">🔴 À imprimer</div>';
        } else if (c.stat === 'printed') {
          warnHtml = '<div class="qr-scan-req">🟠 Imprimé. Scanne pour initialiser.</div>';
        }

        // 🚨 MODIFICATION : Ajout du bouton "Déplacer" (🔄) sur chaque carte !
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
              <button class="cbt" onclick="window.openMove('${c.uid}')" title="Déplacer">🔄</button>
              <button class="cbt" onclick="window.showQR('${c.uid}')" title="Voir Code-Barres">🔳</button>
              <button class="cbt" onclick="window.editCours('${c.uid}')" title="Modifier">✏️</button>
              <button class="cbt" style="color:var(--red); border-color:var(--red);" onclick="window.delCours('${c.uid}')" title="Supprimer">🗑️</button>
          </div>
          ${warnHtml}
        </div>`;
      });
      grid.innerHTML = html;
    }
    window.renderStats();
  } catch(e) {
    if(window.appErrors) {
      window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "Crash renderCours: " + e.message, source: 'data.js', lineno: 0 });
    }
  }
};

window.doLocate = function(uid) {
  const c = window.D.cours.find(x => x.uid === uid);
  if (!c) {
    if(window.$('locContent')) {
      window.$('locContent').innerHTML = `
        <div style="text-align:center;padding:10px 0">
          <div style="font-size:32px;margin-bottom:8px">❌</div>
          <div style="font-family:'DM Mono',monospace;font-size:22px;color:var(--red);margin-bottom:6px;font-weight:bold;">${uid}</div>
          <div style="color:var(--mut);font-size:13px">Code introuvable.</div>
        </div>`;
    }
    if(window.$('locPopup')) window.$('locPopup').classList.add('open');
    return;
  }
  
  window.triggerHaptic();

  const mo = window.D.matieres.find(m => m.id === c.mat) || {name: c.mat, color:'#5b8df7'};
  const co = window.D.classeurs.find(x => x.id === c.cl) || {name: c.cl, icon: '📘'};
  const interNameDisplay = window.getInterName(co, c.inter);
  
  const baseInfoHtml = `
    <div class="loc-code">${c.uid}</div>
    <div class="loc-title">${c.title}</div>
    <div style="text-align:center;margin-top:5px;margin-bottom:15px;font-size:12px;font-weight:bold;color:${mo.color}">
      ${c.type}
    </div>
  `;

  // 🚨 NOUVEAUTÉ : Panneau intelligent de confirmation si le document est scanné pour la 1ère fois (printed)
  if (c.stat === 'printed') {
    window.$('locContent').innerHTML = baseInfoHtml + `
      <div style="background:var(--s2); border:2px dashed var(--acc); padding:15px; border-radius:12px; margin-bottom:15px;">
        <h4 style="color:var(--acc); margin-bottom:10px; text-align:center;">📌 Initialisation</h4>
        <p style="font-size:12px; color:var(--mut); margin-bottom:15px; text-align:center;">Confirme l'emplacement de ce document :</p>
        <div class="loc-cards" style="margin-bottom:15px;">
          <div class="loc-c" style="background:rgba(91,141,247,.15);color:var(--acc);border:1px solid var(--acc);">
            ${co.icon} ${co.name}
          </div>
          <div class="loc-c" style="background:rgba(240,192,96,.15);color:var(--gold);border:1px solid var(--gold);">
            📑 ${interNameDisplay}
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-direction:column;">
          <button class="bp" onclick="window.confirmInit('${c.uid}')" style="background:var(--grn); color:#000; border:none;">✅ Confirmer le rangement</button>
          <button class="bs" onclick="window.closeLocPopup(); window.openMove('${c.uid}')">🔄 Modifier l'emplacement</button>
          <button class="bs" onclick="window.closeLocPopup()" style="border-color:var(--red); color:var(--red);">❌ Annuler</button>
        </div>
      </div>
    `;
  } else {
     // Affichage normal si le cours est déjà "active"
     window.$('locContent').innerHTML = baseInfoHtml + `
        <div class="loc-cards">
          <div class="loc-c" style="background:rgba(91,141,247,.15);color:var(--acc);border:1px solid var(--acc);">
            ${co.icon} ${co.name}
          </div>
          <div class="loc-c" style="background:rgba(240,192,96,.15);color:var(--gold);border:1px solid var(--gold);">
            📑 ${interNameDisplay}
          </div>
        </div>
        ${c.note ? `<div style="text-align:center;font-weight:bold;font-size:16px;color:var(--acc);margin-top:10px;">Note : ${c.note}/20</div>` : ''}
        ${c.desc ? `<div class="loc-desc">${c.desc}</div>` : ''}
        
        <button class="bs" onclick="window.closeLocPopup(); window.openMove('${c.uid}')" style="width:100%; margin-top:15px; padding:10px;">🔄 Déplacer ce document</button>
     `;
  }
  
  if(window.$('locPopup')) window.$('locPopup').classList.add('open');
};

// 🚨 NOUVELLE FONCTION : Confirme l'initialisation du cours suite au scan
window.confirmInit = function(uid) {
  const c = window.D.cours.find(x => x.uid === uid);
  if(c) {
      c.stat = 'active';
      window.save();
      window.renderCours();
      window.renderDashboard();
      window.closeLocPopup();
      window.sysAlert("✅ Document initialisé et classé avec succès !", "Succès");
  }
};

// 🚨 NOUVELLE FONCTION : Ouvre le panneau de modification partielle (Déplacement)
window.openMove = function(uid) {
  const c = window.D.cours.find(x => x.uid === uid);
  if(!c) return;
  window.moveUid = uid;
  
  const co = window.D.classeurs.find(x => x.id === c.cl) || {name: c.cl, icon: '📘'};
  const interNameDisplay = window.getInterName(co, c.inter);
  
  // Affiche la position de départ
  if(window.$('moveCurrentLoc')) {
      window.$('moveCurrentLoc').innerHTML = `${co.icon} ${co.name} <br> 📑 ${interNameDisplay}`;
  }

  // Prépare le select pour choisir le nouveau classeur
  const moveClSelect = window.$('fMoveCl');
  if(moveClSelect) {
      moveClSelect.innerHTML = window.D.classeurs.map(x => `
        <option value="${x.id}" ${x.id===c.cl?'selected':''}>${x.icon} ${x.name}</option>
      `).join('');
  }
  
  window.updateMoveIntercalairesDropdown(c.cl, c.inter);
  
  if(window.$('ovMove')) window.$('ovMove').classList.remove('hidden');
};

// 🚨 NOUVELLE FONCTION : Met à jour les intercalaires dispos dans la page de déplacement
window.updateMoveIntercalairesDropdown = function(clIdOverride, interOverride) {
  const clId = clIdOverride || (window.$('fMoveCl') ? window.$('fMoveCl').value : '');
  const cl = window.D.classeurs.find(c => c.id === clId);
  const maxI = cl ? (cl.maxInter || 12) : 12;
  
  const interSelect = window.$('fMoveInter');
  if(interSelect) {
      interSelect.innerHTML = Array.from({length: maxI}, (_, i) => {
          const val = String(i + 1).padStart(2, '0');
          const customName = window.getInterName(cl, val);
          return `<option value="${val}" ${val===interOverride?'selected':''}>${val} - ${customName}</option>`;
      }).join('');
  }
};

// 🚨 NOUVELLE FONCTION : Sauvegarde uniquement la position du document (Modification partielle)
window.saveMove = function() {
  const cl = window.$('fMoveCl') ? window.$('fMoveCl').value : '';
  const inter = window.$('fMoveInter') ? window.$('fMoveInter').value : '';
  
  if(!cl || !inter) return;
  
  const c = window.D.cours.find(x => x.uid === window.moveUid);
  if(c) {
      c.cl = cl;
      c.inter = inter;
      // Si on le déplace lors de son initialisation, ça le valide de force
      if (c.stat === 'printed') {
          c.stat = 'active';
      }
      window.save();
      window.renderCours();
      window.renderClasseurs();
      window.renderDashboard();
      if(window.$('ovMove')) window.$('ovMove').classList.add('hidden');
      window.sysAlert("✅ Document déplacé avec succès !", "Déplacement réussi");
  }
};


window.delCours = function(uid) {
  window.sysConfirm('Supprimer définitivement le document ' + uid + ' ?', () => {
    window.D.cours = window.D.cours.filter(c => c.uid !== uid);
    window.save();
    window.renderCours();
    window.renderDashboard();
    window.renderNotes();
    window.renderClasseurs();
  }, "Suppression d'un document");
};

window.toggleNoteField = function() {
  const t = window.$('fType') ? window.$('fType').value : '';
  if(window.$('fgNote')) {
    if(t === 'DS' || t === 'KHOLLE') {
      window.$('fgNote').style.display = 'block';
    } else {
      window.$('fgNote').style.display = 'none';
      if(window.$('fNote')) window.$('fNote').value = '';
    }
  }
};

window.updateUidPrefix = function() {
  const matEl = window.$('fMat');
  const prefixEl = window.$('fUidPrefix');
  if (prefixEl) {
    if (!matEl || !matEl.value) {
      prefixEl.textContent = 'XX-';
      prefixEl.style.color = 'var(--mut)';
    } else {
      let prefix = matEl.value.substring(0, 2).toUpperCase();
      while (prefix.length < 2) prefix += 'X';
      prefixEl.textContent = prefix + '-';
      prefixEl.style.color = 'var(--acc)';
    }
  }
};

window.toggleManualUid = function() {
  const isManual = window.$('fManualUidToggle').checked;
  if (isManual) {
    window.$('uidBox').style.display = 'none';
    if(window.$('manualUidContainer')) window.$('manualUidContainer').style.display = 'flex';
    window.updateUidPrefix();
    if(window.$('fUidInput')) window.$('fUidInput').focus();
  } else {
    window.$('uidBox').style.display = 'block';
    if(window.$('manualUidContainer')) window.$('manualUidContainer').style.display = 'none';
  }
};

window.updateIntercalairesDropdown = function() {
  const clId = window.$('fCl') ? window.$('fCl').value : '';
  const cl = window.D.classeurs.find(c => c.id === clId);
  const maxI = cl ? (cl.maxInter || 12) : 12;
  
  if(window.$('fInter')) {
    window.$('fInter').innerHTML = '<option value="">—</option>' + 
      Array.from({length: maxI}, (_, i) => {
        const val = String(i + 1).padStart(2, '0');
        const customName = window.getInterName(cl, val);
        return `<option value="${val}">${val} - ${customName}</option>`;
      }).join('');
  }
};

window.openModalCours = function() {
  window.editUid = null;
  if(window.$('mTitle')) window.$('mTitle').textContent = '✨ Ajouter un document';
  if(window.$('fTitle')) window.$('fTitle').value = ''; 
  if(window.$('fDesc')) window.$('fDesc').value = ''; 
  
  if(window.$('fMat')) {
    window.$('fMat').innerHTML = '<option value="">— Choisir —</option>' + 
    window.D.matieres.map(m => `<option value="${m.id}">${m.label} — ${m.name}</option>`).join('');
  }
  
  if(window.$('fCl')) {
    window.$('fCl').innerHTML = '<option value="">— Choisir —</option>' + 
    window.D.classeurs.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  }
  
  window.updateIntercalairesDropdown(); 
  if(window.$('fInter')) window.$('fInter').value = ''; 
  if(window.$('fType')) window.$('fType').value = 'COURS'; 
  if(window.$('fRev')) window.$('fRev').value = 'green';
  if(window.$('fNote')) window.$('fNote').value = '';
  window.toggleNoteField();
  
  if(window.$('fManualUidToggle')) {
    window.$('fManualUidToggle').checked = false;
    window.$('lblManualUid').style.display = 'flex'; 
  }
  if(window.$('fUidInput')) {
    window.$('fUidInput').value = '';
  }
  if(window.$('manualUidContainer')) window.$('manualUidContainer').style.display = 'none';
  window.updateUidPrefix();

  if(window.$('uidBox')) {
    window.$('uidBox').style.display = 'block';
    window.$('uidBox').innerHTML = '—<br><small style="font-size:10px; font-weight:normal; color:var(--mut);">Code-barres généré automatiquement</small>';
  }
  
  if(window.$('ovCours')) window.$('ovCours').classList.remove('hidden');
};

window.editCours = function(uid) {
  const c = window.D.cours.find(x => x.uid===uid);
  if (!c) return;
  window.editUid = uid;
  
  if(window.$('mTitle')) window.$('mTitle').textContent = '✏️ Modifier le document';
  if(window.$('fTitle')) window.$('fTitle').value = c.title; 
  if(window.$('fDesc')) window.$('fDesc').value = c.desc || ''; 
  if(window.$('fType')) window.$('fType').value = c.type || 'COURS'; 
  if(window.$('fRev')) window.$('fRev').value = c.rev || 'green';
  if(window.$('fNote')) window.$('fNote').value = c.note || '';
  
  window.toggleNoteField();
  
  if(window.$('fMat')) {
    window.$('fMat').innerHTML = window.D.matieres.map(m => `
      <option value="${m.id}" ${m.id===c.mat?'selected':''}>${m.label}</option>
    `).join('');
  }
  
  if(window.$('fCl')) {
    window.$('fCl').innerHTML = window.D.classeurs.map(x => `
      <option value="${x.id}" ${x.id===c.cl?'selected':''}>${x.icon} ${x.name}</option>
    `).join('');
  }
  
  window.updateIntercalairesDropdown();
  if(window.$('fInter')) window.$('fInter').value = c.inter;
  
  if(window.$('lblManualUid')) window.$('lblManualUid').style.display = 'none';
  if(window.$('manualUidContainer')) window.$('manualUidContainer').style.display = 'none';
  
  if(window.$('uidBox')) {
    window.$('uidBox').style.display = 'block';
    window.$('uidBox').innerHTML = c.uid + '<br><small style="font-size:10px; font-weight:normal; color:var(--mut);">Code permanent</small>';
  }
  
  if(window.$('ovCours')) window.$('ovCours').classList.remove('hidden');
};

window.saveCours = function() {
  const title = window.$('fTitle')?window.$('fTitle').value.trim():'';
  const mat = window.$('fMat')?window.$('fMat').value:'';
  const cl = window.$('fCl')?window.$('fCl').value:'';
  const inter = window.$('fInter')?window.$('fInter').value:'';
  
  if (!title || !mat || !cl || !inter) {
    return window.sysAlert('Remplis tous les champs obligatoires avant de sauvegarder.', "Erreur de saisie");
  }
  
  const obj = {
    title, 
    type:window.$('fType')?window.$('fType').value:'', 
    rev:window.$('fRev')?window.$('fRev').value:'', 
    mat, 
    cl, 
    inter, 
    note:window.$('fNote')?window.$('fNote').value:'', 
    desc: window.$('fDesc')?window.$('fDesc').value.trim():''
  };
  
  if(!obj.date) obj.date = new Date().toISOString().split('T')[0];

  if (window.editUid) {
    const idx = window.D.cours.findIndex(c => c.uid===window.editUid);
    if(idx > -1) {
      obj.uid = window.D.cours[idx].uid;
      obj.stat = window.D.cours[idx].stat; 
      if(window.D.cours[idx].date) obj.date = window.D.cours[idx].date;
      window.D.cours[idx] = obj;
    }
  } else {
    let newUid = '';
    if (window.$('fManualUidToggle') && window.$('fManualUidToggle').checked) {
      const prefixEl = window.$('fUidPrefix');
      const prefix = prefixEl ? prefixEl.textContent.replace('-', '') : mat.substring(0,2).toUpperCase();
      const suffix = window.$('fUidInput').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      
      if (!suffix) {
        return window.sysAlert("Veuillez taper au moins un caractère dans la case manuelle !", "Erreur de saisie");
      }
      
      newUid = prefix + '-' + suffix;
      if (window.D.cours.find(c => c.uid === newUid)) {
        return window.sysAlert("Ce code (" + newUid + ") est déjà utilisé ! Trouve-en un autre.", "Erreur de code");
      }
    } else {
      newUid = window.genUid(mat);
    }
    obj.uid = newUid;
    obj.stat = 'pending'; 
    window.D.cours.unshift(obj);
  }
  
  window.save();
  window.closeModalCours();
  window.renderCours();
  window.renderDashboard();
  window.renderClasseurs();
};

window.setNewColorCl = function(col) {
  window.newColorCl = col;
  window.renderClasseurs();
};

window.renderClasseurs = function() {
  try {
    const g = window.$('clGrid');
    if(!g) return;

    let html = `
      <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
        <button class="bs" onclick="window.toggleEditCl()" style="padding:6px 12px; font-size:12px; border-color:var(--bd);">
          ${window.isEditingCl ? '✅ Terminer' : '✏️ Modifier'}
        </button>
      </div>
    `;

    if (!window.D.classeurs.length) {
      g.innerHTML = html + '<div class="empty"><h3>Aucun classeur</h3></div>';
    } else {
      html += window.D.classeurs.map(cl => {
        const cc = window.D.cours.filter(c => c.cl===cl.id);
        cc.sort((a,b) => a.inter.localeCompare(b.inter)); 

        let editBtns = window.isEditingCl ? `
          <button class="cbt" style="padding:4px 8px; margin-left:10px; background:var(--acc); color:#fff; border:none;" onclick="event.stopPropagation(); window.editClasseur('${cl.id}')">✏️ Éditer</button>
          <button class="cbt" style="color:var(--red); border-color:var(--red); padding:4px 8px; margin-left:5px;" onclick="event.stopPropagation(); window.delCl('${cl.id}')">✕</button>
        ` : '';

        let coursesList = cc.length ? cc.map(c => {
          const interNameDisplay = window.getInterName(cl, c.inter);
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
              <div class="cl-info" style="flex:1;">
                <div class="cl-nm">${cl.name}</div>
                <div class="cl-sb">${cl.maxInter || 12} inter. max</div>
              </div>
              ${editBtns}
              <div style="color:var(--mut); font-size:12px; margin-left:8px;">▼</div>
            </div>
            <div class="ilist" id="ili_${cl.id}">
              ${coursesList}
            </div>
          </div>`;
      }).join('');
    }

    g.innerHTML = html;
    
    if(window.$('swCl')) {
      window.$('swCl').innerHTML = window.COLORS.map(c => `
        <div class="sw${c===window.newColorCl?' on':''}" style="background:${c}" onclick="window.setNewColorCl('${c}')"></div>
      `).join('');
    }

  } catch(e) {
    if(window.appErrors) {
      window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "Crash renderClasseurs: " + e.message, source: 'data.js', lineno: 0 });
    }
  }
};

window.editClasseur = function(id) {
  const cl = window.D.classeurs.find(c => c.id === id);
  if(!cl) return;
  window.currentEditClId = id;
  
  if(window.$('eClNm')) window.$('eClNm').value = cl.name;
  if(window.$('eClMax')) window.$('eClMax').value = cl.maxInter || 12;
  
  window.renderEditClInters(); 
  
  if(window.$('ovEditCl')) window.$('ovEditCl').classList.remove('hidden');
};

window.renderEditClInters = function() {
  const cl = window.D.classeurs.find(c => c.id === window.currentEditClId);
  const container = window.$('eClInterList');
  const max = parseInt(window.$('eClMax').value) || 12;
  
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
  const cl = window.D.classeurs.find(c => c.id === window.currentEditClId);
  if(!cl) return;
  
  cl.name = window.$('eClNm').value.trim() || cl.name;
  cl.maxInter = parseInt(window.$('eClMax').value) || 12;
  
  if(!cl.interNames) cl.interNames = {};
  for(let i=1; i<=cl.maxInter; i++) {
    const val = String(i).padStart(2, '0');
    const input = window.$(`eClInter_${val}`);
    if(input && input.value.trim() !== '') {
      cl.interNames[val] = input.value.trim();
    } else {
      delete cl.interNames[val];
    }
  }
  
  window.save(); 
  if(window.$('ovEditCl')) window.$('ovEditCl').classList.add('hidden');
  window.renderClasseurs(); 
  window.renderCours();
};

window.renderMatieres = function() {
  const el = window.$('mgMat');
  if(!el) return;

  let html = `
    <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
      <button class="bs" onclick="window.toggleEditMat()" style="padding:6px 12px; font-size:12px; border-color:var(--bd);">
        ${window.isEditingMat ? '✅ Terminer' : '✏️ Modifier'}
      </button>
    </div>
  `;

  html += window.D.matieres.map(m => {
    let delBtn = window.isEditingMat ? `<button class="mdel" onclick="window.delMat('${m.id}')">✕</button>` : '';
    return `
    <div class="mr">
      <div class="mdot" style="background:${m.color}"></div>
      <div class="mlbl">${m.label}</div><div class="mnm" style="flex:1;">${m.name}</div>
      ${delBtn}
    </div>`
  }).join('');
  
  el.innerHTML = html;
  
  if(window.$('swMat')) {
    window.$('swMat').innerHTML = window.COLORS.map(c => `
      <div class="sw${c===window.newColor?' on':''}" style="background:${c}" onclick="window.setNewColor('${c}')"></div>
    `).join('');
  }
};

window.setNewColor = function(col) {
  window.newColor = col;
  window.renderMatieres();
};

window.addCl = function() {
  const name = window.$('nClNm').value.trim();
  const icon = '📘'; 
  
  if(!name) return window.sysAlert("Le nom est obligatoire", "Création de classeur");
  
  const id = 'CL_' + Date.now();
  
  window.D.classeurs.push({id, name, icon, color:window.newColorCl, maxInter: 12, interNames: {}}); 
  window.save(); 
  window.renderClasseurs(); 
  window.renderCours();
  
  window.$('nClNm').value='';
  window.sysAlert("Classeur ajouté avec succès !", "Création de classeur");
};

window.addMat = function() {
  const lbl = window.$('nMlbl').value.trim().toUpperCase();
  const name = window.$('nMname').value.trim();
  
  if(lbl.length !== 4) return window.sysAlert("Code matière : exactement 4 lettres !", "Création de matière");
  if(window.D.matieres.find(m=>m.id===lbl)) return window.sysAlert("Cette matière existe déjà !", "Création de matière");
  
  window.D.matieres.push({id:lbl, label:lbl, name:name||lbl, color:window.newColor}); 
  window.save(); 
  window.renderMatieres(); 
  window.renderCours();
  
  window.$('nMlbl').value=''; 
  window.$('nMname').value='';
  window.sysAlert("Matière ajoutée avec succès !", "Création de matière");
};

window.delMat = function(id) {
  const doDel = () => {
    window.D.matieres = window.D.matieres.filter(m=>m.id!==id);
    window.save();
    window.renderMatieres();
    window.renderCours();
  };
  
  if(window.D.cours.filter(c=>c.mat===id).length) {
    window.sysConfirm('Attention, cette matière contient des cours. Veux-tu vraiment la supprimer ?', doDel, "Suppression d'une matière");
  } else {
    doDel();
  }
};

window.delCl = function(id) {
  const doDel = () => {
    window.D.classeurs = window.D.classeurs.filter(c=>c.id!==id);
    window.save();
    window.renderClasseurs();
    window.renderCours();
  };

  if(window.D.cours.filter(c=>c.cl===id).length) {
    window.sysConfirm('Attention, ce classeur contient des cours. Veux-tu vraiment le supprimer ?', doDel, "Suppression d'un classeur");
  } else {
    doDel();
  }
};
