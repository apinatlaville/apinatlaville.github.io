window.$ = window.$ || (id => document.getElementById(id));
window.COLORS = ['#5b8df7','#f0c060','#50d890','#f06060','#b06af7','#f06ab0','#60d0f0','#f09060'];

/** Date locale YYYY-MM-DD (évite le décalage UTC de toISOString après minuit) */
window.localDateISO = function(d) {
  const dt = d ? new Date(d) : new Date();
  if (isNaN(dt.getTime())) return window.localDateISO(new Date());
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
};

window.PC_FLASHCARDS = [
  { mat: 'Physique', q: 'Loi de Fourier (Conduction thermique)', a: 'jQ = - λ . grad(T)' },
  { mat: 'Physique', q: 'Équation de Maxwell-Faraday', a: 'rot(E) = - ∂B / ∂t' },
  { mat: 'Physique', q: 'Équation de Maxwell-Ampère', a: 'rot(B) = μ0.j + μ0.ε0.(∂E/∂t)' },
  { mat: 'Chimie', q: 'Rendement du cycle de Carnot', a: 'η = 1 - (Tf / Tc)' },
  { mat: 'Chimie Orga', q: 'Oxydation douce d\'un alcool primaire', a: 'Donne un Aldéhyde (puis Acide carboxylique si oxydant en excès)' },
  { mat: 'Chimie Orga', q: 'Règle de Markovnikov (Add. électrophile)', a: 'Le proton s\'additionne sur le carbone le plus hydrogéné de la double liaison.' }
];

