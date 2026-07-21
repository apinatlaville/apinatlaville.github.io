window.$ = window.$ || (id => document.getElementById(id));
window.COLORS = ['#3b82f6','#f59e0b','#22c55e','#ef4444','#a855f7','#ec4899','#06b6d4','#f97316'];

/** Alias — implémentation dans core-utils.js */
window.localDateISO = window.localDateISO || function(d) {
  const dt = d ? new Date(d) : new Date();
  if (isNaN(dt.getTime())) return window.localDateISO(new Date());
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
};

window.emptyData = {
  settings: { userName: "Étudiant", theme: 'dark', template: 'glass', themePreset: 'minimaliste', appearanceVersion: 2, navLayout: 'sidebar-left', appColor: '#5b9aff', compact: false, showStats: false, showChips: true, showDashHero: true, showDashRev: true, showDashOver: true, showHeaderClock: false, headerClockSeconds: true, ankiQuotaMin: 90 },
  matieres: [
    {id:'PHYS', label:'PHYS', name:'Physique', color:'#5b8df7'},
    {id:'MATH', label:'MATH', name:'Mathématiques', color:'#f0c060'},
    {id:'CHIM', label:'CHIM', name:'Chimie', color:'#50d890'},
    {id:'ANGL', label:'ANGL', name:'Anglais', color:'#e07ab3'},
  ],
  classeurs: [
    {id:'A', name:'Classeur Phys A', icon:'book-blue', color:'#5b8df7', maxInter: 12, interNames: {}},
    {id:'B', name:'Classeur Maths B', icon:'book-orange', color:'#f0c060', maxInter: 12, interNames: {}},
    {id:'C', name:'Classeur Chim C', icon:'book-green', color:'#50d890', maxInter: 12, interNames: {}},
    {id:'E', name:'Classeur Anglais', icon:'languages', color:'#e07ab3', maxInter: 6, interNames: {}},
  ],
  cours: [],
  exercices: [],
  devoirs: []
};

/** Matière système pour documents sans matière valide (créée / supprimée automatiquement). */
window.UNSORTED_MAT_ID = 'UNTRI';

window.ensureUnsortedMatiere = function () {
  if (!window.D) return false;
  if (!window.D.matieres) window.D.matieres = [];
  if (window.D.matieres.some(m => m.id === window.UNSORTED_MAT_ID)) return true;
  window.D.matieres.push({
    id: window.UNSORTED_MAT_ID,
    label: 'UNTR',
    name: 'Non trié',
    color: '#6a7088',
    _system: true
  });
  return true;
};

window._ankiCardsUsingMat = function (matId) {
  if (!window.D || !matId) return [];
  const out = [];
  (window.D.exercices || []).forEach(c => { if (c && c.mat === matId) out.push(c); });
  (window.D.devoirs || []).forEach(c => { if (c && c.mat === matId) out.push(c); });
  return out;
};

window.pruneUnsortedMatiere = function () {
  if (!window.D || !window.D.matieres) return;
  const usedCours = (window.D.cours || []).some(c => c.mat === window.UNSORTED_MAT_ID);
  const usedAnki = window._ankiCardsUsingMat(window.UNSORTED_MAT_ID).length > 0;
  if (!usedCours && !usedAnki) {
    window.D.matieres = window.D.matieres.filter(m => m.id !== window.UNSORTED_MAT_ID);
  }
};

window.reconcileOrphanCours = function () {
  if (!window.D) return false;
  if (!Array.isArray(window.D.cours)) window.D.cours = [];
  let changed = false;
  const matIds = new Set((window.D.matieres || []).map(m => m.id));
  const clIds = new Set((window.D.classeurs || []).map(c => c.id));
  window.D.cours.forEach(c => {
    if (!c.mat || !matIds.has(c.mat)) {
      window.ensureUnsortedMatiere();
      c.mat = window.UNSORTED_MAT_ID;
      changed = true;
      matIds.add(window.UNSORTED_MAT_ID);
    }
    if (!c.cl || !clIds.has(c.cl)) {
      window.ensureUnsortedClasseur();
      c.cl = window.UNSORTED_CL_ID;
      if (!c.inter) c.inter = '01';
      changed = true;
      clIds.add(window.UNSORTED_CL_ID);
    }
  });
  // Cartes Anki orphelines (matière supprimée / id invalide)
  const rehomeAnki = (arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach(c => {
      if (!c) return;
      if (!c.mat || !matIds.has(c.mat)) {
        window.ensureUnsortedMatiere();
        c.mat = window.UNSORTED_MAT_ID;
        matIds.add(window.UNSORTED_MAT_ID);
        changed = true;
      }
    });
  };
  rehomeAnki(window.D.exercices);
  rehomeAnki(window.D.devoirs);
  const matBefore = (window.D.matieres || []).length;
  window.pruneUnsortedMatiere();
  if ((window.D.matieres || []).length !== matBefore) changed = true;
  const clBefore = (window.D.classeurs || []).length;
  window.pruneUnsortedClasseur();
  if ((window.D.classeurs || []).length !== clBefore) changed = true;
  return changed;
};

window.moveCoursToUnsorted = function (fromMatId) {
  if (!window.D || !fromMatId || fromMatId === window.UNSORTED_MAT_ID) return;
  window.ensureUnsortedMatiere();
  window.D.cours.forEach(c => {
    if (c.mat === fromMatId) c.mat = window.UNSORTED_MAT_ID;
  });
};

window.moveAnkiCardsToUnsorted = function (fromMatId) {
  if (!window.D || !fromMatId || fromMatId === window.UNSORTED_MAT_ID) return;
  window.ensureUnsortedMatiere();
  (window.D.exercices || []).forEach(c => {
    if (c && c.mat === fromMatId) c.mat = window.UNSORTED_MAT_ID;
  });
  (window.D.devoirs || []).forEach(c => {
    if (c && c.mat === fromMatId) c.mat = window.UNSORTED_MAT_ID;
  });
};

window.isSystemMatiere = function (id) {
  return id === window.UNSORTED_MAT_ID;
};

/** Classeur système pour documents sans classeur valide (créé / supprimé automatiquement). */
window.UNSORTED_CL_ID = 'NONCL';

window.ensureUnsortedClasseur = function () {
  if (!window.D) return false;
  if (!window.D.classeurs) window.D.classeurs = [];
  if (window.D.classeurs.some(c => c.id === window.UNSORTED_CL_ID)) return true;
  window.D.classeurs.push({
    id: window.UNSORTED_CL_ID,
    name: 'Non classé',
    icon: 'folder',
    color: '#6a7088',
    maxInter: 12,
    interNames: {},
    _system: true
  });
  return true;
};

window.pruneUnsortedClasseur = function () {
  if (!window.D || !window.D.classeurs || !window.D.cours) return;
  const used = window.D.cours.some(c => c.cl === window.UNSORTED_CL_ID);
  if (!used) {
    window.D.classeurs = window.D.classeurs.filter(c => c.id !== window.UNSORTED_CL_ID);
  }
};

window.moveCoursClToUnsorted = function (fromClId) {
  if (!window.D || !fromClId || fromClId === window.UNSORTED_CL_ID) return;
  window.ensureUnsortedClasseur();
  window.D.cours.forEach(c => {
    if (c.cl === fromClId) {
      c.cl = window.UNSORTED_CL_ID;
      if (!c.inter) c.inter = '01';
    }
  });
};

window.isSystemClasseur = function (id) {
  return id === window.UNSORTED_CL_ID;
};

window.isEditingMat = false;
window.isEditingCl = false;
window.currentEditClId = null;
window.chipFilter = null;
window.newColor = window.COLORS[0];
window.newColorCl = window.COLORS[0];
window.newIconCl = 'folder'; 
window.editUid = null;
window.moveUid = null; // 🚨 ÉTAT : Sauvegarde l'id du cours qu'on déplace

window.getInterName = function(cl, ns) {
  // Format unifié partout : "01 - Mécanique" ou "01" si pas de nom personnalisé
  if (cl && cl.interNames && cl.interNames[ns]) {
    return `${ns} - ${cl.interNames[ns]}`;
  }
  return `Intercalaire ${ns}`;
};

// Variante "nom seul" (utilisée dans les dropdowns qui préfixent déjà le numéro)
window.getInterRawName = function(cl, ns) {
  if (cl && cl.interNames && cl.interNames[ns]) return cl.interNames[ns];
  return '';
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
  ['fltType', 'fltRev', 'fltMat', 'fltCl', 'fltQr'].forEach(id => {
    const el = window.$(id);
    if (!el) return;
    if (typeof window.fcSetSelectValue === 'function') window.fcSetSelectValue(el, '');
    else el.value = '';
  });
  ['mainSearchText', 'mainSearchCode'].forEach(id => {
    if (window.$(id)) window.$(id).value = '';
  });
  window.chipFilter = null;
  window.renderCours();
};

