/**
 * nav-config.js — REGISTRE UNIQUE DES ONGLETS
 *
 * Ajouter un onglet : entrée dans APP_TAB_REGISTRY + APP_NAV_GROUPS + pane dans index.html.
 * Onglets v1 archivés : alias redirigés vers la V2 (code dans archive/anki-v1/).
 */
window.APP_TAB_REGISTRY = {
  home:        { pane: 'paneHome',        label: 'Accueil',       icon: 'home',           needsData: true,  onShow: 'dashboard' },
  cours:       { pane: 'paneCours',       label: 'Base Doc',     icon: 'clipboard-list', needsData: true,  onShow: 'cours' },
  notes:       { pane: 'paneNotes',       label: 'Notes',         icon: 'trending-up',    needsData: true,  onShow: 'notes' },
  flashcards:  { pane: 'paneFlashcards',  label: 'Rapide',        icon: 'zap',            needsData: true,  onShow: 'flashcards' },
  agenda:      { pane: 'paneAgenda',      label: 'Agenda',        icon: 'clipboard-list', needsData: true,  onShow: 'agenda' },
  anki:        { label: 'Synchrotron v1', nav: false, archived: true, archivedRedirect: 'ankiV2' },
  ankiV2:      { pane: 'paneAnkiV2',      label: 'Synchrotron',   icon: 'dna',            needsData: true,  onShow: 'ankiV2',      className: 'tab-anki' },
  ankiViz:     { label: 'Carte mentale v1', nav: false, archived: true, archivedRedirect: 'ankiVizV2' },
  ankiCompare: { label: 'v1 vs V2',      nav: false, archived: true, archivedRedirect: 'ankiV2' },
  ankiVizV2:   { pane: 'paneAnkiVizV2',   label: 'Carte mentale', icon: 'map',            needsData: true,  onShow: 'ankiVizV2',    className: 'tab-viz' },
  programme:     { pane: 'paneProgramme', label: 'Programme', icon: 'book-open', needsData: true, onShow: 'programme' },
  print:       { pane: 'panePrint',       label: 'Impression',    icon: 'printer',        needsData: true,  onShow: 'print' },
  programmeBrowse: { pane: 'paneProgrammeBrowse', label: 'Fil d’Ariane', icon: 'search', needsData: true, onShow: 'programmeBrowse', className: 'tab-prog-search' },
  classeurs:   { pane: 'paneClasseurs',   label: 'Classeurs',     icon: 'folders',        needsData: true,  onShow: 'classeurs' },
  matieres:    { pane: 'paneMatieres',    label: 'Matières',      icon: 'tag',            needsData: true,  onShow: 'matieres' },
  orphelins:   { pane: 'paneOrphelins',   label: 'À ranger',      icon: 'inbox',          needsData: true,  onShow: 'orphelins' },
  settings:    { pane: 'paneSettings',    label: 'Paramètres',    icon: 'settings',       needsData: true,  onShow: 'settings',      nav: false },
  logs:        { pane: 'paneLogs',        label: 'Logs',          icon: 'bug',            needsData: false, onShow: 'logs',          className: 'tab-logs' },
  test:        { pane: 'paneTest',        label: 'Diagnostic Scanner', icon: 'camera',    needsData: false, onShow: 'test',          className: 'tab-test' },
  latexTest:   { pane: 'paneLatexTest',  label: 'Labo LaTeX',    icon: 'flask-conical', needsData: false, onShow: 'latexTest',     className: 'tab-latex-test' },
  quickLatex:  { pane: 'paneQuickLatex', label: 'Carte LaTeX',   icon: 'sigma',         needsData: true,  onShow: 'quickLatex',    nav: false }
};

/** Groupes affichés dans la barre d'onglets (ordre conservé) */
window.APP_NAV_GROUPS = [
  {
    label: 'Navigation',
    tabs: ['home', 'cours', 'notes', 'flashcards', 'agenda']
  },
  {
    id: 'Sync',
    label: 'Synchrotron',
    tabs: ['ankiV2', 'ankiVizV2'],
    subNavAfter: 'ankiV2'
  },
  {
    label: 'Organisation',
    tabs: ['print', 'classeurs', 'matieres', 'programme', 'programmeBrowse', 'orphelins']
  },
  {
    label: 'Système',
    className: 'nav-group-tools',
    tabs: ['logs', 'test', 'latexTest']
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

  window.APP_NAV_SECTIONS.forEach(function (sec, idx) {
    var groupKey = sec.id || ('g' + idx);
    var gid = sec.id ? ' id="navGroup' + sec.id + '"' : '';
    var gcls = sec.className ? ' ' + sec.className : '';
    var itemsId = 'navGroupItems' + groupKey;
    html += '<div class="nav-group' + gcls + '"' + gid + ' data-nav-group="' + groupKey + '">';
    html += '<button type="button" class="nav-group-label nav-group-toggle" aria-expanded="false" aria-controls="' + itemsId + '">';
    html += '<span class="nav-group-toggle-label">' + sec.label + '</span>';
    html += '<span class="nav-group-chevron" data-icon="chevron-down" data-icon-size="14" aria-hidden="true"></span>';
    html += '</button>';
    html += '<div class="nav-group-items" id="' + itemsId + '">';
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
    html += '</div></div>';
  });

  bar.innerHTML = html;
  if (typeof window.hydrateIcons === 'function') window.hydrateIcons(bar);
  if (typeof window.syncMobileNavAccordion === 'function') window.syncMobileNavAccordion();
};

/** Accordéon des groupes nav — replié par défaut sur mobile uniquement */
window.syncMobileNavAccordion = function () {
  var mq = window.matchMedia('(max-width: 767px)');
  var groups = document.querySelectorAll('#tabsBar .nav-group');
  if (!groups.length) return;

  if (!mq.matches) {
    groups.forEach(function (g) {
      g.classList.add('is-open');
      var t = g.querySelector('.nav-group-toggle');
      if (t) t.setAttribute('aria-expanded', 'true');
    });
    return;
  }

  var activeGroup = null;
  groups.forEach(function (g) {
    if (g.querySelector('.tab.on')) activeGroup = g;
  });

  groups.forEach(function (g) {
    var open = g === activeGroup;
    g.classList.toggle('is-open', open);
    var t = g.querySelector('.nav-group-toggle');
    if (t) t.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
};

(function initMobileNavAccordion() {
  function onToggleClick(e) {
    var toggle = e.target.closest('#tabsBar .nav-group-toggle');
    if (!toggle) return;
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    if (!document.body.classList.contains('mobile-sidebar-expanded')) return;
    e.preventDefault();
    e.stopPropagation();
    var group = toggle.closest('.nav-group');
    if (!group) return;
    var opening = !group.classList.contains('is-open');
    document.querySelectorAll('#tabsBar .nav-group').forEach(function (g) {
      var open = opening && g === group;
      g.classList.toggle('is-open', open);
      var t = g.querySelector('.nav-group-toggle');
      if (t) t.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  document.addEventListener('click', onToggleClick);
  window.addEventListener('resize', function () {
    clearTimeout(window._navAccordionResizeT);
    window._navAccordionResizeT = setTimeout(window.syncMobileNavAccordion, 120);
  });
})();

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