window.emptyData = {
  settings: { userName: "Étudiant", theme: 'dark', template: 'glass', themePreset: 'minimaliste', appearanceVersion: 2, navLayout: 'sidebar-left', appColor: '#5b9aff', compact: false, showStats: false, showChips: true, showDashHero: true, showDashRev: true, showDashOver: true, showHeaderClock: false, headerClockSeconds: true, showPomo: true, pomoWork: 25, pomoBreak: 5, ankiQuotaMin: 90 },
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

window.demoData = {
  settings: { userName: "Étudiant", theme: 'dark', template: 'glass', themePreset: 'minimaliste', appearanceVersion: 2, navLayout: 'sidebar-left', appColor: '#5b9aff', compact: false, showStats: false, showChips: true, showDashHero: true, showDashRev: true, showDashOver: true, showHeaderClock: false, headerClockSeconds: true, showPomo: true, pomoWork: 25, pomoBreak: 5, ankiQuotaMin: 90 },
  matieres: [
    {id:'PHYS', label:'PHYS', name:'Physique', color:'#5b8df7'},
    {id:'MATH', label:'MATH', name:'Mathématiques', color:'#f0c060'},
    {id:'CHIM', label:'CHIM', name:'Chimie', color:'#50d890'},
    {id:'ANGL', label:'ANGL', name:'Anglais', color:'#e07ab3'},
  ],
  classeurs: [
    {id:'A', name:'Classeur Phys A', icon:'book-blue', color:'#5b8df7', maxInter: 12, interNames: {'01':'Mécanique','02':'Thermodynamique','03':'Électromagnétisme','04':'Optique'}},
    {id:'B', name:'Classeur Maths B', icon:'book-orange', color:'#f0c060', maxInter: 12, interNames: {'01':'Algèbre linéaire','02':'Analyse','03':'Réduction'}},
    {id:'C', name:'Classeur Chim C', icon:'book-green', color:'#50d890', maxInter: 12, interNames: {'01':'Cristallographie','02':'Cinétique','03':'Orga - Alcools'}},
    {id:'E', name:'Classeur Anglais', icon:'languages', color:'#e07ab3', maxInter: 6, interNames: {'01':'Vocabulaire scientifique','02':'Expressions'}},
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
  ],
  exercices: (function(){
    const _d = new Date(); _d.setHours(0,0,0,0);
    const _today = window.localDateISO(_d);
    const _shift = (n) => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+n); return window.localDateISO(d); };
    return [
      // ===========================================================
      // 📚 COURS LONGS (15-25 min) — démonstrations complètes
      // ===========================================================
      { id:'X-K3F', titre:"Théorème énergie cinétique (démo complète)", coursIds:['PH-A1B'], mat:'PHYS', profil:'COURS', question:"Démontre le théorème de l'énergie cinétique pour un système matériel + rappelle les hypothèses + applique à l'oscillateur harmonique.", reponse:"ΔEc = ΣW(F_ext) + ΣW(F_int). Réf. galiléen. Hypothèses : système fermé, sommation sur tous les points. Application : E_méca = Ec + Ep, conservation si forces conservatives.", tempsCible:1200, priorite:1, statut:'actif', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:_today, historique:[], epinglee:true, dateCreation:_today },
      { id:'X-7QP', titre:"Diagonalisabilité (démonstration)", coursIds:['MA-V6J'], mat:'MATH', profil:'COURS', question:"Démontre le critère de diagonalisabilité : un endomorphisme est diagonalisable ssi son polynôme caractéristique est scindé ET dim(E_λ) = mult(λ) pour tout λ.", reponse:"Sens direct : si diagonalisable, base de vecteurs propres → matrice diagonale → χ scindé et dim(E_λ) = mult(λ). Sens réciproque : si conditions remplies, somme des sous-espaces propres = E (dim) → base de vecteurs propres.", tempsCible:1500, priorite:1, statut:'actif', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:_today, historique:[], dateCreation:_today },
      { id:'X-T8R', titre:"Mécanisme SN1 vs SN2", coursIds:['CH-T1R'], mat:'CHIM', profil:'COURS', question:"Compare les mécanismes SN1 et SN2 : étapes, cinétique, stéréochimie, conditions favorables.", reponse:"SN1 : 2 étapes (carbocation), cinétique d'ordre 1, racémisation, favorable substrat tertiaire+solvant polaire protique. SN2 : 1 étape concertée, ordre 2, inversion de Walden, favorable primaire+aprotique polaire.", tempsCible:1200, priorite:1, statut:'actif', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:_today, historique:[], dateCreation:_today },
      { id:'X-2RT', titre:"Équations de Maxwell (formes locales et intégrales)", coursIds:['PH-3K9'], mat:'PHYS', profil:'COURS', question:"Énonce les 4 équations de Maxwell sous forme locale ET intégrale, donne leur signification physique.", reponse:"Gauss (E) : div E = ρ/ε₀ ; Thomson : div B = 0 ; Faraday : rot E = -∂B/∂t ; Ampère-Maxwell : rot B = μ₀(j + ε₀∂E/∂t). Intégrales : flux/circulation.", tempsCible:900, priorite:2, statut:'actif', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:_shift(1), historique:[], dateCreation:_today },

      // ===========================================================
      // 🧪 DÉMONSTRATIONS / MÉCANISMES (5-10 min)
      // ===========================================================
      { id:'X-5BD', titre:"Sous-espace vectoriel (preuve)", coursIds:['MA-7Z3'], mat:'MATH', profil:'COURS', question:"Prouve que l'intersection de 2 SEV est un SEV.", reponse:"Soit F, G SEV de E. F∩G non vide (contient 0). Stabilité : ∀(x,y)∈F∩G, ∀λ : x+λy ∈ F (car F SEV) ET ∈ G → ∈ F∩G.", tempsCible:480, priorite:2, statut:'actif', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:_today, historique:[], dateCreation:_today },
      { id:'X-9XM', titre:"Démo rendement Carnot", coursIds:['PH-X9Y'], mat:'PHYS', profil:'COURS', question:"Démontre la formule du rendement de Carnot à partir des 2 principes.", reponse:"Cycle ditherme réversible : ΔS_univ = 0 → -Qc/Tc - Qf/Tf = 0 → Qf = -Qc·Tf/Tc. η = W/Qc = 1 + Qf/Qc = 1 - Tf/Tc.", tempsCible:600, priorite:2, statut:'actif', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:_today, historique:[], dateCreation:_today },
      { id:'X-N7G', titre:"Loi d'Arrhenius (démo)", coursIds:['CH-8M5'], mat:'CHIM', profil:'COURS', question:"Démontre k = A·exp(-Ea/RT) à partir de la théorie des collisions.", reponse:"Fraction de molécules avec E ≥ Ea suit Boltzmann : exp(-Ea/RT). Vitesse = facteur préexp (collisions+géométrie) × fraction efficace.", tempsCible:540, priorite:2, statut:'actif', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:_shift(1), historique:[], dateCreation:_today },
      { id:'X-D6X', titre:"Dérivation série entière", coursIds:['MA-P4L'], mat:'MATH', profil:'COURS', question:"Calcule Σ n·x^(n−1) sur ]-1,1[ par dérivation terme à terme. Justifie l'opération.", reponse:"Σ x^n = 1/(1-x) sur ]-1,1[. Dérivation terme à terme légitime (convergence normale sur tout compact) : Σ n·x^(n-1) = 1/(1-x)².", tempsCible:600, priorite:2, statut:'actif', intervalle:0, ease:2.4, repetitions:0, dateProchaineRevision:_today, historique:[], dateCreation:_today },

      // ===========================================================
      // 📐 EXERCICES TYPES (20-30 min) — méthodes à maîtriser
      // ===========================================================
      { id:'X-J8L', titre:"Exo : Interférences fentes d'Young", coursIds:['PH-5D4'], mat:'PHYS', profil:'EXO', question:"Setup : λ=633nm, a=0.5mm, D=2m. (1) Calcule l'interfrange. (2) Si on plonge dans l'eau (n=1.33), nouvel interfrange ? (3) Si on bouche 1 fente, que voit-on ?", reponse:"(1) i=λD/a = 2.53 mm. (2) λ' = λ/n → i' = 1.90 mm. (3) Plus d'interférences, juste tache de diffraction d'une fente.", tempsCible:1500, priorite:2, statut:'actif', intervalle:0, ease:2.4, repetitions:0, dateProchaineRevision:_shift(1), historique:[], dateCreation:_today },
      { id:'X-EXJ', titre:"Exo : Réduction d'endomorphisme", coursIds:['MA-V6J'], mat:'MATH', profil:'EXO', question:"Soit M = ((3,1),(0,2)). (1) M est-elle diagonalisable ? (2) Si oui, trouve P et D telles que M = P·D·P⁻¹.", reponse:"(1) χ_M(X) = (X-3)(X-2) scindé à racines simples → diagonalisable. (2) E_3 = Vect((1,0)), E_2 = Vect((1,-1)). P = ((1,1),(0,-1)), D = diag(3,2).", tempsCible:1800, priorite:1, statut:'actif', intervalle:0, ease:2.4, repetitions:0, dateProchaineRevision:_shift(2), historique:[], dateCreation:_today },
      { id:'X-EXC', titre:"Exo : Cinétique ordre 1 (régression)", coursIds:['CH-8M5'], mat:'CHIM', profil:'EXO', question:"On a [A](t=0)=0.1 M, [A](100s)=0.082 M, [A](300s)=0.055 M. (1) Vérifie que c'est bien d'ordre 1. (2) Détermine k et t½.", reponse:"(1) ln[A] vs t : (0,-2.30), (100,-2.50), (300,-2.90) → droite, ordre 1. (2) Pente = -k → k ≈ 0.002 s⁻¹. t½ = ln2/k ≈ 347 s.", tempsCible:1200, priorite:2, statut:'actif', intervalle:0, ease:2.4, repetitions:0, dateProchaineRevision:_shift(2), historique:[], dateCreation:_today },

      // ===========================================================
      // 🎯 FORMULES COURTES (1-3 min) — rappel rapide
      // ===========================================================
      { id:'X-FRM', titre:"Maxwell-Faraday (forme locale)", coursIds:['PH-3K9'], mat:'PHYS', profil:'FORMULE', question:"Équation de Maxwell-Faraday locale.", reponse:"rot(E) = −∂B/∂t", tempsCible:90, priorite:2, statut:'actif', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:_today, historique:[], dateCreation:_today },
      { id:'X-HDM', titre:"Hadamard (rayon convergence)", coursIds:[], mat:'MATH', profil:'FORMULE', question:"Formule de Hadamard pour R.", reponse:"1/R = limsup |a_n|^(1/n)", tempsCible:120, priorite:2, statut:'actif', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:_today, historique:[], dateCreation:_today },
      { id:'X-T12', titre:"t½ ordre 1", coursIds:['CH-8M5'], mat:'CHIM', profil:'FORMULE', question:"Temps de demi-réaction d'un ordre 1.", reponse:"t½ = ln(2) / k (indépendant de [A]₀)", tempsCible:90, priorite:1, statut:'actif', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:_today, historique:[], dateCreation:_today },
      { id:'X-FR2', titre:"Carnot", coursIds:['PH-X9Y'], mat:'PHYS', profil:'FORMULE', question:"Rendement Carnot.", reponse:"η = 1 − Tf/Tc", tempsCible:60, priorite:3, statut:'actif', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:_shift(1), historique:[], dateCreation:_today },
      { id:'X-VBR', titre:"Variance Bernoulli", coursIds:[], mat:'MATH', profil:'FORMULE', question:"Variance d'une loi de Bernoulli B(p).", reponse:"V(X) = p(1-p)", tempsCible:60, importance:2, statut:'reservoir', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:null, historique:[], dateCreation:_today },

      // ===========================================================
      // ⏳ RÉSERVOIR (nouvelles cartes en attente)
      // ===========================================================
      { id:'X-W3K', titre:"Markovnikov", coursIds:['CH-T1R'], mat:'CHIM', profil:'COURS', question:"Règle de Markovnikov : addition d'H-X sur alcène asymétrique.", reponse:"H+ s'additionne sur le carbone le PLUS hydrogéné (donc X- sur le plus substitué) → carbocation le plus stable.", tempsCible:300, priorite:3, statut:'attente', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:null, historique:[], dateCreation:_today },

      // ===========================================================
      // 🇬🇧 ANGLAIS (max 3 — juste pour combler les trous)
      // ===========================================================
      { id:'Y-A2C', titre:"to elicit", coursIds:[], mat:'ANGL', profil:'ANGLAIS', question:"to elicit", reponse:"provoquer / susciter (une réaction)", tempsCible:30, priorite:2, statut:'actif', intervalle:0, ease:2.3, repetitions:0, dateProchaineRevision:_today, historique:[], dateCreation:_today },
      { id:'Y-B7E', titre:"to bridge the gap", coursIds:[], mat:'ANGL', profil:'ANGLAIS', question:"to bridge the gap", reponse:"combler le fossé / l'écart", tempsCible:30, priorite:2, statut:'actif', intervalle:0, ease:2.3, repetitions:0, dateProchaineRevision:_today, historique:[], dateCreation:_today },
      { id:'Y-F4P', titre:"to overcome", coursIds:[], mat:'ANGL', profil:'ANGLAIS', question:"to overcome (an obstacle)", reponse:"surmonter (un obstacle)", tempsCible:30, priorite:2, statut:'actif', intervalle:0, ease:2.3, repetitions:0, dateProchaineRevision:_today, historique:[], dateCreation:_today },


    ];
  })(),
  devoirs: (function(){
    const _d = new Date(); _d.setHours(0,0,0,0);
    const _today = window.localDateISO(_d);
    const _shift = (n) => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+n); return window.localDateISO(d); };
    return [
      { id:'W-DM1', titre:"DM Algèbre linéaire (3 sessions de 30 min)", coursIds:['MA-7Z3','MA-V6J'], mat:'MATH', profil:'EXO', type:'devoir', question:"DM à rendre : 6 exercices d'algèbre linéaire (espaces vectoriels + réduction).", tempsCible:1800, importance:5, statut:'actif', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:_today, dateLimite:_shift(7), historique:[], _morceauxTotal:3, _morceauxFaits:0, _dureeTotaleMin:90, dateCreation:_today }
    ];
  })(),
};