window.renderCours = function() {
  try {
    if (!window.D || !window.D.cours) return;
    const allM = [...new Set(window.D.cours.map(c => c.mat))];
    const allC = [...new Set(window.D.cours.map(c => c.cl))];
    const ms = window.$('fltMat');
    const cs = window.$('fltCl');
    
    if(ms && cs) {
      const mv = ms.value, cv = cs.value;
      const matHtml = '<option value="">Toutes matières</option>' + allM.map(m => {
        const mo = window.D.matieres.find(x => x.id===m) || {name:m};
        return `<option value="${m}" ${m===mv?'selected':''}>${window.escHtml(mo.name)}</option>`;
      }).join('');
      const clHtml = '<option value="">Tous classeurs</option>' + allC.map(c => {
        const co = window.D.classeurs.find(x => x.id===c) || {name:c};
        return `<option value="${c}" ${c===cv?'selected':''}>${window.escHtml(co.name)}</option>`;
      }).join('');
      if (typeof window.fcRefreshSelect === 'function') {
        window.fcRefreshSelect(ms, matHtml);
        window.fcRefreshSelect(cs, clHtml);
      } else {
        ms.innerHTML = matHtml;
        cs.innerHTML = clHtml;
      }
    }
    
    if(window.$('matChips')) {
      window.$('matChips').innerHTML = '<button class="chip' + (window.chipFilter===null?' on':'') + '" data-chip="null">Tous</button>' +
        window.D.matieres.map(m => `
          <button class="chip${window.chipFilter===m.id?' on':''}" data-chip="${m.id}" style="${window.chipFilter===m.id ? 'background:'+m.color+';border-color:'+m.color : 'border-color:'+m.color+'60;color:'+m.color}">${window.escHtml(m.label)}</button>
        `).join('');
        
      window.$('matChips').querySelectorAll('.chip').forEach(btn => {
        btn.addEventListener('click', () => {
          window.chipFilter = btn.dataset.chip==='null' ? null : btn.dataset.chip;
          window.renderCours();
        });
      });
    }

    const qText = window.$('mainSearchText') ? window.$('mainSearchText').value.trim() : '';
    const qCodeRaw = window.$('mainSearchCode') ? window.$('mainSearchCode').value.trim().toUpperCase() : '';
    const qCode = qCodeRaw.replace(/[^A-Z0-9]/g, '');
    const qrf = window.$('fltQr') ? window.$('fltQr').value : '';
    const fType = window.$('fltType') ? window.$('fltType').value : '';
    const fRev = window.$('fltRev') ? window.$('fltRev').value : '';

    let baseList = window.D.cours;

    if (qText && typeof Fuse === 'undefined') {
      if (!window._fuseWarnShown) {
        window._fuseWarnShown = true;
        if (typeof window.sysAlert === 'function') {
          window.sysAlert(
            'La recherche par texte est indisponible : la bibliothèque <b>Fuse.js</b> n\'a pas été chargée.<br><br>' +
            (window.APP_MSG && window.APP_MSG.RELOAD_HINT ? window.APP_MSG.RELOAD_HINT.replace(/\.$/, '') : 'Recharge la page ou vérifie ta connexion') +
            '. En attendant, utilise le filtre par <b>code</b> (PH-8X2).',
            'Recherche limitée'
          );
        }
      }
    } else if (qText && typeof Fuse !== 'undefined') {
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
      const uidNorm = String(c.uid || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      return (!ms || !ms.value || c.mat===ms.value)
        && (!cs || !cs.value || c.cl===cs.value)
        && (!window.chipFilter || c.mat===window.chipFilter)
        && (!qrf || c.stat === qrf)
        && (!fType || c.type === fType)
        && (!fRev || c.rev === fRev)
        && (!qCode || uidNorm.includes(qCode));
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
        const co = window.D.classeurs.find(x => x.id===c.cl) || {name:c.cl, icon:'book-blue', color:'#5b8df7'};
        
        const interNameDisplay = window.getInterName(co, c.inter);

        if (!qText && c.mat !== currentMat) {
          html += `
            <div style="grid-column: 1/-1; margin-top: 15px; border-bottom: 2px solid ${mo.color}; padding-bottom: 5px;">
              <h3 style="font-family: 'Inter'; color: ${mo.color};">${window.escHtml(mo.name)}</h3>
            </div>
          `;
          currentMat = c.mat;
        }

        let warnHtml = '';
        const showWarn = window.D.settings.showInitWarn !== false;
        if (showWarn && c.stat === 'pending') {
          warnHtml = '<div class="qr-warn">' + window.statusLabel('red', 'À imprimer') + '</div>';
        } else if (showWarn && c.stat === 'printed') {
          warnHtml = '<div class="qr-scan-req">' + window.statusLabel('orange', 'Imprimé. Scanne pour initialiser.') + '</div>';
        }

        html += `
        <div class="card" style="--mat-color:${mo.color}" onclick="window.doLocate('${window.escHtml(c.uid)}')">
          <div class="rev-dot rev-${c.rev}"></div>
          <div class="uid-badge">${window.escHtml(c.uid)}</div>
          <div class="ctop">
            <div class="cbadges">
              <span class="bm" style="background:${mo.color}20;color:${mo.color};border:1px solid ${mo.color}60">${window.escHtml(mo.label)}</span>
              <span class="bm badge-type">${window.escHtml(c.type)}</span>
            </div>
          </div>
          <div class="ctitle">${window.escHtml(c.title)}</div>
          <div class="clocs">
            <span class="cloc cloc-a">${window.renderClasseurIcon(co.icon, 14, co.color)} ${window.escHtml(co.name)}</span>
            <span class="cloc cloc-b">${window.iconHtml('bookmark', 14, 'icon-sm')} ${window.escHtml(interNameDisplay)}</span>
          </div>
          ${c.desc ? `<div class="cdesc">${window.escHtml(c.desc)}</div>` : ''}
          ${c.note || c.rang ? `<div class="cnote">${[
            c.note ? `Note : ${window.escHtml(c.note)}/20` : '',
            c.rang ? `Rang : ${window.escHtml(String(c.rang))}${c.effectif ? '/' + window.escHtml(String(c.effectif)) : ''}` : ''
          ].filter(Boolean).join(' · ')}</div>` : ''}
          <div class="cacts" onclick="event.stopPropagation();">
              ${window.iconBtn('refresh-cw', 'Déplacer', `onclick="window.openMove('${window.escHtml(c.uid)}')"`)}
              ${window.iconBtn('qr-code', 'Voir Code-Barres', `onclick="window.showQR('${window.escHtml(c.uid)}')"`)}
              ${window.iconEditDeletePair(
                `window.editCours('${window.escHtml(c.uid)}')`,
                `window.delCours('${window.escHtml(c.uid)}')`
              )}
          </div>
          ${warnHtml}
        </div>`;
      });
      grid.innerHTML = html;
    }
    window.renderStats();
  } catch(e) {
    if (typeof window.recordAppError === 'function') {
      window.recordAppError('Crash renderCours: ' + e.message, 'data.js');
    }
  }
};

