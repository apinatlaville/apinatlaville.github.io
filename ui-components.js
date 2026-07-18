/**
 * Composants UI réutilisables — HTML cohérent, thème via classes CSS.
 * Boutons : .bp (principal) · .bs (secondaire) · --btn-accent pour la couleur
 */
(function () {
  function esc(s) {
    return window.escHtml(s);
  }

  /** Noms sémantiques → variable CSS */
  window.UI_BTN_COLORS = {
    accent: 'var(--acc)',
    blue: 'var(--acc)',
    green: 'var(--grn-btn)',
    grn: 'var(--grn-btn)',
    red: 'var(--red)',
    gold: 'var(--gold)'
  };

  window.resolveUiBtnColor = function (value) {
    if (!value) return '';
    if (window.UI_BTN_COLORS[value]) return window.UI_BTN_COLORS[value];
    return value;
  };

  window.uiBtnStyleAttrs = function (opts) {
    opts = opts || {};
    var parts = [];
    var color = window.resolveUiBtnColor(opts.color);
    if (color) parts.push('--btn-accent:' + color);
    if (opts.width) parts.push('width:' + opts.width);
    if (opts.style) parts.push(opts.style);
    return parts.join('');
  };

  /**
   * Bouton unifié — variant: 'primary' (.bp) | 'secondary' (.bs)
   * color: 'green' | 'red' | '#50d890' | 'var(--grn)' …
   * size: 'sm' | 'lg'
   * danger / gold : raccourcis sur .bp
   */
  window.uiBtn = function (label, opts) {
    opts = opts || {};
    var isSecondary = opts.variant === 'secondary';
    var base = isSecondary ? 'bs ui-btn-surface' : 'bp ui-btn-accent';
    var size = opts.size === 'sm' ? ' ui-btn-sm' : (opts.size === 'lg' ? ' ui-btn-lg' : '');
    var mods = '';
    if (!isSecondary) {
      if (opts.danger || opts.color === 'red') mods += ' bp-danger';
      if (opts.gold || opts.color === 'gold') mods += ' bp-gold';
    }
    var extra = opts.className ? ' ' + opts.className : '';
    var attrs = opts.attrs || '';
    var click = opts.onclick ? ' onclick="' + esc(opts.onclick) + '"' : '';
    var testid = opts.testid ? ' data-testid="' + esc(opts.testid) + '"' : '';
    var styleStr = window.uiBtnStyleAttrs(opts);
    var style = styleStr ? ' style="' + esc(styleStr) + '"' : '';
    var disabled = opts.disabled ? ' disabled' : '';
    return '<button type="button" class="' + base + size + mods + extra + '"' + click + testid + style + disabled + attrs + '>' + label + '</button>';
  };

  window.uiBtnSurface = function (label, opts) {
    return window.uiBtn(label, Object.assign({}, opts || {}, { variant: 'secondary' }));
  };

  window.uiBtnAccent = function (label, opts) {
    return window.uiBtn(label, Object.assign({}, opts || {}, { variant: 'primary' }));
  };

  window.uiDialogActions = function (opts) {
    opts = opts || {};
    var M = window.APP_MSG || {};
    var cancelLabel = opts.cancelLabel || M.CANCEL || 'Annuler';
    var confirmLabel = opts.confirmLabel || M.CONFIRM || 'Confirmer';
    var cancelClick = opts.cancelClick || 'window.closeSysDialog()';
    var confirmClick = opts.confirmClick || '';
    return (
      window.uiBtnSurface(cancelLabel, { onclick: cancelClick, className: 'ui-dialog-cancel' }) +
      window.uiBtnAccent(confirmLabel, {
        onclick: confirmClick,
        className: 'ui-dialog-confirm',
        color: opts.confirmColor || (opts.confirmDanger ? 'red' : '')
      })
    );
  };

  /**
   * Pied de modal formulaire : Annuler (ferme overlay) + action principale.
   * opts: { overlayId, saveClick, saveLabel, cancelLabel }
   */
  window.uiModalActions = function (opts) {
    opts = opts || {};
    var M = window.APP_MSG || {};
    var cancelLabel = opts.cancelLabel || M.CANCEL || 'Annuler';
    var saveLabel = opts.saveLabel || M.SAVE || 'Enregistrer';
    var overlayId = opts.overlayId || '';
    var cancelClick = opts.cancelClick ||
      (overlayId ? "window.hideOverlay('" + overlayId + "')" : '');
    var saveClick = opts.saveClick || '';
    return (
      window.uiBtnSurface(cancelLabel, { onclick: cancelClick }) +
      window.uiBtnAccent(saveLabel, {
        onclick: saveClick,
        color: opts.saveColor || '',
        danger: !!opts.saveDanger
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

  window.uiNotice = function (msg, opts) {
    opts = opts || {};
    const variant = opts.variant || 'info';
    const title = opts.title
      ? '<div class="ui-notice-title">' + (opts.titleIcon || '') + esc(opts.title) + '</div>'
      : '';
    return '<div class="ui-notice ui-notice--' + esc(variant) + '" role="status">' + title + msg + '</div>';
  };

  window.uiEmpty = function (msg, opts) {
    opts = opts || {};
    const icon = opts.icon
      ? '<span class="ui-empty-icon">' + (typeof window.iconLabel === 'function' ? window.iconLabel(opts.icon, '') : '') + '</span>'
      : '';
    return '<div class="ui-empty">' + icon + esc(msg) + '</div>';
  };

  window.uiPanel = function (innerHtml, opts) {
    opts = opts || {};
    const extra = opts.className ? ' ' + opts.className : '';
    const id = opts.id ? ' id="' + esc(opts.id) + '"' : '';
    return '<div class="ui-panel' + extra + '"' + id + '>' + innerHtml + '</div>';
  };

  window.uiBadge = function (label, opts) {
    opts = opts || {};
    const variant = opts.variant || 'default';
    const dot = opts.dot ? '<span class="ui-dot ui-dot--' + esc(opts.dot) + '"></span>' : '';
    return '<span class="ui-badge ui-badge--' + esc(variant) + '">' + dot + esc(label) + '</span>';
  };

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

  window.uiLogEntry = function (entry) {
    return (
      '<div class="ui-log-entry">' +
      '<div class="ui-log-meta">' + esc(entry.time) + ' — Source: ' + esc(entry.source) + '</div>' +
      '<div class="ui-log-msg">' + esc(entry.msg) + '</div>' +
      '</div>'
    );
  };
})();
