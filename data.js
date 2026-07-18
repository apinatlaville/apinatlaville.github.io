window.$ = window.$ || (id => document.getElementById(id));
window.COLORS = ['#5b8df7','#f0c060','#50d890','#f06060','#b06af7','#f06ab0','#60d0f0','#f09060'];

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

window.pruneUnsortedMatiere = function () {
  if (!window.D || !window.D.matieres || !window.D.cours) return;
  const used = window.D.cours.some(c => c.mat === window.UNSORTED_MAT_ID);
  if (!used) {
    window.D.matieres = window.D.matieres.filter(m => m.id !== window.UNSORTED_MAT_ID);
  }
};

window.reconcileOrphanCours = function () {
  if (!window.D || !window.D.cours) return false;
  let changed = false;
  const matIds = new Set((window.D.matieres || []).map(m => m.id));
  const clIds = new Set((window.D.classeurs || []).map(c => c.id));
  window.D.cours.forEach(c => {
    if (!c.mat || !matIds.has(c.mat)) {
      window.ensureUnsortedMatiere();
      c.mat = window.UNSORTED_MAT_ID;
      changed = true;
    }
    if (!c.cl || !clIds.has(c.cl)) {
      window.ensureUnsortedClasseur();
      c.cl = window.UNSORTED_CL_ID;
      if (!c.inter) c.inter = '01';
      changed = true;
    }
  });
  const matBefore = window.D.matieres.length;
  window.pruneUnsortedMatiere();
  if (window.D.matieres.length !== matBefore) changed = true;
  const clBefore = window.D.classeurs.length;
  window.pruneUnsortedClasseur();
  if (window.D.classeurs.length !== clBefore) changed = true;
  return changed;
};