window.doLocate = function(uid) {
  const c = window.D.cours.find(x => x.uid === uid);
  if (!c) {
    if(window.$('locContent')) {
      window.$('locContent').innerHTML = `
        <div style="text-align:center;padding:10px 0">
          <div style="font-size:32px;margin-bottom:8px">${window.iconHtml('circle-x', 32, 'icon-md')}</div>
          <div style="font-family:'DM Mono',monospace;font-size:22px;color:var(--red);margin-bottom:6px;font-weight:bold;">${window.escHtml(uid)}</div>
          <div style="color:var(--mut);font-size:13px">Code introuvable.</div>
        </div>`;
    }
    if(window.$('locBackdrop')) window.$('locBackdrop').style.display = 'block';
    if(window.$('locPopup')) window.$('locPopup').classList.add('open');
    return;
  }
  
  window.triggerHaptic();

  const mo = window.D.matieres.find(m => m.id === c.mat) || {name: c.mat, color:'#5b8df7'};
  const co = window.D.classeurs.find(x => x.id === c.cl) || {name: c.cl, icon: 'book-blue', color: '#5b8df7'};
  const interNameDisplay = window.getInterName(co, c.inter);
  
  const baseInfoHtml = `
    <div class="loc-code">${window.escHtml(c.uid)}</div>
    <div class="loc-title">${window.escHtml(c.title)}</div>
    <div style="text-align:center;margin-top:5px;margin-bottom:15px;font-size:12px;font-weight:bold;color:${mo.color}">
      ${window.escHtml(c.type)}
    </div>
  `;

  if (c.stat === 'printed') {
    window.$('locContent').innerHTML = baseInfoHtml + `
      <div style="background:var(--s2); border:2px dashed var(--acc); padding:15px; border-radius:12px; margin-bottom:15px;">
        <h4 style="color:var(--acc); margin-bottom:10px; text-align:center;">${window.iconLabel('pin', 'Initialisation')}</h4>
        <p style="font-size:12px; color:var(--mut); margin-bottom:15px; text-align:center;">Confirme l'emplacement de ce document :</p>
        <div class="loc-cards" style="margin-bottom:15px;">
          <div class="loc-c" style="background:rgba(91,141,247,.15);color:var(--acc);border:1px solid var(--acc);">
            ${window.renderClasseurIcon(co.icon, 16, co.color)} ${window.escHtml(co.name)}
          </div>
          <div class="loc-c" style="background:rgba(240,192,96,.15);color:var(--gold);border:1px solid var(--gold);">
            ${window.iconHtml('bookmark', 14, 'icon-sm')} ${window.escHtml(interNameDisplay)}
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-direction:column;">
          <button class="bp" onclick="window.confirmInit('${window.escHtml(c.uid)}')" style="background:var(--grn); color:#000; border:none;">${window.iconLabel('check', 'Confirmer le rangement')}</button>
          <button class="bs" onclick="window.closeLocPopup(); window.openMove('${window.escHtml(c.uid)}')">${window.iconLabel('refresh-cw', "Modifier l'emplacement")}</button>
          <button class="bs" onclick="window.closeLocPopup()" style="border-color:var(--red); color:var(--red);">${window.iconLabel('circle-x', 'Annuler')}</button>
        </div>
      </div>
    `;
  } else {
    const linkedCount = (window.D.exercices || []).filter(ex => {
      const ids = ex.coursIds || (ex.coursId ? [ex.coursId] : []);
      return ids.includes(c.uid);
    }).length;
    const uidEsc = window.escHtml(c.uid);
     window.$('locContent').innerHTML = baseInfoHtml + `
        <div class="loc-cards">
          <div class="loc-c" style="background:rgba(91,141,247,.15);color:var(--acc);border:1px solid var(--acc);">
            ${window.renderClasseurIcon(co.icon, 16, co.color)} ${window.escHtml(co.name)}
          </div>
          <div class="loc-c" style="background:rgba(240,192,96,.15);color:var(--gold);border:1px solid var(--gold);">
            ${window.iconHtml('bookmark', 14, 'icon-sm')} ${window.escHtml(interNameDisplay)}
          </div>
        </div>
        ${(c.note || c.rang) ? `<div style="text-align:center;font-weight:bold;font-size:16px;color:var(--acc);margin-top:10px;">${[
          c.note ? `Note : ${window.escHtml(c.note)}/20` : '',
          c.rang ? `Rang : ${window.escHtml(String(c.rang))}${c.effectif ? '/' + window.escHtml(String(c.effectif)) : ''}` : ''
        ].filter(Boolean).join(' · ')}</div>` : ''}
        ${c.desc ? `<div class="loc-desc">${window.escHtml(c.desc)}</div>` : ''}

        <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px;">
          ${typeof window.openCardCreateForCours === 'function' ? `<button type="button" class="bp" onclick="window.openCardCreateForCours('${uidEsc}')" style="width:100%;padding:10px;">${window.iconLabel('plus', 'Créer une carte liée à ce cours')}</button>` : ''}
          ${linkedCount ? `<p style="font-size:11px;color:var(--mut);text-align:center;margin:0;">${linkedCount} carte(s) Synchrotron liée(s)</p>` : ''}
          ${linkedCount && typeof window.startAnkiV2Colle === 'function' ? `<button type="button" class="bs" onclick="window.closeLocPopup();window.switchTab('ankiV2');window.startAnkiV2Colle('${uidEsc}')" style="width:100%;padding:10px;">${window.iconLabel('play', 'Réviser les cartes du chapitre')}</button>` : ''}
        </div>
        
        <button class="bs" onclick="window.closeLocPopup(); window.openMove('${uidEsc}')" style="width:100%; margin-top:12px; padding:10px;">${window.iconLabel('refresh-cw', 'Déplacer ce document')}</button>
     `;
  }
  
  if(window.$('locBackdrop')) window.$('locBackdrop').style.display = 'block';
  if(window.$('locPopup')) window.$('locPopup').classList.add('open');
};

// 🚨 CONFIRME INITIALISATION
window.confirmInit = function(uid) {
  const c = window.D.cours.find(x => x.uid === uid);
  if(c) {
      c.stat = 'active';
      window.save();
      window.renderCours();
      window.renderDashboard();
      window.closeLocPopup();
      window.sysAlert(window.iconLabel('check', 'Document initialisé et classé avec succès !'), "Succès");
  }
};

// 🚨 OUVRE POPUP DEPLACEMENT
window.openMove = function(uid) {
  const c = window.D.cours.find(x => x.uid === uid);
  if(!c) return;
  window.moveUid = uid;
  
  const co = window.D.classeurs.find(x => x.id === c.cl) || {name: c.cl, icon: 'book-blue', color: '#5b8df7'};
  const interNameDisplay = window.getInterName(co, c.inter);
  
  if(window.$('moveCurrentLoc')) {
      window.$('moveCurrentLoc').innerHTML = `${window.renderClasseurIcon(co.icon, 16, co.color)} ${window.escHtml(co.name)} <br> ${window.iconHtml('bookmark', 14, 'icon-sm')} ${window.escHtml(interNameDisplay)}`;
  }

  const moveClSelect = window.$('fMoveCl');
  if(moveClSelect) {
      moveClSelect.innerHTML = window.D.classeurs.map(x => `
        <option value="${x.id}" ${x.id===c.cl?'selected':''}>${window.escHtml(x.name)}</option>
      `).join('');
  }
  
  window.updateMoveIntercalairesDropdown(c.cl, c.inter);
  
  if(window.$('ovMove')) window.$('ovMove').classList.remove('hidden');
};

// 🚨 MET A JOUR LE MENU DEPLACEMENT
window.updateMoveIntercalairesDropdown = function(clIdOverride, interOverride) {
  const clId = clIdOverride || (window.$('fMoveCl') ? window.$('fMoveCl').value : '');
  const cl = window.D.classeurs.find(c => c.id === clId);
  const maxI = cl ? (cl.maxInter || 12) : 12;
  
  const interSelect = window.$('fMoveInter');
  if(interSelect) {
      interSelect.innerHTML = Array.from({length: maxI}, (_, i) => {
          const val = String(i + 1).padStart(2, '0');
          return `<option value="${val}" ${val===interOverride?'selected':''}>${window.escHtml(window.getInterName(cl, val))}</option>`;
      }).join('');
  }
};

// 🚨 SAUVEGARDE DEPLACEMENT
window.saveMove = function() {
  const cl = window.$('fMoveCl') ? window.$('fMoveCl').value : '';
  const inter = window.$('fMoveInter') ? window.$('fMoveInter').value : '';
  
  if(!cl || !inter) return;
  
  const c = window.D.cours.find(x => x.uid === window.moveUid);
  if(c) {
      c.cl = cl;
      c.inter = inter;
      if (c.stat === 'printed') {
          c.stat = 'active';
      }
      window.pruneUnsortedMatiere();
      window.pruneUnsortedClasseur();
      window.save();
      window.renderCours();
      window.renderClasseurs();
      window.renderMatieres();
      window.renderDashboard();
      if (typeof window.renderOrphelins === 'function') window.renderOrphelins();
      if(window.$('ovMove')) window.$('ovMove').classList.add('hidden');
      window.sysAlert(window.iconLabel('check', 'Document déplacé avec succès !'), "Déplacement réussi");
  }
};

