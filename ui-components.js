/**
 * Composants UI réutilisables — HTML cohérent, thème via classes CSS.
 * Utilitaires : window.escHtml (core-utils.js)
 * Familles : boutons · notices · panneaux · badges · sections · logs
 */
(function () {
  function esc(s) {
    return window.escHtml(s);
  }

  window.uiBtnSurface = function (label, opts) {
    opts = opts || {};
    const on = opts.on ? ' on' : '';
    const extra = opts.className ? ' ' + opts.className : '';
    const attrs = opts.attrs || '';
    const click = opts.onclick ? ' onclick="' + esc(opts.onclick) + '"' : '';
    const testid = opts.testid ? ' data-testid="' + esc(opts.testid) + '"' : '';
    return '<button type="button" class="ui-btn-surface bs' + on + extra + '"' + click + testid + attrs + '>' + label + '</button>';
  };

  window.uiBtnAccent = function (label, opts) {
    opts = opts || {};
    const extra = opts.className ? ' ' + opts.className : '';
    const attrs = opts.attrs || '';
    const click = opts.onclick ? ' onclick="' + esc(opts.onclick) + '"' : '';
    const testid = opts.testid ? ' data-testid="' + esc(opts.testid) + '"' : '';
    const style = opts.style ? ' style="' + esc(opts.style) + '"' : '';
    const disabled = opts.disabled ? ' disabled' : '';
    return '<button type="button" class="ui-btn-accent bp' + extra + '"' + click + testid + style + disabled + attrs + '>' + label + '</button>';
  };

  window.uiDialogActions = function (opts) {
    opts = opts || {};
    const cancelLabel = opts.cancelLabel || 'Annuler';
    const confirmLabel = opts.confirmLabel || 'Confirmer';
    const cancelClick = opts.cancelClick || 'window.closeSysDialog()';
    const confirmClick = opts.confirmClick || '';
    return (
      window.uiBtnSurface(cancelLabel, { onclick: cancelClick, className: 'ui-dialog-cancel' }) +
      window.uiBtnAccent(confirmLabel, {
        onclick: confirmClick,
        className: 'ui-dialog-confirm',
        style: opts.confirmDanger ? 'background:var(--red);border-color:var(--red);' : ''
      })
    );
  };

  window.uiTile = function (value, label, opts) {
    opts = opts || {};
    const color = opts.color ? ' style="color:' + esc(opts.color) + ';"' : '';
    const id = opts.id ? ' id="' + esc(opts.id) + '"' : '';
    return (
      '<div class="kpi ui-tile">' +
      '<div class="kpi-n"' + id + color + '>' + value + '</div>' +
      '<div class="kpi-l">' + esc(label) + '</div>' +
      '</div>'
    );
  };

  /** Alerte / info inline — variant: info | success | warn | error */
  window.uiNotice = function (msg, opts) {
    opts = opts || {};
    const variant = opts.variant || 'info';
    const title = opts.title
      ? '<div class="ui-notice-title">' + (opts.titleIcon || '') + esc(opts.title) + '</div>'
      : '';
    return '<div class="ui-notice ui-notice--' + esc(variant) + '" role="status">' + title + msg + '</div>';
  };

  /** État vide centré */
  window.uiEmpty = function (msg, opts) {
    opts = opts || {};
    const icon = opts.icon
      ? '<span class="ui-empty-icon">' + (typeof window.iconLabel === 'function' ? window.iconLabel(opts.icon, '') : '') + '</span>'
      : '';
    return '<div class="ui-empty">' + icon + esc(msg) + '</div>';
  };

  /** Panneau conteneur */
  window.uiPanel = function (innerHtml, opts) {
    opts = opts || {};
    const extra = opts.className ? ' ' + opts.className : '';
    const id = opts.id ? ' id="' + esc(opts.id) + '"' : '';
    return '<div class="ui-panel' + extra + '"' + id + '>' + innerHtml + '</div>';
  };

  /** Badge / indicateur */
  window.uiBadge = function (label, opts) {
    opts = opts || {};
    const variant = opts.variant || 'default';
    const dot = opts.dot ? '<span class="ui-dot ui-dot--' + esc(opts.dot) + '"></span>' : '';
    return '<span class="ui-badge ui-badge--' + esc(variant) + '">' + dot + esc(label) + '</span>';
  };

  /** Section titre + description */
  window.uiSection = function (title, desc, opts) {
    opts = opts || {};
    const tone = opts.tone ? ' ui-section-title--' + opts.tone : '';
    const icon = opts.icon && typeof window.iconLabel === 'function'
      ? window.iconLabel(opts.icon, '')
      : (opts.iconHtml || '');
    return (
      '<div class="ui-section">' +
      '<h2 class="ui-section-title' + tone + '">' + icon + esc(title) + '</h2>' +
      (desc ? '<p class="ui-section-desc">' + desc + '</p>' : '') +
      '</div>'
    );
  };

  /** Entrée journal d'erreurs */
  window.uiLogEntry = function (entry) {
    return (
      '<div class="ui-log-entry">' +
      '<div class="ui-log-meta">' + esc(entry.time) + ' — Source: ' + esc(entry.source) + '</div>' +
      '<div class="ui-log-msg">' + esc(entry.msg) + '</div>' +
      '</div>'
    );
  };
})();
