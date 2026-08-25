/**
 * agenda.js — Onglet Agenda (hors Synchrotron)
 * Liste simple des devoirs W- : CRUD + marquer terminé. Pas de découpage / session.
 */
(function () {
  'use strict';

  var _editingId = null;

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return typeof window.escHtml === 'function'
      ? window.escHtml(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
  }

  function todayISO() {
    if (window.AnkiAlgoV2 && typeof window.AnkiAlgoV2.todayISO === 'function') {
      return window.AnkiAlgoV2.todayISO();
    }
    if (typeof window.todayISO === 'function') return window.todayISO();
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function mat(id) {
    return (window.D && window.D.matieres || []).find(function (m) { return m.id === id; })
      || { color: '#666', label: id || '?', name: id || '?' };
  }

  function fieldVal(id) {
    var el = $(id);
    return el ? String(el.value || '').trim() : '';
  }

  function joursRestants(dateLimite) {
    if (!dateLimite) return null;
    var a = String(dateLimite).slice(0, 10);
    var b = todayISO();
    var da = new Date(a + 'T12:00:00');
    var db = new Date(b + 'T12:00:00');
    if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
    return Math.round((da - db) / 86400000);
  }

  function jrLabel(jr) {
    if (jr == null) return '—';
    if (jr < 0) return 'Retard J' + jr;
    if (jr === 0) return 'Aujourd\'hui';
    return 'J+' + jr;
  }

  /** Nettoie champs découpe legacy + cartes devoir-morceau + file session W-#n */
  function migrateDevoirsLegacy() {
    if (!window.D) return false;
    var changed = false;
    var stripKeys = [
      '_morceauxTotal', '_morceauxFaits', '_sessionMinMin', '_tempsProposeMin',
      '_tempsRestantMin', '_dureeTotaleMin', '_devoirChunkOf', '_devoirChunkIdx',
      '_projSessionIdx', '_projSessionTotal', '_projKind', '_morceauOf', '_morceauIdx'
    ];

    function scrub(list) {
      if (!Array.isArray(list)) return list;
      var out = [];
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (!c) continue;
        if (c.type === 'devoir-morceau') { changed = true; continue; }
        if (c.type === 'devoir' || (c.id && String(c.id).charAt(0) === 'W')) {
          for (var k = 0; k < stripKeys.length; k++) {
            if (Object.prototype.hasOwnProperty.call(c, stripKeys[k])) {
              delete c[stripKeys[k]];
              changed = true;
            }
          }
        }
        out.push(c);
      }
      return out;
    }

    window.D.exercices = scrub(window.D.exercices || []);
    window.D.devoirs = scrub(window.D.devoirs || []);

    try {
      var raw = localStorage.getItem('ankiV2Session');
      if (raw) {
        var sess = JSON.parse(raw);
        if (sess && Array.isArray(sess.queue)) {
          var before = sess.queue.length;
          sess.queue = sess.queue.filter(function (id) {
            var s = String(id || '');
            if (s.indexOf('#') >= 0) return false;
            if (s.charAt(0) === 'W') return false;
            return true;
          });
          if (sess.current && (String(sess.current).indexOf('#') >= 0 || String(sess.current).charAt(0) === 'W')) {
            sess.current = null;
            changed = true;
          }
          if (sess.queue.length !== before) {
            changed = true;
            localStorage.setItem('ankiV2Session', JSON.stringify(sess));
          }
        }
      }
    } catch (e) { /* ignore */ }

    return changed;
  }

  window.migrateDevoirsLegacy = migrateDevoirsLegacy;

  function listActifs() {
    return (window.D && window.D.devoirs || [])
      .filter(function (c) { return c && c.statut === 'actif'; })
      .slice()
      .sort(function (a, b) {
        var da = a.dateLimite || '9999-12-31';
        var db = b.dateLimite || '9999-12-31';
        if (da !== db) return da < db ? -1 : 1;
        return String(a.titre || a.question || '').localeCompare(String(b.titre || b.question || ''));
      });
  }

  function listFinis() {
    return (window.D && window.D.devoirs || [])
      .filter(function (c) { return c && (c.statut === 'fini' || c.statut === 'termine' || c.statut === 'terminé'); })
      .slice()
      .sort(function (a, b) {
        return String(b.dateLimite || '').localeCompare(String(a.dateLimite || ''));
      });
  }

  function renderRow(d) {
    var m = mat(d.mat);
    var jr = joursRestants(d.dateLimite);
    var late = jr != null && jr < 0;
    var today = jr === 0;
    var border = late ? 'border-left:3px solid var(--red);' : (today ? 'border-left:3px solid var(--gold);' : '');
    var badge = late
      ? '<span class="agenda-badge agenda-badge-late">Retard</span>'
      : (today ? '<span class="agenda-badge agenda-badge-today">Aujourd\'hui</span>' : '');
    var dur = d.tempsCible != null
      ? Math.round(Number(d.tempsCible) / 60) + ' min'
      : (d._dureeEstimeeMin != null ? d._dureeEstimeeMin + ' min' : '');
    var metaParts = [
      d.id || '',
      (d.dateLimite || '—'),
      jrLabel(jr)
    ];
    if (dur) metaParts.push(dur);
    return (
      '<div class="anki-devoir-row agenda-row" style="' + border + '">' +
        '<span class="anki-q-mat" style="background:' + esc(m.color) + ';">' +
          (typeof window.iconHtml === 'function' ? window.iconHtml('file-text', 12) : '') +
        '</span>' +
        '<div class="anki-devoir-body">' +
          '<div class="anki-devoir-title">' + esc(d.titre || d.question || 'Sans titre') + ' ' + badge + '</div>' +
          '<div class="anki-devoir-meta">' + esc(metaParts.join(' · ')) +
            ' · ' + esc(m.label || m.name) +
          '</div>' +
        '</div>' +
        '<div class="agenda-row-actions">' +
          '<button type="button" class="bs" title="Marquer terminé" onclick="window.agendaMarkDone(\'' + esc(d.id) + '\')">' +
            (typeof window.iconLabel === 'function' ? window.iconLabel('check', 'Fait') : 'Fait') +
          '</button>' +
          '<button type="button" class="bs" title="Modifier" onclick="window.agendaOpenModal({id:\'' + esc(d.id) + '\'})">' +
            (typeof window.iconHtml === 'function' ? window.iconHtml('pencil', 14) : '✎') +
          '</button>' +
          '<button type="button" class="bs" style="color:var(--red);border-color:var(--red);" title="Supprimer" onclick="window.agendaDelete(\'' + esc(d.id) + '\')">' +
            (typeof window.iconHtml === 'function' ? window.iconHtml('trash-2', 14) : '✕') +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  window.renderAgenda = function () {
    migrateDevoirsLegacy();
    var pane = $('paneAgenda');
    if (!pane) return;
    if (!window.D) {
      pane.innerHTML = '<div class="anki-empty">Données non chargées.</div>';
      return;
    }
    var actifs = listActifs();
    var finis = listFinis().slice(0, 8);
    pane.innerHTML =
      '<div class="agenda-page">' +
        '<div class="anki-card-block">' +
          '<div class="anki-block-hdr">' +
            '<div>' +
              '<h3>' + (typeof window.iconLabel === 'function'
                ? window.iconLabel('clipboard-list', 'Agenda')
                : 'Agenda') + '</h3>' +
              '<p class="anki-mut" style="font-size:12px;">Devoirs à rendre, triés par date limite. Pas liés au Synchrotron.</p>' +
            '</div>' +
            '<div class="anki-block-actions">' +
              '<button type="button" class="bp" onclick="window.agendaOpenModal()">' +
                '+ Ajouter un devoir' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="anki-devoirs-list">' +
            (actifs.length
              ? actifs.map(renderRow).join('')
              : '<div class="anki-empty">Aucun devoir actif. Ajoute un DM avec une date limite.</div>') +
          '</div>' +
          (finis.length
            ? ('<h4 class="agenda-finis-title">Récemment terminés</h4>' +
               '<div class="anki-devoirs-list agenda-finis">' +
                 finis.map(function (d) {
                   var m = mat(d.mat);
                   return (
                     '<div class="anki-devoir-row agenda-row agenda-row-done">' +
                       '<div class="anki-devoir-body">' +
                         '<div class="anki-devoir-title">' + esc(d.titre || d.question || '') + '</div>' +
                         '<div class="anki-devoir-meta">' + esc((d.dateLimite || '—') + ' · ' + (m.label || '')) + '</div>' +
                       '</div>' +
                       '<button type="button" class="bs" onclick="window.agendaReopen(\'' + esc(d.id) + '\')">Réouvrir</button>' +
                     '</div>'
                   );
                 }).join('') +
               '</div>')
            : '') +
        '</div>' +
      '</div>';
    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(pane);
  };

  function ensureOverlay() {
    var ov = $('ovAgendaDevoir');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'ovAgendaDevoir';
      ov.className = 'ov';
      document.body.appendChild(ov);
    }
    return ov;
  }

  window.agendaOpenModal = function (opts) {
    opts = opts || {};
    if (typeof window.refuseSecondaryFullMutation === 'function'
        && window.refuseSecondaryFullMutation('Appareil secondaire : modification de devoir indisponible.')) {
      return;
    }
    if (!window.D) {
      if (typeof window.sysAlert === 'function') {
        window.sysAlert('Données non chargées — réessaie dans un instant.', 'Erreur');
      }
      return;
    }

    var go = function () {
      _editingId = opts.id || null;
      var c = {};
      if (_editingId) {
        c = (window.D.devoirs || []).find(function (x) { return x.id === _editingId; }) || {};
      }
      if (opts.mat && !c.mat) c.mat = opts.mat;
      if (opts.coursId) {
        c.coursIds = [opts.coursId];
        if (!c.mat) {
          var co = (window.D.cours || []).find(function (x) { return x.uid === opts.coursId; });
          if (co) c.mat = co.mat;
        }
      }
      showModal(c);
    };

    if (typeof window.ensureScriptsForTab === 'function') {
      window.ensureScriptsForTab('agenda').then(go).catch(go);
    } else {
      go();
    }
  };

  function showModal(c) {
    var ov = ensureOverlay();
    ov.classList.remove('hidden');
    var matieres = window.D.matieres || [];
    var defaultMat = c.mat || (matieres[0] && matieres[0].id) || '';
    var matOpts = (matieres.length
      ? '<option value="">— Choisir —</option>'
      : '<option value="">— Aucune matière —</option>')
      + matieres.map(function (m) {
        return '<option value="' + esc(m.id) + '"' + (m.id === defaultMat ? ' selected' : '') + '>'
          + esc(m.label) + ' — ' + esc(m.name) + '</option>';
      }).join('');
    var dureeMin = c._dureeEstimeeMin != null
      ? c._dureeEstimeeMin
      : (c.tempsCible != null ? Math.round(Number(c.tempsCible) / 60) : '');

    ov.innerHTML =
      '<div class="modal card-type-surface card-type-devoir agenda-modal">' +
        '<h2>' + (_editingId
          ? (typeof window.iconLabel === 'function' ? window.iconLabel('pencil', 'Modifier le devoir') : 'Modifier le devoir')
          : (typeof window.iconLabel === 'function' ? window.iconLabel('file-text', 'Nouveau devoir') : 'Nouveau devoir')) +
        '</h2>' +
        '<div class="modal-body-scroll">' +
          '<div id="agendaFormError" class="anki-form-error" role="alert"></div>' +
          (!matieres.length
            ? '<div class="anki-form-error visible">Crée d\'abord une matière (onglet Matières).</div>'
            : '') +
          '<div class="fg"><label>Titre *</label>' +
            '<input type="text" id="agendaTitre" placeholder="Ex: DM Mécanique n°3" value="' + esc(c.titre || '') + '">' +
          '</div>' +
          '<div class="anki-modal-row">' +
            '<div class="fg"><label>Matière *</label><select id="agendaMat">' + matOpts + '</select></div>' +
            '<div class="fg"><label>Date limite *</label>' +
              '<input type="date" id="agendaDateLim" value="' + esc(c.dateLimite || '') + '">' +
            '</div>' +
          '</div>' +
          '<div class="fg"><label>Durée estimée (min, optionnel)</label>' +
            '<input type="number" id="agendaDuree" min="5" max="600" step="5" value="' + esc(dureeMin) + '" placeholder="ex. 90">' +
          '</div>' +
          '<div class="fg"><label>Notes / consignes</label>' +
            '<textarea id="agendaNotes" rows="4" placeholder="Quoi faire…">' + esc(c.question || '') + '</textarea>' +
          '</div>' +
        '</div>' +
        '<div class="macts">' +
          '<button type="button" class="bs" onclick="window.agendaCloseModal()">Annuler</button>' +
          '<button type="button" class="bp" style="background:var(--red);border-color:var(--red);" onclick="window.agendaSave()">' +
            'Enregistrer' +
          '</button>' +
        '</div>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(ov);
    ov.onclick = function (e) {
      if (e.target === ov) window.agendaCloseModal();
    };
  }

  window.agendaCloseModal = function () {
    var ov = $('ovAgendaDevoir');
    if (ov) ov.classList.add('hidden');
    _editingId = null;
  };

  window.agendaSave = function () {
    if (typeof window.refuseSecondaryFullMutation === 'function'
        && window.refuseSecondaryFullMutation('Appareil secondaire : modification de devoir indisponible.')) {
      return;
    }
    if (!window.D) return;
    if (!Array.isArray(window.D.devoirs)) window.D.devoirs = [];

    if (typeof window.showFormError === 'function') window.showFormError('agendaFormError', '');

    var titre = fieldVal('agendaTitre');
    var matV = fieldVal('agendaMat');
    var dateLim = fieldVal('agendaDateLim');
    var notes = fieldVal('agendaNotes');
    var duree = parseInt(fieldVal('agendaDuree'), 10);

    if (!matV && (window.D.matieres || []).length === 1) matV = window.D.matieres[0].id;
    if (!titre && notes) titre = notes.slice(0, 80);
    if (!notes && titre) notes = titre;

    function err(msg) {
      if (typeof window.showFormError === 'function') window.showFormError('agendaFormError', msg);
    }

    if (!(window.D.matieres || []).length) {
      err('Crée d\'abord une matière.');
      return;
    }
    if (!matV) { err('Choisis une matière.'); return; }
    if (!titre && !notes) { err('Indique un titre ou des notes.'); return; }
    if (!dateLim) { err('Indique une date limite.'); return; }

    var existingIds = {};
    (window.D.exercices || []).forEach(function (x) { if (x && x.id) existingIds[x.id] = true; });
    (window.D.devoirs || []).forEach(function (x) { if (x && x.id) existingIds[x.id] = true; });

    var card;
    if (_editingId) {
      card = window.D.devoirs.find(function (x) { return x.id === _editingId; });
      if (!card) { err('Devoir introuvable.'); return; }
      card.titre = titre;
      card.question = notes;
      card.mat = matV;
      card.dateLimite = dateLim;
      card.type = 'devoir';
      card.statut = card.statut === 'fini' ? 'fini' : 'actif';
      card.profil = 'EXO';
      if (!isNaN(duree) && duree > 0) {
        card._dureeEstimeeMin = duree;
        card.tempsCible = duree * 60;
      } else {
        delete card._dureeEstimeeMin;
      }
      // Plus de découpage
      ['_morceauxTotal', '_morceauxFaits', '_sessionMinMin', '_tempsProposeMin',
        '_tempsRestantMin', '_dureeTotaleMin'].forEach(function (k) { delete card[k]; });
    } else {
      var newId;
      if (window.AnkiAlgoV2 && typeof window.AnkiAlgoV2.genExoUid === 'function') {
        newId = window.AnkiAlgoV2.genExoUid('W', Object.keys(existingIds));
      } else {
        newId = 'W-' + Math.random().toString(36).slice(2, 5).toUpperCase();
      }
      card = {
        id: newId,
        titre: titre,
        question: notes,
        mat: matV,
        profil: 'EXO',
        type: 'devoir',
        dateLimite: dateLim,
        statut: 'actif',
        importance: 3,
        intervalle: 0,
        ease: 2.5,
        repetitions: 0,
        dateProchaineRevision: todayISO(),
        historique: [],
        epinglee: false,
        dateCreation: new Date().toISOString(),
        coursIds: []
      };
      if (!isNaN(duree) && duree > 0) {
        card._dureeEstimeeMin = duree;
        card.tempsCible = duree * 60;
      }
      window.D.devoirs.unshift(card);
    }

    Promise.resolve(typeof window.save === 'function' ? window.save() : null).then(function () {
      window.agendaCloseModal();
      if (typeof window.renderAgenda === 'function') window.renderAgenda();
      if (typeof window.showToast === 'function') {
        window.showToast('Devoir enregistré');
      } else if (typeof window.sysAlert === 'function') {
        window.sysAlert('Devoir enregistré', 'Agenda');
      }
    }).catch(function () {
      err('Enregistrement impossible.');
    });
  };

  window.agendaMarkDone = function (id) {
    if (typeof window.refuseSecondaryFullMutation === 'function'
        && window.refuseSecondaryFullMutation('Appareil secondaire : modification de devoir indisponible.')) {
      return;
    }
    var c = (window.D && window.D.devoirs || []).find(function (x) { return x.id === id; });
    if (!c) return;
    c.statut = 'fini';
    Promise.resolve(typeof window.save === 'function' ? window.save() : null).then(function () {
      window.renderAgenda();
    });
  };

  window.agendaReopen = function (id) {
    if (typeof window.refuseSecondaryFullMutation === 'function'
        && window.refuseSecondaryFullMutation('Appareil secondaire : modification de devoir indisponible.')) {
      return;
    }
    var c = (window.D && window.D.devoirs || []).find(function (x) { return x.id === id; });
    if (!c) return;
    c.statut = 'actif';
    Promise.resolve(typeof window.save === 'function' ? window.save() : null).then(function () {
      window.renderAgenda();
    });
  };

  window.agendaDelete = function (id) {
    if (typeof window.refuseSecondaryFullMutation === 'function'
        && window.refuseSecondaryFullMutation('Appareil secondaire : suppression indisponible.')) {
      return;
    }
    var go = function () {
      window.D.devoirs = (window.D.devoirs || []).filter(function (x) { return x.id !== id; });
      Promise.resolve(typeof window.save === 'function' ? window.save() : null).then(function () {
        window.renderAgenda();
      });
    };
    if (typeof window.sysConfirm === 'function') {
      window.sysConfirm('Supprimer ce devoir ?', go);
    } else if (window.confirm('Supprimer ce devoir ?')) {
      go();
    }
  };

  // Compat : anciens points d'entrée Synchrotron / FAB
  window.ankiV2OpenDevoirModal = function (opts) {
    var open = function () {
      if (typeof window.showTab === 'function') {
        try { window.showTab('agenda'); } catch (e) { /* ignore */ }
      }
      window.agendaOpenModal(opts || {});
    };
    if (typeof window.ensureScriptsForTab === 'function') {
      window.ensureScriptsForTab('agenda').then(open).catch(open);
    } else {
      open();
    }
  };
})();