window.delCours = function(uid) {
  window.sysConfirm('Supprimer définitivement le document ' + uid + ' ?', () => {
    window.D.cours = window.D.cours.filter(c => c.uid !== uid);
    window.pruneUnsortedMatiere();
    window.pruneUnsortedClasseur();
    window.save();
    window.renderMatieres();
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
      if(window.$('fRang')) window.$('fRang').value = '';
      if(window.$('fEffectif')) window.$('fEffectif').value = '';
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
  const toggle = window.$('fManualUidToggle');
  const uidBox = window.$('uidBox');
  if (!toggle || !uidBox) return;
  const isManual = !!toggle.checked;
  if (isManual) {
    uidBox.style.display = 'none';
    if(window.$('manualUidContainer')) window.$('manualUidContainer').style.display = 'flex';
    window.updateUidPrefix();
    if(window.$('fUidInput')) window.$('fUidInput').focus();
  } else {
    uidBox.style.display = 'block';
    if(window.$('manualUidContainer')) window.$('manualUidContainer').style.display = 'none';
  }
};

window.updateIntercalairesDropdown = function() {
  const clId = window.$('fCl') ? window.$('fCl').value : '';
  const cl = window.D.classeurs.find(c => c.id === clId);
  const maxI = cl ? (cl.maxInter || 12) : 12;
  
  if(window.$('fInter')) {
    const html = '<option value="">—</option>' + 
      Array.from({length: maxI}, (_, i) => {
        const val = String(i + 1).padStart(2, '0');
        return `<option value="${val}">${window.escHtml(window.getInterName(cl, val))}</option>`;
      }).join('');
    if (typeof window.fcRefreshSelect === 'function') {
      window.fcRefreshSelect(window.$('fInter'), html);
    } else {
      window.$('fInter').innerHTML = html;
    }
  }
};

window.openModalCours = function() {
  window.editUid = null;
  if(window.$('mTitle')) window.$('mTitle').innerHTML = window.iconLabel('sparkles', 'Ajouter un document');
  if(window.$('fTitle')) window.$('fTitle').value = ''; 
  if(window.$('fDesc')) window.$('fDesc').value = ''; 
  
  if(window.$('fMat')) {
    const matHtml = '<option value="">— Choisir —</option>' + 
    window.D.matieres.map(m => `<option value="${m.id}">${window.escHtml(m.label)} — ${window.escHtml(m.name)}</option>`).join('');
    if (typeof window.fcRefreshSelect === 'function') window.fcRefreshSelect(window.$('fMat'), matHtml);
    else window.$('fMat').innerHTML = matHtml;
  }
  
  if(window.$('fCl')) {
    const clHtml = '<option value="">— Choisir —</option>' + 
    window.D.classeurs.map(c => `<option value="${c.id}">${window.escHtml(c.name)}</option>`).join('');
    if (typeof window.fcRefreshSelect === 'function') window.fcRefreshSelect(window.$('fCl'), clHtml);
    else window.$('fCl').innerHTML = clHtml;
  }
  
  window.updateIntercalairesDropdown(); 
  if(window.$('fInter')) window.$('fInter').value = ''; 
  if(window.$('fType')) {
    window.$('fType').value = 'COURS';
    if (window.$('fType')._choices) window.$('fType')._choices.setChoiceByValue('COURS');
  }
  if(window.$('fRev')) {
    window.$('fRev').value = 'green';
    if (window.$('fRev')._choices) window.$('fRev')._choices.setChoiceByValue('green');
  }
  if(window.$('fNote')) window.$('fNote').value = '';
  if(window.$('fRang')) window.$('fRang').value = '';
  if(window.$('fEffectif')) window.$('fEffectif').value = '';
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
  if (typeof window.enhanceFormControls === 'function') {
    window.enhanceFormControls(window.$('ovCours'));
  }
};

window.editCours = function(uid) {
  const c = window.D.cours.find(x => x.uid===uid);
  if (!c) return;
  window.editUid = uid;
  
  if(window.$('mTitle')) window.$('mTitle').innerHTML = window.iconLabel('pencil', 'Modifier le document');
  if(window.$('fTitle')) window.$('fTitle').value = c.title; 
  if(window.$('fDesc')) window.$('fDesc').value = c.desc || ''; 
  if(window.$('fNote')) window.$('fNote').value = c.note || '';
  if(window.$('fRang')) window.$('fRang').value = c.rang != null && c.rang !== '' ? c.rang : '';
  if(window.$('fEffectif')) window.$('fEffectif').value = c.effectif != null && c.effectif !== '' ? c.effectif : '';
  
  if(window.$('fMat')) {
    const matHtml = window.D.matieres.map(m =>
      `<option value="${m.id}">${window.escHtml(m.label)} — ${window.escHtml(m.name || '')}</option>`
    ).join('');
    if (typeof window.fcRefreshSelect === 'function') window.fcRefreshSelect(window.$('fMat'), matHtml);
    else window.$('fMat').innerHTML = matHtml;
    if (typeof window.fcSetSelectValue === 'function') window.fcSetSelectValue(window.$('fMat'), c.mat || '');
    else window.$('fMat').value = c.mat || '';
  }
  
  if(window.$('fCl')) {
    const clHtml = window.D.classeurs.map(x =>
      `<option value="${x.id}">${window.escHtml(x.name)}</option>`
    ).join('');
    if (typeof window.fcRefreshSelect === 'function') window.fcRefreshSelect(window.$('fCl'), clHtml);
    else window.$('fCl').innerHTML = clHtml;
    if (typeof window.fcSetSelectValue === 'function') window.fcSetSelectValue(window.$('fCl'), c.cl || '');
    else window.$('fCl').value = c.cl || '';
  }
  
  window.updateIntercalairesDropdown();
  if(window.$('fInter')) {
    if (typeof window.fcSetSelectValue === 'function') window.fcSetSelectValue(window.$('fInter'), c.inter || '');
    else window.$('fInter').value = c.inter || '';
  }

  if(window.$('fType')) {
    window.$('fType').value = c.type || 'COURS';
    if (typeof window.fcSetSelectValue === 'function') window.fcSetSelectValue(window.$('fType'), c.type || 'COURS');
    else if (window.$('fType')._choices) window.$('fType')._choices.setChoiceByValue(c.type || 'COURS');
  }
  if(window.$('fRev')) {
    window.$('fRev').value = c.rev || 'green';
    if (typeof window.fcSetSelectValue === 'function') window.fcSetSelectValue(window.$('fRev'), c.rev || 'green');
    else if (window.$('fRev')._choices) window.$('fRev')._choices.setChoiceByValue(c.rev || 'green');
  }
  window.toggleNoteField();
  
  if(window.$('lblManualUid')) window.$('lblManualUid').style.display = 'none';
  if(window.$('manualUidContainer')) window.$('manualUidContainer').style.display = 'none';
  
  if(window.$('uidBox')) {
    window.$('uidBox').style.display = 'block';
    window.$('uidBox').innerHTML = window.escHtml(c.uid) + '<br><small style="font-size:10px; font-weight:normal; color:var(--mut);">Code permanent</small>';
  }
  
  if(window.$('ovCours')) window.$('ovCours').classList.remove('hidden');
  if (typeof window.enhanceFormControls === 'function') {
    window.enhanceFormControls(window.$('ovCours'));
  }
};

window.saveCours = function() {
  const title = window.$('fTitle')?window.$('fTitle').value.trim():'';
  const mat = window.$('fMat')?window.$('fMat').value:'';
  const cl = window.$('fCl')?window.$('fCl').value:'';
  const inter = window.$('fInter')?window.$('fInter').value:'';
  
  if (!title || !mat || !cl || !inter) {
    return window.sysAlert('Remplis tous les champs obligatoires avant de sauvegarder.', "Erreur de saisie");
  }
  
  let noteRaw = window.$('fNote') ? window.$('fNote').value : '';
  if (noteRaw !== '' && noteRaw != null) {
    const n = parseFloat(String(noteRaw).trim().replace(',', '.'));
    if (!Number.isFinite(n)) noteRaw = '';
    else noteRaw = String(Math.max(0, Math.min(20, Math.round(n * 2) / 2)));
  } else {
    noteRaw = '';
  }

  let rangRaw = window.$('fRang') ? window.$('fRang').value : '';
  let rangVal = '';
  if (rangRaw !== '' && rangRaw != null) {
    const r = parseInt(String(rangRaw).trim(), 10);
    if (Number.isFinite(r) && r >= 1) rangVal = r;
  }

  let effectifRaw = window.$('fEffectif') ? window.$('fEffectif').value : '';
  let effectifVal = '';
  if (effectifRaw !== '' && effectifRaw != null) {
    const e = parseInt(String(effectifRaw).trim(), 10);
    if (Number.isFinite(e) && e >= 1) effectifVal = e;
  }
  if (rangVal !== '' && effectifVal !== '' && rangVal > effectifVal) {
    effectifVal = rangVal;
  }

  const obj = {
    title, 
    type:window.$('fType')?window.$('fType').value:'', 
    rev:window.$('fRev')?window.$('fRev').value:'', 
    mat, 
    cl, 
    inter, 
    note: noteRaw,
    rang: rangVal,
    effectif: effectifVal,
    desc: window.$('fDesc')?window.$('fDesc').value.trim():''
  };
  
  if (obj.type !== 'DS' && obj.type !== 'KHOLLE') {
    obj.note = '';
    obj.rang = '';
    obj.effectif = '';
  }
  
  if(!obj.date) obj.date = window.localDateISO();

  if (window.editUid) {
    const idx = window.D.cours.findIndex(c => c.uid===window.editUid);
    if(idx > -1) {
      const prev = window.D.cours[idx];
      obj.uid = prev.uid;
      obj.stat = prev.stat; 
      if(prev.date) obj.date = prev.date;
      if(prev.duree != null) obj.duree = prev.duree;
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
      const uidTaken = window.D.cours.some(x => x.uid === newUid)
        || (window.D.exercices || []).some(x => x.id === newUid)
        || (window.D.devoirs || []).some(x => x.id === newUid);
      if (uidTaken) {
        return window.sysAlert("Ce code (" + window.escHtml(newUid) + ") est déjà utilisé ! Trouve-en un autre.", "Erreur de code");
      }
    } else {
      newUid = window.genUid(mat);
    }
    obj.uid = newUid;
    obj.stat = 'pending'; 
    window.D.cours.unshift(obj);
  }
  
  window.save();
  window.pruneUnsortedMatiere();
  window.pruneUnsortedClasseur();
  window.renderMatieres();
  window.closeModalCours();
  window.renderCours();
  window.renderDashboard();
  window.renderClasseurs();
  if (typeof window.renderNotes === 'function') window.renderNotes();
};

window.setNewColorCl = function(col) {
  window.newColorCl = col;
  window.renderClasseurs();
};

window.setNewIconCl = function(icon) {
  window.newIconCl = icon === 'book' ? 'book' : 'folder';
  window.renderClasseurs();
};

window.renderClIconPicker = function(containerId, selected, onClickFnName, color) {
  const el = window.$(containerId);
  if (!el) return;
  const choices = window.CL_ICON_CHOICES || [
    { id: 'folder', label: 'Dossier', icon: 'folder' },
    { id: 'book', label: 'Classeur', icon: 'book' }
  ];
  const sel = (typeof window.normalizeClasseurIcon === 'function'
    ? window.normalizeClasseurIcon(selected)
    : selected) || 'folder';
  const tint = color || window.newColorCl || (window.COLORS && window.COLORS[0]) || '#5b8df7';
  el.innerHTML = choices.map(function (ch) {
    const on = ch.id === sel ? ' on' : '';
    const ico = typeof window.renderClasseurIcon === 'function'
      ? window.renderClasseurIcon(ch.icon, 18, tint)
      : '';
    return '<button type="button" class="cl-icon-opt' + on + '" onclick="' + onClickFnName + '(\'' + ch.id + '\')">' +
      ico + '<span>' + ch.label + '</span></button>';
  }).join('');
};

window.renderColorSwatches = function(containerId, selected, onClickFnName, previewId) {
  const el = window.$(containerId);
  if (!el) return;
  const colors = window.COLORS || [];
  const sel = selected || colors[0] || '#5b8df7';
  el.innerHTML = colors.map(c => `
    <div class="sw${c === sel ? ' on' : ''}" style="background:${c}"
      onclick="${onClickFnName}('${c}')" title="${c}" role="button" tabindex="0"></div>
  `).join('');
  const prev = previewId ? window.$(previewId) : null;
  if (prev) prev.style.background = sel;
};

window.editClasseur = function(id) {
  if (window.isSystemClasseur(id)) return;
  const cl = window.D.classeurs.find(c => c.id === id);
  if(!cl) return;
  window.currentEditClId = id;
  window.editClColor = cl.color || (window.COLORS && window.COLORS[0]) || '#5b8df7';
  window.editClIcon = typeof window.normalizeClasseurIcon === 'function'
    ? window.normalizeClasseurIcon(cl.icon)
    : (cl.icon === 'book' ? 'book' : 'folder');
  
  if(window.$('eClNm')) window.$('eClNm').value = cl.name;
  if(window.$('eClMax')) window.$('eClMax').value = cl.maxInter || 12;
  window.renderColorSwatches('eClSw', window.editClColor, 'window.setEditClColor', 'eClColorPreview');
  window.renderClIconPicker('eClIconPick', window.editClIcon, 'window.setEditClIcon', window.editClColor);
  
  window.renderEditClInters(); 
  
  if(window.$('ovEditCl')) window.$('ovEditCl').classList.remove('hidden');
  if (typeof window.hydrateIcons === 'function' && window.$('ovEditCl')) window.hydrateIcons(window.$('ovEditCl'));
};

window.setEditClColor = function(col) {
  window.editClColor = col;
  window.renderColorSwatches('eClSw', window.editClColor, 'window.setEditClColor', 'eClColorPreview');
  window.renderClIconPicker('eClIconPick', window.editClIcon, 'window.setEditClIcon', window.editClColor);
};

window.setEditClIcon = function(icon) {
  window.editClIcon = icon === 'book' ? 'book' : 'folder';
  window.renderClIconPicker('eClIconPick', window.editClIcon, 'window.setEditClIcon', window.editClColor);
};

window.renderClasseurs = function() {
  try {
    const g = window.$('clGrid');
    if(!g) return;

    let html = `
      <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
        <button class="bs" onclick="window.toggleEditCl()" style="padding:6px 12px; font-size:12px; border-color:var(--bd);">
          ${window.isEditingCl ? window.iconLabel('check', 'Terminer') : window.iconLabel('pencil', 'Modifier')}
        </button>
      </div>
    `;

    if (!window.D.classeurs.length) {
      g.innerHTML = html + '<div class="empty"><h3>Aucun classeur</h3></div>';
    } else {
      html += window.D.classeurs.map(cl => {
        const isSystem = window.isSystemClasseur(cl.id);
        const cc = window.D.cours.filter(c => c.cl===cl.id);
        cc.sort((a,b) => a.inter.localeCompare(b.inter)); 

        let editBtns = window.isEditingCl ? `
          ${!isSystem ? `<button class="cbt" style="padding:4px 8px; margin-left:10px; background:var(--acc); color:#fff; border:none;" onclick="event.stopPropagation(); window.editClasseur('${cl.id}')">${window.iconLabel('pencil', 'Éditer')}</button>` : ''}
          ${!isSystem ? `<button class="cbt" style="color:var(--red); border-color:var(--red); padding:4px 8px; margin-left:5px;" onclick="event.stopPropagation(); window.delCl('${cl.id}')">${window.iconHtml('x', 14, 'icon-sm')}</button>` : ''}
        ` : '';

        let coursesList = '';
        if (cc.length) {
          // 🆕 Groupement par intercalaire pour clarifier l'affichage
          const groups = {};
          cc.forEach(c => {
            const key = c.inter || '00';
            if (!groups[key]) groups[key] = [];
            groups[key].push(c);
          });
          const sortedKeys = Object.keys(groups).sort();
          coursesList = sortedKeys.map(k => {
            const interHeader = window.getInterName(cl, k);
            const items = groups[k].map(c => `
              <div class="irow" onclick="window.doLocate('${window.escHtml(c.uid)}')">
                <div>
                  <div style="font-size:13px; font-weight:600; color:var(--txt);">${window.escHtml(c.title)}</div>
                  <div style="font-size:11px; color:var(--mut);">${window.escHtml(c.type)} · ${window.escHtml(c.uid)}</div>
                </div>
                <div style="color:var(--acc); font-size:18px;">${window.iconHtml('arrow-right', 18, 'icon-sm')}</div>
              </div>`).join('');
            return `
              <div class="inter-group">
                <div class="inter-group-hdr" style="background:${typeof window.colorWithAlpha === 'function' ? window.colorWithAlpha(cl.color, 0.22) : (cl.color + '33')}; color:${typeof window.intensifyColor === 'function' ? window.intensifyColor(cl.color) : cl.color}; border-left:4px solid ${typeof window.intensifyColor === 'function' ? window.intensifyColor(cl.color) : cl.color}; padding:8px 12px; font-family:'DM Mono',monospace; font-weight:bold; font-size:12px; letter-spacing:0.5px; margin-top:4px;">${window.iconHtml('bookmark', 14, 'icon-sm')} ${window.escHtml(interHeader)} <span style="float:right;color:var(--mut);font-weight:normal;">${groups[k].length} doc${groups[k].length>1?'s':''}</span></div>
                ${items}
              </div>`;
          }).join('');
        } else {
          coursesList = '<div class="irow" style="color:var(--mut); justify-content:center;">Classeur vide</div>';
        }

        return `
          <div class="cl-card">
            <div class="cl-hdr" onclick="this.nextElementSibling.classList.toggle('open')">
              <div class="cl-ico" style="background:${typeof window.colorWithAlpha === 'function' ? window.colorWithAlpha(cl.color, 0.38) : (cl.color + '55')}; color:${typeof window.intensifyColor === 'function' ? window.intensifyColor(cl.color) : cl.color}">${window.renderClasseurIcon(cl.icon, 22, cl.color)}</div>
              <div class="cl-info" style="flex:1;">
                <div class="cl-nm">${window.escHtml(cl.name)}${isSystem ? '<span style="font-size:11px;color:var(--mut);margin-left:8px;">(auto)</span>' : ''}</div>
                <div class="cl-sb">${cl.maxInter || 12} inter. max</div>
              </div>
              ${editBtns}
              <div style="color:var(--mut); font-size:12px; margin-left:8px;">${window.iconHtml('chevron-down', 12, 'icon-sm')}</div>
            </div>
            <div class="ilist" id="ili_${cl.id}">
              ${coursesList}
            </div>
          </div>`;
      }).join('');
    }

    g.innerHTML = html;
    
    window.renderColorSwatches('swCl', window.newColorCl, 'window.setNewColorCl', 'nClColorPreview');
    window.renderClIconPicker('nClIconPick', window.newIconCl || 'folder', 'window.setNewIconCl', window.newColorCl);

  } catch(e) {
    if (typeof window.recordAppError === 'function') {
      window.recordAppError('Crash renderClasseurs: ' + e.message, 'data.js');
    }
  }
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
    const safeName = window.escHtml ? window.escHtml(existingName) : existingName;
    html += `
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="font-family:'DM Mono', monospace; font-size:12px; color:var(--gold); font-weight:bold;">${val}</div>
        <input type="text" id="eClInter_${val}" placeholder="Ex: Thermodynamique" value="${safeName}" style="flex:1; background:var(--bg); border:1px solid var(--bd); padding:8px 10px; border-radius:6px; color:var(--txt); font-size:12px; outline:none;">
      </div>
    `;
  }
  container.innerHTML = html;
};

window.getClMaxInterConflict = function (clId, newMax) {
  if (!window.D || !clId) return null;
  const newMaxN = Math.max(1, parseInt(newMax, 10) || 12);
  let maxUsed = 0;
  let count = 0;
  window.D.cours.forEach(c => {
    if (c.cl !== clId) return;
    const n = parseInt(c.inter, 10);
    if (!isNaN(n) && n > newMaxN) {
      count++;
      if (n > maxUsed) maxUsed = n;
    }
  });
  return count ? { newMax: newMaxN, count: count, maxUsed: maxUsed } : null;
};

window.onEditClMaxChange = function () {
  const cl = window.D.classeurs.find(c => c.id === window.currentEditClId);
  const input = window.$('eClMax');
  if (!cl || !input) return;
  const conflict = window.getClMaxInterConflict(cl.id, input.value);
  if (conflict) {
    input.value = String(conflict.maxUsed);
    window.sysAlert(
      `Ce classeur contient ${conflict.count} document(s) à partir de l'intercalaire ` +
      `<b>${String(conflict.maxUsed).padStart(2, '0')}</b>.<br><br>` +
      `Tu ne peux pas descendre en dessous de <b>${conflict.maxUsed}</b> intercalaires.`,
      "Nombre d'intercalaires"
    );
  }
  window.renderEditClInters();
};

window.saveClEdit = function() {
  const cl = window.D.classeurs.find(c => c.id === window.currentEditClId);
  if(!cl) return;

  const newMax = parseInt(window.$('eClMax').value, 10) || 12;
  const conflict = window.getClMaxInterConflict(cl.id, newMax);
  if (conflict) {
    if (window.$('eClMax')) window.$('eClMax').value = String(conflict.maxUsed);
    return window.sysAlert(
      `Ce classeur contient ${conflict.count} document(s) à partir de l'intercalaire ` +
      `<b>${String(conflict.maxUsed).padStart(2, '0')}</b>.<br><br>` +
      `Déplace ou supprime ces documents avant de réduire le nombre d'intercalaires.`,
      "Nombre d'intercalaires"
    );
  }
  
  cl.name = window.$('eClNm').value.trim() || cl.name;
  cl.maxInter = newMax;
  if (window.editClColor) cl.color = window.editClColor;
  if (window.editClIcon === 'book' || window.editClIcon === 'folder') cl.icon = window.editClIcon;
  
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
  if (typeof window.renderDashboard === 'function') window.renderDashboard();
};

window.renderMatieres = function() {
  const el = window.$('mgMat');
  if(!el) return;

  let html = `
    <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
      <button class="bs" onclick="window.toggleEditMat()" style="padding:6px 12px; font-size:12px; border-color:var(--bd);">
        ${window.isEditingMat ? window.iconLabel('check', 'Terminer') : window.iconLabel('pencil', 'Modifier')}
      </button>
    </div>
  `;

  html += window.D.matieres.map(m => {
    const isSystem = window.isSystemMatiere(m.id);
    let editBtns = '';
    if (window.isEditingMat && !isSystem) {
      editBtns = `
        <button class="cbt" style="padding:4px 8px; margin-left:8px; background:var(--acc); color:#fff; border:none;"
          onclick="window.editMatiere('${m.id}')">${window.iconLabel('pencil', 'Éditer')}</button>
        <button class="mdel" onclick="window.delMat('${m.id}')">${window.iconHtml('x', 14, 'icon-sm')}</button>`;
    }
    const hint = isSystem ? '<span class="mnm" style="font-size:11px;color:var(--mut);margin-left:8px;">(auto)</span>' : '';
    return `
    <div class="mr">
      <div class="mdot" style="background:${typeof window.intensifyColor === 'function' ? window.intensifyColor(m.color) : m.color}; color:${m.color}"></div>
      <div class="mlbl">${window.escHtml(m.label)}</div><div class="mnm" style="flex:1;">${window.escHtml(m.name)}${hint}</div>
      ${editBtns}
    </div>`;
  }).join('');
  
  el.innerHTML = html;
  
  window.renderColorSwatches('swMat', window.newColor, 'window.setNewColor', 'nMatColorPreview');
};

window.setNewColor = function(col) {
  window.newColor = col;
  window.renderMatieres();
};

window.editMatiere = function(id) {
  if (window.isSystemMatiere(id)) return;
  const m = window.D.matieres.find(x => x.id === id);
  if (!m) return;
  window.currentEditMatId = id;
  window.editMatColor = m.color || (window.COLORS && window.COLORS[0]) || '#5b8df7';
  if (window.$('eMatId')) window.$('eMatId').value = m.id;
  if (window.$('eMatNm')) window.$('eMatNm').value = m.name || '';
  window.renderColorSwatches('eMatSw', window.editMatColor, 'window.setEditMatColor', 'eMatColorPreview');
  if (window.$('ovEditMat')) window.$('ovEditMat').classList.remove('hidden');
  if (typeof window.hydrateIcons === 'function' && window.$('ovEditMat')) window.hydrateIcons(window.$('ovEditMat'));
};

window.setEditMatColor = function(col) {
  window.editMatColor = col;
  window.renderColorSwatches('eMatSw', window.editMatColor, 'window.setEditMatColor', 'eMatColorPreview');
};

window.saveMatEdit = function() {
  const m = window.D.matieres.find(x => x.id === window.currentEditMatId);
  if (!m) return;
  const nameEl = window.$('eMatNm');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) {
    if (typeof window.showInlineError === 'function') window.showInlineError(nameEl, 'Le nom ne peut pas être vide.');
    else if (typeof window.sysAlert === 'function') window.sysAlert('Le nom ne peut pas être vide.');
    return;
  }
  m.name = name;
  // id / label inchangés — les cours restent liés via c.mat === m.id
  if (window.editMatColor) m.color = window.editMatColor;
  window.save();
  if (window.$('ovEditMat')) window.$('ovEditMat').classList.add('hidden');
  window.renderMatieres();
  window.renderCours();
  if (typeof window.renderClasseurs === 'function') window.renderClasseurs();
  if (typeof window.renderDashboard === 'function') window.renderDashboard();
  if (typeof window.renderNotes === 'function') window.renderNotes();
};

