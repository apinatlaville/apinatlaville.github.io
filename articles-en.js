/**
 * articles-en.js — Onglet Articles EN (sources libres)
 * Découvrir : Guardian API + The Conversation + VOA (RSS)
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

  /* The Conversation : .rss renvoie 406 — utiliser .atom */
  var CONVERSATION_FEED = {
    '': 'https://theconversation.com/us/articles.atom',
    science: 'https://theconversation.com/us/health/articles.atom',
    technology: 'https://theconversation.com/us/technology/articles.atom',
    politics: 'https://theconversation.com/us/politics/articles.atom',
    environment: 'https://theconversation.com/us/articles.atom',
    world: 'https://theconversation.com/us/articles.atom',
    uk: 'https://theconversation.com/uk/articles.atom',
    us: 'https://theconversation.com/us/articles.atom'
  };

  /*
   * Flux VOA English — domaine public US.
   * rss2json ne gère que certains IDs VOA (les autres → « Internal error »).
   * OK : USA (zqboml), Africa (z-botl), Ukraine (zt_rqyl).
   */
  var VOA_USA = 'https://www.voanews.com/api/zqboml-vomx-tpeivmy';
  var VOA_AFRICA = 'https://www.voanews.com/api/z-botl-vomx-tpertmq';
  var VOA_UKRAINE = 'https://www.voanews.com/api/zt_rqyl-vomx-tpekboq_';
  var VOA_FEED = {
    '': VOA_USA,
    science: VOA_USA,
    technology: VOA_USA,
    politics: VOA_USA,
    environment: VOA_AFRICA,
    world: VOA_AFRICA,
    uk: VOA_UKRAINE,
    us: VOA_USA
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
    showSettings: false,
    sources: { guardian: true, conversation: true, voa: true }
  };

  var _loadGen = 0;

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

  var _storeCache = null;

  /** Lecture seule (ne pas muter) : parse localStorage une fois jusqu’au prochain saveStore. */
  function readStore() {
    if (!_storeCache) _storeCache = loadStore();
    return _storeCache;
  }

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('storage', function (e) {
      if (!e || e.key === null || e.key === STORE_KEY) _storeCache = null;
    });
  }

  function saveStore(store) {
    _storeCache = null;
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
    return readStore().apiKeyGuardian.trim();
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
    return readStore().saved.some(function (a) { return a && a.id === id; });
  }

  function findSaved(id) {
    return readStore().saved.find(function (a) { return a && a.id === id; }) || null;
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
      SPAN: 1, DIV: 1, IMG: 1, HR: 1, SUP: 1, SUB: 1, MARK: 1
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
          if (tag === 'MARK' && n === 'class') {
            child.setAttribute('class', 'ae-hl');
            return;
          }
          child.removeAttribute(attr.name);
        });
        if (tag === 'A') {
          child.setAttribute('rel', 'noopener noreferrer');
          child.setAttribute('target', '_blank');
        }
        if (tag === 'MARK') child.setAttribute('class', 'ae-hl');
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
    if (isNaN(d.getTime())) return String(iso).slice(0, 16);
    return d.toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  var _genCtl = null;

  /** fetch annulé quand un nouveau chargement remplace celui-ci (résultat déjà ignoré). */
  function fetchT(url, genSignal) {
    if (!genSignal) return fetch(url);
    return fetch(url, { signal: genSignal });
  }

  /* ---------- Guardian ---------- */
  function fetchGuardian(page, genSignal) {
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
    return fetchT(url, genSignal).then(function (res) {
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

  /* ---------- RSS / Atom : rss2json (Conversation) + allorigins (VOA / fallback) ---------- */
  function normalizeFeedDate(pub) {
    if (!pub) return '';
    var d = new Date(pub);
    return isNaN(d.getTime()) ? String(pub) : d.toISOString();
  }

  function pageSlice(all) {
    var slice = all.slice(0, S.page * PAGE_SIZE);
    return {
      items: slice,
      hasMore: all.length > slice.length,
      allCount: all.length
    };
  }

  function mapRss2JsonItems(data, sourceId, sourceLabel) {
    return (data.items || []).map(function (it) {
      var link = it.link || it.guid || '';
      var html = it.content || it.description || '';
      return {
        id: articleId(sourceId, link),
        source: sourceId,
        sourceLabel: sourceLabel,
        url: link,
        title: it.title || '',
        date: normalizeFeedDate(it.pubDate || it.pubdate || ''),
        theme: (it.categories && it.categories[0]) || S.theme || '',
        standfirst: stripTags(it.description || html).slice(0, 220),
        bodyHtml: sanitizeHtml(html),
        thumb: (it.thumbnail || (it.enclosure && it.enclosure.link) || '')
      };
    }).filter(function (a) {
      return a.url && matchQuery(a.title, a.standfirst) && inDateRange(a.date);
    });
  }

  function parseXmlFeed(xmlText, sourceId, sourceLabel) {
    var out = [];
    var doc;
    try {
      doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    } catch (e) {
      return out;
    }
    function localName(el) {
      return (el.localName || el.tagName || '').replace(/^.*:/, '').toLowerCase();
    }
    function childText(node, name) {
      var kids = node.childNodes;
      for (var i = 0; i < kids.length; i++) {
        var c = kids[i];
        if (c.nodeType === 1 && localName(c) === name) {
          return (c.textContent || '').trim();
        }
      }
      return '';
    }
    function pushFrom(node, isAtom) {
      var title = '';
      var link = '';
      var pub = '';
      var desc = '';
      var cat = '';
      if (isAtom) {
        title = childText(node, 'title');
        var kids = node.childNodes;
        for (var i = 0; i < kids.length; i++) {
          var c = kids[i];
          if (c.nodeType !== 1 || localName(c) !== 'link') continue;
          var rel = c.getAttribute('rel') || 'alternate';
          var href = c.getAttribute('href') || '';
          if (href && (rel === 'alternate' || !link)) link = href;
        }
        pub = childText(node, 'published') || childText(node, 'updated');
        desc = childText(node, 'content') || childText(node, 'summary');
      } else {
        title = childText(node, 'title');
        link = childText(node, 'link') || childText(node, 'guid');
        pub = childText(node, 'pubDate');
        var contentEnc = node.getElementsByTagNameNS
          ? node.getElementsByTagNameNS('http://purl.org/rss/1.0/modules/content/', 'encoded')
          : null;
        if (contentEnc && contentEnc[0]) desc = contentEnc[0].textContent || '';
        if (!desc) desc = childText(node, 'description');
        cat = childText(node, 'category');
      }
      if (!link) return;
      out.push({
        id: articleId(sourceId, link),
        source: sourceId,
        sourceLabel: sourceLabel,
        url: link,
        title: title,
        date: normalizeFeedDate(pub),
        theme: cat || S.theme || '',
        standfirst: stripTags(desc).slice(0, 220),
        bodyHtml: sanitizeHtml(desc),
        thumb: ''
      });
    }
    var entries = doc.getElementsByTagNameNS
      ? doc.getElementsByTagNameNS('http://www.w3.org/2005/Atom', 'entry')
      : [];
    if (!entries.length) entries = doc.getElementsByTagName('entry');
    if (entries && entries.length) {
      for (var e = 0; e < entries.length; e++) pushFrom(entries[e], true);
    } else {
      var items = doc.getElementsByTagName('item');
      for (var j = 0; j < items.length; j++) pushFrom(items[j], false);
    }
    return out.filter(function (a) {
      return matchQuery(a.title, a.standfirst) && inDateRange(a.date);
    });
  }

  /** Sans &count= : gratuit, sinon rss2json renvoie HTTP 422. */
  function fetchRss2Json(feedUrl, genSignal) {
    var url = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feedUrl);
    function once() {
      return fetchT(url, genSignal).then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok || !data || data.status !== 'ok') {
            var msg = (data && data.message) ? String(data.message) : ('HTTP ' + res.status);
            throw new Error(msg);
          }
          return data;
        });
      });
    }
    return once().catch(function (err) {
      var m = String(err && err.message || err);
      if (/processed|please wait/i.test(m)) {
        return new Promise(function (resolve) { setTimeout(resolve, 900); }).then(once);
      }
      throw err;
    });
  }

  function normalizeProxyXml(text) {
    var t = String(text || '').trim();
    if (!t || t.length < 40) throw new Error('Feed vide');
    if (/^error code:/i.test(t)) throw new Error(t);
    if (t.indexOf('<html') >= 0 && t.indexOf('<rss') < 0 && t.indexOf('<feed') < 0) {
      throw new Error('Proxy HTML');
    }
    if (t.indexOf('<rss') >= 0 || t.indexOf('<feed') >= 0 || t.indexOf('<?xml') >= 0) return t;
    throw new Error('Réponse proxy invalide');
  }

  function fetchAllOrigins(feedUrl, genSignal) {
    var enc = encodeURIComponent(feedUrl);
    /* /get (JSON) est plus fiable que /raw côté CORS */
    return fetchT('https://api.allorigins.win/get?url=' + enc, genSignal).then(function (res) {
      if (!res.ok) throw new Error('Proxy HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      return normalizeProxyXml(data && data.contents);
    }).catch(function () {
      return fetchT('https://api.allorigins.win/raw?url=' + enc, genSignal).then(function (res) {
        if (!res.ok) throw new Error('Proxy HTTP ' + res.status);
        return res.text();
      }).then(normalizeProxyXml);
    });
  }

  function failFetchMsg(err) {
    var msg = err && err.message ? String(err.message) : 'Load failed';
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
      return 'réseau / CORS — réessaie';
    }
    if (/Internal error/i.test(msg)) return 'proxy RSS indisponible';
    return msg;
  }

  /** Items bruts d’un flux RSS (rss2json puis proxy). */
  function fetchRssItems(feedUrl, sourceId, sourceLabel, genSignal) {
    return fetchRss2Json(feedUrl, genSignal).then(function (data) {
      return mapRss2JsonItems(data, sourceId, sourceLabel);
    }).catch(function (e1) {
      return fetchAllOrigins(feedUrl, genSignal).then(function (xml) {
        return parseXmlFeed(xml, sourceId, sourceLabel);
      }).catch(function (e2) {
        throw new Error(failFetchMsg(e1) + (e2 ? ' / ' + failFetchMsg(e2) : ''));
      });
    });
  }

  function fetchRssPaged(feedUrl, sourceId, sourceLabel, genSignal) {
    return fetchRssItems(feedUrl, sourceId, sourceLabel, genSignal).then(pageSlice);
  }

  function fetchConversation(genSignal) {
    var feed = CONVERSATION_FEED[S.theme] || CONVERSATION_FEED[''];
    return fetchRssPaged(feed, 'conversation', 'The Conversation', genSignal);
  }

  function fetchVoa(genSignal) {
    var theme = S.theme || '';
    /* Sans thème : fusionner 3 flux VOA stables (USA + Afrique + Ukraine). */
    if (!theme) {
      return Promise.all([
        fetchRssItems(VOA_USA, 'voa', 'VOA', genSignal),
        fetchRssItems(VOA_AFRICA, 'voa', 'VOA', genSignal),
        fetchRssItems(VOA_UKRAINE, 'voa', 'VOA', genSignal)
      ]).then(function (lists) {
        return pageSlice(mergeByDate(lists[0], lists[1], lists[2]));
      });
    }
    return fetchRssPaged(VOA_FEED[theme] || VOA_USA, 'voa', 'VOA', genSignal);
  }

  function mergeByDate() {
    var map = Object.create(null);
    for (var i = 0; i < arguments.length; i++) {
      (arguments[i] || []).forEach(function (it) {
        if (!it || !it.id) return;
        if (!map[it.id]) map[it.id] = it;
      });
    }
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (x, y) {
      return new Date(y.date || 0) - new Date(x.date || 0);
    });
  }

  function emptyPart() {
    return Promise.resolve({ items: [], hasMore: false });
  }

  function loadDiscover(append) {
    /* « Voir plus » : ignorer si un fetch tourne déjà. Rechargement : invalide l’ancien. */
    if (append && S.loading) return;
    if (!append) {
      S.page = 1;
      S.items = [];
      S.error = '';
    }
    var gen = ++_loadGen;
    if (_genCtl) { try { _genCtl.abort(); } catch (e) { /* ignore */ } }
    _genCtl = typeof AbortController === 'function' ? new AbortController() : null;
    var genSignal = _genCtl ? _genCtl.signal : null;
    S.loading = true;
    paint();

    var jobs = [
      S.sources.guardian
        ? fetchGuardian(S.page, genSignal).catch(function (err) {
          return { items: [], hasMore: false, error: String(err && err.message || err) };
        })
        : emptyPart(),
      S.sources.conversation
        ? fetchConversation(genSignal).catch(function (err) {
          return { items: [], hasMore: false, error: String(err && err.message || err) };
        })
        : emptyPart(),
      S.sources.voa
        ? fetchVoa(genSignal).catch(function (err) {
          return { items: [], hasMore: false, error: String(err && err.message || err) };
        })
        : emptyPart()
    ];

    Promise.all(jobs).then(function (parts) {
      if (gen !== _loadGen) return;
      var g = parts[0] || {};
      var c = parts[1] || {};
      var v = parts[2] || {};
      var errs = [];
      if (g.needKey && S.sources.guardian) {
        errs.push('Clé Guardian manquante (optionnel si Conversation / VOA seuls).');
      }
      if (g.error) errs.push('Guardian : ' + g.error);
      if (c.error) errs.push('Conversation : ' + c.error);
      if (v.error) errs.push('VOA : ' + v.error);

      var merged = append
        ? mergeByDate(S.items, g.items || [], c.items || [], v.items || [])
        : mergeByDate(g.items || [], c.items || [], v.items || []);
      var seen = Object.create(null);
      S.items = merged.filter(function (it) {
        if (seen[it.id]) return false;
        seen[it.id] = true;
        return true;
      });
      S.hasMore = !!(g.hasMore || c.hasMore || v.hasMore);
      S.error = errs.join(' ');
      S.loading = false;
      paint();
    }).catch(function (err) {
      if (gen !== _loadGen) return;
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

  function persistReaderBody() {
    var body = $('aeReaderBody');
    if (!body || !S.openId) return;
    var st = loadStore();
    var found = false;
    st.saved.forEach(function (a) {
      if (a && a.id === S.openId) {
        a.bodyHtml = body.innerHTML;
        found = true;
      }
    });
    if (found) saveStore(st);
  }

  function highlightSelection() {
    var body = $('aeReaderBody');
    if (!body) return;
    var sel = window.getSelection && window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      toast('Sélectionne du texte dans l’article');
      return;
    }
    if (!body.contains(sel.anchorNode) || !body.contains(sel.focusNode)) {
      toast('Sélectionne du texte dans l’article');
      return;
    }
    try {
      var range = sel.getRangeAt(0);
      var mark = document.createElement('mark');
      mark.className = 'ae-hl';
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
      body.normalize();
      sel.removeAllRanges();
      persistReaderBody();
      toast('Surligné');
    } catch (err) {
      toast('Sélection trop complexe — réessaie sur un passage plus court');
    }
  }

  function clearHighlights() {
    var body = $('aeReaderBody');
    if (!body) return;
    var marks = body.querySelectorAll('mark.ae-hl');
    if (!marks.length) {
      toast('Aucun surlignage');
      return;
    }
    marks.forEach(function (m) {
      var parent = m.parentNode;
      if (!parent) return;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
    });
    body.normalize();
    persistReaderBody();
    toast('Surlignages effacés');
  }

  function unwrapHighlight(mark) {
    if (!mark || !mark.parentNode) return;
    var parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
    persistReaderBody();
  }

  function openArticle(id, fromSaved) {
    S.openId = id;
    S._openFromSaved = !!fromSaved;
    S.showSettings = false;
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
    var list = readStore().saved.slice();
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
        (fromSaved
          ? '<div class="ae-hl-bar">' +
              '<button type="button" class="bp" id="aeHlAdd">Surligner</button>' +
              '<button type="button" class="bs" id="aeHlClear">Effacer surlignages</button>' +
              '<span class="anki-mut ae-hl-hint">Sélectionne un passage, puis Surligner · clic sur un surlignage pour l’enlever</span>' +
            '</div>'
          : '') +
        '<p class="ae-reader-meta anki-mut">' +
          esc(art.sourceLabel || '') +
          (art.date ? ' · ' + esc(formatDate(art.date)) : '') +
          (art.theme ? ' · ' + esc(art.theme) : '') +
        '</p>' +
        '<h2 class="ae-reader-title">' + esc(art.title) + '</h2>' +
        '<div class="ae-reader-body' + (fromSaved ? ' ae-reader-body--hl' : '') + '" id="aeReaderBody">' +
          (art.bodyHtml || '<p class="anki-mut">Pas de corps disponible — ouvre l’original.</p>') +
        '</div>' +
        '<p class="ae-attrib anki-mut">Source : ' + esc(art.sourceLabel || art.source) +
          (art.url ? ' — <a href="' + esc(art.url) + '" target="_blank" rel="noopener noreferrer">article original</a>' : '') +
        '</p>' +
      '</div>'
    );
  }

  function settingsPanelHtml() {
    var key = getApiKey();
    var hasKey = !!key;
    return (
      '<div class="ae-settings' + (S.showSettings ? ' is-open' : '') + '" id="aeSettings">' +
        '<div class="ae-settings-head">' +
          '<button type="button" class="bs ae-settings-toggle" id="aeToggleSettings" aria-expanded="' +
            (S.showSettings ? 'true' : 'false') + '">' +
            iconLabel('settings', 'Paramètres') +
            (hasKey ? '<span class="ae-key-dot" title="Clé Guardian OK"></span>' : '') +
          '</button>' +
          '<div class="ae-src-chips" id="aeSrcChips">' +
            '<label class="ae-chip' + (S.sources.guardian ? ' on' : '') + '"><input type="checkbox" id="aeSrcG"' +
              (S.sources.guardian ? ' checked' : '') + ' hidden> Guardian</label>' +
            '<label class="ae-chip' + (S.sources.conversation ? ' on' : '') + '"><input type="checkbox" id="aeSrcC"' +
              (S.sources.conversation ? ' checked' : '') + ' hidden> Conversation</label>' +
            '<label class="ae-chip' + (S.sources.voa ? ' on' : '') + '"><input type="checkbox" id="aeSrcV"' +
              (S.sources.voa ? ' checked' : '') + ' hidden> VOA</label>' +
          '</div>' +
        '</div>' +
        (S.showSettings
          ? '<div class="ae-settings-body">' +
              '<label class="ae-key-label">Clé API Guardian (gratuite)</label>' +
              '<div class="ae-key-row">' +
                '<input type="password" class="fi" id="aeGuardianKey" placeholder="open-platform.theguardian.com" value="' +
                  esc(key) + '" autocomplete="off">' +
                '<button type="button" class="bp" id="aeSaveKey">Enregistrer</button>' +
                '<a class="bs" href="https://open-platform.theguardian.com/access/" target="_blank" rel="noopener noreferrer">Obtenir</a>' +
              '</div>' +
              '<p class="anki-mut ae-settings-note">Conversation et VOA n’ont pas besoin de clé. La clé reste sur cet appareil.</p>' +
            '</div>'
          : '') +
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
            '<p class="anki-mut" style="margin:0;font-size:12px;">Sources libres · Guardian + Conversation + VOA</p></div></div>' +
          readerHtml(open) +
        '</div>';
      wire();
      if (typeof window.hydrateIcons === 'function') window.hydrateIcons(pane);
      return;
    }

    var listHtml = '';
    if (S.sub === 'discover') {
      if (S.loading && !S.items.length) {
        listHtml = '<p class="anki-mut ae-status">Chargement…</p>';
      } else if (!S.items.length) {
        listHtml = '<p class="anki-empty">Aucun article — ajuste les filtres' +
          (!getApiKey() && S.sources.guardian ? ' ou ouvre Paramètres pour la clé Guardian' : '') + '.</p>';
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
        '<div class="ae-top">' +
          '<div class="ae-top-title">' +
            '<h3>' + iconLabel('book-open', 'Articles EN') + '</h3>' +
            '<p class="anki-mut ae-top-sub">Sources libres · Saved local (hors sync)</p>' +
          '</div>' +
          '<div class="ae-subtabs" role="tablist">' +
            '<button type="button" class="ae-subtab' + (S.sub === 'discover' ? ' on' : '') + '" data-ae-sub="discover">Découvrir</button>' +
            '<button type="button" class="ae-subtab' + (S.sub === 'saved' ? ' on' : '') + '" data-ae-sub="saved">Saved</button>' +
          '</div>' +
        '</div>' +
        (S.sub === 'discover' ? settingsPanelHtml() : '') +
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
    var v = $('aeSrcV');
    if (g) S.sources.guardian = !!g.checked;
    if (c) S.sources.conversation = !!c.checked;
    if (v) S.sources.voa = !!v.checked;
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
          var next = sub.getAttribute('data-ae-sub') === 'saved' ? 'saved' : 'discover';
          S.sub = next;
          S.openId = null;
          /* Toujours re-peindre (évite le blocage si un fetch Découvrir était encore en cours). */
          if (next === 'discover' && !S.items.length) loadDiscover(false);
          else paint();
          return;
        }
        if (t.id === 'aeToggleSettings' || t.closest('#aeToggleSettings')) {
          readFiltersFromDom();
          S.showSettings = !S.showSettings;
          paint();
          return;
        }
        var chip = t.closest('.ae-chip');
        if (chip && chip.querySelector('input[type="checkbox"]')) {
          e.preventDefault();
          var cb = chip.querySelector('input[type="checkbox"]');
          cb.checked = !cb.checked;
          chip.classList.toggle('on', cb.checked);
          readFiltersFromDom();
          if (S.sub === 'discover') loadDiscover(false);
          return;
        }
        if (t.id === 'aeSaveKey' || t.closest('#aeSaveKey')) {
          var inp = $('aeGuardianKey');
          setApiKey(inp ? inp.value : '');
          toast('Clé Guardian enregistrée');
          S.showSettings = false;
          paint();
          return;
        }
        if (t.id === 'aeApply' || t.closest('#aeApply')) {
          readFiltersFromDom();
          if (S.sub === 'discover') loadDiscover(false);
          else paint();
          return;
        }
        if (t.id === 'aeMore' || t.closest('#aeMore')) {
          S.page += 1;
          loadDiscover(true);
          return;
        }
        if (t.id === 'aeCloseReader' || t.closest('#aeCloseReader')) {
          closeReader();
          return;
        }
        if (t.id === 'aeHlAdd' || t.closest('#aeHlAdd')) {
          highlightSelection();
          return;
        }
        if (t.id === 'aeHlClear' || t.closest('#aeHlClear')) {
          clearHighlights();
          return;
        }
        var hlMark = t.closest('mark.ae-hl');
        if (hlMark && t.closest('#aeReaderBody')) {
          unwrapHighlight(hlMark);
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
