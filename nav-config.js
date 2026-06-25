/**
 * nav-config.js — REGISTRE UNIQUE DES ONGLETS
 *
 * Pour ajouter un onglet :
 * 1. Ajouter une entrée dans APP_TAB_REGISTRY
 * 2. Ajouter son id dans APP_NAV_GROUPS (sauf settings → nav:false)
 * 3. Créer <div class="pane ui-pane" id="paneX"> dans index.html
 * 4. Implémenter window.renderX si besoin (ou utiliser onShow existant)
 *
 * Onglets archivés (Synchrotron v1) : nav:false + archived:true.
 * Le code (anki-app.js, anki-viz.js…) reste chargé ; switchTab redirige vers la V2.
 */
window.APP_TAB_REGISTRY = {
  home:        { pane: 'paneHome',        label: 'Accueil',       icon: 'home',           needsData: true,  onShow: 'dashboard' },
  cours:       { pane: 'paneCours',       label: 'Base Doc.',     icon: 'clipboard-list', needsData: true,  onShow: 'cours' },
  notes:       { pane: 'paneNotes',       label: 'Notes',         icon: 'trending-up',    needsData: true,  onShow: 'notes' },
  flashcards:  { pane: 'paneFlashcards',  label: 'Rapide',        icon: 'zap',            needsData: true,  onShow: 'flashcards' },
  anki:        { pane: 'paneAnki',        label: 'Synchrotron v1', icon: 'dna',           needsData: true,  onShow: 'anki',        className: 'tab-anki', nav: false, archived: true, archivedRedirect: 'ankiV2' },
  ankiV2:      { pane: 'paneAnkiV2',      label: 'Synchrotron',   icon: 'dna',            needsData: true,  onShow: 'ankiV2',      className: 'tab-anki' },
  ankiViz:     { pane: 'paneAnkiViz',     label: 'Carte mentale v1', icon: 'map',         needsData: true,  onShow: 'ankiViz',      className: 'tab-viz', nav: false, archived: true, archivedRedirect: 'ankiVizV2' },
  ankiCompare: { pane: 'paneAnkiCompare', label: 'v1 vs V2',      icon: 'git-compare',    needsData: true,  onShow: 'ankiCompare',   className: 'tab-viz', nav: false, archived: true, archivedRedirect: 'ankiV2' },
  ankiVizV2:   { pane: 'paneAnkiVizV2',   label: 'Carte mentale', icon: 'map',            needsData: true,  onShow: 'ankiVizV2',    className: 'tab-viz' },
  print:       { pane: 'panePrint',       label: 'Impression',    icon: 'printer',        needsData: true,  onShow: 'print' },
  classeurs:   { pane: 'paneClasseurs',   label: 'Classeurs',     icon: 'folders',        needsData: true,  onShow: 'classeurs' },
  matieres:    { pane: 'paneMatieres',    label: 'Matières',      icon: 'tag',            needsData: true,  onShow: 'matieres' },
  settings:    { pane: 'paneSettings',    label: 'Paramètres',    icon: 'settings',       needsData: true,  onShow: 'settings',      nav: false },
  logs:        { pane: 'paneLogs',        label: 'Logs',          icon: 'bug',            needsData: false, onShow: 'logs',          className: 'tab-logs' },
  test:        { pane: 'paneTest',        label: 'Diagnostic Scanner', icon: 'camera',    needsData: false, onShow: 'test',          className: 'tab-test' }
};

/** Groupes affichés dans la barre d'onglets (ordre conservé) */
window.APP_NAV_GROUPS = [
  {
    label: 'Navigation',
    tabs: ['home', 'cours', 'notes', 'flashcards']
  },
  {
    id: 'Sync',
    label: 'Synchrotron',
    tabs: ['ankiV2', 'ankiVizV2'],
    subNavAfter: 'ankiV2'
  },
  {
    label: 'Organisation',
    tabs: ['print', 'classeurs', 'matieres']
  },
  {
    label: 'Système',
    className: 'nav-group-tools',
    tabs: ['logs', 'test']
  }
];

window.getTabDef = function (tabId) {
  return window.APP_TAB_REGISTRY[tabId] || null;
};

/** Résout un id d'onglet archivé vers son remplaçant actif (ex. anki → ankiV2). */
window.resolveTabId = function (tabId) {
  var def = window.getTabDef(tabId);
  if (def && def.archived && def.archivedRedirect) return def.archivedRedirect;
  return tabId;
};

window.getTabPaneId = function (tabId) {
  var def = window.getTabDef(tabId);
  return def ? def.pane : null;
};

window.getTabsNeedingData = function () {
  return Object.keys(window.APP_TAB_REGISTRY).filter(function (id) {
    return window.APP_TAB_REGISTRY[id].needsData;
  });
};

/** Rétrocompatibilité */
window.APP_TAB_TITLES = {};
Object.keys(window.APP_TAB_REGISTRY).forEach(function (id) {
  window.APP_TAB_TITLES[id] = window.APP_TAB_REGISTRY[id].label;
});

window.APP_NAV_SECTIONS = window.APP_NAV_GROUPS.map(function (grp) {
  return {
    id: grp.id,
    label: grp.label,
    className: grp.className,
    subNavAfter: grp.subNavAfter,
    items: grp.tabs.map(function (tabId) {
      var def = window.APP_TAB_REGISTRY[tabId];
      if (!def || def.nav === false) return null;
      return {
        tab: tabId,
        icon: def.icon,
        label: def.label,
        className: def.className,
        style: def.style
      };
    }).filter(Boolean)
  };
});

window.renderAppNav = function (activeTab) {
  var bar = document.getElementById('tabsBar');
  if (!bar || !window.APP_NAV_SECTIONS) return;

  var active = activeTab || window._activeTab || 'home';
  var html = '';

  window.APP_NAV_SECTIONS.forEach(function (sec) {
    var gid = sec.id ? ' id="navGroup' + sec.id + '"' : '';
    var gcls = sec.className ? ' ' + sec.className : '';
    html += '<div class="nav-group' + gcls + '"' + gid + '>';
    html += '<div class="nav-group-label">' + sec.label + '</div>';
    sec.items.forEach(function (item) {
      var on = item.tab === active ? ' on' : '';
      var cls = item.className ? ' ' + item.className : '';
      var sty = item.style ? ' style="' + item.style + '"' : '';
      html += '<button type="button" class="tab' + cls + on + '" data-tab="' + item.tab + '"' + sty + '>';
      html += '<span data-icon="' + item.icon + '"></span> ' + item.label;
      html += '</button>';
      if (sec.subNavAfter && item.tab === sec.subNavAfter) {
        html += '<div id="navSubNav" class="nav-sub hidden" aria-label="Sous-navigation"></div>';
      }
    });
    html += '</div>';
  });

  bar.innerHTML = html;
  if (typeof window.hydrateIcons === 'function') window.hydrateIcons(bar);
};

(function bootNav() {
  function init() {
    window.renderAppNav(window._activeTab || 'home');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