// =========================================================
// 📁 GESTION DES MATIÈRES (VERSION CORRIGÉE AVEC BORDURE ROUGE)
// =========================================================
window.addMat = function() {
  const lblInput = window.$('nMlbl');
  const nameInput = window.$('nMname');
  if (!lblInput || !nameInput) return;

  const lbl = lblInput.value.trim().toUpperCase();
  const name = nameInput.value.trim();
  const showError = typeof window.showInlineError === 'function'
    ? window.showInlineError
    : function () {};

  if (lbl.length !== 4) {
    showError(lblInput, "Le code matière doit faire exactement 4 lettres.");
    return;
  }
  if (lbl === 'UNTR' || lbl === window.UNSORTED_MAT_ID) {
    showError(lblInput, "Ce code est réservé (matière « Non trié »).");
    return;
  }
  if (window.D.matieres.find(m => m.id === lbl)) {
    showError(lblInput, "Ce code matière existe déjà !");
    return;
  }
  if (name.length === 0) {
    showError(nameInput, "Tu dois donner un nom complet à ta matière.");
    return;
  }
  
  window.D.matieres.push({id:lbl, label:lbl, name:name, color:window.newColor}); 
  window.save(); 
  window.renderMatieres(); 
  window.renderCours();
  
  lblInput.value = ''; 
  nameInput.value = '';
};

