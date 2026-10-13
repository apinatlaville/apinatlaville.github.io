/**
 * articles-en.js — Onglet Articles EN (sources libres)
 * Découvrir : Guardian API + The Conversation US (RSS)
 * Saved : copies locales (lu / non lu), hors sync cloud
 */
(function () {
  'use strict';

  var STORE_KEY = 'mescours_articles_en_v1';
  var MAX_SAVED = 40;
  var MAX_BYTES = 1500000;
  var PAGE_SIZE = 12;

  var THEMES = [
    { id: '', label: 'Tous' },
    { id: 'science', label: 'Science' },
    { id: 'world', label: 'World' },
    { id: 'environment', label: 'Environment' },
    { id: 'technology', label: 'Technology' },
    { id: 'politics', label: 'Politics' },
    { id: 'uk', label: 'UK' },
    { id: 'us', label: 'US' }
  ];

  var GUARDIAN_SECTION = {
    science: 'science',
    world: 'world',
    environment: 'environment',
    technology: 'technology',
    politics: 'politics',
    uk: 'uk-news',
    us: 'us-news'
  };

  var CONVERSATION_FEED = {
    '': 'https://theconversation.com/us/articles.rss',
    science: 'https://theconversation.com/us/science-technology/articles.rss',
    technology: 'https://theconversation.com/us/technology/articles.rss',
    politics: 'https://theconversation.com/us/politics/articles.rss',
    environment: 'https://theconversation.com/us/environment-energy/articles.rss',
    world: 'https://theconversation.com/us/articles.rss',
    uk: 'https://theconversation.com/uk/articles.rss',
    us: 'https://theconversation.com/us/articles.rss'
  };

  var S = {
    sub: 'discover', /* discover | saved */
    q: '',
    theme: '',
    dateFrom: '',
    dateTo: '',
    savedFilter: 'all', /* all | unread | read */
    page: 1,
    items: [],
    hasMore: false,
    loading: false,
    error: '',
    openId: null,
    sources: { guardian: true, conversation: true }
  };

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return typeof window.escHtml === 'function'
      ? window.escHtml(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
  }

  function toast(msg) {
    if (typeof window.toast === 'function') window.toast(msg);
  }

  function iconLabel(name, label) {
    if (typeof window.iconLabel === 'function') return window.iconLabel(name, label);
    return label || name;
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return { apiKeyGuardian: '', saved: [] };
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return { apiKeyGuardian: '', saved: [] };
      return {
        apiKeyGuardian: String(o.apiKeyGuardian || ''),
        saved: Array.isArray(o.saved) ? o.saved : []
      };
    } catch (e) {
      return { apiKeyGuardian: '', saved: [] };
    }
  }

  function saveStore(store) {
    try {
      var json = JSON.stringify(store);
      if (json.length > MAX_BYTES) {
        toast('Saved plein (~1,5 Mo) — retire des articles.');
        return false;
      }
      localStorage.setItem(STORE_KEY, json);
      return true;
    } catch (e) {
      toast('Impossible d’enregistrer (quota navigateur).');
      return false;
    }
  }

  function getApiKey() {
    return loadStore().apiKeyGuardian.trim();
  }

  function setApiKey(key) {
    var st = loadStore();
    st.apiKeyGuardian = String(key || '').trim();
    saveStore(st);
  }

  function articleId(source, url) {
    return source + '::' + String(url || '').trim();
  }

  function isSaved(id) {
    return loadStore().saved.some(function (a) { return a && a.id === id; });
  }

  function findSaved(id) {
    return loadStore().saved.find(function (a) { return a && a.id === id; }) || null;
  }

  /** Sanitize HTML article : balises texte seulement. */
  function sanitizeHtml(html) {
    var s = String(html == null ? '' : html);
    if (!s) return '';
    var doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = s;
    var allowed = {
      P: 1, BR: 1, EM: 1, I: 1, STRONG: 1, B: 1, A: 1, UL: 1, OL: 1, LI: 1,
      BLOCKQUOTE: 1, H1: 1, H2: 1, H3: 1, H4: 1, FIGURE: 1, FIGCAPTION: 1,
      SPAN: 1, DIV: 1, IMG: 1, HR: 1, SUP: 1, SUB: 1
    };
    function walk(node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      kids.forEach(function (child) {
        if (child.nodeType === 3) return;
        if (child.nodeType !== 1) {
          node.removeChild(child);
          return;
        }
        var tag = child.tagName;
        if (!allowed[tag]) {
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
          return;
        }
        Array.prototype.slice.call(child.attributes || []).forEach(function (attr) {
          var n = attr.name.toLowerCase();
          if (tag === 'A' && (n === 'href' || n === 'title' || n === 'rel' || n === 'target')) {
            if (n === 'href' && /^\s*javascript:/i.test(attr.value)) child.removeAttribute(attr.name);
            return;
          }
          if (tag === 'IMG' && (n === 'src' || n === 'alt' || n === 'width' || n === 'height')) {
            if (n === 'src' && !/^https?:\/\//i.test(attr.value)) child.removeAttribute(attr.name);
            return;
          }
          child.removeAttribute(attr.name);
        });
        if (tag === 'A') {
          child.setAttribute('rel', 'noopener noreferrer');
          child.setAttribute('target', '_blank');
        }
        walk(child);
      });
    }
    walk(doc.body);
    return doc.body.innerHTML;
  }

  function stripTags(html) {
    var d = document.createElement('div');
    d.innerHTML = String(html || '');
    return (d.textContent || d.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function inDateRange(iso) {
    if (!iso) return true;
    var t = new Date(iso).getTime();
    if (isNaN(t)) return true;
    if (S.dateFrom) {
      var a = new Date(S.dateFrom + 'T00:00:00').getTime();
      if (!isNaN(a) && t < a) return false;
    }
    if (S.dateTo) {
      var b = new Date(S.dateTo + 'T23:59:59').getTime();
      if (!isNaN(b) && t > b) return false;
    }
    return true;
  }

  function matchQuery(title, standfirst) {
    var q = (S.q || '').trim().toLowerCase();
    if (!q) return true;
    var hay = ((title || '') + ' ' + (standfirst || '')).toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  /* ---------- Guardian ---------- */
  function fetchGuardian(page) {
    var key = getApiKey();
    if (!key) return Promise.resolve({ items: [], hasMore: false, needKey: true });
    var params = new URLSearchParams({
      'api-key': key,
      'show-fields': 'trailText,body,thumbnail,byline',
      'page-size': String(PAGE_SIZE),
      page: String(page || 1),
      'order-by': 'newest'
    });
    if (S.q) params.set('q', S.q);
    if (S.theme && GUARDIAN_SECTION[S.theme]) params.set('section', GUARDIAN_SECTION[S.theme]);
    if (S.dateFrom) params.set('from-date', S.dateFrom);
    if (S.dateTo) params.set('to-date', S.dateTo);
    var url = 'https://content.guardianapis.com/search?' + params.toString();
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('Guardian HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      var resp = data && data.response;
      var results = (resp && resp.results) || [];
      var items = results.map(function (r) {
        var fields = r.fields || {};
        var urlArt = r.webUrl || '';
        var id = articleId('guardian', urlArt);
        return {
          id: id,
          source: 'guardian',
          sourceLabel: 'The Guardian',
          url: urlArt,
          title: r.webTitle || '',
          date: r.webPublicationDate || '',
          theme: (r.sectionName || S.theme || '').toString(),
          standfirst: stripTags(fields.trailText || ''),
          bodyHtml: sanitizeHtml(fields.body || ''),
          thumb: fields.thumbnail || ''
        };
      }).filter(function (a) {
        return matchQuery(a.title, a.standfirst) && inDateRange(a.date);
      });
      var cur = resp && resp.currentPage ? resp.currentPage : page;
      var pages = resp && resp.pages ? resp.pages : cur;
      return { items: items, hasMore: cur < pages, needKey: false };
    });
  }

  /* ---------- The Conversation (RSS via proxy CORS) ---------- */
  function fetchViaProxy(targetUrl) {
    var proxied = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(targetUrl);
    return fetch(proxied).then(function (res) {
      if (!res.ok) throw new Error('Proxy HTTP ' + res.status);
      return res.text();
    });
  }

  function parseRssItems(xmlText) {
    var out = [];
    var doc;
    try {
      doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    } catch (e) {
      return out;
    }
    var items = doc.querySelectorAll('item');
    items.forEach(function (item) {
      function txt(sel) {
        var el = item.querySelector(sel);
        return el ? (el.textContent || '').trim() : '';
      }
      var title = txt('title');
      var link = txt('link');
      var pub = txt('pubDate') || txt('dc\\:date') || '';
      var desc = '';
      var contentEnc = item.getElementsByTagNameNS
        ? item.getElementsByTagNameNS('http://purl.org/rss/1.0/modules/content/', 'encoded')
        : null;
      if (contentEnc && contentEnc[0]) desc = contentEnc[0].textContent || '';
      if (!desc) desc = txt('description');
      var cat = '';
      var catEl = item.querySelector('category');
      if (catEl) cat = (catEl.textContent || '').trim();
      var iso = '';
      if (pub) {
        var d = new Date(pub);
        if (!isNaN(d.getTime())) iso = d.toISOString();
      }
      var id = articleId('conversation', link);
      var body = sanitizeHtml(desc);
      out.push({
        id: id,
        source: 'conversation',
        sourceLabel: 'The Conversation',
        url: link,
        title: title,
        date: iso || pub,
        theme: cat || S.theme || 'US',
        standfirst: stripTags(desc).slice(0, 220),
        bodyHtml: body,
        thumb: ''
      });
    });
    return out;
  }

  function fetchConversation() {
    var feed = CONVERSATION_FEED[S.theme] || CONVERSATION_FEED[''];
    return fetchViaProxy(feed).then(function (xml) {
      var all = parseRssItems(xml).filter(function (a) {
        return matchQuery(a.title, a.standfirst) && inDateRange(a.date);
      });
      /* Pagination locale : page 1 = 0..PAGE_SIZE, etc. */
      var start = (S.page - 1) * PAGE_SIZE;
      var slice = all.slice(0, start + PAGE_SIZE);
      return {
        items: slice,
        hasMore: all.length > slice.length,
        allCount: all.length
      };
    });
  }

  function mergeByDate(a, b) {
    var map = Object.create(null);
    a.concat(b).forEach(function (it) {
      if (!it || !it.id) return;
      if (!map[it.id]) map[it.id] = it;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (x, y) {
      return new Date(y.date || 0) - new Date(x.date || 0);
    });
  }

  function loadDiscover(append) {
    if (S.loading) return;
    if (!append) {
      S.page = 1;
      S.items = [];
      S.error = '';
    }
    S.loading = true;
    paint();

    var jobs = [];
    if (S.sources.guardian) {
      jobs.push(fetchGuardian(S.page).catch(function (err) {
        return { items: [], hasMore: false, error: String(err && err.message || err) };
      }));
    } else {
      jobs.push(Promise.resolve({ items: [], hasMore: false }));
    }
    if (S.sources.conversation && S.page === 1 && !append) {
      jobs.push(fetchConversation().catch(function (err) {
        return { items: [], hasMore: false, error: String(err && err.message || err) };
      }));
    } else if (S.sources.conversation && append) {
      /* Conversation : recharge flux et coupe jusqu’à page*PAGE_SIZE */
      jobs.push(fetchConversation().catch(function () {
        return { items: [], hasMore: false };
      }));
    } else {
      jobs.push(Promise.resolve({ items: [], hasMore: false }));
    }

    Promise.all(jobs).then(function (parts) {
      var g = parts[0] || {};
      var c = parts[1] || {};
      var errs = [];
      if (g.needKey && S.sources.guardian) errs.push('Clé Guardian manquante (optionnel si Conversation seul).');
      if (g.error) errs.push('Guardian : ' + g.error);
      if (c.error) errs.push('Conversation : ' + c.error);

      var merged = append
        ? mergeByDate(S.items.concat(g.items || []), c.items || [])
        : mergeByDate(g.items || [], c.items || []);
      /* Dédup */
      var seen = Object.create(null);
      S.items = merged.filter(function (it) {
        if (seen[it.id]) return false;
        seen[it.id] = true;
        return true;
      });
      S.hasMore = !!(g.hasMore || c.hasMore);
      S.error = errs.join(' ');
      S.loading = false;
      paint();
    }).catch(function (err) {
      S.loading = false;
      S.error = String(err && err.message || err);
      paint();
    });
  }

  function saveArticle(art) {
    if (!art || !art.id) return;
    var st = loadStore();
    if (st.saved.some(function (a) { return a.id === art.id; })) {
      toast('Déjà dans Saved');
      return;
    }
    if (st.saved.length >= MAX_SAVED) {
      toast('Limite ' + MAX_SAVED + ' articles Saved — retire-en.');
      return;
    }
    st.saved.unshift({
      id: art.id,
      source: art.source,
      sourceLabel: art.sourceLabel,
      url: art.url,
      title: art.title,
      date: art.date,
      theme: art.theme,
      standfirst: art.standfirst,
      bodyHtml: art.bodyHtml || '',
      thumb: art.thumb || '',
      read: false,
      savedAt: new Date().toISOString()
    });
    if (saveStore(st)) {
      toast('Ajouté à Saved');
      paint();
    }
  }

  function unsaveArticle(id) {
    var st = loadStore();
    st.saved = st.saved.filter(function (a) { return a && a.id !== id; });
    saveStore(st);
    if (S.openId === id) S.openId = null;
    paint();
  }

  function toggleRead(id) {
    var st = loadStore();
    st.saved.forEach(function (a) {
      if (a && a.id === id) a.read = !a.read;
    });
    saveStore(st);
    paint();
  }

  function openArticle(id, fromSaved) {
    S.openId = id;
    S._openFromSaved = !!fromSaved;
    paint();
    var el = $('aeReader');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeReader() {
    S.openId = null;
    paint();
  }

  function resolveOpen() {
    if (!S.openId) return null;
    if (S._openFromSaved || S.sub === 'saved') return findSaved(S.openId);
    return S.items.find(function (a) { return a.id === S.openId; }) || findSaved(S.openId);
  }

  function savedListFiltered() {
    var list = loadStore().saved.slice();
    return list.filter(function (a) {
      if (!a) return false;
      if (S.savedFilter === 'unread' && a.read) return false;
      if (S.savedFilter === 'read' && !a.read) return false;
      if (!matchQuery(a.title, a.standfirst)) return false;
      if (!inDateRange(a.date)) return false;
      if (S.theme && a.theme) {
        var th = String(a.theme).toLowerCase();
        if (th.indexOf(S.theme) < 0 && S.theme !== 'us' && S.theme !== 'uk') {
          /* soft filter */
        }
      }
      return true;
    });
  }

  function cardHtml(art, opts) {
    opts = opts || {};
    var saved = isSaved(art.id);
    var readBadge = opts.fromSaved
      ? (art.read
        ? '<span class="ae-badge ae-badge--read">Lu</span>'
        : '<span class="ae-badge ae-badge--unread">Non lu</span>')
      : '';
    return (
      '<article class="ae-card" data-id="' + esc(art.id) + '">' +
        '<div class="ae-card-meta">' +
          '<span class="ae-src">' + esc(art.sourceLabel || art.source) + '</span>' +
          (art.date ? '<span class="ae-date">' + esc(formatDate(art.date)) + '</span>' : '') +
          (art.theme ? '<span class="ae-theme">' + esc(art.theme) + '</span>' : '') +
          readBadge +
        '</div>' +
        '<h3 class="ae-card-title">' +
          '<button type="button" class="ae-linkish" data-ae-open="' + esc(art.id) + '" data-ae-saved="' + (opts.fromSaved ? '1' : '0') + '">' +
            esc(art.title) +
          '</button>' +
        '</h3>' +
        (art.standfirst ? '<p class="ae-standfirst">' + esc(art.standfirst) + '</p>' : '') +
        '<div class="ae-card-actions">' +
          (opts.fromSaved
            ? (
              '<button type="button" class="bs ae-btn" data-ae-read="' + esc(art.id) + '">' +
                (art.read ? 'Non lu' : 'Marquer lu') +
              '</button>' +
              '<button type="button" class="bs ae-btn" data-ae-unsave="' + esc(art.id) + '">Retirer</button>'
            )
            : (
              '<button type="button" class="bs ae-btn' + (saved ? ' is-on' : '') + '" data-ae-save="' + esc(art.id) + '"' +
                (saved ? ' disabled' : '') + '>' +
                (saved ? 'Saved' : 'Save') +
              '</button>'
            )) +
          (art.url
            ? '<a class="bs ae-btn" href="' + esc(art.url) + '" target="_blank" rel="noopener noreferrer">Original</a>'
            : '') +
        '</div>' +
      '</article>'
    );
  }

  function readerHtml(art) {
    if (!art) return '';
    var saved = isSaved(art.id);
    var fromSaved = !!(S._openFromSaved || S.sub === 'saved');
    return (
      '<div class="ae-reader" id="aeReader">' +
        '<div class="ae-reader-bar">' +
          '<button type="button" class="bs" id="aeCloseReader">' + iconLabel('arrow-left', 'Retour') + '</button>' +
          '<div class="ae-reader-actions">' +
            (fromSaved
              ? '<button type="button" class="bs" data-ae-read="' + esc(art.id) + '">' +
                  (art.read ? 'Non lu' : 'Marquer lu') + '</button>' +
                '<button type="button" class="bs" data-ae-unsave="' + esc(art.id) + '">Retirer</button>'
              : '<button type="button" class="bp" data-ae-save="' + esc(art.id) + '"' +
                  (saved ? ' disabled' : '') + '>' + (saved ? 'Saved' : 'Save') + '</button>') +
            (art.url
              ? '<a class="bs" href="' + esc(art.url) + '" target="_blank" rel="noopener noreferrer">Original</a>'
              : '') +
          '</div>' +
        '</div>' +
        '<p class="ae-reader-meta anki-mut">' +
          esc(art.sourceLabel || '') +
          (art.date ? ' · ' + esc(formatDate(art.date)) : '') +
          (art.theme ? ' · ' + esc(art.theme) : '') +
        '</p>' +
        '<h2 class="ae-reader-title">' + esc(art.title) + '</h2>' +
        '<div class="ae-reader-body">' + (art.bodyHtml || '<p class="anki-mut">Pas de corps disponible — ouvre l’original.</p>') + '</div>' +
        '<p class="ae-attrib anki-mut">Source : ' + esc(art.sourceLabel || art.source) +
          (art.url ? ' — <a href="' + esc(art.url) + '" target="_blank" rel="noopener noreferrer">article original</a>' : '') +
        '</p>' +
      '</div>'
    );
  }

  function filtersHtml() {
    var themeOpts = THEMES.map(function (t) {
      return '<option value="' + esc(t.id) + '"' + (S.theme === t.id ? ' selected' : '') + '>' + esc(t.label) + '</option>';
    }).join('');
    return (
      '<div class="ae-filters">' +
        '<input type="search" class="fi" id="aeQ" placeholder="Recherche (titre…)" value="' + esc(S.q) + '">' +
        '<select class="fi" id="aeTheme">' + themeOpts + '</select>' +
        '<input type="date" class="fi" id="aeFrom" value="' + esc(S.dateFrom) + '" title="Du" data-fc-skip>' +
        '<input type="date" class="fi" id="aeTo" value="' + esc(S.dateTo) + '" title="Au" data-fc-skip>' +
        (S.sub === 'saved'
          ? '<select class="fi" id="aeSavedFilter">' +
              '<option value="all"' + (S.savedFilter === 'all' ? ' selected' : '') + '>Tous</option>' +
              '<option value="unread"' + (S.savedFilter === 'unread' ? ' selected' : '') + '>Non lus</option>' +
              '<option value="read"' + (S.savedFilter === 'read' ? ' selected' : '') + '>Lus</option>' +
            '</select>'
          : '') +
        '<button type="button" class="bp" id="aeApply">' + iconLabel('search', 'Filtrer') + '</button>' +
      '</div>'
    );
  }

  function paint() {
    var pane = $('paneArticlesEn');
    if (!pane) return;

    if (S.openId) {
      var open = resolveOpen();
      pane.innerHTML =
        '<div class="ae-shell">' +
          '<div class="pbar"><div><h3>Articles EN</h3>' +
            '<p class="anki-mut" style="margin:0;font-size:12px;">Sources libres · Guardian + The Conversation</p></div></div>' +
          readerHtml(open) +
        '</div>';
      wire();
      if (typeof window.hydrateIcons === 'function') window.hydrateIcons(pane);
      return;
    }

    var key = getApiKey();
    var listHtml = '';
    if (S.sub === 'discover') {
      if (S.loading && !S.items.length) {
        listHtml = '<p class="anki-mut ae-status">Chargement…</p>';
      } else if (!S.items.length) {
        listHtml = '<p class="anki-empty">Aucun article — ajuste les filtres' +
          (!key && S.sources.guardian ? ' ou ajoute une clé Guardian' : '') + '.</p>';
      } else {
        listHtml = '<div class="ae-list">' + S.items.map(function (a) { return cardHtml(a, {}); }).join('') + '</div>';
        if (S.hasMore) {
          listHtml += '<div class="ae-more-wrap">' +
            '<button type="button" class="bp" id="aeMore"' + (S.loading ? ' disabled' : '') + '>' +
              (S.loading ? 'Chargement…' : 'Voir plus') +
            '</button></div>';
        }
      }
    } else {
      var saved = savedListFiltered();
      if (!saved.length) {
        listHtml = '<p class="anki-empty">Rien dans Saved — ouvre Découvrir et clique Save.</p>';
      } else {
        listHtml = '<div class="ae-list">' + saved.map(function (a) {
          return cardHtml(a, { fromSaved: true });
        }).join('') + '</div>';
      }
    }

    pane.innerHTML =
      '<div class="ae-shell">' +
        '<div class="pbar">' +
          '<div>' +
            '<h3>' + iconLabel('book-open', 'Articles EN') + '</h3>' +
            '<p class="anki-mut" style="margin:0;font-size:12px;">Lecture libre · pas de sync cloud pour Saved</p>' +
          '</div>' +
        '</div>' +
        '<div class="ae-subtabs" role="tablist">' +
          '<button type="button" class="ae-subtab' + (S.sub === 'discover' ? ' on' : '') + '" data-ae-sub="discover">Découvrir</button>' +
          '<button type="button" class="ae-subtab' + (S.sub === 'saved' ? ' on' : '') + '" data-ae-sub="saved">Saved</button>' +
        '</div>' +
        (S.sub === 'discover'
          ? '<div class="ae-keybar">' +
              '<label class="ae-key-label">Clé API Guardian (gratuite)</label>' +
              '<div class="ae-key-row">' +
                '<input type="password" class="fi" id="aeGuardianKey" placeholder="open-platform.theguardian.com" value="' + esc(key) + '" autocomplete="off">' +
                '<button type="button" class="bs" id="aeSaveKey">Enregistrer</button>' +
                '<a class="bs" href="https://open-platform.theguardian.com/access/" target="_blank" rel="noopener noreferrer">Obtenir</a>' +
              '</div>' +
              '<div class="ae-src-toggles">' +
                '<label class="ae-check"><input type="checkbox" id="aeSrcG"' + (S.sources.guardian ? ' checked' : '') + '> Guardian</label>' +
                '<label class="ae-check"><input type="checkbox" id="aeSrcC"' + (S.sources.conversation ? ' checked' : '') + '> Conversation</label>' +
              '</div>' +
            '</div>'
          : '') +
        filtersHtml() +
        (S.error ? '<p class="ae-error">' + esc(S.error) + '</p>' : '') +
        listHtml +
      '</div>';

    wire();
    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(pane);
  }

  function readFiltersFromDom() {
    var q = $('aeQ');
    var th = $('aeTheme');
    var fr = $('aeFrom');
    var to = $('aeTo');
    var sf = $('aeSavedFilter');
    if (q) S.q = q.value || '';
    if (th) S.theme = th.value || '';
    if (fr) S.dateFrom = fr.value || '';
    if (to) S.dateTo = to.value || '';
    if (sf) S.savedFilter = sf.value || 'all';
    var g = $('aeSrcG');
    var c = $('aeSrcC');
    if (g) S.sources.guardian = !!g.checked;
    if (c) S.sources.conversation = !!c.checked;
  }

  function findInItems(id) {
    return S.items.find(function (a) { return a.id === id; }) || findSaved(id);
  }

  function wire() {
    var pane = $('paneArticlesEn');
    if (!pane || pane._aeWired) {
      /* re-bind each paint: remove flag pattern — use onclick delegation once */
    }
    if (!pane._aeDeleg) {
      pane._aeDeleg = true;
      pane.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var sub = t.closest('[data-ae-sub]');
        if (sub) {
          S.sub = sub.getAttribute('data-ae-sub') === 'saved' ? 'saved' : 'discover';
          S.openId = null;
          if (S.sub === 'discover') loadDiscover(false);
          else paint();
          return;
        }
        if (t.id === 'aeSaveKey' || (t.closest && t.closest('#aeSaveKey'))) {
          var inp = $('aeGuardianKey');
          setApiKey(inp ? inp.value : '');
          toast('Clé Guardian enregistrée');
          return;
        }
        if (t.id === 'aeApply' || (t.closest && t.closest('#aeApply'))) {
          readFiltersFromDom();
          if (S.sub === 'discover') loadDiscover(false);
          else paint();
          return;
        }
        if (t.id === 'aeMore' || (t.closest && t.closest('#aeMore'))) {
          S.page += 1;
          loadDiscover(true);
          return;
        }
        if (t.id === 'aeCloseReader' || (t.closest && t.closest('#aeCloseReader'))) {
          closeReader();
          return;
        }
        var openBtn = t.closest('[data-ae-open]');
        if (openBtn) {
          openArticle(openBtn.getAttribute('data-ae-open'), openBtn.getAttribute('data-ae-saved') === '1');
          return;
        }
        var saveBtn = t.closest('[data-ae-save]');
        if (saveBtn && !saveBtn.disabled) {
          var art = findInItems(saveBtn.getAttribute('data-ae-save'));
          if (art) saveArticle(art);
          return;
        }
        var unsaveBtn = t.closest('[data-ae-unsave]');
        if (unsaveBtn) {
          unsaveArticle(unsaveBtn.getAttribute('data-ae-unsave'));
          return;
        }
        var readBtn = t.closest('[data-ae-read]');
        if (readBtn) {
          toggleRead(readBtn.getAttribute('data-ae-read'));
        }
      });
    }
  }

  window.renderArticlesEn = function () {
    if (S.sub === 'discover' && !S.items.length && !S.loading) {
      loadDiscover(false);
    } else {
      paint();
    }
  };
})();
