/** Jeux de démo : demo-data.js (minimal, 3 semaines, mi-année PC*) */

window.demoData = {
  settings: { userName: "Étudiant", theme: 'dark', template: 'glass', themePreset: 'minimaliste', appearanceVersion: 2, navLayout: 'sidebar-left', appColor: '#5b9aff', compact: false, showStats: false, showChips: true, showDashHero: true, showDashRev: true, showDashOver: true, showHeaderClock: false, headerClockSeconds: true, ankiQuotaMin: 90 },
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
    { uid: 'CH-8M5', title: 'Cinétique Chimique', type: 'DS', rev: 'red', note: '12', mat: 'CHIM', cl: 'C', inter: '02', stat: 'active', date: '2026-02-12' },
    { uid: 'PH-3K9', title: 'Électromagnétisme', type: 'KHOLLE', rev: 'green', note: '16', mat: 'PHYS', cl: 'A', inter: '03', stat: 'active', date: '2026-02-20' },
    { uid: 'MA-D12', title: 'DS Analyse', type: 'DS', rev: 'orange', note: '11.5', mat: 'MATH', cl: 'B', inter: '02', stat: 'active', date: '2026-03-05' },
    { uid: 'PH-K21', title: 'Colle Mécanique', type: 'KHOLLE', rev: 'green', note: '14', mat: 'PHYS', cl: 'A', inter: '01', stat: 'active', date: '2026-03-12' },
    { uid: 'CH-K08', title: 'Colle Orga', type: 'KHOLLE', rev: 'orange', note: '13', mat: 'CHIM', cl: 'C', inter: '03', stat: 'active', date: '2026-03-26' },
    { uid: 'MA-K33', title: 'Colle Algèbre', type: 'KHOLLE', rev: 'green', note: '17', mat: 'MATH', cl: 'B', inter: '01', stat: 'active', date: '2026-04-02' },
    { uid: 'PH-D07', title: 'DS Optique', type: 'DS', rev: 'green', note: '15', mat: 'PHYS', cl: 'A', inter: '04', stat: 'active', date: '2026-04-10' },

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
      { id:'W-DM1', titre:"DM Algèbre linéaire", coursIds:['MA-7Z3','MA-V6J'], mat:'MATH', profil:'EXO', type:'devoir', question:"DM à rendre : 6 exercices d'algèbre linéaire (espaces vectoriels + réduction).", tempsCible:1800, importance:5, statut:'actif', intervalle:0, ease:2.5, repetitions:0, dateProchaineRevision:_today, dateLimite:_shift(7), historique:[], _morceauxTotal:3, _morceauxFaits:0, _dureeTotaleMin:90, _tempsRestantMin:90, _tempsProposeMin:90, _sessionMinMin:30, dateCreation:_today }
    ];
  })(),
};

/** Démo « 3 semaines » — historique riche, ease variés */
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
    settings: { userName: "Étudiant XP", theme:'dark', template:'glass', compact:false, showStats:true, showChips:true, showDashHero:true, showDashRev:true, showDashOver:true, ankiQuotaMin:90, ankiSessionMin:75, ankiIncludeNew:4, ankiMaxAnglaisFill:4 },
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