// =========================================================
// 📁 GESTION DES CLASSEURS (RESTAURÉE ET SÉCURISÉE)
// =========================================================
window.addCl = function() {
  const nameInput = window.$('nClNm');
  if (!nameInput) return;

  const name = nameInput.value.trim();
  const showError = typeof window.showInlineError === 'function'
    ? window.showInlineError
    : function () {};

  if (name.length === 0) {
    showError(nameInput, "Tu dois donner un nom à ton classeur.");
    return;
  }
  
  const newId = 'CL-' + Math.random().toString(36).substr(2, 5).toUpperCase();
  
  window.D.classeurs.push({
    id: newId, 
    name: name, 
    icon: (window.newIconCl === 'book' ? 'book' : 'folder'), 
    color: window.newColorCl || (window.COLORS && window.COLORS[0]) || '#ccc', 
    maxInter: 12, 
    interNames: {}
  });
  
  window.save(); 
  window.renderClasseurs(); 
  window.renderCours();
  
  nameInput.value = '';
  window.newIconCl = 'folder';
};

window.delMat = function(id) {
  if (window.isSystemMatiere(id)) return;

  const count = window.D.cours.filter(c => c.mat === id).length;
  const ankiCount = window._ankiCardsUsingMat(id).length;
  const doDel = () => {
    if (count) window.moveCoursToUnsorted(id);
    if (ankiCount) window.moveAnkiCardsToUnsorted(id);
    window.D.matieres = window.D.matieres.filter(m => m.id !== id);
    window.pruneUnsortedMatiere();
    window.save();
    window.renderMatieres();
    window.renderCours();
    if (typeof window.renderAnkiV2 === 'function') window.renderAnkiV2();
    if (typeof window.renderFlashcards === 'function') window.renderFlashcards();
    if (typeof window.renderOrphelins === 'function') window.renderOrphelins();
  };

  if (count || ankiCount) {
    const bits = [];
    if (count) bits.push(`${count} document(s)`);
    if (ankiCount) bits.push(`${ankiCount} carte(s) Anki`);
    window.sysConfirm(
      `Cette matière contient ${bits.join(' et ')}. Ils seront déplacés dans « Non trié » — tu pourras les reclasser dans l'onglet <b>À ranger</b>.`,
      doDel,
      "Suppression d'une matière"
    );
  } else {
    doDel();
  }
};

