/**
 * anki-card-ui.js — Types de cartes W/X/Y · badges · picker de création
 */
(function () {
  const esc = s => (window.escHtml ? window.escHtml(s) : String(s || ''));

  window.CARD_TYPE_META = {
    devoir: {
      key: 'devoir',
      letter: 'W',
      label: 'Devoir',
      hint: 'DM, colle, exo à rendre · Agenda',
      color: 'var(--red)',
      icon: 'file-text'
    },
    main: {
      key: 'main',
      letter: 'X',
      label: 'Principale',
      hint: 'Cours, exo type · réservoir puis activation',
      color: 'var(--grn)',
      icon: 'brain'
    },
    quick: {
      key: 'quick',
      letter: 'Y',
      label: 'Rapide',
      hint: 'Flash ~30 s · active directement',
      color: 'var(--acc)',
      icon: 'zap'
    }
  };

  function algo() {
    return window.AnkiAlgoV2 || window.AnkiAlgo || null;
  }

  window.cardTypeKind = function (card) {
    if (!card) return 'main';
    if (card.type === 'devoir' || card.type === 'devoir-morceau') return 'devoir';
    const A = algo();
    if (A && typeof A.cardKind === 'function') {
      const k = A.cardKind(card);
      if (k === 'devoir') return 'devoir';
      if (k === 'quick') return 'quick';
    }
    if (card.id && String(card.id).charAt(0) === 'Y') return 'quick';
    if (card.id && String(card.id).charAt(0) === 'W') return 'devoir';
    return 'main';
  };

  window.cardTypeMeta = function (kind) {
    return window.CARD_TYPE_META[kind] || window.CARD_TYPE_META.main;
  };

  window.cardTypeBadgeHtml = function (kind, opts) {
    const m = window.cardTypeMeta(kind);
    const o = opts || {};
    const cls = 'card-type-badge card-type-' + m.key + (o.className ? ' ' + o.className : '');
    return `<span class="${cls}" title="${esc(m.label)}">${m.letter}</span>`;
  };

  window.cardTypeSurfaceClass = function (kind) {
    const m = window.cardTypeMeta(kind);
    return 'card-type-surface card-type-' + m.key;
  };

  window.cardTypeSurfaceStyle = function (kind) {
    const m = window.cardTypeMeta(kind);
    return `--card-type-color:${m.color};`;
  };

  function injectStyles() {
    if (document.getElementById('anki-card-ui-styles')) return;
    const tag = document.createElement('style');
    tag.id = 'anki-card-ui-styles';
    tag.textContent = `
.card-type-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.15rem;
  height: 1.15rem;
  padding: 0 0.28rem;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  font-family: 'DM Mono', ui-monospace, monospace;
  letter-spacing: 0.03em;
  vertical-align: middle;
  flex-shrink: 0;
}
.card-type-badge.card-type-devoir { background: rgba(233,79,100,0.14); color: var(--red); border: 1px solid rgba(233,79,100,0.32); }
.card-type-badge.card-type-main   { background: rgba(76,175,125,0.12); color: var(--grn); border: 1px solid rgba(76,175,125,0.30); }
.card-type-badge.card-type-quick  { background: rgba(91,141,247,0.12); color: var(--acc); border: 1px solid rgba(91,141,247,0.30); }

.card-type-surface.card-type-devoir { background: rgba(233,79,100,0.055) !important; border-color: rgba(233,79,100,0.20) !important; }
.card-type-surface.card-type-main   { background: rgba(76,175,125,0.055) !important; border-color: rgba(76,175,125,0.20) !important; }
.card-type-surface.card-type-quick  { background: rgba(91,141,247,0.055) !important; border-color: rgba(91,141,247,0.20) !important; }

.card-type-picker-modal { max-width: 520px; }
.card-type-picker-modal h2 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.card-type-picker-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}
@media (max-width: 560px) {
  .card-type-picker-grid { grid-template-columns: 1fr; }
}
.card-type-picker-opt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 14px 12px;
  border-radius: 10px;
  border: 1px solid var(--bd);
  background: var(--s1);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s, transform 0.12s;
}
.card-type-picker-opt:hover {
  transform: translateY(-1px);
  border-color: var(--card-type-color, var(--acc));
  background: color-mix(in srgb, var(--card-type-color, var(--acc)) 6%, var(--s1));
}
.card-type-picker-opt strong { font-size: 14px; color: var(--txt); }
.card-type-picker-opt span.card-type-picker-hint { font-size: 11px; color: var(--mut); line-height: 1.35; }
.card-type-picker-opt .card-type-badge { width: 1.6rem; height: 1.6rem; font-size: 11px; }

.anki-fab-create {
  position: fixed;
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  right: calc(20px + env(safe-area-inset-right, 0px));
  z-index: 140;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--bd);
  background: var(--s2);
  color: var(--txt);
  box-shadow: 0 4px 18px rgba(0,0,0,0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
  transition: transform 0.12s, box-shadow 0.12s, background 0.12s;
}
.anki-fab-create:hover {
  transform: scale(1.04);
  box-shadow: 0 6px 22px rgba(0,0,0,0.28);
  background: var(--s3);
}
body.nav-sidebar-left .anki-fab-create { right: calc(24px + env(safe-area-inset-right, 0px)); }
#paneFlashcards .anki-fab-create { background: rgba(91,141,247,0.12); border-color: rgba(91,141,247,0.35); color: var(--acc); }
#paneAnkiV2 .anki-fab-create { background: rgba(76,175,125,0.10); border-color: rgba(76,175,125,0.32); color: var(--grn); }

.anki-q-row .card-type-badge,
.anki-devoir-row .card-type-badge,
.anki-lib-row .card-type-badge,
.anki-cal-row .card-type-badge,
.anki-pcard .card-type-badge { margin-right: 4px; }
.anki-q-row { align-items: center; }
.anki-devoir-row { align-items: center; gap: 6px; }
.anki-lib-row { align-items: center; gap: 8px; }
`;
    document.head.appendChild(tag);
  }

  function ensurePickerOverlay() {
    injectStyles();
    let ov = document.getElementById('ovCardTypePicker');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'ovCardTypePicker';
      ov.className = 'ov hidden';
      document.body.appendChild(ov);
    }
    return ov;
  }

  window.openCardTypePicker = function (opts) {
    injectStyles();
    window._cardCreateOpts = Object.assign({}, opts || {});
    const ov = ensurePickerOverlay();
    const linked = window._cardCreateOpts.coursId
      ? (window.D.cours || []).find(c => c.uid === window._cardCreateOpts.coursId)
      : null;
    const linkedHint = linked
      ? `<p class="anki-mut" style="font-size:12px;margin:6px 0 0;">Lié au cours <b>${esc(linked.uid)}</b> · ${esc(linked.title)}</p>`
      : '';

    ov.innerHTML = `
      <div class="modal card-type-picker-modal" role="dialog" aria-labelledby="cardTypePickerTitle">
        <h2 id="cardTypePickerTitle">${window.iconLabel ? window.iconLabel('plus', 'Créer une carte') : 'Créer une carte'}</h2>
        <p class="anki-mut" style="font-size:13px;margin:0;">Choisis le type — le formulaire s'adapte ensuite.</p>
        ${linkedHint}
        <div class="card-type-picker-grid">
          ${['devoir', 'main', 'quick'].map(k => {
            const m = window.cardTypeMeta(k);
            return `<button type="button" class="card-type-picker-opt card-type-${k}" style="--card-type-color:${m.color};" onclick="window.pickCardType('${k}')">
              ${window.cardTypeBadgeHtml(k)}
              <strong>${esc(m.label)}</strong>
              <span class="card-type-picker-hint">${esc(m.hint)}</span>
            </button>`;
          }).join('')}
        </div>
        <div class="macts" style="margin-top:16px;">
          <button type="button" class="bs" onclick="window.closeCardTypePicker()">Annuler</button>
        </div>
      </div>`;
    ov.classList.remove('hidden');
    if (window.hydrateIcons) window.hydrateIcons(ov);
  };

  window.closeCardTypePicker = function () {
    const ov = document.getElementById('ovCardTypePicker');
    if (ov) ov.classList.add('hidden');
  };

  window.pickCardType = function (kind) {
    const opts = Object.assign({}, window._cardCreateOpts || {});
    window.closeCardTypePicker();
    if (kind === 'devoir' && typeof window.ankiV2OpenDevoirModal === 'function') {
      window.ankiV2OpenDevoirModal(opts);
    } else if (kind === 'main' && typeof window.ankiV2OpenExoModal === 'function') {
      window.ankiV2OpenExoModal(opts);
    } else if (kind === 'quick' && typeof window.ankiV2OpenQuickModal === 'function') {
      window.ankiV2OpenQuickModal(opts);
    }
  };

  window.openCardCreateForCours = function (coursUid) {
    const co = (window.D && window.D.cours || []).find(x => x.uid === coursUid);
    if (!co) return;
    if (typeof window.closeLocPopup === 'function') window.closeLocPopup();
    window.openCardTypePicker({ coursId: coursUid, mat: co.mat });
  };

  window.renderCardCreateFab = function (paneId, onclick) {
    injectStyles();
    const fn = onclick || 'window.openCardTypePicker()';
    return `<button type="button" class="anki-fab-create" aria-label="Créer une carte" title="Créer une carte" onclick="${fn}">${window.iconHtml ? window.iconHtml('plus', 22) : '+'}</button>`;
  };

  injectStyles();
})();
