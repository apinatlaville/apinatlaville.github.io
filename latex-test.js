/**
 * latex-test.js — Onglet labo : éditeur MathLive + aperçu (sandbox avant intégration cartes)
 */
(function () {
  'use strict';

  var MATHLIVE_VER = '0.110.0';
  var CDN = 'https://cdn.jsdelivr.net/npm/mathlive@' + MATHLIVE_VER;
  var UI_REV = 7;
  var _uiRev = 0;
  var _mathLivePromise = null;
  var _built = false;
  var _wired = false;
  var _mf = null;
  var _activeSection = 'maths';
  var _activeSub = 'base';
  var _spaceMode = true; /* Espace clavier → \, dans l'éditeur / le code */
  var _snipFuse = null;

  /** Palettes PC* — volets déroulants, grille dense (clic = structure, Tab pour remplir) */
  var SNIP_GROUPS = [
    {
      id: 'freq',
      label: 'Fréquents',
      items: [
        { label: 'a/b', latex: '\\frac{#0}{#1}', title: 'Fraction' },
        { label: '√', latex: '\\sqrt{#0}', title: 'Racine carrée' },
        { label: '∫', latex: '\\int_{#0}^{#1}#2\\,\\mathrm{d}#3', title: 'Intégrale définie' },
        { label: '∑', latex: '\\sum_{#0}^{#1}#2', title: 'Somme' },
        { label: 'lim', latex: '\\lim_{#0\\to#1}#2', title: 'Limite' },
        { label: 'Mat2', latex: '\\begin{pmatrix}#0&#1\\\\#2&#3\\end{pmatrix}', title: 'Matrice 2×2' },
        { label: '→u', latex: '\\overrightarrow{#0}', title: 'Vecteur (flèche au-dessus)' },
        { label: 'col2', latex: '\\begin{pmatrix}#0\\\\#1\\end{pmatrix}', title: 'Vecteur colonne 2D' },
        { label: '∂', latex: '\\frac{\\partial #0}{\\partial #1}', title: 'Dérivée partielle' },
        { label: 'ce{}', latex: '\\ce{#0}', title: 'Formule chimie mhchem' },
        { label: '≤', latex: '\\leq', title: 'Inférieur ou égal' },
        { label: 'α', latex: '\\alpha', title: 'Alpha' },
        { label: '×', latex: '\\times', title: 'Multiplication' },
        { label: '·', latex: '\\cdot', title: 'Point médian' },
        { label: '∞', latex: '\\infty', title: 'Infini' },
        { label: '→', latex: '\\rightarrow', title: 'Flèche droite' },
        { label: '⇒', latex: '\\Rightarrow', title: 'Implique' },
        { label: '≠', latex: '\\neq', title: 'Différent' },
        { label: '±', latex: '\\pm', title: 'Plus ou moins' },
        { label: '∈', latex: '\\in', title: 'Appartient' },
        { label: 'ℝ', latex: '\\mathbb{R}', title: 'Réels' },
        { label: 'sin', latex: '\\sin{#0}', title: 'Sinus' },
        { label: 'ln', latex: '\\ln{#0}', title: 'Log népérien' },
        { label: 'e^{}', latex: 'e^{#0}', title: 'Exponentielle' },
        { label: 'aⁿ', latex: '{#0}^{#1}', title: 'Puissance' },
        { label: '|·|', latex: '\\left|#0\\right|', title: 'Valeur absolue' },
        { label: '( )', latex: '\\left(#0\\right)', title: 'Parenthèses auto' },
        { label: '…', latex: '\\dots', title: 'Points de suspension' },
        { label: 'P()', latex: '\\mathbb{P}\\left(#0\\right)', title: 'Probabilité' }
      ]
    },
    {
      id: 'base',
      label: 'Bases',
      items: [
        { label: 'a/b', latex: '\\frac{#0}{#1}', title: 'Fraction' },
        { label: 'dfrac', latex: '\\dfrac{#0}{#1}', title: 'Fraction display' },
        { label: 'tfrac', latex: '\\tfrac{#0}{#1}', title: 'Fraction texte' },
        { label: '√', latex: '\\sqrt{#0}', title: 'Racine carrée' },
        { label: 'ⁿ√', latex: '\\sqrt[#0]{#1}', title: 'Racine n-ième' },
        { label: 'aⁿ', latex: '{#0}^{#1}', title: 'Puissance / exposant' },
        { label: 'aₙ', latex: '{#0}_{#1}', title: 'Indice' },
        { label: 'aₙᵐ', latex: '{#0}_{#1}^{#2}', title: 'Indice + exposant' },
        { label: '|·|', latex: '\\left|#0\\right|', title: 'Valeur absolue' },
        { label: '‖·‖', latex: '\\lVert#0\\rVert', title: 'Norme' },
        { label: '⌊⌋', latex: '\\lfloor#0\\rfloor', title: 'Partie entière inférieure' },
        { label: '⌈⌉', latex: '\\lceil#0\\rceil', title: 'Partie entière supérieure' },
        { label: '( )', latex: '\\left(#0\\right)', title: 'Parenthèses auto' },
        { label: '[ ]', latex: '\\left[#0\\right]', title: 'Crochets auto' },
        { label: '{ }', latex: '\\left\\{#0\\right\\}', title: 'Accolades auto' },
        { label: 'e^{}', latex: 'e^{#0}', title: 'Exponentielle e^x' },
        { label: '10^', latex: '10^{#0}', title: 'Puissance de 10' },
        { label: 'n!', latex: '#0!', title: 'Factorielle' },
        { label: 'C(n,k)', latex: '\\binom{#0}{#1}', title: 'Coefficient binomial' },
        { label: '√2', latex: '\\sqrt{2}', title: 'Racine de 2' },
        { label: '1/2', latex: '\\tfrac{1}{2}', title: 'Un demi' },
        { label: '1/n', latex: '\\tfrac{1}{#0}', title: 'Inverse' },
        { label: 'a/b/c', latex: '\\frac{#0}{\\frac{#1}{#2}}', title: 'Fraction complexe' },
        { label: 'over', latex: '\\overset{#0}{#1}', title: 'Au-dessus' },
        { label: 'under', latex: '\\underset{#0}{#1}', title: 'En-dessous' }
      ]
    },
    {
      id: 'analyse',
      label: 'Analyse',
      items: [
        { label: 'lim', latex: '\\lim_{#0\\to#1}#2', title: 'Limite' },
        { label: 'lim±', latex: '\\lim_{#0\\to{#1}^{#2}}#3', title: 'Limite à gauche/droite' },
        { label: 'lim sup', latex: '\\limsup_{#0}#1', title: 'Limite supérieure' },
        { label: 'lim inf', latex: '\\liminf_{#0}#1', title: 'Limite inférieure' },
        { label: "f'", latex: "{#0}'", title: 'Dérivée prime' },
        { label: "f''", latex: "{#0}''", title: 'Dérivée seconde' },
        { label: "f^{(n)}", latex: '{#0}^{(#1)}', title: 'Dérivée n-ième' },
        { label: 'df/dx', latex: '\\frac{\\mathrm{d}#0}{\\mathrm{d}#1}', title: 'Dérivée' },
        { label: 'd²f/dx²', latex: '\\frac{\\mathrm{d}^{2}#0}{\\mathrm{d}#1^{2}}', title: 'Dérivée seconde' },
        { label: 'd/dt', latex: '\\frac{\\mathrm{d}#0}{\\mathrm{d}t}', title: 'Dérivée en t' },
        { label: '∂/∂', latex: '\\frac{\\partial #0}{\\partial #1}', title: 'Dérivée partielle' },
        { label: '∂²', latex: '\\frac{\\partial^{2}#0}{\\partial #1\\,\\partial #2}', title: 'Dérivée partielle croisée' },
        { label: '∇', latex: '\\nabla', title: 'Nabla' },
        { label: '∫', latex: '\\int_{#0}^{#1}#2\\,\\mathrm{d}#3', title: 'Intégrale définie' },
        { label: '∫…', latex: '\\int#0\\,\\mathrm{d}#1', title: 'Intégrale indéfinie' },
        { label: '∬', latex: '\\iint_{#0}#1\\,\\mathrm{d}#2\\,\\mathrm{d}#3', title: 'Intégrale double' },
        { label: '∭', latex: '\\iiint_{#0}#1\\,\\mathrm{d}#2', title: 'Intégrale triple' },
        { label: '∮', latex: '\\oint_{#0}#1\\,\\mathrm{d}#2', title: 'Intégrale de circulation' },
        { label: '∯', latex: '\\oiint_{#0}#1\\,\\mathrm{d}#2', title: 'Intégrale de surface' },
        { label: '∑', latex: '\\sum_{#0}^{#1}#2', title: 'Somme' },
        { label: '∏', latex: '\\prod_{#0}^{#1}#2', title: 'Produit' },
        { label: '∑∞', latex: '\\sum_{#0}^{\\infty}#1', title: 'Série infinie' },
        { label: 'sup', latex: '\\sup_{#0}#1', title: 'Supremum' },
        { label: 'inf', latex: '\\inf_{#0}#1', title: 'Infimum' },
        { label: 'max', latex: '\\max_{#0}#1', title: 'Maximum' },
        { label: 'min', latex: '\\min_{#0}#1', title: 'Minimum' },
        { label: 'argmax', latex: '\\arg\\max_{#0}#1', title: 'Argmax' },
        { label: 'argmin', latex: '\\arg\\min_{#0}#1', title: 'Argmin' },
        { label: '∞', latex: '\\infty', title: 'Infini' },
        { label: '∼', latex: '\\sim', title: 'Équivalent' },
        { label: '≪', latex: '\\ll', title: 'Négligeable devant' },
        { label: '≫', latex: '\\gg', title: 'Dominant devant' },
        { label: 'O()', latex: '\\mathcal{O}\\left(#0\\right)', title: 'Grand O' },
        { label: 'o()', latex: 'o\\left(#0\\right)', title: 'Petit o' },
        { label: '∂Ω', latex: '\\partial#0', title: 'Frontière' },
        { label: 'Cⁿ', latex: '\\mathcal{C}^{#0}', title: 'Classe C^n' },
        { label: 'L²', latex: 'L^{2}\\left(#0\\right)', title: 'Espace L²' }
      ]
    },
    {
      id: 'vecteurs',
      label: 'Vecteurs',
      items: [
        { label: '→u', latex: '\\overrightarrow{#0}', title: 'Vecteur — flèche au-dessus (recommandé)' },
        { label: '→AB', latex: '\\overrightarrow{#0}', title: 'Vecteur nommé (AB, OM, u…)' },
        { label: 'u⃗', latex: '\\vec{#0}', title: 'Flèche courte — 1 caractère seulement' },
        { label: 'bold u', latex: '\\mathbf{#0}', title: 'Vecteur en gras' },
        { label: 'col 2', latex: '\\begin{pmatrix}#0\\\\#1\\end{pmatrix}', title: 'Vecteur colonne 2D (x ; y)' },
        { label: 'col 3', latex: '\\begin{pmatrix}#0\\\\#1\\\\#2\\end{pmatrix}', title: 'Vecteur colonne 3D (x ; y ; z)' },
        { label: 'ligne 2', latex: '\\begin{pmatrix}#0&#1\\end{pmatrix}', title: 'Vecteur ligne 2D (x y)' },
        { label: 'OM', latex: '\\overrightarrow{OM}', title: 'Vecteur position OM' },
        { label: 'AB', latex: '\\overrightarrow{AB}', title: 'Vecteur AB' },
        { label: 'i,j,k', latex: '\\vec{i},\\,\\vec{j},\\,\\vec{k}', title: 'Base canonique ℝ³' },
        { label: 'u·v', latex: '#0\\cdot#1', title: 'Produit scalaire' },
        { label: 'u×v', latex: '#0\\times#1', title: 'Produit vectoriel' },
        { label: '‖u‖', latex: '\\lVert#0\\rVert', title: 'Norme d\'un vecteur' },
        { label: '⟨u|v⟩', latex: '\\langle#0\\mid#1\\rangle', title: 'Produit scalaire ⟨·|·⟩' },
        { label: 'proj', latex: '\\mathrm{proj}_{#0}\\left(#1\\right)', title: 'Projection sur un vecteur' },
        { label: 'det u,v', latex: '\\det\\left(#0,#1\\right)', title: 'Déterminant (2 vecteurs du plan)' },
        { label: 'M·v', latex: '#0\\,#1', title: 'Matrice × vecteur (espace fin)' },
        { label: 'λu', latex: '#0\\,#1', title: 'Scalaire × vecteur' },
        { label: 'u+v', latex: '#0+#1', title: 'Somme de vecteurs' },
        { label: 'u-v', latex: '#0-#1', title: 'Différence de vecteurs' },
        { label: '∥', latex: '#0\\parallel#1', title: 'Vecteurs parallèles' },
        { label: '⊥', latex: '#0\\perp#1', title: 'Vecteurs orthogonaux' }
      ]
    },
    {
      id: 'algebre',
      label: 'Algèbre',
      items: [
        { label: 'Mat 2×2', latex: '\\begin{pmatrix}#0&#1\\\\#2&#3\\end{pmatrix}', title: 'Matrice 2×2' },
        { label: 'Mat 3×3', latex: '\\begin{pmatrix}#0&#1&#2\\\\#3&#4&#5\\\\#6&#7&#8\\end{pmatrix}', title: 'Matrice 3×3' },
        { label: 'bmatrix', latex: '\\begin{bmatrix}#0&#1\\\\#2&#3\\end{bmatrix}', title: 'Matrice crochets' },
        { label: 'det', latex: '\\begin{vmatrix}#0&#1\\\\#2&#3\\end{vmatrix}', title: 'Déterminant 2×2' },
        { label: 'det3', latex: '\\begin{vmatrix}#0&#1&#2\\\\#3&#4&#5\\\\#6&#7&#8\\end{vmatrix}', title: 'Déterminant 3×3' },
        { label: 'Syst.2', latex: '\\begin{cases}#0\\\\#1\\end{cases}', title: 'Système 2 eq.' },
        { label: 'Syst.3', latex: '\\begin{cases}#0\\\\#1\\\\#2\\end{cases}', title: 'Système 3 eq.' },
        { label: '→u', latex: '\\overrightarrow{#0}', title: 'Vecteur (voir onglet Vecteurs)' },
        { label: 'col 2', latex: '\\begin{pmatrix}#0\\\\#1\\end{pmatrix}', title: 'Vecteur colonne 2D' },
        { label: 'â', latex: '\\hat{#0}', title: 'Chapeau' },
        { label: 'Ā', latex: '\\overline{#0}', title: 'Barre / conjugué' },
        { label: 'A̲', latex: '\\underline{#0}', title: 'Souligné' },
        { label: 'bold', latex: '\\mathbf{#0}', title: 'Gras' },
        { label: 'A^T', latex: '{#0}^{\\mathsf{T}}', title: 'Transposée' },
        { label: 'A⁻¹', latex: '{#0}^{-1}', title: 'Inverse' },
        { label: 'span', latex: '\\mathrm{Span}\\left(#0\\right)', title: 'Espace engendré' },
        { label: 'ker', latex: '\\ker\\left(#0\\right)', title: 'Noyau' },
        { label: 'Im', latex: '\\mathrm{Im}\\left(#0\\right)', title: 'Image' },
        { label: 'dim', latex: '\\dim\\left(#0\\right)', title: 'Dimension' },
        { label: 'rg', latex: '\\mathrm{rg}\\left(#0\\right)', title: 'Rang' },
        { label: 'tr', latex: '\\mathrm{tr}\\left(#0\\right)', title: 'Trace' },
        { label: '⊕', latex: '#0\\oplus#1', title: 'Somme directe' },
        { label: '⊗', latex: '#0\\otimes#1', title: 'Produit tensoriel' },
        { label: 'λ', latex: '\\lambda', title: 'Valeur propre' },
        { label: 'I', latex: 'I_{#0}', title: 'Identité' },
        { label: 'I₃', latex: 'I_3', title: 'Identité 3×3' },
        { label: '⟨·|·⟩', latex: '\\langle#0\\mid#1\\rangle', title: 'Produit scalaire' },
        { label: '‖·‖', latex: '\\lVert#0\\rVert', title: 'Norme' },
        { label: '⊥', latex: '#0^{\\perp}', title: 'Orthogonal' },
        { label: 'V/W', latex: '#0/#1', title: 'Quotient' },
        { label: 'GL', latex: 'GL_{#0}\\left(#1\\right)', title: 'Groupe linéaire' },
        { label: 'SL', latex: 'SL_{#0}\\left(#1\\right)', title: 'Groupe spécial linéaire' },
        { label: 'M_n', latex: '\\mathcal{M}_{#0}\\left(#1\\right)', title: 'Matrices n×n' },
        { label: 'End', latex: '\\mathrm{End}\\left(#0\\right)', title: 'Endomorphismes' },
        { label: 'Aut', latex: '\\mathrm{Aut}\\left(#0\\right)', title: 'Automorphismes' },
        { label: 'Spec', latex: '\\mathrm{Sp}\\left(#0\\right)', title: 'Spectre' },
        { label: 'diag', latex: '\\mathrm{diag}\\left(#0\\right)', title: 'Matrice diagonale' }
      ]
    },
    {
      id: 'grec',
      label: 'Grec',
      items: [
        { label: 'α', latex: '\\alpha', title: 'Alpha minuscule' },
        { label: 'β', latex: '\\beta', title: 'Beta minuscule' },
        { label: 'γ', latex: '\\gamma', title: 'Gamma minuscule' },
        { label: 'δ', latex: '\\delta', title: 'Delta minuscule' },
        { label: 'ε', latex: '\\epsilon', title: 'Epsilon' },
        { label: 'ϵ', latex: '\\varepsilon', title: 'Epsilon variante' },
        { label: 'ζ', latex: '\\zeta', title: 'Zêta' },
        { label: 'η', latex: '\\eta', title: 'Êta' },
        { label: 'θ', latex: '\\theta', title: 'Thêta' },
        { label: 'ϑ', latex: '\\vartheta', title: 'Thêta variante' },
        { label: 'ι', latex: '\\iota', title: 'Iota' },
        { label: 'κ', latex: '\\kappa', title: 'Kappa' },
        { label: 'λ', latex: '\\lambda', title: 'Lambda minuscule' },
        { label: 'μ', latex: '\\mu', title: 'Mu' },
        { label: 'ν', latex: '\\nu', title: 'Nu' },
        { label: 'ξ', latex: '\\xi', title: 'Xi minuscule' },
        { label: 'π', latex: '\\pi', title: 'Pi minuscule' },
        { label: 'ϖ', latex: '\\varpi', title: 'Pi variante' },
        { label: 'ρ', latex: '\\rho', title: 'Rho' },
        { label: 'ϱ', latex: '\\varrho', title: 'Rho variante' },
        { label: 'σ', latex: '\\sigma', title: 'Sigma minuscule' },
        { label: 'ς', latex: '\\varsigma', title: 'Sigma final' },
        { label: 'τ', latex: '\\tau', title: 'Tau' },
        { label: 'υ', latex: '\\upsilon', title: 'Upsilon minuscule' },
        { label: 'φ', latex: '\\phi', title: 'Phi' },
        { label: 'ϕ', latex: '\\varphi', title: 'Phi variante' },
        { label: 'χ', latex: '\\chi', title: 'Chi' },
        { label: 'ψ', latex: '\\psi', title: 'Psi minuscule' },
        { label: 'ω', latex: '\\omega', title: 'Oméga minuscule' },
        { label: 'Γ', latex: '\\Gamma', title: 'Gamma majuscule' },
        { label: 'Δ', latex: '\\Delta', title: 'Delta majuscule' },
        { label: 'Θ', latex: '\\Theta', title: 'Thêta majuscule' },
        { label: 'Λ', latex: '\\Lambda', title: 'Lambda majuscule' },
        { label: 'Ξ', latex: '\\Xi', title: 'Xi majuscule' },
        { label: 'Π', latex: '\\Pi', title: 'Pi majuscule' },
        { label: 'Σ', latex: '\\Sigma', title: 'Sigma majuscule' },
        { label: 'Υ', latex: '\\Upsilon', title: 'Upsilon majuscule' },
        { label: 'Φ', latex: '\\Phi', title: 'Phi majuscule' },
        { label: 'Ψ', latex: '\\Psi', title: 'Psi majuscule' },
        { label: 'Ω', latex: '\\Omega', title: 'Oméga majuscule' },
        { label: '∇', latex: '\\nabla', title: 'Nabla' },
        { label: '∂', latex: '\\partial', title: 'Partielle' },
        { label: 'ℏ', latex: '\\hbar', title: 'h barre' },
        { label: 'ℓ', latex: '\\ell', title: 'ell script' },
        { label: '℘', latex: '\\wp', title: 'Weierstrass p' },
        { label: 'Re', latex: '\\Re', title: 'Partie réelle' },
        { label: 'Im', latex: '\\Im', title: 'Partie imaginaire' }
      ]
    },
    {
      id: 'accents',
      label: 'Accents',
      items: [
        { label: 'â', latex: '\\hat{#0}', title: 'Chapeau' },
        { label: 'check', latex: '\\check{#0}', title: 'Caron / check' },
        { label: 'ã', latex: '\\tilde{#0}', title: 'Tilde' },
        { label: 'ā', latex: '\\bar{#0}', title: 'Barre' },
        { label: 'u⃗', latex: '\\vec{#0}', title: 'Flèche courte (1 caractère)' },
        { label: '→', latex: '\\overrightarrow{#0}', title: 'Flèche vecteur (recommandé)' },
        { label: '←', latex: '\\overleftarrow{#0}', title: 'Flèche gauche' },
        { label: '↔', latex: '\\overleftrightarrow{#0}', title: 'Double flèche' },
        { label: 'ẋ', latex: '\\dot{#0}', title: 'Point' },
        { label: 'ẍ', latex: '\\ddot{#0}', title: 'Double point' },
        { label: '…', latex: '\\dddot{#0}', title: 'Triple point' },
        { label: 'breve', latex: '\\breve{#0}', title: 'Brève' },
        { label: 'acute', latex: '\\acute{#0}', title: 'Aigu' },
        { label: 'grave', latex: '\\grave{#0}', title: 'Grave' },
        { label: 'ring', latex: '\\mathring{#0}', title: 'Rond' },
        { label: 'wide', latex: '\\widehat{#0}', title: 'Chapeau large' },
        { label: 'widetilde', latex: '\\widetilde{#0}', title: 'Tilde large' },
        { label: 'overline', latex: '\\overline{#0}', title: 'Ligne au-dessus' },
        { label: 'underline', latex: '\\underline{#0}', title: 'Souligné' },
        { label: 'underbrace', latex: '\\underbrace{#0}_{#1}', title: 'Accolade sous' },
        { label: 'overbrace', latex: '\\overbrace{#0}^{#1}', title: 'Accolade sur' },
        { label: 'text', latex: '\\text{#0}', title: 'Texte en mode math' }
      ]
    },
    {
      id: 'ops',
      label: 'Opérateurs',
      items: [
        { label: '+', latex: '+', title: 'Plus' },
        { label: '−', latex: '-', title: 'Moins' },
        { label: '±', latex: '\\pm', title: 'Plus ou moins' },
        { label: '∓', latex: '\\mp', title: 'Moins ou plus' },
        { label: '×', latex: '\\times', title: 'Multiplication' },
        { label: '÷', latex: '\\div', title: 'Division' },
        { label: '·', latex: '\\cdot', title: 'Point médian' },
        { label: '∗', latex: '\\ast', title: 'Astérisque' },
        { label: '⋆', latex: '\\star', title: 'Étoile' },
        { label: '∘', latex: '\\circ', title: 'Composition' },
        { label: '⊕', latex: '\\oplus', title: 'Somme directe' },
        { label: '⊖', latex: '\\ominus', title: 'Différence circulaire' },
        { label: '⊗', latex: '\\otimes', title: 'Produit tensoriel' },
        { label: '⊘', latex: '\\oslash', title: 'Division circulaire' },
        { label: '⊙', latex: '\\odot', title: 'Point circulaire' },
        { label: '∪', latex: '\\cup', title: 'Union' },
        { label: '∩', latex: '\\cap', title: 'Intersection' },
        { label: '∨', latex: '\\vee', title: 'Ou logique' },
        { label: '∧', latex: '\\wedge', title: 'Et logique' },
        { label: '∖', latex: '\\setminus', title: 'Différence ensembliste' },
        { label: '⊎', latex: '\\uplus', title: 'Union disjointe' },
        { label: '⊔', latex: '\\sqcup', title: 'Union carrée' },
        { label: '⊓', latex: '\\sqcap', title: 'Intersection carrée' },
        { label: '⋃', latex: '\\bigcup_{#0}^{#1}#2', title: 'Grande union' },
        { label: '⋂', latex: '\\bigcap_{#0}^{#1}#2', title: 'Grande intersection' },
        { label: '⋁', latex: '\\bigvee_{#0}^{#1}#2', title: 'Grand ou' },
        { label: '⋀', latex: '\\bigwedge_{#0}^{#1}#2', title: 'Grand et' },
        { label: '∐', latex: '\\coprod_{#0}^{#1}#2', title: 'Coproduit' },
        { label: '∫op', latex: '\\int', title: 'Intégrale (symbole)' },
        { label: '∑op', latex: '\\sum', title: 'Somme (symbole)' },
        { label: '∏op', latex: '\\prod', title: 'Produit (symbole)' },
        { label: '√op', latex: '\\sqrt{#0}', title: 'Racine (opérateur)' }
      ]
    },
    {
      id: 'relations',
      label: 'Relations',
      items: [
        { label: '=', latex: '=', title: 'Égal' },
        { label: '≠', latex: '\\neq', title: 'Différent' },
        { label: '≡', latex: '\\equiv', title: 'Congruent' },
        { label: '≈', latex: '\\approx', title: 'Approximativement égal' },
        { label: '≃', latex: '\\simeq', title: 'Asymptotiquement égal' },
        { label: '≅', latex: '\\cong', title: 'Isomorphe' },
        { label: '∼', latex: '\\sim', title: 'Distribué comme' },
        { label: '∝', latex: '\\propto', title: 'Proportionnel' },
        { label: '<', latex: '<', title: 'Strictement inférieur' },
        { label: '>', latex: '>', title: 'Strictement supérieur' },
        { label: '≤', latex: '\\leq', title: 'Inférieur ou égal' },
        { label: '≥', latex: '\\geq', title: 'Supérieur ou égal' },
        { label: '≪', latex: '\\ll', title: 'Très inférieur' },
        { label: '≫', latex: '\\gg', title: 'Très supérieur' },
        { label: '⊂', latex: '\\subset', title: 'Inclus strict' },
        { label: '⊃', latex: '\\supset', title: 'Contient strict' },
        { label: '⊆', latex: '\\subseteq', title: 'Inclus' },
        { label: '⊇', latex: '\\supseteq', title: 'Contient' },
        { label: '⊊', latex: '\\subsetneq', title: 'Inclus strict (trait)' },
        { label: '∈', latex: '\\in', title: 'Appartient' },
        { label: '∉', latex: '\\notin', title: 'N\'appartient pas' },
        { label: '∋', latex: '\\ni', title: 'Contient (élément)' },
        { label: '∌', latex: '\\not\\ni', title: 'Ne contient pas' },
        { label: '∅', latex: '\\emptyset', title: 'Ensemble vide' },
        { label: '∀', latex: '\\forall', title: 'Pour tout' },
        { label: '∃', latex: '\\exists', title: 'Il existe' },
        { label: '∄', latex: '\\nexists', title: 'Il n\'existe pas' },
        { label: '⊥', latex: '\\perp', title: 'Orthogonal' },
        { label: '∥', latex: '\\parallel', title: 'Parallèle' },
        { label: '∦', latex: '\\nparallel', title: 'Non parallèle' },
        { label: '⊢', latex: '\\vdash', title: 'Prouve / satisfait' },
        { label: '⊨', latex: '\\models', title: 'Modèle / valide' },
        { label: '≺', latex: '\\prec', title: 'Précède' },
        { label: '≻', latex: '\\succ', title: 'Suit' },
        { label: '≼', latex: '\\preceq', title: 'Précède ou égal' },
        { label: '≽', latex: '\\succeq', title: 'Suit ou égal' },
        { label: '∼R', latex: '#0\\sim#1', title: 'Relation d\'équivalence' },
        { label: '≈R', latex: '#0\\approx#1', title: 'Approximation' },
        { label: 'def', latex: '\\stackrel{\\mathrm{def}}{=}', title: 'Défini par' },
        { label: ':=', latex: ':=', title: 'Est défini par' }
      ]
    },
    {
      id: 'fleches',
      label: 'Flèches',
      items: [
        { label: '→', latex: '\\rightarrow', title: 'Flèche droite' },
        { label: '←', latex: '\\leftarrow', title: 'Flèche gauche' },
        { label: '↔', latex: '\\leftrightarrow', title: 'Double flèche' },
        { label: '⟶', latex: '\\longrightarrow', title: 'Longue droite' },
        { label: '⟵', latex: '\\longleftarrow', title: 'Longue gauche' },
        { label: '⟷', latex: '\\longleftrightarrow', title: 'Longue double' },
        { label: '⇒', latex: '\\Rightarrow', title: 'Implique' },
        { label: '⇐', latex: '\\Leftarrow', title: 'Impliqué par' },
        { label: '⇔', latex: '\\Leftrightarrow', title: 'Équivalence' },
        { label: '⟹', latex: '\\Longrightarrow', title: 'Longue implique' },
        { label: '⟸', latex: '\\Longleftarrow', title: 'Longue impliqué par' },
        { label: '⟺', latex: '\\Longleftrightarrow', title: 'Longue équivalence' },
        { label: '↑', latex: '\\uparrow', title: 'Flèche haut' },
        { label: '↓', latex: '\\downarrow', title: 'Flèche bas' },
        { label: '↕', latex: '\\updownarrow', title: 'Flèche haut-bas' },
        { label: '↦', latex: '\\mapsto', title: 'Application / mapsto' },
        { label: '↪', latex: '\\hookrightarrow', title: 'Injection' },
        { label: '↩', latex: '\\hookleftarrow', title: 'Injection gauche' },
        { label: '↣', latex: '\\rightarrowtail', title: 'Injection droite' },
        { label: '↢', latex: '\\leftarrowtail', title: 'Injection gauche queue' },
        { label: '↠', latex: '\\twoheadrightarrow', title: 'Surjection' },
        { label: '↞', latex: '\\twoheadleftarrow', title: 'Surjection gauche' },
        { label: '⟶ᵏ', latex: '\\xrightarrow{#0}', title: 'Flèche avec label dessus' },
        { label: '⟵ᵏ', latex: '\\xleftarrow{#0}', title: 'Flèche gauche label dessus' },
        { label: '⇀', latex: '\\rightharpoonup', title: 'Harpon droit haut' },
        { label: '⇁', latex: '\\rightharpoondown', title: 'Harpon droit bas' },
        { label: '↼', latex: '\\leftharpoonup', title: 'Harpon gauche haut' },
        { label: '↽', latex: '\\leftharpoondown', title: 'Harpon gauche bas' },
        { label: '⇌', latex: '\\rightleftharpoons', title: 'Équilibre chimique' },
        { label: '⇋', latex: '\\leftrightharpoons', title: 'Équilibre inverse' },
        { label: '↗', latex: '\\nearrow', title: 'Nord-est' },
        { label: '↘', latex: '\\searrow', title: 'Sud-est' },
        { label: '↙', latex: '\\swarrow', title: 'Sud-ouest' },
        { label: '↖', latex: '\\nwarrow', title: 'Nord-ouest' },
        { label: '⟼', latex: '\\longmapsto', title: 'Long mapsto' },
        { label: '↪f', latex: '#0\\hookrightarrow#1', title: 'Injection nommée' }
      ]
    },
    {
      id: 'ensembles',
      label: 'Ensembles',
      items: [
        { label: 'ℕ', latex: '\\mathbb{N}', title: 'Entiers naturels' },
        { label: 'ℤ', latex: '\\mathbb{Z}', title: 'Entiers relatifs' },
        { label: 'ℚ', latex: '\\mathbb{Q}', title: 'Rationnels' },
        { label: 'ℝ', latex: '\\mathbb{R}', title: 'Réels' },
        { label: 'ℂ', latex: '\\mathbb{C}', title: 'Complexes' },
        { label: '∅', latex: '\\emptyset', title: 'Ensemble vide' },
        { label: '𝒫', latex: '\\mathcal{P}\\left(#0\\right)', title: 'Parties' },
        { label: '×', latex: '#0\\times#1', title: 'Produit cartésien' },
        { label: '∖', latex: '#0\\setminus#1', title: 'Complémentaire' },
        { label: '∪', latex: '#0\\cup#1', title: 'Union' },
        { label: '∩', latex: '#0\\cap#1', title: 'Intersection' },
        { label: '⊂', latex: '#0\\subset#1', title: 'Inclus' },
        { label: '⊆', latex: '#0\\subseteq#1', title: 'Inclus ou égal' },
        { label: '∈', latex: '#0\\in#1', title: 'Appartient' },
        { label: '∉', latex: '#0\\notin#1', title: 'N\'appartient pas' },
        { label: '{x|…}', latex: '\\left\\{#0\\mid#1\\right\\}', title: 'Ensemble par extension' },
        { label: '{x:…}', latex: '\\left\\{#0:#1\\right\\}', title: 'Ensemble ( deux-points )' },
        { label: 'card', latex: '\\mathrm{card}\\left(#0\\right)', title: 'Cardinal' },
        { label: '#', latex: '\\#', title: 'Cardinal (sharp)' },
        { label: 'U', latex: 'U', title: 'Univers' },
        { label: 'F', latex: '\\mathbb{F}_{#0}', title: 'Corps fini' },
        { label: 'K', latex: 'K', title: 'Corps' },
        { label: 'GL_n', latex: 'GL_n\\left(#0\\right)', title: 'Groupe linéaire' },
        { label: 'O_n', latex: 'O_n\\left(#0\\right)', title: 'Groupe orthogonal' },
        { label: 'SO_n', latex: 'SO_n\\left(#0\\right)', title: 'Groupe spécial orthogonal' },
        { label: 'A\\B', latex: '#0\\backslash#1', title: 'Différence' },
        { label: 'compl', latex: '#0^{c}', title: 'Complément' },
        { label: 'overline', latex: '\\overline{#0}', title: 'Adhérence / fermeture' }
      ]
    },
    {
      id: 'fonctions',
      label: 'Fonctions',
      items: [
        { label: 'sin', latex: '\\sin{#0}', title: 'Sinus' },
        { label: 'cos', latex: '\\cos{#0}', title: 'Cosinus' },
        { label: 'tan', latex: '\\tan{#0}', title: 'Tangente' },
        { label: 'cot', latex: '\\cot{#0}', title: 'Cotangente' },
        { label: 'sec', latex: '\\sec{#0}', title: 'Sécante' },
        { label: 'csc', latex: '\\csc{#0}', title: 'Cosécante' },
        { label: 'arcsin', latex: '\\arcsin{#0}', title: 'Arc sinus' },
        { label: 'arccos', latex: '\\arccos{#0}', title: 'Arc cosinus' },
        { label: 'arctan', latex: '\\arctan{#0}', title: 'Arc tangente' },
        { label: 'sinh', latex: '\\sinh{#0}', title: 'Sinus hyperbolique' },
        { label: 'cosh', latex: '\\cosh{#0}', title: 'Cosinus hyperbolique' },
        { label: 'tanh', latex: '\\tanh{#0}', title: 'Tangente hyperbolique' },
        { label: 'ln', latex: '\\ln{#0}', title: 'Logarithme népérien' },
        { label: 'log', latex: '\\log{#0}', title: 'Logarithme' },
        { label: 'log_b', latex: '\\log_{#0}{#1}', title: 'Logarithme base b' },
        { label: 'lg', latex: '\\lg{#0}', title: 'Log base 10' },
        { label: 'exp', latex: '\\exp\\left(#0\\right)', title: 'Exponentielle' },
        { label: 'e^', latex: 'e^{#0}', title: 'e puissance' },
        { label: 'det', latex: '\\det\\left(#0\\right)', title: 'Déterminant' },
        { label: 'tr', latex: '\\mathrm{tr}\\left(#0\\right)', title: 'Trace' },
        { label: 'rg', latex: '\\mathrm{rg}\\left(#0\\right)', title: 'Rang' },
        { label: 'Re', latex: '\\Re\\left(#0\\right)', title: 'Partie réelle' },
        { label: 'Im', latex: '\\Im\\left(#0\\right)', title: 'Partie imaginaire' },
        { label: 'arg', latex: '\\arg\\left(#0\\right)', title: 'Argument' },
        { label: 'gcd', latex: '\\gcd\\left(#0,#1\\right)', title: 'PGCD' },
        { label: 'lcm', latex: '\\mathrm{lcm}\\left(#0,#1\\right)', title: 'PPCM' },
        { label: 'deg', latex: '\\deg\\left(#0\\right)', title: 'Degré' },
        { label: 'ord', latex: '\\mathrm{ord}\\left(#0\\right)', title: 'Ordre' },
        { label: 'sign', latex: '\\mathrm{sign}\\left(#0\\right)', title: 'Signe' },
        { label: 'sup f', latex: '\\sup_{#0}#1', title: 'Supremum fonction' },
        { label: 'inf f', latex: '\\inf_{#0}#1', title: 'Infimum fonction' },
        { label: 'id', latex: '\\mathrm{id}_{#0}', title: 'Identité' },
        { label: '1_{}', latex: '\\mathbf{1}_{#0}', title: 'Fonction indicatrice' }
      ]
    },
    {
      id: 'physique',
      label: 'Physique',
      items: [
        { label: 'd/dt', latex: '\\frac{\\mathrm{d}#0}{\\mathrm{d}t}', title: 'Dérivée temporelle' },
        { label: '∂/∂t', latex: '\\frac{\\partial #0}{\\partial t}', title: 'Dérivée partielle t' },
        { label: 'ẋ', latex: '\\dot{#0}', title: 'Point (Newton)' },
        { label: 'ẍ', latex: '\\ddot{#0}', title: 'Double point' },
        { label: 'grad', latex: '\\overrightarrow{\\mathrm{grad}}\\,#0', title: 'Gradient' },
        { label: 'div', latex: '\\mathrm{div}\\,#0', title: 'Divergence' },
        { label: 'rot', latex: '\\overrightarrow{\\mathrm{rot}}\\,#0', title: 'Rotationnel' },
        { label: 'Δ', latex: '\\Delta#0', title: 'Laplacien' },
        { label: '∇²', latex: '\\nabla^{2}#0', title: 'Laplacien (nabla²)' },
        { label: '→F', latex: '\\overrightarrow{#0}', title: 'Vecteur' },
        { label: '×', latex: '\\times', title: 'Produit vectoriel' },
        { label: '·', latex: '\\cdot', title: 'Produit scalaire' },
        { label: '≈', latex: '\\approx', title: 'Environ' },
        { label: '∝', latex: '\\propto', title: 'Proportionnel' },
        { label: '≪', latex: '\\ll', title: 'Très inférieur' },
        { label: '≫', latex: '\\gg', title: 'Très supérieur' },
        { label: '∼', latex: '\\sim', title: 'Ordre de grandeur' },
        { label: 'ℏ', latex: '\\hbar', title: 'Constante de Planck réduite' },
        { label: '⟨ψ|', latex: '\\langle#0|', title: 'Bra' },
        { label: '|ψ⟩', latex: '|#0\\rangle', title: 'Ket' },
        { label: '⟨ψ|φ⟩', latex: '\\langle#0|#1\\rangle', title: 'Braket' },
        { label: 'Å', latex: '\\mathrm{\\AA}', title: 'Angström' },
        { label: '°', latex: '{}^{\\circ}', title: 'Degré' },
        { label: 'm/s', latex: '\\mathrm{m\\,s^{-1}}', title: 'Vitesse SI' },
        { label: 'kg', latex: '\\mathrm{kg}', title: 'Kilogramme' },
        { label: 'J', latex: '\\mathrm{J}', title: 'Joule' },
        { label: 'N', latex: '\\mathrm{N}', title: 'Newton' },
        { label: 'Pa', latex: '\\mathrm{Pa}', title: 'Pascal' },
        { label: 'W', latex: '\\mathrm{W}', title: 'Watt' },
        { label: 'V', latex: '\\mathrm{V}', title: 'Volt' },
        { label: 'A', latex: '\\mathrm{A}', title: 'Ampère' },
        { label: 'Ω', latex: '\\Omega', title: 'Ohm' },
        { label: 'c', latex: 'c', title: 'Vitesse de la lumière' },
        { label: 'G', latex: 'G', title: 'Constante gravitation' },
        { label: 'ε₀', latex: '\\varepsilon_0', title: 'Permittivité du vide' },
        { label: 'μ₀', latex: '\\mu_0', title: 'Perméabilité du vide' }
      ]
    },
    {
      id: 'chimie',
      label: 'Chimie',
      items: [
        { label: 'ce{}', latex: '\\ce{#0}', title: 'Formule mhchem (H2O, Fe2+, …)' },
        { label: '→', latex: '\\longrightarrow', title: 'Réaction' },
        { label: '⇌', latex: '\\rightleftharpoons', title: 'Équilibre' },
        { label: '⟶ᵏ', latex: '\\xrightarrow{#0}', title: 'Flèche avec condition dessus' },
        { label: '⇄', latex: '\\xrightleftharpoons[#0]{#1}', title: 'Équilibre annoté' },
        { label: '↑', latex: '\\uparrow', title: 'Gaz dégagé' },
        { label: '↓', latex: '\\downarrow', title: 'Précipité' },
        { label: 'Δ', latex: '\\Delta', title: 'Chaleur / variation' },
        { label: 'Δ_rH', latex: '\\Delta_{\\mathrm{r}}H', title: 'Enthalpie de réaction' },
        { label: '°C', latex: '{}^{\\circ}\\mathrm{C}', title: 'Degré Celsius' },
        { label: 'aq', latex: '(\\mathrm{aq})', title: 'Aqueux' },
        { label: 's', latex: '(\\mathrm{s})', title: 'Solide' },
        { label: 'l', latex: '(\\mathrm{l})', title: 'Liquide' },
        { label: 'g', latex: '(\\mathrm{g})', title: 'Gazeux' },
        { label: 'pH', latex: '\\mathrm{pH}', title: 'pH' },
        { label: 'pKa', latex: '\\mathrm{p}K_{\\mathrm{a}}', title: 'pKa' },
        { label: 'K', latex: 'K_{#0}', title: 'Constante (K_a, K_éq…)' },
        { label: 'K_eq', latex: 'K_{\\mathrm{eq}}', title: 'Constante d\'équilibre' },
        { label: '½', latex: '\\tfrac{1}{2}', title: 'Un demi (stœchio)' },
        { label: 'e⁻', latex: 'e^{-}', title: 'Électron' },
        { label: 'H⁺', latex: '\\mathrm{H}^{+}', title: 'Proton' },
        { label: 'OH⁻', latex: '\\mathrm{OH}^{-}', title: 'Ion hydroxyde' },
        { label: 'n⁰', latex: 'n^{0}', title: 'Neutron' },
        { label: 'p⁺', latex: 'p^{+}', title: 'Proton (particule)' },
        { label: 'mol', latex: '\\mathrm{mol}', title: 'Mole' },
        { label: 'M', latex: '\\mathrm{M}', title: 'Molarité' },
        { label: 'g/mol', latex: '\\mathrm{g\\,mol^{-1}}', title: 'Masse molaire' },
        { label: 'ΔG', latex: '\\Delta G', title: 'Enthalpie libre' },
        { label: 'ΔS', latex: '\\Delta S', title: 'Variation entropie' },
        { label: 'E°', latex: 'E^{\\circ}', title: 'Potentiel standard' },
        { label: '⇀', latex: '\\ce{#0 -> #1}', title: 'Réaction mhchem A → B' },
        { label: '⇌ce', latex: '\\ce{#0 <=> #1}', title: 'Équilibre mhchem' },
        { label: 'cat', latex: '\\xrightarrow[\\text{#0}]{\\text{#1}}', title: 'Catalyseur / conditions' }
      ]
    },
    {
      id: 'proba',
      label: 'Probas',
      items: [
        { label: 'P()', latex: '\\mathbb{P}\\left(#0\\right)', title: 'Probabilité' },
        { label: 'P(A|B)', latex: '\\mathbb{P}\\left(#0\\mid#1\\right)', title: 'Probabilité conditionnelle' },
        { label: 'E[]', latex: '\\mathbb{E}\\left[#0\\right]', title: 'Espérance' },
        { label: 'E[X|Y]', latex: '\\mathbb{E}\\left[#0\\mid#1\\right]', title: 'Espérance conditionnelle' },
        { label: 'V()', latex: '\\mathbb{V}\\left(#0\\right)', title: 'Variance' },
        { label: 'Var', latex: '\\mathrm{Var}\\left(#0\\right)', title: 'Variance (Var)' },
        { label: 'Cov', latex: '\\mathrm{Cov}\\left(#0,#1\\right)', title: 'Covariance' },
        { label: 'Corr', latex: '\\mathrm{Corr}\\left(#0,#1\\right)', title: 'Corrélation' },
        { label: '∼', latex: '#0\\sim#1', title: 'Loi / distribué comme' },
        { label: '≈', latex: '#0\\approx#1', title: 'Approximation en loi' },
        { label: '⊥', latex: '#0\\perp#1', title: 'Indépendance' },
        { label: '⊥⊥', latex: '#0\\perp\\!\\!\\!\\perp#1', title: 'Indépendance forte' },
        { label: 'Bin', latex: '\\mathcal{B}\\left(#0,#1\\right)', title: 'Loi binomiale' },
        { label: 'Pois', latex: '\\mathcal{P}\\left(#0\\right)', title: 'Loi de Poisson' },
        { label: 'N(μ,σ²)', latex: '\\mathcal{N}\\left(#0,#1\\right)', title: 'Loi normale' },
        { label: 'U[a,b]', latex: '\\mathcal{U}\\left[#0,#1\\right]', title: 'Loi uniforme' },
        { label: 'Exp', latex: '\\mathcal{E}\\left(#0\\right)', title: 'Loi exponentielle' },
        { label: 'Gamma', latex: '\\Gamma\\left(#0,#1\\right)', title: 'Loi gamma' },
        { label: 'χ²', latex: '\\chi^{2}\\left(#0\\right)', title: 'Loi du chi-deux' },
        { label: 't', latex: 't_{#0}', title: 'Loi de Student' },
        { label: 'F', latex: 'F_{#0,#1}', title: 'Loi de Fisher' },
        { label: 'i.i.d.', latex: '\\mathrm{i.i.d.}', title: 'Indépendants identiquement distribués' },
        { label: 'a.s.', latex: '\\mathrm{a.s.}', title: 'Presque sûrement' },
        { label: 'L²', latex: 'L^{2}\\left(#0\\right)', title: 'Convergence L²' },
        { label: 'P→', latex: '\\xrightarrow{\\mathbb{P}}', title: 'Convergence en probabilité' },
        { label: 'd→', latex: '\\xrightarrow{d}', title: 'Convergence en loi' },
        { label: 'σ-alg', latex: '\\sigma\\left(#0\\right)', title: 'Tribu engendrée' },
        { label: 'Filtration', latex: '\\mathcal{F}_{#0}', title: 'Filtration' },
        { label: '1_{A}', latex: '\\mathbf{1}_{#0}', title: 'Indicatrice' },
        { label: '|', latex: '\\mid', title: 'Conditionnel (barre)' }
      ]
    },
    {
      id: 'delim',
      label: 'Délimiteurs',
      items: [
        { label: '( )', latex: '\\left(#0\\right)', title: 'Parenthèses auto' },
        { label: '[ ]', latex: '\\left[#0\\right]', title: 'Crochets auto' },
        { label: '{ }', latex: '\\left\\{#0\\right\\}', title: 'Accolades auto' },
        { label: '⟨ ⟩', latex: '\\left\\langle#0\\right\\rangle', title: 'Chevrons / produit scalaire' },
        { label: '| |', latex: '\\left|#0\\right|', title: 'Barres verticales' },
        { label: '‖ ‖', latex: '\\left\\lVert#0\\right\\rVert', title: 'Double barres (norme)' },
        { label: '⌊ ⌋', latex: '\\left\\lfloor#0\\right\\rfloor', title: 'Plancher auto' },
        { label: '⌈ ⌉', latex: '\\left\\lceil#0\\right\\rceil', title: 'Plafond auto' },
        { label: '( ]', latex: '\\left(#0\\right]', title: 'Intervalle ] ouvert gauche' },
        { label: '[ )', latex: '\\left[#0\\right)', title: 'Intervalle ) ouvert droite' },
        { label: 'cases', latex: '\\begin{cases}#0\\\\#1\\end{cases}', title: 'Cas / système' },
        { label: 'cases3', latex: '\\begin{cases}#0\\\\#1\\\\#2\\end{cases}', title: 'Cas 3 lignes' },
        { label: 'dcases', latex: '\\begin{dcases}#0\\\\#1\\end{dcases}', title: 'Cas display' },
        { label: 'matrix', latex: '\\begin{matrix}#0&#1\\\\#2&#3\\end{matrix}', title: 'Matrice sans délimiteurs' },
        { label: 'pmatrix', latex: '\\begin{pmatrix}#0&#1\\\\#2&#3\\end{pmatrix}', title: 'Matrice parenthèses' },
        { label: 'bmatrix', latex: '\\begin{bmatrix}#0&#1\\\\#2&#3\\end{bmatrix}', title: 'Matrice crochets' },
        { label: 'Bmatrix', latex: '\\begin{Bmatrix}#0&#1\\\\#2&#3\\end{Bmatrix}', title: 'Matrice accolades' },
        { label: 'vmatrix', latex: '\\begin{vmatrix}#0&#1\\\\#2&#3\\end{vmatrix}', title: 'Matrice barres simples' },
        { label: 'Vmatrix', latex: '\\begin{Vmatrix}#0&#1\\\\#2&#3\\end{Vmatrix}', title: 'Matrice double barres' },
        { label: 'big(', latex: '\\bigl(#0\\bigr)', title: 'Grandes parenthèses' },
        { label: 'Big(', latex: '\\Bigl(#0\\Bigr)', title: 'Très grandes parenthèses' },
        { label: 'bigg(', latex: '\\biggl(#0\\biggr)', title: 'Énormes parenthèses' },
        { label: 'Bigg(', latex: '\\Biggl(#0\\Biggr)', title: 'Max parenthèses' },
        { label: 'mleft', latex: '\\mleft(#0\\mright)', title: 'Parenthèses adaptatives mleft' },
        { label: 'overbrace', latex: '\\overbrace{#0}^{#1}', title: 'Accolade dessus' },
        { label: 'underbrace', latex: '\\underbrace{#0}_{#1}', title: 'Accolade dessous' },
        { label: 'array', latex: '\\begin{array}{#0}#1\\end{array}', title: 'Tableau array' },
        { label: 'aligned', latex: '\\begin{aligned}#0\\\\#1\\end{aligned}', title: 'Aligné' }
      ]
    }
  ];

  /**
   * Familles (4 boutons) + sous-onglets = les 15 palettes, sans les empiler.
   * Les « Fréquents » sont toujours en bandeau rapide (comme la barre du haut
   * des éditeurs LaTeX classiques) — pas un 5ᵉ onglet.
   */
  var SNIP_SECTIONS = [
    { id: 'maths', label: 'Maths', groups: ['base', 'vecteurs', 'analyse', 'algebre', 'proba', 'fonctions'] },
    { id: 'symboles', label: 'Symboles', groups: ['grec', 'accents', 'ops', 'relations', 'fleches'] },
    { id: 'structures', label: 'Structures', groups: ['ensembles', 'delim'] },
    { id: 'sciences', label: 'Sciences', groups: ['physique', 'chimie'] }
  ];

  var QUICK_GROUP_ID = 'freq';

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function stripAccents(s) {
    return String(s == null ? '' : s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function findSnipById(id) {
    for (var g = 0; g < SNIP_GROUPS.length; g++) {
      var items = SNIP_GROUPS[g].items;
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) return items[i];
      }
    }
    return null;
  }

  function getGroupById(id) {
    for (var i = 0; i < SNIP_GROUPS.length; i++) {
      if (SNIP_GROUPS[i].id === id) return SNIP_GROUPS[i];
    }
    return SNIP_GROUPS[0];
  }

  function paletteHintForGroup(group) {
    if (group && group.id === 'vecteurs') {
      return '→u = flèche alignée · col 2/3 = vecteur colonne · Tab pour remplir';
    }
    return 'Sous-onglet · ' + (group ? group.items.length : 0) + ' symboles';
  }

  function getSectionById(id) {
    for (var i = 0; i < SNIP_SECTIONS.length; i++) {
      if (SNIP_SECTIONS[i].id === id) return SNIP_SECTIONS[i];
    }
    return SNIP_SECTIONS[0];
  }

  function sectionGroupCount(section) {
    var n = 0;
    for (var i = 0; i < section.groups.length; i++) {
      var g = getGroupById(section.groups[i]);
      if (g) n += g.items.length;
    }
    return n;
  }

  /** Mots-clés FR courants (fautes tolérées via Fuse) */
  function frKeywordsFor(item, group) {
    var parts = [group.label, item.title || '', item.label || ''];
    var t = stripAccents(item.title || '');
    var lab = stripAccents(item.label || '');
    var lx = String(item.latex || '');
    var extras = [];
    if (group.id === 'chimie') {
      extras.push('chimie', 'chemistry', 'chimestry', 'molecule', 'reaction', 'equilibre');
    }
    if (group.id === 'physique') {
      extras.push('physique', 'mecanique', 'unite');
    }
    if (group.id === 'proba') {
      extras.push('proba', 'probabilite', 'statistique');
    }
    if (/\bfraction\b|\bfrac\b|a\/b|\bdemi\b/.test(t + ' ' + lab)) {
      extras.push('fraction', 'diviser', 'quotient');
    }
    if (/\bracine\b/.test(t) || (/\\sqrt/.test(lx) && /racine|√/.test(t + lab))) {
      extras.push('racine', 'carree', 'sqrt');
    }
    if (/\bintegrale\b/.test(t) || (/\\int|\\oint|\\iint|\\iiint|\\oiint/.test(lx) && /integrale|∮|∫/.test(t + lab))) {
      extras.push('integrale', 'primitive');
    }
    if (/\bsomme\b|\bserie\b/.test(t)) extras.push('somme', 'serie');
    if (/\blimite\b|\blimsup\b|\bliminf\b|\blim\b/.test(t + ' ' + lab)) {
      extras.push('limite', 'tend vers');
    }
    if (/\bmatrice\b|\bsysteme\b|\bdeterminant\b/.test(t)) {
      extras.push('matrice', 'systeme', 'determinant');
    }
    if (group.id === 'vecteurs') {
      extras.push('vecteur', 'fleche', 'colonne', 'norme', 'scalaire', 'vectoriel', 'projection');
    }
    if (/\bvecteur\b/.test(t)) extras.push('vecteur', 'fleche');
    if (/\bderivee\b|\bpartielle\b/.test(t)) extras.push('derivee', 'differentielle');
    if (/\bparenthese\b|\bcrochet\b|\baccolade\b|\bnorme\b|valeur absolue/.test(t)) {
      extras.push('parenthese', 'delimiteur', 'encadrer');
    }
    if (/\bimplique\b|\bequivalence\b/.test(t) || (/\bfleche\b/.test(t) && !/\bvecteur\b/.test(t))) {
      extras.push('implique', 'equivalence', 'fleche');
    }
    if (/\bappartient\b|\binclus\b|\bensemble\b|\bnaturels\b|\breels\b|\bcomplexes\b/.test(t)) {
      extras.push('ensemble', 'appartient', 'inclusion');
    }
    if (/\bsinus\b|\bcosinus\b|\btangente\b|\blogarithme\b|\bexponentielle\b/.test(t)) {
      extras.push('fonction', 'trigo', 'logarithme');
    }
    return parts.concat(extras).join(' ');
  }

  function ensureSnipIds() {
    SNIP_GROUPS.forEach(function (group) {
      group.items.forEach(function (item, idx) {
        if (!item.id) item.id = group.id + '-' + idx;
        item.groupId = group.id;
        item.groupLabel = group.label;
        item._titleNorm = stripAccents(item.title || '');
        item._labelNorm = stripAccents(item.label || '');
        item._groupNorm = stripAccents(group.label || '');
        item._search = stripAccents(frKeywordsFor(item, group) + ' ' + (item.latex || ''));
      });
    });
  }
  ensureSnipIds();

  function allSnipsFlat() {
    var out = [];
    SNIP_GROUPS.forEach(function (g) {
      g.items.forEach(function (item) { out.push(item); });
    });
    return out;
  }

  /** Distance d’édition bornée (1–2 fautes), comme une recherche tolérante FR */
  function editDistanceAtMost(a, b, max) {
    if (a === b) return 0;
    var la = a.length;
    var lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    if (!la) return lb;
    if (!lb) return la;
    var prev = new Array(lb + 1);
    var cur = new Array(lb + 1);
    var j;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (var i = 1; i <= la; i++) {
      cur[0] = i;
      var rowMin = cur[0];
      var ca = a.charCodeAt(i - 1);
      for (j = 1; j <= lb; j++) {
        var cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
        var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      var tmp = prev;
      prev = cur;
      cur = tmp;
    }
    return prev[lb];
  }

  function typoBudget(q) {
    if (q.length <= 5) return 1;
    return 2;
  }

  /** Sous-chaîne exacte sur un mot entier (évite « limite » dans « delimiteurs ») */
  function hasExactNeedle(text, qNorm) {
    if (!text || !qNorm) return false;
    var words = text.split(/[^a-z0-9]+/);
    for (var i = 0; i < words.length; i++) {
      if (words[i] === qNorm) return true;
      /* Préfixe mot long : « proba » → probabilite */
      if (qNorm.length >= 4 && words[i].indexOf(qNorm) === 0) return true;
    }
    return false;
  }

  /** Fautes d’orthographe sur les mots (1–2), initiale identique ; 2 fautes ⇒ préfixe 3 lettres */
  function wordsTypoMatch(text, qNorm, budget) {
    if (!text || qNorm.length < 2) return false;
    var words = text.split(/[^a-z0-9]+/);
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w.length < 3) continue;
      if (w.charAt(0) !== qNorm.charAt(0)) continue;
      if (Math.abs(w.length - qNorm.length) > budget) continue;
      var d = editDistanceAtMost(w, qNorm, budget);
      if (d > budget) continue;
      if (d === 2 && w.slice(0, 3) !== qNorm.slice(0, 3)) continue;
      return true;
    }
    return false;
  }

  function getSnipFuse() {
    if (_snipFuse) return _snipFuse;
    if (typeof Fuse === 'undefined') return null;
    /* Uniquement des champs sans accents : « integrale » trouve « Intégrale » */
    _snipFuse = new Fuse(allSnipsFlat(), {
      keys: [
        { name: '_titleNorm', weight: 3 },
        { name: '_search', weight: 2.5 },
        { name: '_groupNorm', weight: 1.2 },
        { name: '_labelNorm', weight: 1 }
      ],
      threshold: 0.4,
      ignoreLocation: true,
      isCaseSensitive: false,
      minMatchCharLength: 2,
      includeScore: true
    });
    return _snipFuse;
  }

  function searchSnips(query) {
    var q = (query || '').trim();
    if (!q) return [];
    var qNorm = stripAccents(q);
    if (qNorm.length < 1) return [];
    var budget = typoBudget(qNorm);
    var seen = Object.create(null);
    var out = [];

    function relevant(item) {
      var hay = item._search || '';
      var titleN = item._titleNorm || stripAccents(item.title || '');
      var groupN = item._groupNorm || stripAccents(item.groupLabel || '');
      var labN = item._labelNorm || stripAccents(item.label || '');
      /* Sous-chaîne sans accents : « algebre », « ete », « integrale »… */
      if (
        hay.indexOf(qNorm) !== -1 ||
        titleN.indexOf(qNorm) !== -1 ||
        labN.indexOf(qNorm) !== -1 ||
        groupN.indexOf(qNorm) !== -1
      ) {
        return true;
      }
      if (qNorm.length < 2) return false;
      if (hasExactNeedle(hay, qNorm) || hasExactNeedle(titleN, qNorm) || hasExactNeedle(groupN, qNorm)) {
        return true;
      }
      return wordsTypoMatch(titleN, qNorm, budget) || wordsTypoMatch(groupN, qNorm, budget);
    }

    var fuse = getSnipFuse();
    var ranked = fuse && qNorm.length >= 2 ? fuse.search(qNorm) : null;
    if (ranked) {
      ranked.forEach(function (r) {
        if (!relevant(r.item)) return;
        var key = (r.item.latex || '') + '\0' + (r.item.label || '');
        if (seen[key]) return;
        seen[key] = true;
        out.push(r.item);
      });
    }

    allSnipsFlat().forEach(function (item) {
      if (!relevant(item)) return;
      var key = (item.latex || '') + '\0' + (item.label || '');
      if (seen[key]) return;
      seen[key] = true;
      out.push(item);
    });
    return out;
  }

  function loadStylesheet(href) {
    if (document.querySelector('link[data-mathlive="' + href + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-mathlive', href);
    document.head.appendChild(link);
  }

  function ensureMathLive() {
    if (_mathLivePromise) return _mathLivePromise;
    if (window.MathfieldElement || customElements.get('math-field')) {
      _mathLivePromise = Promise.resolve();
      return _mathLivePromise;
    }
    _mathLivePromise = new Promise(function (resolve, reject) {
      loadStylesheet(CDN + '/mathlive-static.css');
      loadStylesheet(CDN + '/mathlive-fonts.css');
      var s = document.createElement('script');
      s.src = CDN + '/mathlive.min.js';
      s.async = true;
      s.onload = function () {
        try {
          if (window.MathfieldElement) {
            window.MathfieldElement.fontsDirectory = CDN + '/fonts';
          }
        } catch (e) { /* ignore */ }
        resolve();
      };
      s.onerror = function () {
        _mathLivePromise = null;
        reject(new Error('Impossible de charger MathLive (réseau / CDN).'));
      };
      document.head.appendChild(s);
    });
    return _mathLivePromise;
  }

  function getEditorLatex() {
    if (!_mf) return '';
    try {
      return _mf.getValue ? _mf.getValue('latex') : (_mf.value || '');
    } catch (e) {
      return _mf.value || '';
    }
  }

  function getTextBefore() {
    var el = document.getElementById('latexTestBefore');
    return el ? el.value : '';
  }

  function getTextAfter() {
    var el = document.getElementById('latexTestAfter');
    return el ? el.value : '';
  }

  function latexBuildInline(before, latex, after) {
    var math = (latex || '').trim() ? '\\(' + String(latex).trim() + '\\)' : '';
    var parts = [];
    if (before) parts.push(String(before));
    if (math) parts.push(math);
    if (after) parts.push(String(after));
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  /** Phrase complète : texte + \( latex \) + texte */
  function buildFullExport() {
    var latex = getEditorLatex().trim();
    var built = latexBuildInline(getTextBefore(), latex, getTextAfter());
    return built || latex;
  }

  /**
   * \\vec{AB} n’aligne la flèche que sur la 1ʳᵉ lettre — bascule vers \\overrightarrow{} si besoin.
   */
  function normalizeVectorLatex(latex) {
    if (!latex) return latex;
    return String(latex).replace(/\\vec\{([^}]*)\}/g, function (_, inner) {
      var core = inner.replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, 'X').replace(/[_^{}\\, ]/g, '');
      if (core.length > 1) return '\\overrightarrow{' + inner + '}';
      return '\\vec{' + inner + '}';
    });
  }

  function latexToMarkup(latex) {
    if (!latex) return '';
    var normalized = normalizeVectorLatex(latex);
    try {
      if (window.MathfieldElement && typeof window.MathfieldElement.convertLatexToMarkup === 'function') {
        return window.MathfieldElement.convertLatexToMarkup(normalized);
      }
    } catch (e) { /* ignore */ }
    try {
      if (window.MathLive && typeof window.MathLive.convertLatexToMarkup === 'function') {
        return window.MathLive.convertLatexToMarkup(normalized);
      }
    } catch (e2) { /* ignore */ }
    return '<span class="latex-lab-fallback-math">' + escHtml(normalized) + '</span>';
  }

  /** Aperçu lab / Easy : texte échappé + formule markup (une seule voie). */
  function formatLatexPreviewHtml(before, latex, after) {
    var html = '';
    if (before) html += '<span class="latex-lab-preview-text">' + escHtml(before) + '</span>';
    if (latex) html += '<span class="latex-lab-preview-math">' + latexToMarkup(latex) + '</span>';
    if (after) html += '<span class="latex-lab-preview-text">' + escHtml(after) + '</span>';
    return html;
  }

  /** Segments texte / math pour faces carte (plusieurs \\( … \\) OK). */
  function parseLatexInlineSegments(str) {
    var s = String(str == null ? '' : str);
    var segments = [];
    var re = /\\\(([\s\S]*?)\\\)/g;
    var last = 0;
    var m;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) segments.push({ type: 'text', value: s.slice(last, m.index) });
      segments.push({ type: 'math', value: m[1] });
      last = m.index + m[0].length;
    }
    if (last < s.length) segments.push({ type: 'text', value: s.slice(last) });
    if (!segments.length && s) segments.push({ type: 'text', value: s });
    return segments;
  }

  /**
   * Éditeur Easy (1 champ formule) : avant / latex / après.
   * Les formules suivantes restent dans « after » pour un round-trip via latexBuildInline.
   */
  function parseLatexInlineForEditor(str) {
    var s = String(str == null ? '' : str);
    var m = s.match(/^(.*?)\s*\\\(([\s\S]*?)\\\)\s*(.*)$/);
    if (m) return { before: m[1].trim(), latex: m[2].trim(), after: m[3].trim() };
    if (/\\[a-zA-Z{]/.test(s) && s.indexOf('\\(') < 0) {
      return { before: '', latex: s.trim(), after: '' };
    }
    return { before: s, latex: '', after: '' };
  }

  /** HTML sûr pour afficher une face (Rapide / session / dock). */
  function formatCardFaceHtml(str) {
    var s = String(str == null ? '' : str);
    if (!s) return '';
    if (s.indexOf('\\(') < 0) {
      if (/\\[a-zA-Z{]/.test(s)) {
        return '<span class="latex-lab-preview-math">' + latexToMarkup(s) + '</span>';
      }
      return escHtml(s);
    }
    return parseLatexInlineSegments(s).map(function (seg) {
      if (seg.type === 'math') {
        return '<span class="latex-lab-preview-math">' + latexToMarkup(seg.value) + '</span>';
      }
      return escHtml(seg.value);
    }).join('');
  }

  function syncPreview() {
    var wrap = document.getElementById('latexTestPreviewWrap');
    if (!wrap) return;
    var html = formatLatexPreviewHtml(getTextBefore(), getEditorLatex(), getTextAfter());
    if (!html) html = '<span class="anki-mut">Aperçu vide — tape une formule ou du texte</span>';
    wrap.innerHTML = html;
  }

  function syncFromEditor() {
    if (!_mf) return;
    var latex = getEditorLatex();
    var codeEl = document.getElementById('latexTestCode');
    if (codeEl && document.activeElement !== codeEl) codeEl.value = latex;
    syncPreview();
  }

  function applyLatexToEditor(latex, focus) {
    if (!_mf) return;
    try {
      _mf.value = latex || '';
    } catch (e) { /* ignore */ }
    syncFromEditor();
    if (focus) {
      try { _mf.focus(); } catch (e2) { /* ignore */ }
    }
  }

  function insertSnip(latex) {
    if (!_mf) return;
    try {
      if (typeof _mf.executeCommand === 'function') {
        _mf.executeCommand(['insert', latex]);
      } else {
        _mf.value = (_mf.value || '') + latex;
      }
      _mf.focus();
    } catch (e) {
      if (typeof window.showToast === 'function') window.showToast('Insertion échouée');
    }
    syncFromEditor();
  }

  function insertSpaceToken(kind) {
    var map = {
      thin: '\\,',
      med: '\\:',
      thick: '\\;',
      quad: '\\quad',
      qquad: '\\qquad',
      textsp: '\\ '
    };
    insertSnip(map[kind] || '\\,');
  }

  function insertTextBox() {
    insertSnip('\\text{#0}');
  }

  function copyLatex(full) {
    var codeEl = document.getElementById('latexTestCode');
    var text = full ? buildFullExport() : ((codeEl && codeEl.value) || getEditorLatex());
    if (!text) {
      if (typeof window.showToast === 'function') window.showToast('Rien à copier');
      return;
    }
    var done = function () {
      if (typeof window.showToast === 'function') {
        window.showToast(full ? 'Phrase copiée (texte + formule)' : 'LaTeX copié');
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        if (codeEl) {
          codeEl.focus();
          codeEl.select();
          try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
        }
      });
    } else if (codeEl) {
      codeEl.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
    }
  }

  function clearAll() {
    applyLatexToEditor('', true);
    var codeEl = document.getElementById('latexTestCode');
    if (codeEl) codeEl.value = '';
    var b = document.getElementById('latexTestBefore');
    var a = document.getElementById('latexTestAfter');
    if (b) b.value = '';
    if (a) a.value = '';
    syncPreview();
  }

  function isInsideTextCommand(value, caret) {
    var before = String(value || '').slice(0, caret);
    var idx = before.lastIndexOf('\\text{');
    if (idx < 0) return false;
    var after = before.slice(idx + 6);
    return after.indexOf('}') === -1;
  }

  /** Dans le code LaTeX : Espace → \, (sauf dans \text{…}) */
  function onCodeKeydown(e) {
    if (!_spaceMode || e.key !== ' ' || e.ctrlKey || e.metaKey || e.altKey) return;
    var el = e.target;
    var start = el.selectionStart;
    var end = el.selectionEnd;
    var val = el.value || '';
    if (isInsideTextCommand(val, start)) return; /* espace normal dans le texte */
    e.preventDefault();
    var token = e.shiftKey ? '\\quad' : '\\,';
    el.value = val.slice(0, start) + token + val.slice(end);
    var pos = start + token.length;
    el.setSelectionRange(pos, pos);
    applyLatexToEditor(el.value, false);
  }

  function onMathSpaceKeydown(e) {
    if (!_spaceMode || e.key !== ' ' || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    insertSpaceToken(e.shiftKey ? 'quad' : 'thin');
  }

  function renderSectionTabs() {
    return SNIP_SECTIONS.map(function (section) {
      var active = section.id === _activeSection ? ' is-active' : '';
      return (
        '<button type="button" class="latex-lab-family' + active + '" role="tab" ' +
          'aria-selected="' + (section.id === _activeSection ? 'true' : 'false') + '" ' +
          'data-section="' + escHtml(section.id) + '">' +
          '<span class="latex-lab-family-label">' + escHtml(section.label) + '</span>' +
          '<span class="latex-lab-family-count">' + sectionGroupCount(section) + '</span>' +
        '</button>'
      );
    }).join('');
  }

  function renderSubTabs(section) {
    if (!section || !section.groups.length) return '';
    return section.groups.map(function (gid) {
      var group = getGroupById(gid);
      var active = gid === _activeSub ? ' is-active' : '';
      return (
        '<button type="button" class="latex-lab-sub' + active + '" role="tab" ' +
          'aria-selected="' + (gid === _activeSub ? 'true' : 'false') + '" ' +
          'data-sub="' + escHtml(gid) + '">' +
          escHtml(group.label) +
          '<span class="latex-lab-sub-count">' + group.items.length + '</span>' +
        '</button>'
      );
    }).join('');
  }

  function renderSnipButtons(items) {
    return items.map(function (s) {
      var tip = s.title || s.label;
      if (s.groupLabel && tip.indexOf(s.groupLabel) === -1) tip += ' · ' + s.groupLabel;
      return (
        '<button type="button" class="latex-lab-snip" data-snip="' + escHtml(s.id) + '" ' +
          'title="' + escHtml(tip) + '">' + escHtml(s.label) + '</button>'
      );
    }).join('');
  }

  function renderQuickBar() {
    var group = getGroupById(QUICK_GROUP_ID);
    if (!group) return '';
    return (
      '<div class="latex-lab-quick-row" role="toolbar" aria-label="Raccourcis fréquents">' +
        '<span class="latex-lab-quick-label">Raccourcis</span>' +
        '<div class="latex-lab-quick-snips">' + renderSnipButtons(group.items) + '</div>' +
      '</div>'
    );
  }

  function ensureActiveSub(section) {
    if (!section) return;
    if (section.groups.indexOf(_activeSub) === -1) {
      _activeSub = section.groups[0];
    }
  }

  function refreshPalette(query) {
    var tabs = document.getElementById('latexTestCats');
    var subs = document.getElementById('latexTestSubs');
    var grid = document.getElementById('latexTestSnips');
    var title = document.getElementById('latexTestCatTitle');
    var hint = document.getElementById('latexTestPaletteHint');
    var panel = document.getElementById('latexTestFamilyPanel');
    var q = query != null ? query : ((document.getElementById('latexTestSearch') || {}).value || '');
    q = (q || '').trim();

    if (q) {
      if (tabs) tabs.querySelectorAll('.latex-lab-family').forEach(function (btn) {
        btn.classList.remove('is-active');
        btn.setAttribute('aria-selected', 'false');
      });
      if (subs) {
        subs.innerHTML = '';
        subs.hidden = true;
      }
      if (panel) panel.classList.add('is-searching');
      var hits = searchSnips(q);
      if (title) title.textContent = hits.length ? ('Résultats (' + hits.length + ')') : 'Aucun résultat';
      if (hint) hint.textContent = 'Sans accents · fautes tolérées';
      if (grid) {
        grid.innerHTML = hits.length
          ? renderSnipButtons(hits)
          : '<p class="anki-mut latex-lab-empty">Aucun symbole pour « ' + escHtml(q) + ' »</p>';
        wireSnipButtons(grid);
      }
      return;
    }

    if (panel) panel.classList.remove('is-searching');
    var section = getSectionById(_activeSection);
    ensureActiveSub(section);

    if (tabs) {
      tabs.innerHTML = renderSectionTabs();
      tabs.querySelectorAll('[data-section]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          _activeSection = btn.getAttribute('data-section');
          var sec = getSectionById(_activeSection);
          _activeSub = sec.groups[0];
          refreshPalette('');
        });
      });
    }

    if (subs) {
      var subHtml = renderSubTabs(section);
      subs.innerHTML = subHtml;
      subs.hidden = !subHtml;
      subs.querySelectorAll('[data-sub]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          _activeSub = btn.getAttribute('data-sub');
          refreshPalette('');
        });
      });
    }

    var group = getGroupById(_activeSub);
    if (title) {
      title.textContent = section.label + ' · ' + group.label;
    }
    if (hint) {
      hint.textContent = paletteHintForGroup(group);
    }
    if (grid) {
      grid.innerHTML = renderSnipButtons(group.items);
      wireSnipButtons(grid);
    }
  }

  function wireSnipButtons(container) {
    if (!container) return;
    container.querySelectorAll('[data-snip]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var snip = findSnipById(btn.getAttribute('data-snip'));
        if (snip) insertSnip(snip.latex);
      });
    });
  }

  function configureMathField(mf) {
    if (!mf) return;
    try {
      mf.menuItems = [];
      mf.mathVirtualKeyboardPolicy = 'manual';
    } catch (e) { /* ignore */ }
    mf.setAttribute('virtual-keyboard-mode', 'manual');
    mf.setAttribute('math-virtual-keyboard-policy', 'manual');
  }

  function wireFields() {
    _mf = document.getElementById('latexTestField');
    if (!_mf) return;

    if (_wired) {
      syncFromEditor();
      return;
    }
    _wired = true;

    configureMathField(_mf);
    _mf.setAttribute('smart-mode', 'true');

    _mf.addEventListener('input', syncFromEditor);
    _mf.addEventListener('change', syncFromEditor);
    _mf.addEventListener('keydown', onMathSpaceKeydown, true);

    var codeEl = document.getElementById('latexTestCode');
    if (codeEl) {
      codeEl.addEventListener('input', function () {
        applyLatexToEditor(codeEl.value, false);
      });
      codeEl.addEventListener('keydown', onCodeKeydown);
    }

    ['latexTestBefore', 'latexTestAfter'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', syncPreview);
    });

    if (!_mf.value) {
      applyLatexToEditor('\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}', false);
    } else {
      syncFromEditor();
    }

    try { _mf.focus(); } catch (e) { /* ignore */ }
  }

  function buildShell(root) {
    root.innerHTML =
      '<div class="latex-lab">' +
        '<header class="latex-lab-toolbar">' +
          '<div class="latex-lab-toolbar-head">' +
            '<h2 class="latex-lab-title"><span data-icon="flask-conical"></span> Labo LaTeX</h2>' +
            '<div class="latex-lab-head-actions">' +
              '<input type="search" id="latexTestSearch" class="latex-lab-search" ' +
                'placeholder="Sans accents : integrale, algebre, fraction…" ' +
                'autocomplete="off" spellcheck="true" lang="fr">' +
              '<button type="button" class="bs" id="latexTestCopy" title="Copier le code LaTeX seul">' +
                '<span data-icon="copy"></span> Copier</button>' +
              '<button type="button" class="bs" id="latexTestCopyFull" title="Copier texte + formule">' +
                '<span data-icon="clipboard-list"></span> Phrase</button>' +
              '<button type="button" class="bs" id="latexTestClear">' +
                '<span data-icon="trash-2"></span></button>' +
            '</div>' +
          '</div>' +
        '</header>' +

        '<div class="latex-lab-work">' +
          '<div class="latex-lab-compose">' +
            '<section class="latex-lab-panel latex-lab-panel-preview">' +
              '<div class="latex-lab-panel-label">Aperçu <span class="anki-mut">· texte + formule</span></div>' +
              '<div class="latex-lab-preview-wrap" id="latexTestPreviewWrap"></div>' +
            '</section>' +
            '<section class="latex-lab-panel latex-lab-panel-editor">' +
              '<div class="latex-lab-panel-label">Éditeur <span class="anki-mut">· Tab = case suivante · Espace = espacement</span></div>' +
              '<input type="text" id="latexTestBefore" class="latex-lab-text-field" ' +
                'placeholder="Texte avant (ex. On a donc)" autocomplete="off" spellcheck="true">' +
              '<div class="latex-lab-field-wrap">' +
                '<math-field id="latexTestField" class="latex-lab-field"></math-field>' +
              '</div>' +
              '<input type="text" id="latexTestAfter" class="latex-lab-text-field" ' +
                'placeholder="Texte après (ex. d’où le résultat.)" autocomplete="off" spellcheck="true">' +
              '<div class="latex-lab-quickbar" role="toolbar" aria-label="Insertions rapides">' +
                '<button type="button" class="latex-lab-quick" data-space="thin" title="Espace fin (touche Espace)">␣</button>' +
                '<button type="button" class="latex-lab-quick" data-space="med" title="Espace moyen">␣␣</button>' +
                '<button type="button" class="latex-lab-quick" data-space="quad" title="Grand espace (Maj+Espace)">□</button>' +
                '<button type="button" class="latex-lab-quick" id="latexTestInsertText" title="Insérer du texte dans la formule">\\text{}</button>' +
                '<label class="latex-lab-space-toggle" title="Espace clavier → espacement LaTeX">' +
                  '<input type="checkbox" id="latexTestSpaceMode" checked> Espace auto' +
                '</label>' +
              '</div>' +
            '</section>' +
          '</div>' +

          '<section class="latex-lab-palette">' +
            '<div id="latexTestQuick" class="latex-lab-quick-wrap">' + renderQuickBar() + '</div>' +
            '<div class="latex-lab-families" id="latexTestCats" role="tablist" aria-label="Familles de symboles"></div>' +
            '<div class="latex-lab-family-panel" id="latexTestFamilyPanel">' +
              '<div class="latex-lab-palette-head">' +
                '<span class="latex-lab-panel-label" id="latexTestCatTitle">Maths · Bases</span>' +
                '<span class="anki-mut latex-lab-palette-hint" id="latexTestPaletteHint">Sous-onglet</span>' +
              '</div>' +
              '<div class="latex-lab-subs" id="latexTestSubs" role="tablist" aria-label="Sous-catégories"></div>' +
              '<div class="latex-lab-snip-grid" id="latexTestSnips" role="tabpanel"></div>' +
            '</div>' +
          '</section>' +
        '</div>' +

        '<details class="latex-lab-code-panel">' +
          '<summary class="latex-lab-code-summary">Code LaTeX <span class="anki-mut">— modification simple (Espace = \\,)</span></summary>' +
          '<textarea id="latexTestCode" class="latex-lab-code" rows="3" spellcheck="false" ' +
            'placeholder="\\frac{a}{b}"></textarea>' +
        '</details>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(root);

    refreshPalette('');
    var quickWrap = document.getElementById('latexTestQuick');
    if (quickWrap) wireSnipButtons(quickWrap);

    var searchEl = document.getElementById('latexTestSearch');
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        refreshPalette(searchEl.value);
      });
    }

    document.querySelectorAll('[data-space]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        insertSpaceToken(btn.getAttribute('data-space'));
      });
    });
    var textBtn = document.getElementById('latexTestInsertText');
    if (textBtn) textBtn.addEventListener('click', insertTextBox);

    var spaceToggle = document.getElementById('latexTestSpaceMode');
    if (spaceToggle) {
      spaceToggle.addEventListener('change', function () {
        _spaceMode = !!spaceToggle.checked;
      });
    }

    var copyBtn = document.getElementById('latexTestCopy');
    var copyFullBtn = document.getElementById('latexTestCopyFull');
    var clearBtn = document.getElementById('latexTestClear');
    if (copyBtn) copyBtn.addEventListener('click', function () { copyLatex(false); });
    if (copyFullBtn) copyFullBtn.addEventListener('click', function () { copyLatex(true); });
    if (clearBtn) clearBtn.addEventListener('click', clearAll);
  }

  window.renderLatexTest = function () {
    if (_uiRev !== UI_REV) {
      _built = false;
      _wired = false;
      _uiRev = UI_REV;
    }

    var root = document.getElementById('paneLatexTest');
    if (!root) return;

    if (!_built) {
      root.innerHTML =
        '<div class="latex-lab latex-lab-loading">' +
          '<div class="clean-spinner" aria-hidden="true"></div>' +
          '<p class="anki-mut">Chargement de MathLive…</p>' +
        '</div>';
    }

    ensureMathLive().then(function () {
      if (!_built) {
        buildShell(root);
        _built = true;
      }
      customElements.whenDefined('math-field').then(function () {
        wireFields();
      }).catch(function () {
        wireFields();
      });
    }).catch(function (err) {
      root.innerHTML =
        '<div class="latex-lab">' +
          '<h2 class="latex-lab-title">Labo LaTeX</h2>' +
          '<p class="latex-lab-error">' + (err && err.message ? err.message : 'Erreur de chargement') + '</p>' +
          '<p class="anki-mut">Vérifie ta connexion : MathLive est chargé depuis jsDelivr.</p>' +
          '<button type="button" class="bp" id="latexTestRetry">Réessayer</button>' +
        '</div>';
      var retry = document.getElementById('latexTestRetry');
      if (retry) retry.addEventListener('click', function () {
        _built = false;
        _wired = false;
        window.renderLatexTest();
      });
    });
  };

  /** API partagée (cartes rapides LaTeX, session, dock, etc.) */
  window.ensureMathLive = ensureMathLive;
  window.latexToMarkup = latexToMarkup;
  window.normalizeVectorLatex = normalizeVectorLatex;
  window.latexBuildInline = latexBuildInline;
  window.formatCardFaceHtml = formatCardFaceHtml;
  window.formatQuickCardHtml = formatCardFaceHtml; /* alias Rapide */
  window.parseLatexInlineForEditor = parseLatexInlineForEditor;
  window.parseLatexInlineSegments = parseLatexInlineSegments;

  /**
   * Monte une instance « LaTeX Easy » (même modèle que le labo) dans host.
   * @returns {{ getInline:Function, setFromInline:Function, focus:Function, destroy:Function }}
   */
  window.mountLatexEasyEditor = function (host, opts) {
    opts = opts || {};
    if (!host) return null;
    var prefix = opts.prefix || ('lex' + Math.random().toString(36).slice(2, 8));
    var title = opts.title || 'LaTeX Easy';
    var spaceMode = true;
    var activeSection = 'maths';
    var activeSub = 'base';
    var mf = null;
    var destroyed = false;

    function pid(suf) { return prefix + suf; }
    function gel(suf) { return document.getElementById(pid(suf)); }

    function getLatex() {
      if (!mf) return '';
      try { return mf.getValue ? mf.getValue('latex') : (mf.value || ''); }
      catch (e) { return mf.value || ''; }
    }
    function getBefore() { var el = gel('Before'); return el ? el.value : ''; }
    function getAfter() { var el = gel('After'); return el ? el.value : ''; }

    function syncPreview() {
      var wrap = gel('PreviewWrap');
      if (!wrap) return;
      var html = formatLatexPreviewHtml(getBefore(), getLatex(), getAfter());
      if (!html) html = '<span class="anki-mut">Aperçu vide — tape une formule ou du texte</span>';
      wrap.innerHTML = html;
    }

    function syncFromEditor() {
      if (!mf) return;
      var latex = getLatex();
      var codeEl = gel('Code');
      if (codeEl && document.activeElement !== codeEl) codeEl.value = latex;
      syncPreview();
    }

    function applyLatex(latex, focus) {
      if (!mf) return;
      try { mf.value = latex || ''; } catch (e) { /* ignore */ }
      syncFromEditor();
      if (focus) { try { mf.focus(); } catch (e2) { /* ignore */ } }
    }

    function insertSnipLocal(latex) {
      if (!mf) return;
      try {
        if (typeof mf.executeCommand === 'function') mf.executeCommand(['insert', latex]);
        else mf.value = (mf.value || '') + latex;
        mf.focus();
      } catch (e) { /* ignore */ }
      syncFromEditor();
    }

    function insertSpaceLocal(kind) {
      var map = { thin: '\\,', med: '\\:', thick: '\\;', quad: '\\quad', qquad: '\\qquad', textsp: '\\ ' };
      insertSnipLocal(map[kind] || '\\,');
    }

    function renderSnips(items) {
      return items.map(function (s) {
        var tip = s.title || s.label;
        if (s.groupLabel && tip.indexOf(s.groupLabel) === -1) tip += ' · ' + s.groupLabel;
        return (
          '<button type="button" class="latex-lab-snip" data-snip="' + escHtml(s.id) + '" ' +
            'title="' + escHtml(tip) + '">' + escHtml(s.label) + '</button>'
        );
      }).join('');
    }

    function wireSnips(container) {
      if (!container) return;
      container.querySelectorAll('[data-snip]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var snip = findSnipById(btn.getAttribute('data-snip'));
          if (snip) insertSnipLocal(snip.latex);
        });
      });
    }

    function refreshPalette(query) {
      if (destroyed) return;
      var tabs = gel('Cats');
      var subs = gel('Subs');
      var grid = gel('Snips');
      var titleEl = gel('CatTitle');
      var hint = gel('PaletteHint');
      var panel = gel('FamilyPanel');
      var searchEl = gel('Search');
      var q = query != null ? query : ((searchEl && searchEl.value) || '');
      q = (q || '').trim();

      if (q) {
        if (tabs) tabs.querySelectorAll('.latex-lab-family').forEach(function (btn) {
          btn.classList.remove('is-active');
          btn.setAttribute('aria-selected', 'false');
        });
        if (subs) { subs.innerHTML = ''; subs.hidden = true; }
        if (panel) panel.classList.add('is-searching');
        var hits = searchSnips(q);
        if (titleEl) titleEl.textContent = hits.length ? ('Résultats (' + hits.length + ')') : 'Aucun résultat';
        if (hint) hint.textContent = 'Sans accents · fautes tolérées';
        if (grid) {
          grid.innerHTML = hits.length
            ? renderSnips(hits)
            : '<p class="anki-mut latex-lab-empty">Aucun symbole pour « ' + escHtml(q) + ' »</p>';
          wireSnips(grid);
        }
        return;
      }

      if (panel) panel.classList.remove('is-searching');
      var section = getSectionById(activeSection);
      if (section.groups.indexOf(activeSub) === -1) activeSub = section.groups[0];

      if (tabs) {
        tabs.innerHTML = SNIP_SECTIONS.map(function (sec) {
          var active = sec.id === activeSection ? ' is-active' : '';
          return (
            '<button type="button" class="latex-lab-family' + active + '" role="tab" ' +
              'aria-selected="' + (sec.id === activeSection ? 'true' : 'false') + '" ' +
              'data-section="' + escHtml(sec.id) + '">' +
              '<span class="latex-lab-family-label">' + escHtml(sec.label) + '</span>' +
              '<span class="latex-lab-family-count">' + sectionGroupCount(sec) + '</span>' +
            '</button>'
          );
        }).join('');
        tabs.querySelectorAll('[data-section]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            activeSection = btn.getAttribute('data-section');
            activeSub = getSectionById(activeSection).groups[0];
            refreshPalette('');
          });
        });
      }

      if (subs) {
        var subHtml = section.groups.map(function (gid) {
          var group = getGroupById(gid);
          var active = gid === activeSub ? ' is-active' : '';
          return (
            '<button type="button" class="latex-lab-sub' + active + '" role="tab" ' +
              'aria-selected="' + (gid === activeSub ? 'true' : 'false') + '" ' +
              'data-sub="' + escHtml(gid) + '">' +
              escHtml(group.label) +
              '<span class="latex-lab-sub-count">' + group.items.length + '</span>' +
            '</button>'
          );
        }).join('');
        subs.innerHTML = subHtml;
        subs.hidden = !subHtml;
        subs.querySelectorAll('[data-sub]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            activeSub = btn.getAttribute('data-sub');
            refreshPalette('');
          });
        });
      }

      var group = getGroupById(activeSub);
      if (titleEl) titleEl.textContent = section.label + ' · ' + group.label;
      if (hint) hint.textContent = paletteHintForGroup(group);
      if (grid) {
        grid.innerHTML = renderSnips(group.items);
        wireSnips(grid);
      }
    }

    var freqGroup = getGroupById(QUICK_GROUP_ID);
    var quickHtml = freqGroup
      ? ('<div class="latex-lab-quick-row" role="toolbar" aria-label="Raccourcis fréquents">' +
          '<span class="latex-lab-quick-label">Raccourcis</span>' +
          '<div class="latex-lab-quick-snips">' + renderSnips(freqGroup.items) + '</div></div>')
      : '';

    host.innerHTML =
      '<div class="latex-lab latex-lab-easy-embed">' +
        '<header class="latex-lab-toolbar">' +
          '<div class="latex-lab-toolbar-head">' +
            '<h2 class="latex-lab-title"><span data-icon="flask-conical"></span> ' + escHtml(title) + '</h2>' +
            '<div class="latex-lab-head-actions">' +
              '<input type="search" id="' + pid('Search') + '" class="latex-lab-search" ' +
                'placeholder="Sans accents : integrale, algebre…" autocomplete="off" spellcheck="true" lang="fr">' +
              '<button type="button" class="bs" id="' + pid('Clear') + '" title="Effacer">' +
                '<span data-icon="trash-2"></span></button>' +
            '</div>' +
          '</div>' +
        '</header>' +
        '<div class="latex-lab-work">' +
          '<div class="latex-lab-compose">' +
            '<section class="latex-lab-panel latex-lab-panel-preview">' +
              '<div class="latex-lab-panel-label">Aperçu <span class="anki-mut">· texte + formule</span></div>' +
              '<div class="latex-lab-preview-wrap" id="' + pid('PreviewWrap') + '"></div>' +
            '</section>' +
            '<section class="latex-lab-panel latex-lab-panel-editor">' +
              '<div class="latex-lab-panel-label">Éditeur <span class="anki-mut">· Tab = case suivante · Espace = espacement</span></div>' +
              '<input type="text" id="' + pid('Before') + '" class="latex-lab-text-field" ' +
                'placeholder="Texte avant" autocomplete="off" spellcheck="true">' +
              '<div class="latex-lab-field-wrap">' +
                '<math-field id="' + pid('Field') + '" class="latex-lab-field"></math-field>' +
              '</div>' +
              '<input type="text" id="' + pid('After') + '" class="latex-lab-text-field" ' +
                'placeholder="Texte après" autocomplete="off" spellcheck="true">' +
              '<div class="latex-lab-quickbar" role="toolbar" aria-label="Insertions rapides">' +
                '<button type="button" class="latex-lab-quick" data-space="thin" title="Espace fin">␣</button>' +
                '<button type="button" class="latex-lab-quick" data-space="med" title="Espace moyen">␣␣</button>' +
                '<button type="button" class="latex-lab-quick" data-space="quad" title="Grand espace">□</button>' +
                '<button type="button" class="latex-lab-quick" id="' + pid('InsertText') + '" title="Texte dans la formule">\\text{}</button>' +
                '<label class="latex-lab-space-toggle" title="Espace clavier → espacement LaTeX">' +
                  '<input type="checkbox" id="' + pid('SpaceMode') + '" checked> Espace auto' +
                '</label>' +
              '</div>' +
            '</section>' +
          '</div>' +
          '<section class="latex-lab-palette">' +
            '<div id="' + pid('Quick') + '" class="latex-lab-quick-wrap">' + quickHtml + '</div>' +
            '<div class="latex-lab-families" id="' + pid('Cats') + '" role="tablist"></div>' +
            '<div class="latex-lab-family-panel" id="' + pid('FamilyPanel') + '">' +
              '<div class="latex-lab-palette-head">' +
                '<span class="latex-lab-panel-label" id="' + pid('CatTitle') + '">Maths · Bases</span>' +
                '<span class="anki-mut latex-lab-palette-hint" id="' + pid('PaletteHint') + '">Sous-onglet</span>' +
              '</div>' +
              '<div class="latex-lab-subs" id="' + pid('Subs') + '" role="tablist"></div>' +
              '<div class="latex-lab-snip-grid" id="' + pid('Snips') + '" role="tabpanel"></div>' +
            '</div>' +
          '</section>' +
        '</div>' +
        '<details class="latex-lab-code-panel">' +
          '<summary class="latex-lab-code-summary">Code LaTeX <span class="anki-mut">— Espace = \\,</span></summary>' +
          '<textarea id="' + pid('Code') + '" class="latex-lab-code" rows="3" spellcheck="false" ' +
            'placeholder="\\frac{a}{b}"></textarea>' +
        '</details>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(host);
    refreshPalette('');
    wireSnips(gel('Quick'));

    var searchEl = gel('Search');
    if (searchEl) searchEl.addEventListener('input', function () { refreshPalette(searchEl.value); });
    host.querySelectorAll('[data-space]').forEach(function (btn) {
      btn.addEventListener('click', function () { insertSpaceLocal(btn.getAttribute('data-space')); });
    });
    var textBtn = gel('InsertText');
    if (textBtn) textBtn.addEventListener('click', function () { insertSnipLocal('\\text{#0}'); });
    var spaceToggle = gel('SpaceMode');
    if (spaceToggle) spaceToggle.addEventListener('change', function () { spaceMode = !!spaceToggle.checked; });
    var clearBtn = gel('Clear');
    if (clearBtn) clearBtn.addEventListener('click', function () {
      applyLatex('', true);
      var b = gel('Before'); var a = gel('After'); var c = gel('Code');
      if (b) b.value = '';
      if (a) a.value = '';
      if (c) c.value = '';
      syncPreview();
    });

    function wireMath() {
      mf = gel('Field');
      if (!mf) return;
      configureMathField(mf);
      mf.setAttribute('smart-mode', 'true');
      mf.addEventListener('input', syncFromEditor);
      mf.addEventListener('change', syncFromEditor);
      mf.addEventListener('keydown', function (e) {
        if (!spaceMode || e.key !== ' ' || e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        e.stopPropagation();
        insertSpaceLocal(e.shiftKey ? 'quad' : 'thin');
      }, true);

      var codeEl = gel('Code');
      if (codeEl) {
        codeEl.addEventListener('input', function () { applyLatex(codeEl.value, false); });
        codeEl.addEventListener('keydown', function (e) {
          if (!spaceMode || e.key !== ' ' || e.ctrlKey || e.metaKey || e.altKey) return;
          var start = codeEl.selectionStart;
          var end = codeEl.selectionEnd;
          var val = codeEl.value || '';
          if (isInsideTextCommand(val, start)) return;
          e.preventDefault();
          var token = e.shiftKey ? '\\quad' : '\\,';
          codeEl.value = val.slice(0, start) + token + val.slice(end);
          var pos = start + token.length;
          codeEl.setSelectionRange(pos, pos);
          applyLatex(codeEl.value, false);
        });
      }
      ['Before', 'After'].forEach(function (suf) {
        var el = gel(suf);
        if (el) el.addEventListener('input', syncPreview);
      });

      if (opts.seedInline != null) {
        var parts = parseLatexInlineForEditor(opts.seedInline);
        var b = gel('Before'); var a = gel('After');
        if (b) b.value = parts.before || '';
        if (a) a.value = parts.after || '';
        applyLatex(parts.latex || '', false);
      } else {
        syncFromEditor();
      }
      if (opts.autofocus !== false) {
        try { mf.focus(); } catch (e) { /* ignore */ }
      }
    }

    var ready = ensureMathLive().then(function () {
      return customElements.whenDefined('math-field');
    }).then(wireMath).catch(function (err) {
      host.insertAdjacentHTML('afterbegin',
        '<p class="latex-lab-error">' + escHtml((err && err.message) || 'MathLive indisponible') + '</p>');
      // Propager l’échec : sinon le popup active « Appliquer » et wipe les champs
      throw err || new Error('MathLive indisponible');
    });

    return {
      ready: ready,
      getInline: function () {
        return latexBuildInline(getBefore(), getLatex(), getAfter());
      },
      setFromInline: function (str) {
        var parts = parseLatexInlineForEditor(str);
        var b = gel('Before'); var a = gel('After');
        if (b) b.value = parts.before || '';
        if (a) a.value = parts.after || '';
        applyLatex(parts.latex || '', false);
      },
      focus: function () { try { if (mf) mf.focus(); } catch (e) { /* ignore */ } },
      destroy: function () {
        destroyed = true;
        mf = null;
        host.innerHTML = '';
      }
    };
  };
})();