window.delCl = function(id) {
  if (window.isSystemClasseur(id)) return;

  const count = window.D.cours.filter(c => c.cl === id).length;
  const doDel = () => {
    if (count) window.moveCoursClToUnsorted(id);
    window.D.classeurs = window.D.classeurs.filter(c => c.id !== id);
    window.pruneUnsortedClasseur();
    window.save();
    window.renderClasseurs();
    window.renderCours();
    if (typeof window.renderOrphelins === 'function') window.renderOrphelins();
  };

  if (count) {
    window.sysConfirm(
      `Ce classeur contient ${count} document(s). Ils seront déplacés dans « Non classé » — tu pourras les reclasser dans l'onglet <b>À ranger</b>.`,
      doDel,
      "Suppression d'un classeur"
    );
  } else {
    doDel();
  }
};

// =========================================================
// ONGLET « À RANGER » — orphelins (cours + cartes Anki)
// =========================================================
if (!window.orphanSelCours) window.orphanSelCours = new Set();
if (!window.orphanSelAnki) window.orphanSelAnki = new Set();

window.listOrphanCours = function () {
  if (!window.D || !Array.isArray(window.D.cours)) return [];
  const mid = window.UNSORTED_MAT_ID;
  const cid = window.UNSORTED_CL_ID;
  return window.D.cours.filter(c => c && (c.mat === mid || c.cl === cid));
};

window.listOrphanAnki = function () {
  if (!window.D) return [];
  const mid = window.UNSORTED_MAT_ID;
  const out = [];
  (window.D.exercices || []).forEach(c => { if (c && c.mat === mid) out.push(c); });
  (window.D.devoirs || []).forEach(c => { if (c && c.mat === mid) out.push(c); });
  return out;
};

window.countOrphans = function () {
  return {
    cours: window.listOrphanCours().length,
    anki: window.listOrphanAnki().length
  };
};

window._orphanReason = function (c) {
  const bits = [];
  if (c.mat === window.UNSORTED_MAT_ID) bits.push('Non trié');
  if (c.cl === window.UNSORTED_CL_ID) bits.push('Non classé');
  return bits.join(' · ') || 'À ranger';
};

window.renderOrphelins = function () {
  const root = window.$('orphanRoot');
  if (!root || !window.D) return;

  const docs = window.listOrphanCours();
  const cards = window.listOrphanAnki();
  const validCours = new Set(docs.map(c => c.uid));
  const validAnki = new Set(cards.map(c => c.id));
  window.orphanSelCours = new Set([...window.orphanSelCours].filter(id => validCours.has(id)));
  window.orphanSelAnki = new Set([...window.orphanSelAnki].filter(id => validAnki.has(id)));

  const selN = window.orphanSelCours.size + window.orphanSelAnki.size;
  if (window.$('orphanStats')) {
    window.$('orphanStats').textContent =
      `${docs.length} document(s) · ${cards.length} carte(s) Anki · ${selN} sélectionné(s)`;
  }
  if (window.$('orphanTitle')) {
    window.$('orphanTitle').innerHTML = window.iconLabel
      ? window.iconLabel('inbox', 'À ranger')
      : 'À ranger';
  }

  const esc = s => window.escHtml(s);
  const check = on => (on
    ? (window.iconHtml ? window.iconHtml('check', 14, 'icon-sm') : '✓')
    : (window.iconHtml ? window.iconHtml('square', 14, 'icon-sm') : '☐'));

  const drawDoc = (c) => {
    const on = window.orphanSelCours.has(c.uid);
    return `
      <div class="pcard ${on ? 'sel' : ''}" onclick="window.toggleOrphanSel('cours','${esc(c.uid)}')">
        <div class="pc-check">${check(on)}</div>
        <div class="orphan-badge">${esc(window._orphanReason(c))}</div>
        <div class="pc-uid">${esc(c.uid)}</div>
        <div class="pc-title">${esc(c.title || 'Sans titre')}</div>
        <div class="orphan-meta">${esc(c.type || 'DOC')}</div>
      </div>`;
  };

  const drawAnki = (c) => {
    const on = window.orphanSelAnki.has(c.id);
    const kind = (window.AnkiAlgo && window.AnkiAlgo.cardKind)
      ? window.AnkiAlgo.cardKind(c)
      : (c.type === 'devoir' || c.type === 'devoir-morceau' ? 'devoir' : 'main');
    const kindLabel = kind === 'devoir' ? 'Devoir' : (kind === 'quick' ? 'Rapide' : 'Principale');
    return `
      <div class="pcard ${on ? 'sel' : ''}" onclick="window.toggleOrphanSel('anki','${esc(c.id)}')">
        <div class="pc-check">${check(on)}</div>
        <div class="orphan-badge">Non trié · ${esc(kindLabel)}</div>
        <div class="pc-uid">${esc(c.id)}</div>
        <div class="pc-title">${esc(c.titre || (c.question || '').substring(0, 60) || 'Sans titre')}</div>
      </div>`;
  };

  let html = '';
  html += `<div class="orphan-section">
    <h3>${window.iconLabel ? window.iconLabel('clipboard-list', 'Documents') : 'Documents'}
      <span class="anki-mut" style="font-weight:500;font-size:12px;">(${docs.length})</span></h3>
    ${docs.length
      ? `<div class="cgrid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;">${docs.map(drawDoc).join('')}</div>`
      : `<div class="orphan-empty">${window.iconLabel ? window.iconLabel('check', 'Aucun document à ranger.') : 'Aucun document à ranger.'}</div>`}
  </div>`;

  html += `<div class="orphan-section">
    <h3>${window.iconLabel ? window.iconLabel('dna', 'Cartes Anki') : 'Cartes Anki'}
      <span class="anki-mut" style="font-weight:500;font-size:12px;">(${cards.length})</span></h3>
    ${cards.length
      ? `<div class="cgrid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;">${cards.map(drawAnki).join('')}</div>`
      : `<div class="orphan-empty">${window.iconLabel ? window.iconLabel('check', 'Aucune carte Anki à ranger.') : 'Aucune carte Anki à ranger.'}</div>`}
  </div>`;

  root.innerHTML = html;
  if (window.hydrateIcons) window.hydrateIcons(root);
  const pane = window.$('paneOrphelins');
  if (pane && window.hydrateIcons) window.hydrateIcons(pane);
};