window.demoDataPCStar = (function () {
  const _d = new Date();
  _d.setHours(0, 0, 0, 0);
  function localDateISO(d) {
    const dt = d instanceof Date ? new Date(d.getTime()) : new Date(d || Date.now());
    if (isNaN(dt.getTime())) return localDateISO(new Date());
    dt.setHours(0, 0, 0, 0);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  const today = localDateISO(_d);
  const shift = function (n) {
    const d = new Date(_d);
    d.setDate(d.getDate() + n);
    return localDateISO(d);
  };
  const dateTime = function (daysFromToday) {
    const d = new Date(_d);
    d.setDate(d.getDate() + daysFromToday);
    return d.toISOString();
  };

  function histo(reviews) {
    return reviews.map(function (r) {
      return {
        date: dateTime(-r.d),
        qScore: r.q,
        tempsReel: r.t || 60,
        pen: 1,
        mode: "normal"
      };
    });
  }

  function card(o) {
    const c = {
      id: o.id,
      titre: o.titre || o.q.substring(0, 48),
      question: o.q,
      reponse: o.a || "",
      mat: o.mat,
      profil: o.profil || "COURS",
      tempsCible: o.temps,
      importance: o.imp != null ? o.imp : 3,
      statut: o.statut || "actif",
      intervalle: o.int != null ? o.int : 0,
      ease: o.ease != null ? o.ease : 2.5,
      repetitions: o.rep || 0,
      dateProchaineRevision: o.due === null ? null : (o.due != null ? o.due : today),
      historique: o.hist || [],
      coursIds: o.coursIds || [],
      dateCreation: o.created || dateTime(-60),
      epinglee: !!o.pin
    };
    if (o.type === "devoir") {
      c.type = "devoir";
      c.dateLimite = o.lim;
      c._morceauxTotal = o.pieces || 1;
      c._morceauxFaits = o.done || 0;
      c._dureeTotaleMin = o.dureeMin || Math.round(c.tempsCible / 60);
      delete c.reponse;
    }
    if (o.blocage) {
      c._blocageActif = true;
      c._blocageRevCount = o.blocageCount || 2;
    }
    return c;
  }

  /** Profils de révision pour simuler une vraie mi-année (dates réparties ensuite). */
  function stageSpec(stage, seed) {
    const s = seed || 0;
    const specs = {
      mature: {
        int: 16 + (s % 28), ease: 2.72 + (s % 6) * 0.04, rep: 5 + (s % 3),
        due: shift(14 + (s % 20)),
        hist: histo([{ d: 58 + s, q: 9 }, { d: 38, q: 9 }, { d: 20, q: 10 }, { d: 9, q: 9 }, { d: 3, q: 8 }])
      },
      good: {
        int: 7 + (s % 9), ease: 2.48 + (s % 4) * 0.05, rep: 4,
        due: shift(5 + (s % 11)),
        hist: histo([{ d: 28, q: 8 }, { d: 16, q: 8 }, { d: 7, q: 9 }, { d: 2, q: 8 }])
      },
      learning: {
        int: 2 + (s % 5), ease: 2.15 + (s % 3) * 0.08, rep: 2 + (s % 2),
        due: shift(1 + (s % 6)),
        hist: histo([{ d: 12, q: 6 }, { d: 5, q: 7 }, { d: 1, q: 6 }])
      },
      struggle: {
        int: s % 2, ease: 1.65 + (s % 3) * 0.1, rep: 2 + (s % 2),
        due: shift(1 + (s % 3)), blocage: s % 3 === 0, blocageCount: 1,
        hist: histo([{ d: 14, q: 3 }, { d: 8, q: 4 }, { d: 3, q: 5 }])
      },
      fresh: {
        int: 0, ease: 2.35, rep: 0,
        due: shift(2 + (s % 8)), hist: []
      },
      started: {
        int: 0, ease: 2.05, rep: 1,
        due: shift(1 + (s % 5)),
        hist: histo([{ d: 4, q: 5 }])
      },
      reservoir: {
        statut: "reservoir", due: null, int: 0, ease: 2.5, rep: 0, hist: []
      }
    };
    return specs[stage] || specs.learning;
  }

  /** Étale les échéances sur ~2 mois (max 5 cartes/jour) pour des prévisions réalistes. */
  function hashId(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
    return h;
  }

  function alignHistoriqueToDue(c, dueDayOffset) {
    if (!c.historique || !c.historique.length) return;
    var int = Math.max(1, c.intervalle || 1);
    var lastDay = dueDayOffset - int;
    c.historique[c.historique.length - 1].date = dateTime(lastDay);
    for (var j = c.historique.length - 2; j >= 0; j--) {
      int = Math.max(2, Math.min(int + 1, 18));
      lastDay -= int;
      c.historique[j].date = dateTime(lastDay);
    }
  }

  function rebalanceDemoSchedule(exercices) {
    var minD = 0;
    var maxD = 56;
    var maxCards = 4;
    var maxSec = 95 * 60;
    var counts = {};
    var secCounts = {};
    var actifs = exercices.filter(function (c) {
      return c.statut === "actif" && c.dateProchaineRevision != null && c.type !== "devoir";
    });
    actifs.sort(function (a, b) { return a.id.localeCompare(b.id); });

    actifs.forEach(function (c, i) {
      var bias = 0;
      var ease = c.ease || 2.5;
      var intv = c.intervalle || 0;
      var dur = c.tempsCible || 60;
      if (ease < 1.9) bias = 2;
      else if (intv >= 14) bias = 22;
      else if ((c.repetitions || 0) <= 1) bias = 5;

      var span = maxD - minD + 1;
      var day = minD + ((i * 17 + bias + hashId(c.id)) % span);
      var placed = false;
      for (var k = 0; k < span && !placed; k++) {
        var tryDay = minD + ((day - minD + k) % span);
        if ((counts[tryDay] || 0) < maxCards && (secCounts[tryDay] || 0) + dur <= maxSec) {
          counts[tryDay] = (counts[tryDay] || 0) + 1;
          secCounts[tryDay] = (secCounts[tryDay] || 0) + dur;
          c.dateProchaineRevision = shift(tryDay);
          alignHistoriqueToDue(c, tryDay);
          placed = true;
        }
      }
      if (!placed) {
        for (var j = minD; j <= maxD; j++) {
          if ((counts[j] || 0) < maxCards + 1) {
            counts[j] = (counts[j] || 0) + 1;
            secCounts[j] = (secCounts[j] || 0) + dur;
            c.dateProchaineRevision = shift(j);
            alignHistoriqueToDue(c, j);
            break;
          }
        }
      }
    });

    exercices.filter(function (c) { return c.type === "devoir" && c.statut === "actif"; }).forEach(function (c, i) {
      var dueDay = 2 + (i % 5) * 4 + (hashId(c.id) % 3);
      c.dateProchaineRevision = shift(dueDay);
    });
  }

  /** Génère les cartes X- d'un chapitre (questions usuelles + exos + formules). */
  function chapterCards(ch) {
    return ch.items.map(function (it, i) {
      const spec = stageSpec(it.stage, i + (ch.seed || 0));
      const id = "X-" + ch.prefix + String(i + 1).padStart(2, "0");
      const titre = it.qu
        ? (it.q.indexOf("[QU]") === 0 ? "" : "[QU] ") + (it.titre || it.q.substring(0, 44))
        : (it.titre || (it.p === "EXO" ? "Exo — " + it.q.substring(0, 36) : undefined));
      return card(Object.assign({}, spec, {
        id: id,
        mat: ch.mat,
        coursIds: [ch.coursId],
        profil: it.p,
        imp: it.imp != null ? it.imp : 3,
        q: it.q,
        a: it.a,
        temps: it.t,
        titre: titre,
        created: dateTime(ch.baseAge + i * 2 + (i % 5)),
        pin: !!it.pin
      }, it.over || {}));
    });
  }

  // ——— Documents cours (programme PC* typique S1/S2) ———
  var cours = [
    { uid: "PH-MEC", title: "Mécanique du point", type: "COURS", rev: "green", mat: "PHYS", cl: "A", inter: "01", stat: "active", date: shift(-95) },
    { uid: "PH-THD", title: "Thermodynamique", type: "COURS", rev: "green", mat: "PHYS", cl: "A", inter: "02", stat: "active", date: shift(-80) },
    { uid: "PH-EMG", title: "Électromagnétisme", type: "COURS", rev: "orange", mat: "PHYS", cl: "A", inter: "03", stat: "active", date: shift(-55) },
    { uid: "PH-OPT", title: "Optique ondulatoire", type: "TD", rev: "orange", mat: "PHYS", cl: "A", inter: "04", stat: "active", date: shift(-30) },
    { uid: "MA-ALG", title: "Algèbre linéaire", type: "COURS", rev: "green", mat: "MATH", cl: "B", inter: "01", stat: "active", date: shift(-100) },
    { uid: "MA-ANL", title: "Analyse (suites & intégrales)", type: "COURS", rev: "green", mat: "MATH", cl: "B", inter: "02", stat: "active", date: shift(-70) },
    { uid: "MA-RED", title: "Réduction endomorphismes", type: "FICHE", rev: "orange", mat: "MATH", cl: "B", inter: "03", stat: "active", date: shift(-40) },
    { uid: "MA-PRO", title: "Probabilités discrètes", type: "TD", rev: "red", mat: "MATH", cl: "B", inter: "04", stat: "active", date: shift(-20) },
    { uid: "CH-CRU", title: "Cristallographie", type: "COURS", rev: "green", mat: "CHIM", cl: "C", inter: "01", stat: "active", date: shift(-75) },
    { uid: "CH-CIN", title: "Cinétique chimique", type: "COURS", rev: "orange", mat: "CHIM", cl: "C", inter: "02", stat: "active", date: shift(-45) },
    { uid: "CH-ORG", title: "Chimie org — Alcools & mécanismes", type: "COURS", rev: "orange", mat: "CHIM", cl: "C", inter: "03", stat: "active", date: shift(-25) }
  ];

  // ——— Cartes X- par chapitre (volume mi-année réaliste) ———
  var xCards = [].concat(
    // ═══ PHYS — Mécanique (chapitre ancien, bien avancé) ═══
    chapterCards({ prefix: "PHM", mat: "PHYS", coursId: "PH-MEC", baseAge: -115, seed: 1, items: [
      { p: "COURS", qu: true, imp: 5, stage: "mature", q: "Questions usuelles — Mécanique du point : énoncer PFD, TEC, théorème du moment cinétique et leurs hypothèses.", a: "PFD: ΣF=ma. TEC: ΔEc=W_ext+W_int. Moment cinétique: dL/dt=M_ext. Réf. galiléen, système matériel.", t: 1500 },
      { p: "COURS", qu: true, imp: 5, stage: "good", q: "[QU] Référentiels : définition réf. galiléen, réf. tournant, force centrifuge et de Coriolis.", a: "Galiléen: rectiligne uniforme. Tournant: F_cf=mΩ²r, F_Cor=-2mΩ∧v.", t: 1080 },
      { p: "COURS", qu: true, imp: 4, stage: "good", q: "[QU] Énergie mécanique : quand est-elle conservée ? Lien avec forces conservatives.", a: "Conservée si forces int/ext conservatives. W=-ΔEp, Em=Ec+Ep constant.", t: 720 },
      { p: "EXO", imp: 4, stage: "mature", q: "Projectile lancé à v₀, angle α. Équations horaires, portée, flèche.", a: "x=v₀cosα·t, z=v₀sinα·t-gt²/2. P=v₀²sin2α/g, H=v₀²sin²α/(2g).", t: 1200 },
      { p: "EXO", imp: 4, stage: "mature", q: "Pendule simple (petites oscillations) : équation, période, énergie.", a: "θ''+ω₀²θ=0, T=2π√(L/g). Em=const si frottements négligeables.", t: 900 },
      { p: "EXO", imp: 5, stage: "good", q: "Choc élastique 1D entre deux masses m₁, m₂. Conservation quantité mouvement + énergie.", a: "m₁v₁+m₂v₂=m₁v'₁+m₂v'₂ et Ec conservée → formules v'₁, v'₂.", t: 1500 },
      { p: "EXO", imp: 3, stage: "learning", q: "Roulement sans glissement : v(G), ω, condition cinématique.", a: "v(G)=Rω, contact sans glissement: v_contact=0.", t: 1080 },
      { p: "EXO", imp: 4, stage: "struggle", q: "Satellite en orbite circulaire : vitesse, période, énergie mécanique.", a: "v=√(GM/r), T=2πr/v, Em=-GMm/(2r).", t: 1320 },
      { p: "EXO", imp: 3, stage: "good", q: "Fil à la verticale, masse m en rotation (conique) : T et ω en fonction de L, α.", a: "T=mg/cosα, ω=√(g/(L·cosα)).", t: 1200 },
      { p: "FORMULE", imp: 3, stage: "mature", q: "Relation v=ωr (roulement).", a: "v(G)=Rω (sans glissement)", t: 60 },
      { p: "FORMULE", imp: 2, stage: "mature", q: "PFD (forme vectorielle).", a: "ΣF_ext = m·a_G", t: 45 },
      { p: "FORMULE", imp: 3, stage: "good", q: "TEC.", a: "ΔEc = W(F_ext) + W(F_int)", t: 60 },
      { p: "FORMULE", imp: 2, stage: "good", q: "Moment cinétique point.", a: "L_O = r∧p = r∧(mv)", t: 75 },
      { p: "COURS", qu: true, imp: 4, stage: "learning", q: "[QU] Puissance d'une force, théorème de l'énergie cinétique en puissance.", a: "P=F·v. dEc/dt=P_ext+P_int.", t: 600 },
      { p: "EXO", imp: 3, stage: "fresh", q: "Plan incliné avec frottement : condition de glissement d'une masse m.", a: "Glisse si tanα > μ_s ; accélération a=g(sinα-μcosα).", t: 1200 },
      { p: "EXO", imp: 2, stage: "reservoir", q: "Oscillateur harmonique amorti : régimes faible/fort/sur-amorti.", a: "γ<ω₀ pseudo-périodique ; γ>ω₀ apériodique ; γ=ω₀ critique.", t: 1080 }
    ] }),

    // ═══ PHYS — Thermodynamique ═══
    chapterCards({ prefix: "PHT", mat: "PHYS", coursId: "PH-THD", baseAge: -98, seed: 2, items: [
      { p: "COURS", qu: true, imp: 5, stage: "mature", q: "Questions usuelles — Thermo : 1er et 2e principes, enthalpie, entropie (définitions).", a: "1er: ΔU=W+Q. 2e: ΔS_univ≥0. H=U+pV, dS échange+création.", t: 1320 },
      { p: "COURS", qu: true, imp: 4, stage: "good", q: "[QU] Transformations reversibles/irréversibles, machine thermique, rendement.", a: "Réversible: quasi-statique sans dissipation. η=W/Qc≤η_Carnot.", t: 900 },
      { p: "COURS", qu: true, imp: 4, stage: "good", q: "[QU] Démontrer η_Carnot = 1 − Tf/Tc.", a: "Cycle réversible ditherme → ΔS=0 → η=1-Tf/Tc.", t: 900, pin: true },
      { p: "EXO", imp: 4, stage: "mature", q: "Gaz parfait : Cp−Cv=R, loi Mayer.", a: "Cp-Cv=R ; γ=Cp/Cv.", t: 720 },
      { p: "EXO", imp: 4, stage: "good", q: "Détente adiabatique GP : pV^γ=const, relation T-V.", a: "TV^(γ-1)=const.", t: 900 },
      { p: "EXO", imp: 3, stage: "learning", q: "Cycle de Carnot (diagramme p-V) : tracer, calculer η.", a: "2 isothermes + 2 adiabatiques. η=1-Tf/Tc.", t: 1200 },
      { p: "EXO", imp: 4, stage: "struggle", q: "Mélange deux gaz identiques (GP) : variation d'entropie.", a: "ΔS=nR·ln(Vf/Vi) par gaz si expansion libre.", t: 1080 },
      { p: "EXO", imp: 3, stage: "good", q: "Réfrigérateur : COP, relation avec η_Carnot.", a: "COP=Qf/W ; COP_max=Tf/(Tc-Tf).", t: 900 },
      { p: "FORMULE", imp: 2, stage: "mature", q: "1er principe (système fermé).", a: "ΔU = W + Q", t: 45 },
      { p: "FORMULE", imp: 3, stage: "mature", q: "Carnot.", a: "η = 1 − Tf/Tc", t: 60 },
      { p: "FORMULE", imp: 2, stage: "good", q: "Entropie (définition réversible).", a: "dS = δQ_rev / T", t: 75 },
      { p: "FORMULE", imp: 3, stage: "learning", q: "Enthalpie.", a: "H = U + pV ; dH = δQ (P constante)", t: 60 },
      { p: "EXO", imp: 3, stage: "started", q: "Compression isotherme n moles GP : W, Q, ΔU.", a: "ΔU=0, W=-Q=nRT·ln(Vf/Vi).", t: 960 },
      { p: "COURS", qu: true, imp: 3, stage: "reservoir", q: "[QU] Potentiels thermodynamiques (F, G) — définitions.", a: "F=U-TS, G=H-TS.", t: 720 }
    ] }),

    // ═══ PHYS — Électromagnétisme ═══
    chapterCards({ prefix: "PHE", mat: "PHYS", coursId: "PH-EMG", baseAge: -72, seed: 3, items: [
      { p: "COURS", qu: true, imp: 5, stage: "learning", q: "Questions usuelles — EM : Maxwell (4 eq. locales), flux, circulation, potentiels.", a: "Gauss E/B, Faraday, Ampère-Maxwell. rot E=-∂B/∂t.", t: 1200 },
      { p: "COURS", qu: true, imp: 4, stage: "struggle", q: "[QU] Loi de Gauss, théorème de Green-Ostrogradski (rappel).", a: "Φ=∫E·dS=Q/ε₀. ∫div F dV=∮F·dS.", t: 900 },
      { p: "COURS", qu: true, imp: 4, stage: "good", q: "[QU] Induction : loi de Faraday, Lenz, auto-induction.", a: "e=-dΦ/dt. Lenz: s'oppose à la variation.", t: 780 },
      { p: "EXO", imp: 5, stage: "learning", q: "Fil infini I : champ B à distance r (Biôt-Savart ou Ampère).", a: "B=μ₀I/(2πr) (direction tangente).", t: 1080 },
      { p: "EXO", imp: 4, stage: "struggle", q: "Condensateur plan : C, énergie stockée, avec diélectrique.", a: "C=εS/d, U=½CV², C'=ε_r C.", t: 1200 },
      { p: "EXO", imp: 4, stage: "good", q: "RL : établissement courant, constante τ=L/R.", a: "i(t)=E/R(1-e^{-t/τ}), τ=L/R.", t: 960 },
      { p: "EXO", imp: 3, stage: "good", q: "Oscillations RLC série : équation, pulsation propre, amortissement.", a: "Lq''+Rq'+q/C=0 ; ω₀=1/√(LC).", t: 1320 },
      { p: "EXO", imp: 4, stage: "started", q: "Onde plane EM : relation B=E/c, direction propagation.", a: "E⊥B⊥k, c=1/√(ε₀μ₀).", t: 900 },
      { p: "FORMULE", imp: 3, stage: "good", q: "Maxwell-Faraday.", a: "rot E = −∂B/∂t", t: 60 },
      { p: "FORMULE", imp: 3, stage: "learning", q: "Ampère-Maxwell.", a: "rot B = μ₀(j + ε₀∂E/∂t)", t: 75 },
      { p: "FORMULE", imp: 2, stage: "mature", q: "Force de Lorentz.", a: "F = q(E + v∧B)", t: 60 },
      { p: "FORMULE", imp: 3, stage: "good", q: "Gauss (E).", a: "div E = ρ/ε₀", t: 60 },
      { p: "EXO", imp: 3, stage: "fresh", q: "Bobine longue n spires/m, I : B à l'intérieur.", a: "B=μ₀nI (Néel).", t: 720 },
      { p: "EXO", imp: 2, stage: "reservoir", q: "Guide d'onde : onde TE/TM (qualitatif).", a: "Modes propres, fréquence coupure.", t: 900 }
    ] }),

    // ═══ PHYS — Optique ═══
    chapterCards({ prefix: "PHO", mat: "PHYS", coursId: "PH-OPT", baseAge: -38, seed: 4, items: [
      { p: "COURS", qu: true, imp: 5, stage: "started", q: "Questions usuelles — Optique : diffraction, interférences, résolution.", a: "Young: i=λD/a. Fente: a sinθ=nλ. Critère Rayleigh.", t: 1080 },
      { p: "COURS", qu: true, imp: 4, stage: "fresh", q: "[QU] Ondes lumineuses : relation dispersion, c=λν, indice n.", a: "n=c/v, λ_n=λ/n.", t: 540 },
      { p: "EXO", imp: 5, stage: "struggle", q: "Fentes de Young : λ=633nm, a=0,5mm, D=2m → interfrange. Effet n=1,33 ?", a: "i≈2,53mm ; dans l'eau i'≈1,90mm.", t: 1500 },
      { p: "EXO", imp: 4, stage: "learning", q: "Interférence miroirs de Fresnel : franges localisation.", a: "Miroirs inclinés → fringes localisées à l'infini si source étendue.", t: 1200 },
      { p: "EXO", imp: 4, stage: "started", q: "Diffraction fente unique : largeur tache centrale.", a: "Δθ≈2λ/a, tache ≈ 2λD/a.", t: 1080 },
      { p: "EXO", imp: 3, stage: "fresh", q: "Réseau de diffraction : condition des maxima.", a: "d·sinθ = kλ (k entier).", t: 900 },
      { p: "FORMULE", imp: 3, stage: "learning", q: "Interfrange Young.", a: "i = λD/a", t: 60 },
      { p: "FORMULE", imp: 2, stage: "started", q: "Snell-Descartes.", a: "n₁ sin i₁ = n₂ sin i₂", t: 45 },
      { p: "EXO", imp: 3, stage: "reservoir", q: "Diffraction circulaire : tache d'Airy, 1er minimum.", a: "sinθ ≈ 1,22 λ/D", t: 960 },
      { p: "COURS", qu: true, imp: 3, stage: "reservoir", q: "[QU] Polarisation lumière (qualitatif).", a: "Onde transverse, filtre polarisant, loi de Malus.", t: 600 }
    ] }),

    // ═══ MATH — Algèbre linéaire ═══
    chapterCards({ prefix: "MAL", mat: "MATH", coursId: "MA-ALG", baseAge: -120, seed: 5, items: [
      { p: "COURS", qu: true, imp: 5, stage: "mature", q: "Questions usuelles — Algèbre : SEV, base, dimension, rang, théorème de la base.", a: "SEV: stable +,·. Base: libre+ génératrice. dim=card base. Th. base: compléter en base.", t: 1200 },
      { p: "COURS", qu: true, imp: 5, stage: "mature", q: "[QU] Applications linéaires : noyau, image, théorème du rang.", a: "Ker f SEV, Im f SEV. dim Ker + dim Im = dim E.", t: 900 },
      { p: "COURS", qu: true, imp: 4, stage: "good", q: "[QU] Matrices : produit, inverse, changement de base.", a: "Mat(gh)=Mat(g)Mat(h). P_AP=P_BA^{-1}.", t: 780 },
      { p: "EXO", imp: 4, stage: "mature", q: "Prouver F∩G SEV (F,G SEV de E).", a: "0∈F∩G, stable par + et λ.", t: 480 },
      { p: "EXO", imp: 4, stage: "mature", q: "Famille libre/génératrice dans R³ : base ?", a: "Vérifier déterminant ou rang.", t: 900 },
      { p: "EXO", imp: 5, stage: "good", q: "Résoudre AX=B par pivot de Gauss (exemple 3×3).", a: "Augmentée [A|B], échelon, remontée.", t: 1500 },
      { p: "EXO", imp: 4, stage: "good", q: "Endomorphisme de R² : déterminer Ker et Im.", a: "Résoudre f(x)=0 et f(E) engendré.", t: 1080 },
      { p: "EXO", imp: 3, stage: "learning", q: "Projecteur : p²=p, montrer Im⊕Ker=E.", a: "x=p(x)+(x-p(x)), p(x)∈Im, x-p(x)∈Ker.", t: 1200 },
      { p: "EXO", imp: 4, stage: "good", q: "Dual : base duale, forme linéaire sur R³.", a: "e_i*(e_j)=δ_ij.", t: 960 },
      { p: "FORMULE", imp: 2, stage: "mature", q: "Théorème du rang.", a: "dim Ker f + rg f = dim E", t: 60 },
      { p: "FORMULE", imp: 3, stage: "good", q: "Determinant 2×2.", a: "det((a,b),(c,d)) = ad − bc", t: 45 },
      { p: "FORMULE", imp: 2, stage: "mature", q: "Trace.", a: "tr(AB)=tr(BA)", t: 45 },
      { p: "EXO", imp: 3, stage: "learning", q: "Somme directe F⊕G : critère F∩G={0} et dim somme.", a: "dim(F+G)=dim F+dim G.", t: 720 },
      { p: "EXO", imp: 2, stage: "reservoir", q: "Endomorphisme nilpotent : indice, exemple.", a: "∃k, f^k=0. Ex: décalage sur R^n.", t: 1080 }
    ] }),

    // ═══ MATH — Analyse ═══
    chapterCards({ prefix: "MAN", mat: "MATH", coursId: "MA-ANL", baseAge: -88, seed: 6, items: [
      { p: "COURS", qu: true, imp: 5, stage: "good", q: "Questions usuelles — Analyse : suites, séries, intégrales impropres, équivalents.", a: "Cauchy suites. Séries: reste, critères comparaison, d'Alembert. Équiv. ln(1+u)~u.", t: 1200 },
      { p: "COURS", qu: true, imp: 4, stage: "good", q: "[QU] Séries entières : rayon, dérivation/intégration terme à terme.", a: "R=1/limsup|a_n|^{1/n}. Sur ]-R,R[ dérivation OK.", t: 900 },
      { p: "EXO", imp: 4, stage: "mature", q: "Calculer Σ n·x^(n−1) sur ]−1,1[.", a: "= 1/(1−x)²", t: 720 },
      { p: "EXO", imp: 4, stage: "good", q: "Intégrale ∫₀^∞ e^{-x²} dx (Gauss).", a: "√π/2 (via Γ ou carré).", t: 1500 },
      { p: "EXO", imp: 4, stage: "learning", q: "Suite définie par u_{n+1}=f(u_n) : convergence fixe point.", a: "Si f continue, u→ℓ et f(ℓ)=ℓ.", t: 1080 },
      { p: "EXO", imp: 3, stage: "good", q: "Équivalent de ln(sin x) en 0.", a: "ln(sin x) ~ ln x ~ x (x→0⁺).", t: 600 },
      { p: "EXO", imp: 4, stage: "struggle", q: "Série ∑1/n^α : convergence selon α.", a: "Converge si α>1 (Riemann).", t: 720 },
      { p: "FORMULE", imp: 3, stage: "good", q: "Hadamard (rayon).", a: "1/R = limsup |a_n|^(1/n)", t: 60 },
      { p: "FORMULE", imp: 2, stage: "mature", q: "DL e^x en 0.", a: "e^x = 1 + x + x²/2! + …", t: 45 },
      { p: "FORMULE", imp: 3, stage: "learning", q: "Intégration par parties.", a: "∫u'v = [uv] − ∫uv'", t: 60 },
      { p: "EXO", imp: 3, stage: "started", q: "Suite récurrente linéaire ordre 2 : polynôme caractéristique.", a: "r²+ar+b=0 → solution selon Δ.", t: 1200 },
      { p: "EXO", imp: 2, stage: "reservoir", q: "Fonction Γ : Γ(n+1)=n! pour n∈N.", a: "Γ(z)=∫₀^∞ t^{z-1}e^{-t}dt.", t: 900 }
    ] }),

    // ═══ MATH — Réduction ═══
    chapterCards({ prefix: "MAR", mat: "MATH", coursId: "MA-RED", baseAge: -52, seed: 7, items: [
      { p: "COURS", qu: true, imp: 5, stage: "struggle", q: "Questions usuelles — Réduction : valeurs propres, diagonalisation, trigonalisation.", a: "Av=λv. Diag ⟺ χ scindé + dim E_λ=mult(λ).", t: 1200 },
      { p: "COURS", qu: true, imp: 5, stage: "learning", q: "[QU] Polynôme annulateur, théorème Cayley-Hamilton.", a: "χ_A(A)=0. Annulateur minimal divise χ.", t: 900 },
      { p: "EXO", imp: 5, stage: "struggle", q: "M=((3,1),(0,2)). Diagonalisable ? P, D ?", a: "Oui. P=((1,1),(0,−1)), D=diag(3,2).", t: 1680 },
      { p: "EXO", imp: 4, stage: "learning", q: "Endomorphisme 3×3 : valeurs propres, espaces propres.", a: "det(A-λI)=0 puis Ker(A-λI).", t: 1500 },
      { p: "EXO", imp: 4, stage: "struggle", q: "Matrice non diagonalisable : forme de Jordan (2×2).", a: "Bloc Jordan λ avec 1 au-dessus diag.", t: 1320 },
      { p: "EXO", imp: 3, stage: "good", q: "Endomorphisme symétrique réel : diagonalisable dans une BON.", a: "Spectre réel, espaces propres orthogonaux.", t: 1080 },
      { p: "FORMULE", imp: 4, stage: "learning", q: "Critère diagonalisabilité.", a: "χ scindé ET dim E_λ = mult(λ) ∀λ", t: 75 },
      { p: "FORMULE", imp: 3, stage: "started", q: "Polynôme caractéristique.", a: "χ_A(λ) = det(A − λI)", t: 60 },
      { p: "EXO", imp: 4, stage: "fresh", q: "Réduction 3×3 numérique complète.", a: "(exemple TD)", t: 1800 },
      { p: "EXO", imp: 3, stage: "reservoir", q: "Endomorphisme nilpotent + diagonalisable → nul.", a: "Spectre {0}, Ker=E.", t: 720 }
    ] }),

    // ═══ MATH — Probabilités ═══
    chapterCards({ prefix: "MAP", mat: "MATH", coursId: "MA-PRO", baseAge: -28, seed: 8, items: [
      { p: "COURS", qu: true, imp: 5, stage: "started", q: "Questions usuelles — Probas : VA discrètes, loi, espérance, variance.", a: "E(X)=Σx_i p_i, V(X)=E(X²)-E(X)².", t: 900 },
      { p: "COURS", qu: true, imp: 4, stage: "fresh", q: "[QU] Formule de Bayes, probabilités totales.", a: "P(A|B)=P(B|A)P(A)/P(B). P(A)=ΣP(A|B_i)P(B_i).", t: 720 },
      { p: "EXO", imp: 4, stage: "learning", q: "Binomiale B(n,p) : E, V, P(X=k).", a: "E=np, V=np(1-p), P=C(n,k)p^k(1-p)^{n-k}.", t: 960 },
      { p: "EXO", imp: 3, stage: "started", q: "Loi géométrique : E(X), absence de mémoire.", a: "E=1/p, P(X>n+m|X>n)=P(X>m).", t: 900 },
      { p: "EXO", imp: 3, stage: "fresh", q: "Poisson P(λ) : E, V, approximation binomiale.", a: "E=V=λ. B(n,p)≈P(np) si n grand, p petit.", t: 1080 },
      { p: "FORMULE", imp: 2, stage: "struggle", q: "Variance Bernoulli.", a: "V(X) = p(1−p)", t: 60 },
      { p: "FORMULE", imp: 3, stage: "started", q: "Markov (inégalité).", a: "P(X≥a) ≤ E(X)/a", t: 60 },
      { p: "EXO", imp: 2, stage: "reservoir", q: "Couple (X,Y) : loi jointe, marginales.", a: "P(X=x)=Σ_y P(X=x,Y=y).", t: 960 }
    ] }),

    // ═══ CHIM — Cristallographie ═══
    chapterCards({ prefix: "CHC", mat: "CHIM", coursId: "CH-CRU", baseAge: -92, seed: 9, items: [
      { p: "COURS", qu: true, imp: 4, stage: "good", q: "Questions usuelles — Cristallo : réseaux, maille, compacité, Bragg.", a: "Réseau = translations. Maille = motif+réseau. Bragg: 2d sinθ=nλ.", t: 1080 },
      { p: "EXO", imp: 3, stage: "mature", q: "Compacité CC, CC, CFC.", a: "CC≈0,68 ; CFC≈0,74 ; CVC≈0,68.", t: 720 },
      { p: "EXO", imp: 3, stage: "good", q: "Nombre d'atomes par maille cubique faces centrées.", a: "4 atomes/maille (8×1/8 + 6×1/2).", t: 600 },
      { p: "EXO", imp: 2, stage: "good", q: "Distance interatomique dans CFC (paramètre a).", a: "d=a/√2 entre atomes de contact.", t: 720 },
      { p: "FORMULE", imp: 1, stage: "mature", q: "Loi de Bragg.", a: "2d·sinθ = nλ", t: 60 },
      { p: "FORMULE", imp: 2, stage: "good", q: "Relation d=a pour cubique.", a: "a = 2r (simple) ; a = 2√2 r (CFC contact)", t: 75 },
      { p: "EXO", imp: 2, stage: "learning", q: "Défauts ponctuels : lacune, interstitiel.", a: "Lacune: site vide. Interstitiel: atome hors site.", t: 540 },
      { p: "COURS", qu: true, imp: 2, stage: "reservoir", q: "[QU] Structures hexagonales (graphite, glace).", a: "Empilements ABAB ou réseau hex.", t: 720 }
    ] }),

    // ═══ CHIM — Cinétique ═══
    chapterCards({ prefix: "CHI", mat: "CHIM", coursId: "CH-CIN", baseAge: -58, seed: 10, items: [
      { p: "COURS", qu: true, imp: 4, stage: "learning", q: "Questions usuelles — Cinétique : ordre, loi de vitesse, mécanismes, Arrhenius.", a: "v=k[A]^α. Arrhenius k=Ae^{-Ea/RT}. t½ ordre1=ln2/k.", t: 1080 },
      { p: "COURS", qu: true, imp: 3, stage: "struggle", q: "[QU] Mécanismes : étape limitante, intermédiaire réactionnel.", a: "RDS = plus lente. Steady state pour radicaux.", t: 900 },
      { p: "EXO", imp: 4, stage: "good", q: "Vérifier ordre 1 sur données [A](t), trouver k et t½.", a: "ln[A] linéaire → k≈0,002 s⁻¹.", t: 1200 },
      { p: "EXO", imp: 4, stage: "good", q: "Méthode des vitesses initiales : déterminer ordre.", a: "Tracer v₀ vs [A]₀^n → ordre n.", t: 1080 },
      { p: "EXO", imp: 3, stage: "learning", q: "Arrhenius : tracer ln k vs 1/T, déduire Ea.", a: "Pente = -Ea/R.", t: 960 },
      { p: "EXO", imp: 3, stage: "started", q: "Catalyse homogène : rôle, modification mécanisme.", a: "Abaisse Ea, régénéré en fin.", t: 720 },
      { p: "FORMULE", imp: 3, stage: "mature", q: "t½ ordre 1.", a: "t½ = ln(2)/k", t: 60 },
      { p: "FORMULE", imp: 3, stage: "good", q: "Arrhenius.", a: "k = A·exp(−Ea/RT)", t: 60 },
      { p: "FORMULE", imp: 2, stage: "learning", q: "Loi vitesse ordre 1.", a: "v = k[A]", t: 45 },
      { p: "EXO", imp: 2, stage: "reservoir", q: "Réaction en chaîne (radicaux) : initiation, propagation.", a: "Initiation → propagation → terminaison.", t: 900 }
    ] }),

    // ═══ CHIM — Orga ═══
    chapterCards({ prefix: "CHO", mat: "CHIM", coursId: "CH-ORG", baseAge: -32, seed: 11, items: [
      { p: "COURS", qu: true, imp: 4, stage: "good", q: "Questions usuelles — Orga : SN1/SN2, E1/E2, alcools, carbonylés.", a: "SN1 carbocation ; SN2 Walden. E1/E2 déshydratation.", t: 1200 },
      { p: "COURS", qu: true, imp: 4, stage: "learning", q: "[QU] Oxydation alcools : primaire → aldéhyde/acide, tertiaire résiste.", a: "Primaire: PCC→aldéhyde. Tertiaire: pas d'ox. ménagée facile.", t: 900 },
      { p: "EXO", imp: 4, stage: "good", q: "Comparer SN1 vs SN2 (cinétique, stéréo, substrat).", a: "SN1 ordre1, racémisation ; SN2 ordre2, inversion.", t: 1140 },
      { p: "EXO", imp: 3, stage: "learning", q: "Identifier produit majoritaire addition HBr sur alcène asymétrique.", a: "Markovnikov : H sur C le + H.", t: 720 },
      { p: "EXO", imp: 3, stage: "started", q: "Mécanisme estérification acide (catalysée H+).", a: "Protonation carbonyle → addition nucléophile ROH.", t: 1080 },
      { p: "FORMULE", imp: 2, stage: "good", q: "Markovnikov (énoncé).", a: "H+ sur le carbone le plus hydrogéné.", t: 45 },
      { p: "EXO", imp: 2, stage: "reservoir", q: "Réaction de Grignard sur cétone : produit.", a: "Alcool tertiaire après hydrolyse.", t: 720 },
      { p: "COURS", qu: true, imp: 3, stage: "reservoir", q: "[QU] Spectro IR : bandes OH, C=O, C-H.", a: "OH large ~3300 ; C=O ~1700 cm⁻¹.", t: 600 }
    ] })
  );

  // Cartes réservoir supplémentaires (feuilles pas encore traitées)
  xCards = xCards.concat([
    card({ id: "X-RS01", mat: "PHYS", profil: "COURS", imp: 3, statut: "reservoir", due: null, coursIds: ["PH-OPT"], q: "Diffraction fente unique : position minima.", a: "a·sinθ = nλ", temps: 600, created: dateTime(-5) }),
    card({ id: "X-RS02", mat: "MATH", profil: "COURS", imp: 4, statut: "reservoir", due: null, coursIds: ["MA-PRO"], q: "Loi faible des grands nombres (énoncé).", a: "X̄_n → E(X) en probabilité.", temps: 420, created: dateTime(-4) }),
    card({ id: "X-RS03", mat: "CHIM", profil: "EXO", imp: 3, statut: "reservoir", due: null, coursIds: ["CH-ORG"], q: "Synthèse aspirine (schéma réactionnel).", a: "Acide salicylique + anhydride acétique → ASA.", temps: 900, created: dateTime(-3) }),
    card({ id: "X-RS04", mat: "PHYS", profil: "EXO", imp: 4, statut: "reservoir", due: null, coursIds: ["PH-MEC"], q: "Pendule conique : fréquence propre.", a: "ω = √(g/(L·cosα))", temps: 1200, created: dateTime(-2) }),
    card({ id: "X-RS05", mat: "MATH", profil: "EXO", imp: 5, statut: "reservoir", due: null, coursIds: ["MA-RED"], q: "Réduction matrice 4×4 (TD complet).", a: "(exemple numérique)", temps: 1800, created: dateTime(-1) }),
    card({ id: "X-RS06", mat: "PHYS", profil: "COURS", imp: 3, statut: "reservoir", due: null, coursIds: ["PH-THD"], q: "[QU] Phase et transitions de phase (Clapeyron).", a: "dp/dT = L/(TΔv).", temps: 720, created: dateTime(-6) }),
    card({ id: "X-RS07", mat: "MATH", profil: "COURS", imp: 4, statut: "reservoir", due: null, coursIds: ["MA-ANL"], q: "[QU] Équations différentielles linéaires ordre 2.", a: "y''+ay'+by=0 → r²+ar+b=0.", temps: 780, created: dateTime(-7) }),
    card({ id: "X-RS08", mat: "CHIM", profil: "COURS", imp: 2, statut: "reservoir", due: null, coursIds: ["CH-CRU"], q: "[QU] Bandes électroniques (conducteur/isolant).", a: "Gap interdit ; conducteur: bandes chevauchantes.", temps: 660, created: dateTime(-8) })
  ]);

  // ——— 50 cartes anglais Y- ———
  var EN = [
    ["to elicit", "provoquer / susciter"], ["to overcome", "surmonter"], ["a breakthrough", "une percée"],
    ["to bridge the gap", "combler le fossé"], ["to shed light on", "élucider"], ["to account for", "expliquer / représenter"],
    ["to carry out", "effectuer"], ["to set forth", "exposer / présenter"], ["to assess", "évaluer"],
    ["to enhance", "améliorer / renforcer"], ["to hinder", "entraver"], ["to underpin", "soutenir / fonder"],
    ["to yield", "produire / céder"], ["to devise", "concevoir"], ["to tackle", "s'attaquer à"],
    ["to refine", "affiner / raffiner"], ["to encompass", "englober"], ["to infer", "déduire"],
    ["to constrain", "contraindre"], ["to mitigate", "atténuer"], ["to leverage", "exploiter (un levier)"],
    ["to streamline", "rationaliser / simplifier"], ["to corroborate", "confirmer / corroborer"],
    ["to preclude", "exclure / empêcher"], ["to substantiate", "étayer / prouver"], ["to hinge on", "dépendre de"],
    ["to delve into", "approfondir"], ["to pinpoint", "identifier précisément"], ["to outweigh", "l'emporter sur"],
    ["to abide by", "respecter / se conformer à"], ["to dwell on", "s'attarder sur"], ["to rule out", "écarter"],
    ["to come up with", "proposer / trouver"], ["to build on", "fonder sur"], ["to boil down to", "se résumer à"],
    ["to spell out", "expliciter"], ["to draw on", "s'appuyer sur"], ["to fall short of", "ne pas atteindre"],
    ["to pave the way for", "ouvrir la voie à"], ["to give rise to", "donner lieu à"], ["to bring about", "provoquer"],
    ["to call for", "requérir / nécessiter"], ["to hinge upon", "reposer sur"], ["to put forward", "avancer (une idée)"],
    ["to run counter to", "aller à l'encontre de"], ["to bear out", "confirmer"], ["to touch upon", "aborder brièvement"],
    ["to single out", "distinguer / isoler"], ["to do away with", "supprimer"], ["to hinge", "dépendre"],
    ["to make up for", "compenser"], ["to stand for", "représenter / symboliser"]
  ].slice(0, 50);

  var yCards = EN.map(function (pair, i) {
    var idx = i + 1;
    var id = "Y-EN" + String(idx).padStart(2, "0");
    var q = pair[0];
    var a = pair[1];
    var tier = i % 5;
    var spec;
    if (tier === 0) {
      spec = { int: 12 + (i % 8), ease: 2.5 + (i % 3) * 0.08, rep: 5 + (i % 3), due: shift(4 + (i % 10)), hist: histo([{ d: 25 + i, q: 8 }, { d: 14, q: 9 }, { d: 6, q: 8 }]) };
    } else if (tier === 1) {
      spec = { int: 4 + (i % 4), ease: 2.3, rep: 3, due: shift(1 + (i % 3)), hist: histo([{ d: 10, q: 7 }, { d: 4, q: 6 }]) };
    } else if (tier === 2) {
      spec = { int: 0, ease: 2.1, rep: 1, due: today, hist: histo([{ d: 3, q: 5 }]) };
    } else if (tier === 3) {
      spec = { int: 1, ease: 1.85, rep: 2, due: shift(1 + (i % 3)), blocage: i % 7 === 0, hist: histo([{ d: 7, q: 3 }, { d: 2, q: 4 }]) };
    } else {
      spec = { int: 0, ease: 2.3, rep: 0, due: today, hist: [] };
    }
    return card(Object.assign({
      id: id,
      mat: "ANGL",
      profil: "ANGLAIS",
      imp: i % 9 === 0 ? 2 : 3,
      q: q,
      a: a,
      temps: 25 + (i % 3) * 5,
      created: dateTime(-80 + i)
    }, spec));
  });

  // ——— Devoirs W- ———
  var wCards = [
    card({ id: "W-DM1", type: "devoir", mat: "MATH", profil: "EXO", imp: 5, coursIds: ["MA-ALG", "MA-RED"], q: "DM Algèbre : SEV, bases, réduction (6 exos).", pieces: 4, done: 1, dureeMin: 120, lim: shift(5), due: shift(2), created: dateTime(-10) }),
    card({ id: "W-DM2", type: "devoir", mat: "PHYS", profil: "EXO", imp: 4, coursIds: ["PH-OPT"], q: "DM Optique : interferences + diffraction.", pieces: 3, done: 0, dureeMin: 90, lim: shift(9), due: shift(5), created: dateTime(-4) }),
    card({ id: "W-DM3", type: "devoir", mat: "CHIM", profil: "EXO", imp: 5, coursIds: ["CH-CIN"], q: "DM Cinétique : ordres, Arrhenius, mécanismes.", pieces: 2, done: 2, dureeMin: 60, lim: shift(-1), due: shift(-1), created: dateTime(-20) }),
    card({ id: "W-DM4", type: "devoir", mat: "MATH", profil: "EXO", imp: 3, coursIds: ["MA-PRO"], q: "DM Probas : variables discrètes, espérance.", pieces: 3, done: 0, dureeMin: 75, lim: shift(18), due: shift(11), created: dateTime(-2) })
  ];

  var allExercices = xCards.concat(yCards);
  rebalanceDemoSchedule(allExercices);

  return {
    settings: {
      userName: "PC* — simu mi-année",
      theme: "dark",
      template: "glass",
      compact: false,
      showStats: true,
      showChips: true,
      showDashHero: true,
      showDashRev: true,
      showDashOver: true,
      ankiQuotaMin: 90,
      ankiSessionMin: 90,
      ankiIncludeNew: 0,
      ankiMaxAnglaisFill: 8,
      margeBudget: 0.92,
      seuilDevoirForce: 35
    },
    matieres: [
      { id: "PHYS", label: "PHYS", name: "Physique", color: "#5b8df7" },
      { id: "MATH", label: "MATH", name: "Mathématiques", color: "#f0c060" },
      { id: "CHIM", label: "CHIM", name: "Chimie", color: "#50d890" },
      { id: "ANGL", label: "ANGL", name: "Anglais", color: "#e07ab3" }
    ],
    classeurs: [
      { id: "A", name: "Classeur Phys A", icon: "book-blue", color: "#5b8df7", maxInter: 12, interNames: { "01": "Mécanique", "02": "Thermo", "03": "Électro", "04": "Optique", "05": "Ondes" } },
      { id: "B", name: "Classeur Maths B", icon: "book-orange", color: "#f0c060", maxInter: 12, interNames: { "01": "Algèbre", "02": "Analyse", "03": "Réduction", "04": "Probas" } },
      { id: "C", name: "Classeur Chim C", icon: "book-green", color: "#50d890", maxInter: 12, interNames: { "01": "Cristallo", "02": "Cinétique", "03": "Orga", "04": "Atomistique" } },
      { id: "E", name: "Classeur Anglais", icon: "languages", color: "#e07ab3", maxInter: 6, interNames: { "01": "Vocab scientifique", "02": "Expressions" } }
    ],
    cours: cours,
    exercices: allExercices,
    devoirs: wCards
  };
})();
