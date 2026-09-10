/**
 * form-controls.js — Flatpickr, Choices.js, toggles (thème Liquid Glass)
 * Dépend de : flatpickr.min.js, flatpickr-fr.js, choices.min.js
 */
(function () {
  'use strict';

  var FP_OPTS = {
    locale: (window.flatpickr && window.flatpickr.l10ns && window.flatpickr.l10ns.fr) || 'default',
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'j F Y',
    disableMobile: false,
    allowInput: false
  };

  function $(id) { return document.getElementById(id); }

  window.fcDestroyScope = function (root) {
    if (!root) return;
    root.querySelectorAll('select').forEach(function (sel) {
      if (sel._choices) {
        sel._choices.destroy();
        sel._choices = null;
      }
    });
    root.querySelectorAll('input').forEach(function (inp) {
      if (inp._flatpickr) {
        inp._flatpickr.destroy();
        inp._flatpickr = null;
      }
    });
  };

  window.fcRefreshSelect = function (sel, html) {
    if (!sel) return;
    if (sel._choices) {
      sel._choices.destroy();
      sel._choices = null;
    }
    if (html !== undefined) sel.innerHTML = html;
    window.fcEnhanceSelect(sel);
  };

  /** Définit la valeur d'un <select>, y compris s'il est wrappé par Choices.js */
  window.fcSetSelectValue = function (sel, value) {
    if (!sel) return;
    var v = value == null ? '' : String(value);
    sel.value = v;
    if (sel._choices) {
      try {
        sel._choices.setChoiceByValue(v);
      } catch (e) {
        try { sel._choices.setChoiceByValue([v]); } catch (e2) {}
      }
    }
  };

  window.fcEnhanceSelect = function (sel) {
    if (!sel || sel.tagName !== 'SELECT' || sel.multiple || sel.dataset.fcSkip !== undefined) return;
    if (!window.Choices) return;
    if (sel._choices) return;

    var n = sel.options ? sel.options.length : 0;
    var inst = new Choices(sel, {
      searchEnabled: n > 12,
      itemSelectText: '',
      shouldSort: false,
      allowHTML: false,
      position: 'auto',
      classNames: {
        containerOuter: 'choices fc-choices'
      }
    });
    sel._choices = inst;
  };

  window.fcEnhanceDate = function (inp) {
    if (!inp || inp.dataset.fcSkip !== undefined) return;
    if (!window.flatpickr) return;
    if (inp._flatpickr) return;

    var wrap = inp.parentElement;
    if (!wrap || !wrap.classList.contains('fc-date-wrap')) {
      wrap = document.createElement('div');
      wrap.className = 'fc-date-wrap';
      inp.parentNode.insertBefore(wrap, inp);
      wrap.appendChild(inp);
      var ic = document.createElement('span');
      ic.className = 'fc-date-icon';
      ic.setAttribute('aria-hidden', 'true');
      if (typeof window.icon === 'function') {
        ic.innerHTML = window.icon('calendar', 16);
      }
      wrap.appendChild(ic);
    }

    inp._flatpickr = window.flatpickr(inp, Object.assign({}, FP_OPTS, {
      defaultDate: inp.value || null
    }));
  };

  function wrapCheckbox(inp) {
    if (!inp || inp.type !== 'checkbox' || inp.dataset.fcSkip !== undefined) return;
    if (inp.closest('.fc-toggle')) return;

    var label = document.createElement('label');
    label.className = 'fc-toggle';
    if (inp.classList.contains('anki-pick') || inp.closest('.anki-pick')) {
      label.classList.add('fc-toggle-sm');
    }

    var track = document.createElement('span');
    track.className = 'fc-toggle-track';
    track.setAttribute('aria-hidden', 'true');

    inp.parentNode.insertBefore(label, inp);
    label.appendChild(inp);
    label.appendChild(track);

    var lbl = inp.getAttribute('data-fc-label');
    if (lbl) {
      var span = document.createElement('span');
      span.className = 'fc-toggle-label';
      span.textContent = lbl;
      label.appendChild(span);
    }
  }

  function enhanceNumbers(scope) {
    scope.querySelectorAll('input[type="number"]:not([data-fc-skip])').forEach(function (inp) {
      inp.classList.add('fc-number');
      inp.setAttribute('inputmode', 'decimal');
    });
  }

  window.enhanceFormControls = function (root) {
    var scope = root && root.querySelectorAll ? root : document;

    scope.querySelectorAll('input[type="date"]:not([data-fc-skip])').forEach(window.fcEnhanceDate);
    scope.querySelectorAll('select:not([data-fc-skip])').forEach(window.fcEnhanceSelect);
    scope.querySelectorAll('input[type="checkbox"]:not([data-fc-skip])').forEach(wrapCheckbox);
    enhanceNumbers(scope);
  };

  /* Modal « Décaler » — Synchrotron → Bibliothèque → icône calendrier sur une carte */
  window.fcOpenShiftDate = function (opts) {
    opts = opts || {};
    var cur = opts.current || '';
    var onApply = opts.onApply;

    var ov = $('fcShiftOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'fcShiftOverlay';
      ov.className = 'ov hidden';
      ov.innerHTML =
        '<div class="modal">' +
        '<h2 style="margin-bottom:4px;display:flex;align-items:center;gap:8px;">' +
        '<span data-icon="calendar" data-icon-size="18"></span> Décaler la révision</h2>' +
        '<p id="fcShiftSub" style="font-size:12px;color:var(--mut);margin-bottom:8px;"></p>' +
        '<div class="fc-shift-current" id="fcShiftCur"></div>' +
        '<div class="fc-shift-quick" id="fcShiftQuick"></div>' +
        '<div class="fc-shift-picker fg">' +
        '<label>Choisir une date précise</label>' +
        '<div id="fcShiftPickerMount"></div>' +
        '<input type="text" id="fcShiftDateInp" data-fc-skip readonly tabindex="-1" aria-hidden="true" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;">' +
        '</div>' +
        '<div class="macts">' +
        '<button type="button" class="bs" id="fcShiftCancel">Annuler</button>' +
        '<button type="button" class="bp" id="fcShiftApply">Appliquer</button>' +
        '</div></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) {
        if (e.target === ov) ov.classList.add('hidden');
      });
      $('fcShiftCancel').addEventListener('click', function () { ov.classList.add('hidden'); });
    }

    $('fcShiftSub').textContent = opts.subtitle || '';
    $('fcShiftCur').textContent = 'Actuellement : ' + (cur || '—');

    var quick = $('fcShiftQuick');
    quick.innerHTML = '';

    var mount = $('fcShiftPickerMount');
    var hidden = $('fcShiftDateInp');
    if (hidden._flatpickr) {
      hidden._flatpickr.destroy();
      hidden._flatpickr = null;
    }
    if (mount) mount.innerHTML = '';

    function shiftBaseDate() {
      var fp0 = hidden._flatpickr;
      if (fp0 && fp0.selectedDates && fp0.selectedDates[0]) {
        return fp0.formatDate(fp0.selectedDates[0], 'Y-m-d');
      }
      return cur || '';
    }

    function updateShiftPreview(dateStr) {
      var el = $('fcShiftCur');
      if (!el) return;
      el.textContent = dateStr ? ('Nouvelle date : ' + dateStr) : ('Actuellement : ' + (cur || '—'));
    }

    hidden._flatpickr = window.flatpickr(hidden, {
      locale: FP_OPTS.locale,
      dateFormat: 'Y-m-d',
      altInput: false,
      inline: true,
      disableMobile: true,
      defaultDate: cur || null,
      appendTo: mount || document.body,
      onChange: function (_selected, dateStr) {
        if (dateStr) updateShiftPreview(dateStr);
      }
    });
    updateShiftPreview(cur || '');

    [{ d: 1, l: '+1 j' }, { d: 3, l: '+3 j' }, { d: 7, l: '+7 j' }, { d: 14, l: '+14 j' }, { d: -1, l: '−1 j' }].forEach(function (q) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = q.l;
      b.addEventListener('click', function () {
        if (window.AnkiAlgo && window.AnkiAlgo.addDays && hidden._flatpickr) {
          var base = shiftBaseDate() || cur || window.AnkiAlgo.todayISO();
          var next = window.AnkiAlgo.addDays(base, q.d);
          hidden._flatpickr.setDate(next, true);
          updateShiftPreview(next);
        }
      });
      quick.appendChild(b);
    });

    $('fcShiftApply').onclick = function () {
      var fp = hidden._flatpickr;
      var val = '';
      if (fp && fp.selectedDates && fp.selectedDates[0]) {
        val = fp.formatDate(fp.selectedDates[0], 'Y-m-d');
      } else if (cur) {
        val = cur;
      }
      if (!val) return;
      if (typeof onApply === 'function') onApply(val);
      ov.classList.add('hidden');
    };

    ov.classList.remove('hidden');
    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(ov);
  };

  var origHydrate = window.hydrateIcons;
  window.hydrateIcons = function (root) {
    if (origHydrate) origHydrate(root);
    window.enhanceFormControls(root);
  };

  function boot() {
    window.enhanceFormControls(document);
    var filters = document.querySelector('.filters');
    if (filters) window.enhanceFormControls(filters);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