window.toggleOrphanSel = function (kind, id) {
  const set = kind === 'anki' ? window.orphanSelAnki : window.orphanSelCours;
  if (set.has(id)) set.delete(id);
  else set.add(id);
  window.renderOrphelins();
};

window.orphanSelAllDocs = function () {
  window.orphanSelCours = new Set(window.listOrphanCours().map(c => c.uid));
  window.renderOrphelins();
};
window.orphanSelAllAnki = function () {
  window.orphanSelAnki = new Set(window.listOrphanAnki().map(c => c.id));
  window.renderOrphelins();
};
window.orphanSelAll = function () {
  window.orphanSelCours = new Set(window.listOrphanCours().map(c => c.uid));
  window.orphanSelAnki = new Set(window.listOrphanAnki().map(c => c.id));
  window.renderOrphelins();
};
window.orphanSelNone = function () {
  window.orphanSelCours.clear();
  window.orphanSelAnki.clear();
  window.renderOrphelins();
};

window.updateOrphanInterDropdown = function () {
  const clId = window.$('fOrphanCl') ? window.$('fOrphanCl').value : '';
  const cl = (window.D.classeurs || []).find(c => c.id === clId);
  const maxI = cl ? (cl.maxInter || 12) : 12;
  const sel = window.$('fOrphanInter');
  if (!sel) return;
  sel.innerHTML = Array.from({ length: maxI }, (_, i) => {
    const val = String(i + 1).padStart(2, '0');
    return `<option value="${val}">${window.escHtml(window.getInterName(cl, val))}</option>`;
  }).join('');
};

/** Analyse la sélection : faut-il une matière / un classeur ? */
window._orphanAssignNeeds = function () {
  let needMat = window.orphanSelAnki.size > 0;
  let needCl = false;
  window.orphanSelCours.forEach(uid => {
    const c = window.D.cours.find(x => x.uid === uid);
    if (!c) return;
    if (c.mat === window.UNSORTED_MAT_ID) needMat = true;
    if (c.cl === window.UNSORTED_CL_ID) needCl = true;
  });
  return { needMat, needCl };
};

window.openOrphanAssign = function () {
  const nDocs = window.orphanSelCours.size;
  const nAnki = window.orphanSelAnki.size;
  if (!nDocs && !nAnki) {
    if (typeof window.sysAlert === 'function') {
      window.sysAlert('Sélectionne au moins un document ou une carte à ranger.', 'À ranger');
    }
    return;
  }

  const needs = window._orphanAssignNeeds();
  const mats = (window.D.matieres || []).filter(m => m.id !== window.UNSORTED_MAT_ID);
  const cls = (window.D.classeurs || []).filter(c => c.id !== window.UNSORTED_CL_ID);
  if (needs.needMat && !mats.length) {
    return window.sysAlert('Crée d\'abord une matière (hors « Non trié ») pour pouvoir ranger.', 'À ranger');
  }
  if (needs.needCl && !cls.length) {
    return window.sysAlert('Crée d\'abord un classeur (hors « Non classé ») pour ranger des documents.', 'À ranger');
  }

  const matField = window.$('orphanMatField');
  if (matField) matField.style.display = needs.needMat ? '' : 'none';
  const matSel = window.$('fOrphanMat');
  if (matSel && needs.needMat) {
    matSel.innerHTML = mats.map(m =>
      `<option value="${m.id}">${window.escHtml(m.label)} — ${window.escHtml(m.name)}</option>`
    ).join('');
  }
  const clFields = window.$('orphanClFields');
  if (clFields) clFields.style.display = needs.needCl ? '' : 'none';
  const clSel = window.$('fOrphanCl');
  if (clSel && needs.needCl) {
    clSel.innerHTML = cls.map(c =>
      `<option value="${c.id}">${window.escHtml(c.name)}</option>`
    ).join('');
    window.updateOrphanInterDropdown();
  }

  if (window.$('orphanAssignSummary')) {
    const bits = [];
    if (nDocs) bits.push(`${nDocs} document(s)`);
    if (nAnki) bits.push(`${nAnki} carte(s) Anki`);
    const parts = [];
    if (needs.needMat) parts.push('matière');
    if (needs.needCl) parts.push('classeur');
    window.$('orphanAssignSummary').textContent =
      `Ranger ${bits.join(' et ')}` + (parts.length ? ` (${parts.join(' + ')})` : '') + '…';
  }
  if (window.$('ovOrphanAssign')) window.$('ovOrphanAssign').classList.remove('hidden');
};

window.closeOrphanAssign = function () {
  if (window.$('ovOrphanAssign')) window.$('ovOrphanAssign').classList.add('hidden');
};

window.saveOrphanAssign = function () {
  const needs = window._orphanAssignNeeds();
  const mat = window.$('fOrphanMat') ? window.$('fOrphanMat').value : '';
  const cl = window.$('fOrphanCl') ? window.$('fOrphanCl').value : '';
  const inter = window.$('fOrphanInter') ? window.$('fOrphanInter').value : '';

  if (needs.needMat && (!mat || mat === window.UNSORTED_MAT_ID)) {
    return window.sysAlert('Choisis une matière valide.', 'À ranger');
  }
  if (needs.needCl && (!cl || cl === window.UNSORTED_CL_ID || !inter)) {
    return window.sysAlert('Choisis un classeur et un intercalaire pour les documents.', 'À ranger');
  }

  let movedDocs = 0;
  let movedAnki = 0;
  window.orphanSelCours.forEach(uid => {
    const c = window.D.cours.find(x => x.uid === uid);
    if (!c) return;
    // Ne corriger que ce qui est orphelin — ne pas écraser une matière/classeur déjà valides
    if (c.mat === window.UNSORTED_MAT_ID) c.mat = mat;
    if (c.cl === window.UNSORTED_CL_ID) {
      c.cl = cl;
      c.inter = inter;
    }
    if (c.stat === 'printed' && c.cl !== window.UNSORTED_CL_ID) c.stat = 'active';
    movedDocs++;
  });
  const applyAnki = (arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach(c => {
      if (c && window.orphanSelAnki.has(c.id)) {
        c.mat = mat;
        movedAnki++;
      }
    });
  };
  applyAnki(window.D.exercices);
  applyAnki(window.D.devoirs);

  window.orphanSelCours.clear();
  window.orphanSelAnki.clear();
  window.pruneUnsortedMatiere();
  window.pruneUnsortedClasseur();
  window.save();
  window.closeOrphanAssign();

  window.renderCours();
  window.renderMatieres();
  window.renderClasseurs();
  window.renderDashboard();
  if (typeof window.renderAnkiV2 === 'function') window.renderAnkiV2();
  if (typeof window.renderFlashcards === 'function') window.renderFlashcards();
  window.renderOrphelins();

  const bits = [];
  if (movedDocs) bits.push(`${movedDocs} document(s)`);
  if (movedAnki) bits.push(`${movedAnki} carte(s)`);
  window.sysAlert(
    window.iconLabel('check', bits.length ? bits.join(' et ') + ' rangé(s).' : 'Rien à ranger.'),
    'À ranger'
  );
};