window.moveCoursToUnsorted = function (fromMatId) {
  if (!window.D || !fromMatId || fromMatId === window.UNSORTED_MAT_ID) return;
  window.ensureUnsortedMatiere();
  window.D.cours.forEach(c => {
    if (c.mat === fromMatId) c.mat = window.UNSORTED_MAT_ID;
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
        const co = window.D.classeurs.find(x => x.id===c.cl) || {name:c.cl, icon:'book-blue'};
        
        const interNameDisplay = window.getInterName(co, c.inter);

        if (!qText && c.mat !== currentMat) {
          html += `
            <div style="grid-column: 1/-1; margin-top: 15px; border-bottom: 2px solid ${mo.color}; padding-bottom: 5px;">
              <h3 style="font-family: 'Inter'; color: ${mo.color};">${mo.name}</h3>
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
            <span class="cloc cloc-a">${window.renderClasseurIcon(co.icon)} ${window.escHtml(co.name)}</span>
            <span class="cloc cloc-b">${window.iconHtml('bookmark', 14, 'icon-sm')} ${window.escHtml(interNameDisplay)}</span>
          </div>
          ${c.desc ? `<div class="cdesc">${window.escHtml(c.desc)}</div>` : ''}
          ${c.note ? `<div class="cnote">Note : ${window.escHtml(c.note)}/20</div>` : ''}
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
  const co = window.D.classeurs.find(x => x.id === c.cl) || {name: c.cl, icon: 'book-blue'};
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
            ${window.renderClasseurIcon(co.icon)} ${window.escHtml(co.name)}
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
            ${window.renderClasseurIcon(co.icon)} ${window.escHtml(co.name)}
          </div>
          <div class="loc-c" style="background:rgba(240,192,96,.15);color:var(--gold);border:1px solid var(--gold);">
            ${window.iconHtml('bookmark', 14, 'icon-sm')} ${window.escHtml(interNameDisplay)}
          </div>
        </div>
        ${c.note ? `<div style="text-align:center;font-weight:bold;font-size:16px;color:var(--acc);margin-top:10px;">Note : ${window.escHtml(c.note)}/20</div>` : ''}
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
  
  const co = window.D.classeurs.find(x => x.id === c.cl) || {name: c.cl, icon: 'book-blue'};
  const interNameDisplay = window.getInterName(co, c.inter);
  
  if(window.$('moveCurrentLoc')) {
      window.$('moveCurrentLoc').innerHTML = `${window.renderClasseurIcon(co.icon)} ${window.escHtml(co.name)} <br> ${window.iconHtml('bookmark', 14, 'icon-sm')} ${window.escHtml(interNameDisplay)}`;
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
          return `<option value="${val}" ${val===interOverride?'selected':''}>${window.getInterName(cl, val)}</option>`;
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
      window.save();
      window.renderCours();
      window.renderClasseurs();
      window.renderDashboard();
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
        return `<option value="${val}">${window.getInterName(cl, val)}</option>`;
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
  if(window.$('fType')) window.$('fType').value = c.type || 'COURS'; 
  if(window.$('fRev')) window.$('fRev').value = c.rev || 'green';
  if(window.$('fNote')) window.$('fNote').value = c.note || '';
  
  window.toggleNoteField();
  
  if(window.$('fMat')) {
    window.$('fMat').innerHTML = window.D.matieres.map(m => `
      <option value="${m.id}" ${m.id===c.mat?'selected':''}>${window.escHtml(m.label)}</option>
    `).join('');
  }
  
  if(window.$('fCl')) {
    window.$('fCl').innerHTML = window.D.classeurs.map(x => `
      <option value="${x.id}" ${x.id===c.cl?'selected':''}>${window.escHtml(x.name)}</option>
    `).join('');
  }
  
  window.updateIntercalairesDropdown();
  if(window.$('fInter')) window.$('fInter').value = c.inter;
  
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
  
  if(!obj.date) obj.date = window.localDateISO();

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
                <div class="inter-group-hdr" style="background:${cl.color}15; color:${cl.color}; border-left:3px solid ${cl.color}; padding:8px 12px; font-family:'DM Mono',monospace; font-weight:bold; font-size:12px; letter-spacing:0.5px; margin-top:4px;">${window.iconHtml('bookmark', 14, 'icon-sm')} ${window.escHtml(interHeader)} <span style="float:right;color:var(--mut);font-weight:normal;">${groups[k].length} doc${groups[k].length>1?'s':''}</span></div>
                ${items}
              </div>`;
          }).join('');
        } else {
          coursesList = '<div class="irow" style="color:var(--mut); justify-content:center;">Classeur vide</div>';
        }

        return `
          <div class="cl-card">
            <div class="cl-hdr" onclick="this.nextElementSibling.classList.toggle('open')">
              <div class="cl-ico" style="background:${cl.color}20">${window.renderClasseurIcon(cl.icon)}</div>
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
    
    if(window.$('swCl')) {
      window.$('swCl').innerHTML = window.COLORS.map(c => `
        <div class="sw${c===window.newColorCl?' on':''}" style="background:${c}" onclick="window.setNewColorCl('${c}')"></div>
      `).join('');
    }

  } catch(e) {
    if (typeof window.recordAppError === 'function') {
      window.recordAppError('Crash renderClasseurs: ' + e.message, 'data.js');
    }
  }
};

window.editClasseur = function(id) {
  if (window.isSystemClasseur(id)) return;
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
        ${window.isEditingMat ? window.iconLabel('check', 'Terminer') : window.iconLabel('pencil', 'Modifier')}
      </button>
    </div>
  `;

  html += window.D.matieres.map(m => {
    const isSystem = window.isSystemMatiere(m.id);
    let delBtn = (window.isEditingMat && !isSystem)
      ? `<button class="mdel" onclick="window.delMat('${m.id}')">${window.iconHtml('x', 14, 'icon-sm')}</button>`
      : '';
    const hint = isSystem ? '<span class="mnm" style="font-size:11px;color:var(--mut);margin-left:8px;">(auto)</span>' : '';
    return `
    <div class="mr">
      <div class="mdot" style="background:${m.color}"></div>
      <div class="mlbl">${window.escHtml(m.label)}</div><div class="mnm" style="flex:1;">${window.escHtml(m.name)}${hint}</div>
      ${delBtn}
    </div>`;
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
    icon: 'folder', 
    color: window.newColorCl || (window.COLORS && window.COLORS[0]) || '#ccc', 
    maxInter: 12, 
    interNames: {}
  });
  
  window.save(); 
  window.renderClasseurs(); 
  window.renderCours();
  
  nameInput.value = '';
};

window.delMat = function(id) {
  if (window.isSystemMatiere(id)) return;

  const count = window.D.cours.filter(c => c.mat === id).length;
  const doDel = () => {
    if (count) window.moveCoursToUnsorted(id);
    window.D.matieres = window.D.matieres.filter(m => m.id !== id);
    window.pruneUnsortedMatiere();
    window.save();
    window.renderMatieres();
    window.renderCours();
  };

  if (count) {
    window.sysConfirm(
      `Cette matière contient ${count} document(s). Ils seront déplacés dans « Non trié » pour que tu puisses les reclasser.`,
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
  };

  if (count) {
    window.sysConfirm(
      `Ce classeur contient ${count} document(s). Ils seront déplacés dans « Non classé » pour que tu puisses les reclasser.`,
      doDel,
      "Suppression d'un classeur"
    );
  } else {
    doDel();
  }
};