// ===========================================================================================
// JEU DE DONNÉES TEST #2 : utilisateur expérimenté (3 semaines d'usage simulées)
// Cartes avec historique riche, ease modifiés, dates étalées, courbes de stats peuplées
// ===========================================================================================
window.demoDataXP = (function() {
  const _d = new Date(); _d.setHours(0,0,0,0);
  const _today = window.localDateISO(_d);
  const _shift = (n) => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+n); return window.localDateISO(d); };
  const _dateTime = (n) => { const d = new Date(); d.setDate(d.getDate()+n); return d.toISOString(); };

  // Génère un historique réaliste (3 derniers révisions)
  const histo = (qs, temps) => qs.map((q, i) => ({
    date: _dateTime(-(qs.length - i) * 3 - 1),
    qScore: q,
    tempsReel: temps[i] || 60,
    pen: 1,
    mode: 'normal'
  }));

  return {
    settings: { userName: "Étudiant XP", theme:'dark', template:'glass', compact:false, showStats:true, showChips:true, showDashHero:true, showDashRev:true, showDashOver:true, showPomo:true, pomoWork:25, pomoBreak:5, ankiQuotaMin:90, ankiSessionMin:75, ankiIncludeNew:4, ankiMaxAnglaisFill:4 },
    matieres: [
      {id:'PHYS', label:'PHYS', name:'Physique', color:'#5b8df7'},
      {id:'MATH', label:'MATH', name:'Mathématiques', color:'#f0c060'},
      {id:'CHIM', label:'CHIM', name:'Chimie', color:'#50d890'},
      {id:'ANGL', label:'ANGL', name:'Anglais', color:'#e07ab3'},
    ],
    classeurs: [
      {id:'A', name:'Classeur Phys A', icon:'book-blue', color:'#5b8df7', maxInter:12, interNames:{'01':'Mécanique','02':'Thermodynamique','03':'Électromagnétisme','04':'Optique','05':'Mécanique quantique'}},
      {id:'B', name:'Classeur Maths B', icon:'book-orange', color:'#f0c060', maxInter:12, interNames:{'01':'Algèbre linéaire','02':'Analyse','03':'Réduction','04':'Probabilités'}},
      {id:'C', name:'Classeur Chim C', icon:'book-green', color:'#50d890', maxInter:12, interNames:{'01':'Cristallographie','02':'Cinétique','03':'Orga - Alcools','04':'Atomistique'}},
      {id:'E', name:'Classeur Anglais', icon:'languages', color:'#e07ab3', maxInter:6, interNames:{'01':'Vocabulaire scientifique','02':'Expressions'}}
    ],
    cours: [
      { uid:'PH-A1B', title:'Mécanique de Newton', type:'COURS', rev:'green', mat:'PHYS', cl:'A', inter:'01', stat:'active', date:_shift(-21) },
      { uid:'PH-X9Y', title:'Thermodynamique', type:'COURS', rev:'green', mat:'PHYS', cl:'A', inter:'02', stat:'active', date:_shift(-18) },
      { uid:'PH-3K9', title:'Électromagnétisme', type:'COURS', rev:'orange', mat:'PHYS', cl:'A', inter:'03', stat:'active', date:_shift(-14) },
      { uid:'PH-5D4', title:'Optique Ondulatoire', type:'TD', rev:'red', mat:'PHYS', cl:'A', inter:'04', stat:'active', date:_shift(-7) },
      { uid:'MA-7Z3', title:'Espaces Vectoriels', type:'COURS', rev:'green', mat:'MATH', cl:'B', inter:'01', stat:'active', date:_shift(-21) },
      { uid:'MA-P4L', title:'Séries Entières', type:'TD', rev:'orange', mat:'MATH', cl:'B', inter:'02', stat:'active', date:_shift(-10) },
      { uid:'MA-V6J', title:'Réduction', type:'FICHE', rev:'orange', mat:'MATH', cl:'B', inter:'03', stat:'active', date:_shift(-5) },
      { uid:'CH-T1R', title:'Chimie Org - Alcools', type:'COURS', rev:'green', mat:'CHIM', cl:'C', inter:'03', stat:'active', date:_shift(-12) },
      { uid:'CH-8M5', title:'Cinétique Chimique', type:'COURS', rev:'orange', mat:'CHIM', cl:'C', inter:'02', stat:'active', date:_shift(-8) }
    ],
    exercices: [
      // Cartes maîtrisées (ease haut, intervalle moyen, historique réussi)
      { id:'X-K3F', titre:"Théorème énergie cinétique", coursIds:['PH-A1B'], mat:'PHYS', profil:'COURS', question:"Énonce le théorème de l'énergie cinétique.", reponse:"ΔEc = ΣW(F_ext) + ΣW(F_int). Réf. galiléen.", tempsCible:60, priorite:1, statut:'actif', intervalle:8, ease:2.75, repetitions:4, dateProchaineRevision:_shift(2), historique:histo([8,9,8,9],[55,50,48,45]), dateCreation:_dateTime(-21) },
      { id:'X-9XM', titre:"Rendement Carnot", coursIds:['PH-X9Y'], mat:'PHYS', profil:'FORMULE', question:"η de Carnot ?", reponse:"η = 1 − Tf/Tc (T en K).", tempsCible:30, priorite:2, statut:'actif', intervalle:14, ease:2.8, repetitions:5, dateProchaineRevision:_shift(7), historique:histo([8,9,10,9,10],[28,25,22,20,18]), dateCreation:_dateTime(-25) },
      // Cartes en difficulté (ease bas, intervalle court, historique mixte)
      { id:'X-7QP', titre:"Diagonalisabilité", coursIds:['MA-V6J'], mat:'MATH', profil:'COURS', question:"Critère de diagonalisabilité d'un endomorphisme.", reponse:"⟺ Pol. car. scindé + dim(E_λ)=mult(λ) ∀λ.", tempsCible:90, priorite:1, statut:'actif', intervalle:1, ease:1.85, repetitions:3, dateProchaineRevision:_today, historique:histo([3,5,3,6],[120,100,140,95]), dateCreation:_dateTime(-15) },
      { id:'X-D6X', titre:"Série dérivée", coursIds:['MA-P4L'], mat:'MATH', profil:'EXO', question:"Σ n·x^(n−1) sur ]-1,1[ ?", reponse:"= 1/(1-x)²", tempsCible:75, priorite:1, statut:'actif', intervalle:0, ease:1.7, repetitions:2, dateProchaineRevision:_today, historique:histo([2,4,3],[110,90,105]), dateCreation:_dateTime(-12) },
      // Cartes moyennes
      { id:'X-2RT', titre:"Maxwell-Faraday", coursIds:['PH-3K9'], mat:'PHYS', profil:'FORMULE', question:"Équation Maxwell-Faraday locale.", reponse:"rot(E) = −∂B/∂t", tempsCible:30, priorite:2, statut:'actif', intervalle:5, ease:2.4, repetitions:3, dateProchaineRevision:_shift(1), historique:histo([6,7,7],[35,30,28]), dateCreation:_dateTime(-14) },
      { id:'X-J8L', titre:"Interférences Young", coursIds:['PH-5D4'], mat:'PHYS', profil:'EXO', question:"Interfrange dans les fentes d'Young ?", reponse:"i = λD/a", tempsCible:90, priorite:2, statut:'actif', intervalle:3, ease:2.2, repetitions:2, dateProchaineRevision:_shift(1), historique:histo([5,6],[100,85]), dateCreation:_dateTime(-9) },
      { id:'X-5BD', titre:"Sous-espace vectoriel", coursIds:['MA-7Z3'], mat:'MATH', profil:'COURS', question:"Définition d'un SEV.", reponse:"Stable par +, ·, contient 0_E.", tempsCible:45, priorite:2, statut:'actif', intervalle:21, ease:2.85, repetitions:6, dateProchaineRevision:_shift(14), historique:histo([9,10,9,10,9,10],[40,35,30,28,25,22]), dateCreation:_dateTime(-30) },
      { id:'X-T8R', titre:"Oxydation alcool primaire", coursIds:['CH-T1R'], mat:'CHIM', profil:'COURS', question:"Produits d'oxydation douce d'un alcool primaire ?", reponse:"Aldéhyde (puis acide carbox. si excès).", tempsCible:45, priorite:2, statut:'actif', intervalle:7, ease:2.5, repetitions:3, dateProchaineRevision:_shift(3), historique:histo([7,8,7],[50,45,40]), dateCreation:_dateTime(-10) },
      { id:'X-N7G', titre:"Cinétique ordre 1", coursIds:['CH-8M5'], mat:'CHIM', profil:'FORMULE', question:"Loi d'ordre 1 intégrée et t½.", reponse:"[A]=[A]₀·exp(−kt); t½=ln2/k", tempsCible:60, priorite:1, statut:'actif', intervalle:0, ease:2.0, repetitions:1, dateProchaineRevision:_today, historique:histo([4,3],[80,75]), dateCreation:_dateTime(-7) },
      // Réservoir : nouvelles cartes en attente
      { id:'X-V4N', titre:"Rayon convergence (Hadamard)", coursIds:[], mat:'MATH', profil:'FORMULE', question:"Formule de Hadamard pour R ?", reponse:"1/R = limsup |a_n|^(1/n)", tempsCible:50, priorite:2, statut:'attente', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:null, historique:[], dateCreation:_dateTime(-2) },
      { id:'X-W3K', titre:"Markovnikov", coursIds:['CH-T1R'], mat:'CHIM', profil:'COURS', question:"Règle de Markovnikov.", reponse:"H+ sur le C le + hydrogéné de la double liaison.", tempsCible:30, priorite:3, statut:'attente', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:null, historique:[], dateCreation:_dateTime(-1) },
      // Anglais (matière dédiée) — vocab + historique
      { id:'Y-A2C', titre:"to elicit", coursIds:[], mat:'ANGL', profil:'ANGLAIS', question:"to elicit", reponse:"provoquer / susciter", tempsCible:20, priorite:2, statut:'actif', intervalle:4, ease:2.4, repetitions:3, dateProchaineRevision:_shift(1), historique:histo([7,8,7],[18,15,14]), dateCreation:_dateTime(-12) },
      { id:'Y-B7E', titre:"to bridge the gap", coursIds:[], mat:'ANGL', profil:'ANGLAIS', question:"to bridge the gap", reponse:"combler le fossé", tempsCible:20, priorite:2, statut:'actif', intervalle:8, ease:2.5, repetitions:4, dateProchaineRevision:_shift(5), historique:histo([8,9,8,9],[18,15,12,12]), dateCreation:_dateTime(-15) },
      { id:'Y-C9D', titre:"a breakthrough", coursIds:[], mat:'ANGL', profil:'ANGLAIS', question:"a breakthrough", reponse:"une percée majeure", tempsCible:20, priorite:2, statut:'actif', intervalle:2, ease:2.2, repetitions:2, dateProchaineRevision:_today, historique:histo([6,7],[22,18]), dateCreation:_dateTime(-8) },
      { id:'Y-F4P', titre:"to overcome", coursIds:[], mat:'ANGL', profil:'ANGLAIS', question:"to overcome (an obstacle)", reponse:"surmonter (un obstacle)", tempsCible:20, priorite:2, statut:'actif', intervalle:15, ease:2.65, repetitions:5, dateProchaineRevision:_shift(8), historique:histo([8,9,10,9,10],[20,18,15,13,12]), dateCreation:_dateTime(-20) },
      // Devoir auto-découpé en 3 morceaux
      { id:'W-DMX', titre:"DM Réduction d'endomorphismes", coursIds:['MA-V6J'], mat:'MATH', profil:'EXO', type:'devoir', question:"DM à rendre : 4 exercices de réduction.", reponse:"", tempsCible:4800, priorite:1, statut:'actif', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:_today, dateLimite:_shift(5), historique:[], _morceauxTotal:3, _morceauxFaits:0, dateCreation:_dateTime(-1) }
    ],
    devoirs: []
  };
})();

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
              ${window.iconBtn('pencil', 'Modifier', `onclick="window.editCours('${window.escHtml(c.uid)}')"`)}
              ${window.iconBtn('trash-2', 'Supprimer', `style="color:var(--red); border-color:var(--red);" onclick="window.delCours('${window.escHtml(c.uid)}')"`)}
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
    window.D.matieres.map(m => `<option value="${m.id}">${m.label} — ${m.name}</option>`).join('');
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
      <option value="${m.id}" ${m.id===c.mat?'selected':''}>${m.label}</option>
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
    window.$('uidBox').innerHTML = c.uid + '<br><small style="font-size:10px; font-weight:normal; color:var(--mut);">Code permanent</small>';
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
        || (window.D.exercices || []).some(x => x.id === newUid);
      if (uidTaken) {
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
          ${window.isEditingCl ? window.iconLabel('check', 'Terminer') : window.iconLabel('pencil', 'Modifier')}
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
          <button class="cbt" style="padding:4px 8px; margin-left:10px; background:var(--acc); color:#fff; border:none;" onclick="event.stopPropagation(); window.editClasseur('${cl.id}')">${window.iconLabel('pencil', 'Éditer')}</button>
          <button class="cbt" style="color:var(--red); border-color:var(--red); padding:4px 8px; margin-left:5px;" onclick="event.stopPropagation(); window.delCl('${cl.id}')">${window.iconHtml('x', 14, 'icon-sm')}</button>
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
                <div class="cl-nm">${cl.name}</div>
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
        ${window.isEditingMat ? window.iconLabel('check', 'Terminer') : window.iconLabel('pencil', 'Modifier')}
      </button>
    </div>
  `;

  html += window.D.matieres.map(m => {
    let delBtn = window.isEditingMat ? `<button class="mdel" onclick="window.delMat('${m.id}')">${window.iconHtml('x', 14, 'icon-sm')}</button>` : '';
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

// =========================================================
// 📁 GESTION DES MATIÈRES (VERSION CORRIGÉE AVEC BORDURE ROUGE)
// =========================================================
window.addMat = function() {
  const lblInput = window.$('nMlbl');
  const nameInput = window.$('nMname');
  if (!lblInput || !nameInput) return;

  const lbl = lblInput.value.trim().toUpperCase();
  const name = nameInput.value.trim();
  
  const showError = (input, msg) => {
    input.style.border = "2px solid var(--red)";
    let errText = input.nextElementSibling;
    if (!errText || errText.className !== 'inline-error') {
      errText = document.createElement('div');
      errText.className = 'inline-error';
      errText.style.color = "var(--red)";
      errText.style.fontSize = "12px";
      errText.style.marginTop = "5px";
      errText.style.fontWeight = "bold";
      input.parentNode.insertBefore(errText, input.nextSibling);
    }
    errText.innerHTML = window.iconHtml('circle-x', 14, 'icon-sm') + ' ' + msg;
    
    setTimeout(() => {
      input.style.border = "";
      if (errText && errText.parentNode) errText.parentNode.removeChild(errText);
    }, 4000);
  };

  if (lbl.length !== 4) {
    showError(lblInput, "Le code matière doit faire exactement 4 lettres.");
    return; // Bloque la création si erreur !
  }
  if (window.D.matieres.find(m => m.id === lbl)) {
    showError(lblInput, "Ce code matière existe déjà !");
    return; // Bloque la création si erreur !
  }
  if (name.length === 0) {
    showError(nameInput, "Tu dois donner un nom complet à ta matière.");
    return; // Bloque la création si erreur !
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
  
  const showError = (input, msg) => {
    input.style.border = "2px solid var(--red)";
    let errText = input.nextElementSibling;
    if (!errText || errText.className !== 'inline-error') {
      errText = document.createElement('div');
      errText.className = 'inline-error';
      errText.style.color = "var(--red)";
      errText.style.fontSize = "12px";
      errText.style.marginTop = "5px";
      errText.style.fontWeight = "bold";
      input.parentNode.insertBefore(errText, input.nextSibling);
    }
    errText.innerHTML = window.iconHtml('circle-x', 14, 'icon-sm') + ' ' + msg;
    
    setTimeout(() => {
      input.style.border = "";
      if (errText && errText.parentNode) errText.parentNode.removeChild(errText);
    }, 4000);
  };

  if (name.length === 0) {
    showError(nameInput, "Tu dois donner un nom à ton classeur.");
    return; // Bloque la création si erreur !
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
