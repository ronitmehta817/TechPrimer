
if (typeof CONTENT !== 'undefined' && typeof window.CONTENT_FULL === 'undefined') {
  window.CONTENT_FULL = CONTENT;
}

(function () {
  'use strict';

  // ===================== CONFIG =====================
  var THEME_KEY = 'tech-primer-theme';
  var STORAGE_PFX = 'tp-';
  var DEFAULT_LANG = 'plaintext';
  var GUIDE_TITLE = 'Tech Primer';
  var GUIDE_ICON = '\uD83D\uDCDA';
  var SITE_ORIGIN = 'https://tech-primer.ronitmehta817.workers.dev/';
  var SITE_DESCRIPTION = 'A complete software engineering learning guide for system design, microservices, message queues, Spring Framework, and design patterns.';


  var DOMAINS = [
    { prefix: 'sd-', label: 'System Design', icon: '\uD83C\uDFDB\uFE0F', desc: 'System design fundamentals, building blocks, scalability, reliability, and case studies.', file: 'sd', category: 'arch' },
    { prefix: 'ms-', label: 'Microservices', icon: '\uD83D\uDD17', desc: 'Architecture patterns, communication, data management, resilience, and deployment.', file: 'ms', category: 'arch' },
    { prefix: 'mq-', label: 'Message Queues', icon: '\uD83D\uDCEC', desc: 'Messaging patterns, reliability, Kafka, RabbitMQ, event-driven architecture.', file: 'mq', category: 'arch' },
    { prefix: 'dp-', label: 'Design Patterns', icon: '\uD83E\uDDE9', desc: 'Creational, structural, and behavioral object-oriented design patterns in Java.', file: 'dp', category: 'code' },
    { prefix: 'spring-', label: 'Spring Framework', icon: '\uD83C\uDF31', desc: 'Spring Core, Spring Boot, AOP, JDBC, Hibernate, and MVC.', file: 'spring', category: 'code' }
  ];

  // Domain categories drive the grouped welcome page layout.
  var DOMAIN_CATEGORIES = [
    { key: 'arch', label: 'Systems & Architecture', desc: 'High-level architecture, scalability, and distributed systems.' },
    { key: 'code', label: 'Code & Frameworks', desc: 'Object-oriented design and the Spring ecosystem.' }
  ];

  var ICONS = {
    chevron: '<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>',
    prevArr: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>',
    nextArr: '<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>',
    image: '<path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"/>',
    refresh: '<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"/>',
    copy: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"/>',
    check: '<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    star: '<path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/>',
    starFill: '<path fill="currentColor" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/>',
    note: '<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931ZM16.862 4.487L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"/>',
    playlist: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>'
  };

  // ===================== HELPERS =====================
  function svg(name, w, sw) {
    return '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="' + (sw || 2) + '" stroke="currentColor"' + (w ? ' width="' + w + '" height="' + w + '"' : '') + '>' + ICONS[name] + '</svg>';
  }

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') el.className = attrs[k];
        else if (k === 'text') el.textContent = attrs[k];
        else if (k === 'html') el.innerHTML = attrs[k];
        else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(el.style, attrs[k]);
        else if (k === 'on') Object.keys(attrs[k]).forEach(function (ev) { el.addEventListener(ev, attrs[k][ev]); });
        else if (k === 'data') Object.keys(attrs[k]).forEach(function (d) { el.dataset[d] = attrs[k][d]; });
        else el.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (!c) return;
        el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return el;
  }

  // readingTime is hot - called for every chapter on every nav rebuild.
  // The result only depends on chapter content, so cache it on the chapter
  // object the first time we see it.
  var READING_TIME_RX = /[#*`\[\]()|\->\~\_\!\^]/g;
  var WHITESPACE_RX = /\s+/;
  function computeReadingTime(text) {
    if (!text) return '';
    var stripped = text.replace(READING_TIME_RX, ' ');
    // Avoid the .filter() pass and full split into an array; estimate word
    // count by counting whitespace-delimited chunks while walking once.
    var len = stripped.length;
    var count = 0;
    var inWord = false;
    for (var i = 0; i < len; i++) {
      var c = stripped.charCodeAt(i);
      var isWs = (c === 32 || c === 9 || c === 10 || c === 13);
      if (!isWs) {
        if (!inWord) { count++; inWord = true; }
      } else {
        inWord = false;
      }
    }
    return Math.max(1, Math.ceil(count / 100)) + ' min';
  }
  function readingTime(text, chapter) {
    if (chapter && chapter._readingTime) return chapter._readingTime;
    var rt = computeReadingTime(text);
    if (chapter) chapter._readingTime = rt;
    return rt;
  }

  function getDomain(sectionId) {
    for (var i = 0; i < DOMAINS.length; i++) {
      if (sectionId.indexOf(DOMAINS[i].prefix) === 0) return DOMAINS[i];
    }
    return null;
  }

  function chKey(sid, cid) { return sid + '/' + cid; }

  function getChapterUrl(sectionId, chapterId) {
    var url = new URL(window.location);
    url.hash = '';
    url.search = '';
    url.searchParams.set('section', sectionId);
    url.searchParams.set('chapter', chapterId);
    return url;
  }

  function getCanonicalUrl(sectionId, chapterId) {
    var url = new URL('/', SITE_ORIGIN);
    if (sectionId && chapterId) {
      url.searchParams.set('section', sectionId);
      url.searchParams.set('chapter', chapterId);
    }
    return url.toString();
  }

  function setHeadMeta(selector, attrName, attrValue, content) {
    var el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function setCanonical(url) {
    var el = document.head.querySelector('link[rel="canonical"]');
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', 'canonical');
      document.head.appendChild(el);
    }
    el.setAttribute('href', url);
  }

  function updateDocumentMeta(section, chapter) {
    var title = GUIDE_TITLE + ' \u2014 Complete Guide';
    var description = SITE_DESCRIPTION;
    var canonical = getCanonicalUrl();
    if (section && chapter) {
      var domain = getDomain(section.id);
      var scope = domain ? domain.label : section.title;
      title = chapter.title + ' \u2014 ' + scope + ' | ' + GUIDE_TITLE;
      description = 'Learn ' + chapter.title + ' in the ' + scope + ' section of Tech Primer.';
      canonical = getCanonicalUrl(section.id, chapter.id);
    }
    document.title = title;
    setHeadMeta('meta[name="description"]', 'name', 'description', description);
    setHeadMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setHeadMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setHeadMeta('meta[property="og:url"]', 'property', 'og:url', canonical);
    setHeadMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setHeadMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    setCanonical(canonical);
  }

  // ===================== CHAPTER ID NORMALISATION =====================
  // Chapter IDs in CONTENT historically duplicated their section's prefix
  // ("sd-foundations" section + "sd-01-..." chapter -> redundant "sd-",
  //  "mq-foundations" section + "mq-foundations-..." chapter -> redundant
  //  "mq-foundations-").  We trim the longest matching prefix once at load
  // time so chapter IDs are short (and identical to the URL form) everywhere
  // downstream - URL routing, search index, lookups, and localStorage keys.
  // The mutation happens at every CONTENT entry point so by the time any
  // other code touches a chapter, the .id is already canonical.
  function normaliseChapterId(sectionId, chapterId) {
    if (!sectionId || !chapterId) return chapterId;
    var fullPrefix = sectionId + '-';
    if (chapterId.indexOf(fullPrefix) === 0) return chapterId.slice(fullPrefix.length);
    var domain = getDomain(sectionId);
    if (domain && chapterId.indexOf(domain.prefix) === 0) return chapterId.slice(domain.prefix.length);
    return chapterId;
  }

  function normaliseSectionIds(sections) {
    if (!Array.isArray(sections)) return sections;
    sections.forEach(function (sec) {
      if (!sec || !Array.isArray(sec.chapters)) return;
      sec.chapters.forEach(function (ch) {
        if (ch && typeof ch.id === 'string') ch.id = normaliseChapterId(sec.id, ch.id);
      });
    });
    return sections;
  }

  // ===================== AUTH =====================
  // Holds the currently signed-in Google user (or null), and provides
  // signIn/signOut helpers. `load()` is called once at boot to populate
  // `user` from /api/me; `onChange` listeners fire whenever user changes.
  //
  // Human-readable messages for every code the server can stash into
  // `?login_error=...` after a failed callback. The URL never carries free
  // text — only one of these whitelisted codes — so reflected XSS via the
  // login_error param isn't possible. Unknown codes fall through to a
  // generic message.
  var LOGIN_ERROR_MESSAGES = {
    oauth_access_denied: 'Sign-in was cancelled.',
    oauth_invalid_request: 'Sign-in failed: invalid request.',
    oauth_unauthorized_client: 'This app is not authorized.',
    oauth_unsupported_response_type: 'Sign-in failed: unsupported response.',
    oauth_invalid_scope: 'Sign-in failed: invalid scope.',
    oauth_server_error: 'Google had a problem; please try again.',
    oauth_temporarily_unavailable: 'Google is temporarily unavailable.',
    state_mismatch: 'Sign-in expired or was tampered with. Please try again.',
    missing_state_cookie: 'Browser blocked sign-in cookies. Allow cookies and retry.',
    missing_params: 'Sign-in failed: missing data from Google.',
    nonce_mismatch: 'Sign-in failed integrity check. Please try again.',
    missing_sub: 'Sign-in failed: Google did not return your account ID.',
    token_exchange_failed: 'Could not contact Google. Please try again.',
    id_token_invalid: 'Sign-in failed: invalid token from Google.',
    session_sign_failed: 'Server could not create your session. Please try again.',
    not_configured: 'Sign-in is not configured on this server.'
  };

  var Auth = {
    user: null,
    loaded: false,
    pendingLoginError: null,    // { code, message } from URL on boot
    _listeners: [],
    _signingIn: false,          // double-click guard, see signIn()
    // Single mutation point for `user` so every path (boot, in-page sign-out,
    // session-expired 401 from /api/store) consistently fans out to listeners
    // and the account UI repaints. Direct assignment to Auth.user bypasses
    // listeners and leaves the avatar stuck in the old state.
    _setUser: function (u) {
      this.user = (u && u.sub) ? u : null;
      var self = this;
      this._listeners.forEach(function (fn) { try { fn(self.user); } catch (_) { } });
    },
    load: function () {
      var self = this;
      return fetch('/api/me', { credentials: 'same-origin' }).then(function (r) {
        return r.ok ? r.json() : null;
      }).catch(function () { return null; }).then(function (u) {
        self._setUser(u);
        self.loaded = true;
        return self.user;
      });
    },
    onChange: function (fn) { this._listeners.push(fn); },
    signIn: function () {
      // The button click handler can fire many times before the navigation
      // actually starts (especially on slow networks or impatient users).
      // Refusing duplicate calls within a 5-second window prevents a flurry
      // of /auth/login redirects, each of which would burn one rate-limit
      // slot and could trip the per-IP limiter unnecessarily.
      if (this._signingIn) return;
      this._signingIn = true;
      setTimeout(function () { Auth._signingIn = false; }, 5000);
      var rt = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
      window.location.href = '/auth/login?return_to=' + rt;
    },
    signOut: function () { window.location.href = '/auth/logout'; },
    // Called once at boot. If the URL has ?login_error=<code>, we capture
    // the matching message into `pendingLoginError` and strip the param
    // (and any leftover ?code/?state from a half-completed callback) so a
    // page refresh doesn't re-show the error. The actual UI render happens
    // in initAccountUi() so the dropdown DOM exists by then.
    consumeLoginErrorFromUrl: function () {
      try {
        var u = new URL(window.location.href);
        var code = u.searchParams.get('login_error');
        if (!code) return;
        var msg = LOGIN_ERROR_MESSAGES[code] || 'Sign-in failed. Please try again.';
        this.pendingLoginError = { code: code, message: msg };
        u.searchParams.delete('login_error');
        u.searchParams.delete('code');
        u.searchParams.delete('state');
        u.searchParams.delete('error');
        var qs = u.searchParams.toString();
        var clean = u.pathname + (qs ? '?' + qs : '') + u.hash;
        window.history.replaceState(null, '', clean);
      } catch (_) { /* URL/replaceState may not be available; skip */ }
    }
  };
  Auth.consumeLoginErrorFromUrl();

  // ===================== STORAGE =====================
  // Public API matches the original Store exactly so the rest of the app
  // is unchanged. Internally:
  //   - prefs always live at the legacy prefix (device-local UX state).
  //   - bookmarks/notes/playlists/last-read live at the legacy prefix when
  //     signed-out, and at a per-user prefix (`tp-u:<sub>:`) when signed-in.
  //   - Every signed-in write schedules a debounced PUT /api/store.
  //   - On boot, if signed-in, we fetch /api/store and merge with whatever
  //     local copy exists (legacy on first sign-in, per-user prefix on
  //     subsequent sign-ins) using last-write-wins-by-`t` per entry, then
  //     persist the merged blob locally and push it back to the server.
  // SYNCED_KEYS lists the localStorage keys that participate in remote sync.
  var SYNCED_KEYS = ['bookmarks', 'notes', 'playlists', 'last-read'];
  var REMOTE_DEBOUNCE_MS = 1500;

  function userPrefixFor(sub) { return STORAGE_PFX + 'u:' + sub + ':'; }

  var Store = {
    pfx: STORAGE_PFX,
    _legacyPfx: STORAGE_PFX,
    _writeTimer: null,
    _writeInFlight: false,
    _writeQueued: false,
    _suspendRemote: false,
    _changeHandlers: [],

    _keyPrefix: function (k) { return k === 'prefs' ? this._legacyPfx : this.pfx; },

    _g: function (k, d) {
      try { var v = localStorage.getItem(this._keyPrefix(k) + k); return v ? JSON.parse(v) : d; }
      catch (e) { return d; }
    },
    _s: function (k, v) {
      try { localStorage.setItem(this._keyPrefix(k) + k, JSON.stringify(v)); } catch (e) { }
      if (!this._suspendRemote && SYNCED_KEYS.indexOf(k) !== -1 && Auth.user) {
        this._scheduleRemotePut();
      }
    },

    getLastRead: function () { return this._g('last-read', null); },
    setLastRead: function (sid, c) { this._s('last-read', { s: sid, c: c, t: Date.now() }); },

    getBookmarks: function () { return this._g('bookmarks', {}); },
    toggleBookmark: function (key, title, sid) {
      var b = this.getBookmarks();
      if (b[key]) delete b[key]; else b[key] = { title: title, sid: sid, t: Date.now() };
      this._s('bookmarks', b);
      return !!b[key];
    },
    isBookmarked: function (key) { return !!this.getBookmarks()[key]; },

    getNotes: function (key) { return this._g('notes', {})[key] || ''; },
    setNotes: function (key, text) { var n = this._g('notes', {}); if (text) n[key] = text; else delete n[key]; this._s('notes', n); },
    getAllNotes: function () { return this._g('notes', {}); },

    getPlaylists: function () { return this._g('playlists', []); },
    savePlaylists: function (p) { this._s('playlists', p); },

    getPrefs: function () { return this._g('prefs', { fontSize: 'M', lineSpacing: 'normal', contentWidth: 'default' }); },
    savePrefs: function (p) { this._s('prefs', p); },

    onChange: function (fn) { this._changeHandlers.push(fn); },
    _emitChange: function () {
      this._changeHandlers.forEach(function (fn) { try { fn(); } catch (_) { } });
    },

    // Build the synced-keys snapshot from a given prefix.
    _readSnapshotFromPrefix: function (pfx) {
      function read(k, d) {
        try { var v = localStorage.getItem(pfx + k); return v ? JSON.parse(v) : d; }
        catch (e) { return d; }
      }
      return {
        bookmarks: read('bookmarks', {}),
        notes: read('notes', {}),
        playlists: read('playlists', []),
        lastRead: read('last-read', null)
      };
    },

    _writeSnapshotToPrefix: function (pfx, snap) {
      function write(k, v) {
        try { localStorage.setItem(pfx + k, JSON.stringify(v)); } catch (e) { }
      }
      write('bookmarks', snap.bookmarks || {});
      write('notes', snap.notes || {});
      write('playlists', Array.isArray(snap.playlists) ? snap.playlists : []);
      if (snap.lastRead) write('last-read', snap.lastRead);
    },

    // Last-write-wins per entry, keyed by `t` where available. For notes
    // (no `t` today) we union local + remote, with remote winning on
    // collision since it is the cross-device source of truth.
    _mergeSnapshots: function (local, remote) {
      local = local || {}; remote = remote || {};
      var merged = { bookmarks: {}, notes: {}, playlists: [], lastRead: null };

      var lb = local.bookmarks || {}, rb = remote.bookmarks || {};
      Object.keys(lb).forEach(function (k) { merged.bookmarks[k] = lb[k]; });
      Object.keys(rb).forEach(function (k) {
        var lt = (lb[k] && typeof lb[k].t === 'number') ? lb[k].t : 0;
        var rt = (rb[k] && typeof rb[k].t === 'number') ? rb[k].t : 0;
        if (!lb[k] || rt >= lt) merged.bookmarks[k] = rb[k];
      });

      var ln = local.notes || {}, rn = remote.notes || {};
      Object.keys(ln).forEach(function (k) { merged.notes[k] = ln[k]; });
      Object.keys(rn).forEach(function (k) { merged.notes[k] = rn[k]; });

      var byId = {};
      var lp = Array.isArray(local.playlists) ? local.playlists : [];
      var rp = Array.isArray(remote.playlists) ? remote.playlists : [];
      lp.forEach(function (p) { if (p && p.id) byId[p.id] = p; });
      rp.forEach(function (p) {
        if (!p || !p.id) return;
        var existing = byId[p.id];
        if (!existing) { byId[p.id] = p; return; }
        var lt = existing.t || 0, rt = p.t || 0;
        if (rt >= lt) byId[p.id] = p;
      });
      merged.playlists = Object.keys(byId).map(function (id) { return byId[id]; });

      var llr = local.lastRead || null, rlr = remote.lastRead || null;
      if (!llr) merged.lastRead = rlr;
      else if (!rlr) merged.lastRead = llr;
      else merged.lastRead = ((rlr.t || 0) >= (llr.t || 0)) ? rlr : llr;

      return merged;
    },

    // Suspends local→remote sync until this wall-clock timestamp (ms).
    // Set by 429 responses' Retry-After header so we stop hammering the
    // server while the rate limiter cools down.
    _rateLimitedUntil: 0,
    _rateLimitTimer: null,
    // Set whenever a write happens while the cooldown is active. Tells
    // tick() whether to schedule a flush-after-cooldown or just clear the
    // status and stay quiet.
    _pendingFlushAfterCooldown: false,

    _handleUnauthorized: function () {
      Auth._setUser(null);
      this.deactivateSync();
      setSyncStatus('Signed out (session expired)', 'error');
    },

    _handleRateLimited: function (response, label) {
      var retryAfterSec = parseInt(response.headers.get('Retry-After') || '60', 10);
      if (!Number.isFinite(retryAfterSec) || retryAfterSec < 1) retryAfterSec = 60;
      this._rateLimitedUntil = Date.now() + retryAfterSec * 1000;
      this._scheduleRateLimitTick(label);
    },

    _scheduleRateLimitTick: function (label) {
      var self = this;
      var prefix = label || 'Sync';
      function tick() {
        var remainMs = self._rateLimitedUntil - Date.now();
        if (remainMs <= 0) {
          self._rateLimitTimer = null;
          setSyncStatus('', '');
          // Only flush after cooldown if a real write came in during the
          // cooldown window. Otherwise we'd be sending an unchanged
          // snapshot on every cooldown-end and burning KV writes for free.
          if (Auth.user && self._pendingFlushAfterCooldown) {
            self._pendingFlushAfterCooldown = false;
            self._scheduleRemotePut();
          }
          return;
        }
        var sec = Math.ceil(remainMs / 1000);
        setSyncStatus(prefix + ' rate-limited, retry in ' + sec + 's', 'error');
        self._rateLimitTimer = setTimeout(tick, 1000);
      }
      if (this._rateLimitTimer) clearTimeout(this._rateLimitTimer);
      tick();
    },

    _isRateLimited: function () {
      return Date.now() < this._rateLimitedUntil;
    },

    // Try to read the standardized JSON envelope { error, message }; fall
    // back to a generic message so the UI always has something to show.
    _readErrorBody: function (response) {
      return response.text().then(function (text) {
        try {
          var body = JSON.parse(text);
          if (body && typeof body.message === 'string') return body.message;
          if (body && typeof body.error === 'string') return body.error;
        } catch (_) { /* not JSON, fall through */ }
        return 'HTTP ' + response.status;
      }).catch(function () { return 'HTTP ' + response.status; });
    },

    _remoteGet: function () {
      var self = this;
      return fetch('/api/store', { credentials: 'same-origin' }).then(function (r) {
        if (r.status === 401) { self._handleUnauthorized(); return {}; }
        if (r.status === 429) {
          self._handleRateLimited(r, 'Sync');
          throw new Error('rate_limited');
        }
        if (!r.ok) {
          return self._readErrorBody(r).then(function (msg) {
            setSyncStatus('Sync failed: ' + msg, 'error');
            throw new Error('GET /api/store ' + r.status);
          });
        }
        return r.json();
      });
    },

    _remotePut: function (snap) {
      var self = this;
      return fetch('/api/store', {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snap)
      }).then(function (r) {
        if (r.status === 401) { self._handleUnauthorized(); throw new Error('unauthorized'); }
        if (r.status === 429) {
          self._handleRateLimited(r, 'Sync');
          throw new Error('rate_limited');
        }
        if (!r.ok) {
          return self._readErrorBody(r).then(function (msg) {
            // 4xx (validation) errors mean the local snapshot can never be
            // accepted as-is; surface the reason to the user so they can
            // adjust (delete a huge note, etc.). 5xx errors mean transient
            // server trouble — show the message but the next debounced
            // flush will retry.
            setSyncStatus('Sync failed: ' + msg, 'error');
            throw new Error('PUT /api/store ' + r.status);
          });
        }
        return r.json().then(function (body) {
          setSyncStatus('Synced', 'success');
          setTimeout(function () { setSyncStatus('', ''); }, 2000);
          return body;
        });
      });
    },

    _scheduleRemotePut: function () {
      var self = this;
      if (!Auth.user) return;
      if (this._isRateLimited()) {
        // Remember that we owe the server a flush once the cooldown ends.
        this._pendingFlushAfterCooldown = true;
        return;
      }
      if (this._writeTimer) clearTimeout(this._writeTimer);
      this._writeTimer = setTimeout(function () { self._flushRemote(); }, REMOTE_DEBOUNCE_MS);
    },

    _flushRemote: function () {
      var self = this;
      this._writeTimer = null;
      if (!Auth.user) return;
      if (this._isRateLimited()) return;
      if (this._writeInFlight) { this._writeQueued = true; return; }
      this._writeInFlight = true;
      var snap = this._readSnapshotFromPrefix(this.pfx);
      this._remotePut(snap).catch(function () { }).then(function () {
        self._writeInFlight = false;
        if (self._writeQueued) { self._writeQueued = false; self._scheduleRemotePut(); }
      });
    },

    // Called once after Auth.load() resolves with a signed-in user. Picks
    // a local seed (legacy prefix on first ever sign-in for this account
    // on this browser, otherwise the per-user prefix), fetches the remote
    // blob, merges, persists locally under the per-user prefix, and pushes
    // the merged blob back so the server is up to date too.
    initSync: function () {
      var self = this;
      if (!Auth.user) return Promise.resolve(false);
      var sub = Auth.user.sub;
      var userPfx = userPrefixFor(sub);

      var hasUserData = false;
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (key && key.indexOf(userPfx) === 0) { hasUserData = true; break; }
        }
      } catch (e) { /* private mode etc. */ }

      var seedPfx = hasUserData ? userPfx : this._legacyPfx;
      var localSeed = this._readSnapshotFromPrefix(seedPfx);

      return this._remoteGet().then(function (remote) {
        var merged = self._mergeSnapshots(localSeed, remote || {});
        self._suspendRemote = true;
        self.pfx = userPfx;
        self._writeSnapshotToPrefix(userPfx, merged);
        self._suspendRemote = false;
        return self._remotePut(merged).catch(function () { }).then(function () {
          self._emitChange();
          return true;
        });
      }).catch(function () {
        self.pfx = userPfx;
        self._emitChange();
        return false;
      });
    },

    // Switch back to the legacy prefix without wiping per-user data so the
    // user can sign back in later and pick up where they left off.
    deactivateSync: function () { this.pfx = this._legacyPfx; },

    // Cross-tab sync within the same browser: when another tab on this
    // origin writes to a key under the active prefix, repaint UI here.
    _handleStorageEvent: function (e) {
      if (!e || !e.key || e.key.indexOf(this.pfx) !== 0) return;
      var k = e.key.slice(this.pfx.length);
      if (SYNCED_KEYS.indexOf(k) === -1) return;
      this._emitChange();
    }
  };
  window.addEventListener('storage', function (e) { Store._handleStorageEvent(e); });

  // ===================== STATE =====================
  var state = {
    activeSection: null,
    activeChapter: null,
    flatChapters: [],
    activeDomainFilter: null,
    loadedDomains: {},
    contentLoaded: false,
    fuseInstance: null,
    mermaidReady: false
  };
  var dom = {};
  var tocScrollHandler = null;
  var searchTimer = null;

  // ===================== LAZY CONTENT LOADING =====================
  var CONTENT = [];

  function getContentForDomain(prefix) {
    return CONTENT.filter(function (s) { return s.id.indexOf(prefix) === 0; });
  }

  function loadDomainContent(prefix, cb) {
    var domain = null;
    for (var i = 0; i < DOMAINS.length; i++) { if (DOMAINS[i].prefix === prefix) { domain = DOMAINS[i]; break; } }
    if (!domain) { if (cb) cb(); return; }
    if (state.loadedDomains[prefix]) { if (cb) cb(); return; }

    var varName = 'CONTENT_' + domain.file.toUpperCase();
    if (window[varName]) {
      mergeDomainContent(window[varName], prefix);
      if (cb) cb();
      return;
    }

    var script = document.createElement('script');
    script.src = 'content/' + domain.file + '.js';
    script.onload = function () {
      if (window[varName]) mergeDomainContent(window[varName], prefix);
      if (cb) cb();
    };
    script.onerror = function () {
      if (!state.contentLoaded && window.CONTENT_FALLBACK) {
        CONTENT = normaliseSectionIds(window.CONTENT_FALLBACK);
        state.contentLoaded = true;
        DOMAINS.forEach(function (d) { state.loadedDomains[d.prefix] = true; });
      }
      if (cb) cb();
    };
    document.head.appendChild(script);
  }

  function mergeDomainContent(sections, prefix) {
    normaliseSectionIds(sections);
    sections.forEach(function (sec) {
      var exists = CONTENT.find(function (s) { return s.id === sec.id; });
      if (!exists) CONTENT.push(sec);
      else {
        exists.chapters = sec.chapters;
        exists.title = sec.title;
        exists.icon = sec.icon;
      }
    });
    state.loadedDomains[prefix] = true;
    initFuse();
  }

  function ensureAllContentLoaded(cb) {
    var pending = DOMAINS.filter(function (d) { return !state.loadedDomains[d.prefix]; });
    if (!pending.length) { if (cb) cb(); return; }
    var loaded = 0;
    pending.forEach(function (d) {
      loadDomainContent(d.prefix, function () {
        loaded++;
        if (loaded === pending.length && cb) cb();
      });
    });
  }

  function initContentFromManifest() {
    if (window.CONTENT_FULL && Array.isArray(window.CONTENT_FULL)) {
      CONTENT = normaliseSectionIds(window.CONTENT_FULL);
      state.contentLoaded = true;
      DOMAINS.forEach(function (d) { state.loadedDomains[d.prefix] = true; });
      return;
    }
    if (window.CONTENT_MANIFEST) {
      CONTENT = normaliseSectionIds(window.CONTENT_MANIFEST.map(function (s) {
        return {
          id: s.id, title: s.title, icon: s.icon, description: s.description || '', chapters: s.chapters.map(function (ch) {
            return { id: ch.id, title: ch.title, parent: ch.parent || undefined, content: '' };
          })
        };
      }));
    }
  }

  // ===================== FUSE SEARCH =====================
  function initFuse() {
    if (!window.Fuse) return;
    var items = [];
    CONTENT.forEach(function (section) {
      section.chapters.forEach(function (ch) {
        items.push({
          sectionId: section.id,
          sectionTitle: section.title,
          chapterId: ch.id,
          chapterTitle: ch.title,
          contentSnippet: (ch.content || '').replace(/[#*`\[\]()|\->\~\_\!\^]/g, ' ').substring(0, 3000)
        });
      });
    });
    state.fuseInstance = new Fuse(items, {
      keys: [
        { name: 'chapterTitle', weight: 0.45 },
        { name: 'contentSnippet', weight: 0.35 },
        { name: 'sectionTitle', weight: 0.2 }
      ],
      threshold: 0.35,
      includeMatches: true,
      minMatchCharLength: 2,
      ignoreLocation: true
    });
  }

  // ===================== THEME =====================
  function initTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    var sun = dom.themeToggle && dom.themeToggle.querySelector('.sun-icon');
    var moon = dom.themeToggle && dom.themeToggle.querySelector('.moon-icon');
    if (sun && moon) {
      sun.style.display = theme === 'light' ? 'block' : 'none';
      moon.style.display = theme === 'dark' ? 'block' : 'none';
    }
    if (state.mermaidReady) {
      try { mermaid.initialize({ theme: theme === 'dark' ? 'dark' : 'default', startOnLoad: false }); } catch (e) { }
    }
    if (window.AetherBg && window.AetherBg.setTheme) window.AetherBg.setTheme(theme);
    if (window.AetherWelcome && window.AetherWelcome.setTheme) window.AetherWelcome.setTheme(theme);
  }

  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme');
    var next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    if (state.activeChapter) reRenderMermaid();
    if (parallaxState) initParallaxShapes();
  }

  // ===================== READING PREFERENCES =====================
  function applyPreferences() {
    var p = Store.getPrefs();
    document.documentElement.setAttribute('data-font-size', p.fontSize);
    document.documentElement.setAttribute('data-line-spacing', p.lineSpacing);
    document.documentElement.setAttribute('data-content-width', p.contentWidth);

    ['prefs-font-size', 'prefs-line-spacing', 'prefs-content-width'].forEach(function (id) {
      var group = document.getElementById(id);
      if (!group) return;
      var key = id === 'prefs-font-size' ? 'fontSize' : id === 'prefs-line-spacing' ? 'lineSpacing' : 'contentWidth';
      group.querySelectorAll('button').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.val === p[key]);
      });
    });
    updateSidebarToggleVisibility();
  }

  function setupPreferences() {
    ['prefs-font-size', 'prefs-line-spacing', 'prefs-content-width'].forEach(function (id) {
      var group = document.getElementById(id);
      if (!group) return;
      var key = id === 'prefs-font-size' ? 'fontSize' : id === 'prefs-line-spacing' ? 'lineSpacing' : 'contentWidth';
      group.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var p = Store.getPrefs();
        p[key] = btn.dataset.val;
        Store.savePrefs(p);
        applyPreferences();
      });
    });
  }

  // ===================== SIDEBAR & NAV =====================
  function isMobileLayout() { return window.matchMedia('(max-width: 1024px)').matches; }

  function isWideMode() { return document.documentElement.getAttribute('data-content-width') === 'wide'; }

  function updateSidebarToggleVisibility() {
    if (!dom.sidebarToggle) return;
    var shouldShow = !isMobileLayout() && !!state.activeSection && !!state.activeChapter && (isWideMode() || !dom.guideMain.classList.contains('full-width'));
    dom.sidebarToggle.classList.toggle('visible', shouldShow);
  }

  function openSidebar() {
    dom.sidebar.classList.add('open'); dom.overlay.classList.add('active'); document.body.style.overflow = 'hidden';
    if (isWideMode() && dom.chapterToc.classList.contains('visible')) dom.chapterToc.classList.add('open');
  }
  function closeSidebar() {
    dom.sidebar.classList.remove('open'); dom.overlay.classList.remove('active'); document.body.style.overflow = '';
    dom.chapterToc.classList.remove('open');
  }

  function updateSearchPlaceholder() {
    var text = 'Search across all topics\u2026';
    if (state.activeDomainFilter) {
      for (var i = 0; i < DOMAINS.length; i++) {
        if (DOMAINS[i].prefix === state.activeDomainFilter) { text = 'Search in ' + DOMAINS[i].label + '\u2026'; break; }
      }
    }
    if (dom.searchInput) dom.searchInput.placeholder = text;
    if (dom.searchInputMobile) dom.searchInputMobile.placeholder = text;
  }

  function getFilteredContent() {
    var filtered = CONTENT;
    if (state.activeDomainFilter) {
      filtered = filtered.filter(function (s) { return s.id.indexOf(state.activeDomainFilter) === 0; });
    }
    return filtered;
  }

  function buildNavigation() {
    dom.sidebarNav.innerHTML = '';
    state.flatChapters = [];
    var filtered = getFilteredContent();
    var bookmarks = Store.getBookmarks();

    filtered.forEach(function (section) {
      var domain = getDomain(section.id);

      var headerEl = h('div', {
        class: 'sidebar-section-header', html:
          '<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' + ICONS.chevron + '</svg>' +
          '<span class="section-icon">' + section.icon + '</span>' +
          '<span>' + section.title + '</span>' +
          (domain ? '<span style="font-size:11px;opacity:0.6;margin-left:auto;text-transform:none;letter-spacing:0;">' + domain.label + '</span>' : '')
      });
      var itemsContainer = h('div', { class: 'sidebar-section-items' });

      var lastParent = null;
      section.chapters.forEach(function (ch) {
        if (ch.parent && ch.parent !== lastParent) {
          itemsContainer.appendChild(h('div', { class: 'nav-group-header', text: ch.parent }));
          lastParent = ch.parent;
        }
        state.flatChapters.push({ sectionId: section.id, chapter: ch });
        var key = chKey(section.id, ch.id);
        var isBookmarked = !!bookmarks[key];
        var navItem = h('a', {
          class: 'nav-item',
          href: '?section=' + section.id + '&chapter=' + ch.id,
          data: { section: section.id, chapter: ch.id, testid: 'chapter-link' },
          on: { click: function (e) { e.preventDefault(); loadChapter(section.id, ch.id); closeSidebar(); } }
        }, [
          h('span', { class: 'nav-item-dot' }),
          h('span', { class: 'nav-item-title', text: ch.title }),
          isBookmarked ? h('span', { class: 'nav-item-star', html: svg('starFill', 12) }) : null,
          h('span', { class: 'nav-item-time', text: ch.content ? readingTime(ch.content, ch) : '' })
        ].filter(Boolean));
        itemsContainer.appendChild(navItem);
      });

      headerEl.addEventListener('click', function () {
        var wasExpanded = headerEl.classList.contains('expanded');
        headerEl.classList.toggle('expanded');
        itemsContainer.classList.toggle('expanded');
        if (!wasExpanded) {
          var children = itemsContainer.querySelectorAll('.nav-item, .nav-group-header');
          children.forEach(function (el, i) {
            el.classList.remove('nav-stagger');
            void el.offsetWidth;
            el.style.animationDelay = (i * 0.04) + 's';
            el.classList.add('nav-stagger');
          });
        }
      });
      dom.sidebarNav.appendChild(h('div', { class: 'sidebar-section' }, [headerEl, itemsContainer]));
    });
  }

  function setActiveNav(sectionId, chapterId) {
    dom.sidebarNav.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
    var target = dom.sidebarNav.querySelector('.nav-item[data-section="' + sectionId + '"][data-chapter="' + chapterId + '"]');
    if (target) {
      target.classList.add('active');
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      var sec = target.closest('.sidebar-section');
      if (sec) {
        var hdr = sec.querySelector('.sidebar-section-header');
        var items = sec.querySelector('.sidebar-section-items');
        if (hdr && !hdr.classList.contains('expanded')) hdr.classList.add('expanded');
        if (items && !items.classList.contains('expanded')) items.classList.add('expanded');
      }
    }
  }

  // ===================== MARKDOWN & CONTENT =====================
  function configureMarked() { marked.setOptions({ gfm: true, breaks: false }); }

  function highlightCode() {
    dom.contentArea.querySelectorAll('pre code').forEach(function (block) {
      // Mermaid blocks are converted to SVG diagrams later; never let
      // highlight.js touch them - it strips the original textContent on
      // reprocess and removes the language-mermaid class on some builds.
      if (block.classList.contains('language-mermaid') || block.classList.contains('lang-mermaid')) return;
      var hasLang = false;
      block.classList.forEach(function (c) { if (c.indexOf('language-') === 0) hasLang = true; });
      if (!hasLang) block.classList.add('language-' + DEFAULT_LANG);
      hljs.highlightElement(block);
    });
  }

  function strategyVisualMeta(label) {
    var key = String(label || '').replace(/:$/, '').trim().toLowerCase();
    var map = {
      'how it works': { kind: 'flow', badge: 'Flow' },
      'strengths': { kind: 'plus', badge: 'Good' },
      'watch-outs': { kind: 'risk', badge: 'Risk' },
      'use when': { kind: 'fit', badge: 'Fit' }
    };
    return map[key] || null;
  }

  function wrapSubSections() {
    var md = dom.contentArea.querySelector('.md-content');
    if (!md) return;
    var children = Array.from(md.children);
    for (var i = 0; i < children.length - 1; i++) {
      var p = children[i], next = children[i + 1];
      if (p.tagName !== 'P') continue;
      var strong = p.querySelector('strong');
      if (!strong || !strong.textContent.endsWith(':')) continue;
      if (!next || (next.tagName !== 'UL' && next.tagName !== 'OL')) continue;

      var rest = p.textContent.replace(strong.textContent, '').trim();
      var label = strong.textContent.replace(/:$/, '');
      var visual = strategyVisualMeta(label);
      var wrapperAttrs = {
        class: 'sub-section' + (visual ? ' strategy-visual-card strategy-visual-' + visual.kind : '')
      };
      if (visual) wrapperAttrs.data = { visual: visual.kind };

      var wrapper = h('div', wrapperAttrs, [
        h('div', { class: 'sub-section-label' }, [
          visual ? h('span', { class: 'strategy-visual-badge', text: visual.badge }) : null,
          h('span', { text: label })
        ].filter(Boolean)),
        rest ? h('div', { class: 'sub-section-desc', text: rest }) : null
      ].filter(Boolean));

      p.parentNode.insertBefore(wrapper, p);
      wrapper.appendChild(next);
      p.remove();
      children = Array.from(md.children);
      i--;
    }
  }

  function enhanceContent() {
    var md = dom.contentArea.querySelector('.md-content');
    if (!md) return;
    md.innerHTML = md.innerHTML
      .replace(/\(Recommended\)/g, '<span class="keyword-badge recommended">Recommended</span>')
      .replace(/\(Default\)/g, '<span class="keyword-badge default-badge">Default</span>');
    md.querySelectorAll('p').forEach(function (p) {
      var s = p.querySelector('strong');
      if (!s) return;
      var st = s.textContent || '';
      if (!st.endsWith(':')) return;
      var next = p.nextElementSibling;
      if (next && (next.tagName === 'UL' || next.tagName === 'OL' || next.classList.contains('sub-section'))) return;
      var full = p.textContent || '';
      var desc = full.replace(st, '').trim();
      if (!desc) return;
      var block = h('div', { class: 'definition-block' }, [
        h('div', { class: 'def-term', text: st.replace(/:$/, '') }),
        h('div', { class: 'def-desc', text: desc })
      ]);
      p.parentNode.replaceChild(block, p);
    });
  }

  // ===================== MIND MAP MODAL =====================
  function slugifyFileName(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // ===================== CHAPTER MIND MAP =====================
  // The recap is precomputed at build time by scripts/build-mindmaps.mjs
  // and shipped as mindmaps.js (window.AllWebMindMapData). The renderer in
  // mindmap.js looks up the chapter by id, paints colours, lays it out and
  // returns an unattached card. This wrapper just decides *whether* to ask
  // for a recap and where to drop the launch button. The actual map is only
  // created after the user clicks the button, and is displayed inside a modal.
  //
  // We also opportunistically verify the precomputed-data checksum against
  // the live CONTENT array on the first call. A mismatch means mindmaps.js
  // is stale (someone edited content.js without regenerating); the recap
  // will still render — it'll just show old labels for any freshly-edited
  // chapters until `npm run build:mindmaps` runs.
  function closeMindMapModal() {
    var modal = document.querySelector('.mindmap-modal-backdrop');
    if (!modal) return;
    var previousOverflow = modal._previousOverflow || '';
    if (modal._mindmapTimers) modal._mindmapTimers.forEach(function (timer) { clearTimeout(timer); });
    modal.remove();
    document.body.style.overflow = previousOverflow;
  }

  function openChapterMindMapModal(sectionId, chapter) {
    var api = window.AllWebMindMap;
    if (!api || typeof api.create !== 'function') return;

    closeMindMapModal();
    var previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    var modal = h('div', {
      class: 'modal-backdrop mindmap-modal-backdrop',
      role: 'presentation',
      on: { click: function (e) { if (e.target === modal) closeMindMapModal(); } }
    });
    modal._previousOverflow = previousOverflow;

    var box = h('div', {
      class: 'modal-box mindmap-modal-box',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'mindmap-modal-title'
    });

    var closeBtn = h('button', {
      class: 'mindmap-modal-close',
      type: 'button',
      'aria-label': 'Close mind map',
      on: { click: closeMindMapModal }
    }, ['\u00d7']);

    var downloadBtn = h('button', {
      class: 'mindmap-modal-download',
      type: 'button',
      disabled: 'disabled',
      'aria-disabled': 'true',
      on: { click: function () { downloadChapterMindMap(sectionId, chapter); } }
    }, ['Download']);

    box.appendChild(h('div', { class: 'mindmap-modal-header' }, [
      h('div', {}, [
        h('div', { class: 'mindmap-modal-eyebrow', text: 'Chapter Mind Map' }),
        h('h3', { id: 'mindmap-modal-title', text: chapter.title || 'Chapter Mind Map' })
      ]),
      h('div', { class: 'mindmap-modal-actions' }, [downloadBtn, closeBtn])
    ]));

    var body = h('div', { class: 'mindmap-modal-body' });
    body.appendChild(buildMindMapGenerationState(chapter));
    box.appendChild(body);
    modal.appendChild(box);
    document.body.appendChild(modal);
    closeBtn.focus();

    runMindMapGenerationSteps(modal, body, downloadBtn, sectionId, chapter);
  }

  function buildMindMapGenerationState(chapter) {
    return h('div', { class: 'mindmap-generation' }, [
      h('div', { class: 'mindmap-generation-orb' }),
      h('div', { class: 'mindmap-generation-title', text: 'Generating mind map' }),
      h('div', {
        class: 'mindmap-generation-subtitle',
        text: 'Preparing a visual recap for ' + ((chapter && chapter.title) || 'this chapter') + '.'
      }),
      h('div', { class: 'mindmap-generation-steps' }, [
        h('div', { class: 'mindmap-generation-step active', data: { step: '0' } }, [
          h('span', { class: 'mindmap-step-dot' }),
          h('span', { class: 'mindmap-step-text', text: 'Extracting chapter data' })
        ]),
        h('div', { class: 'mindmap-generation-step', data: { step: '1' } }, [
          h('span', { class: 'mindmap-step-dot' }),
          h('span', { class: 'mindmap-step-text', text: 'Extracted headings and key points' })
        ]),
        h('div', { class: 'mindmap-generation-step', data: { step: '2' } }, [
          h('span', { class: 'mindmap-step-dot' }),
          h('span', { class: 'mindmap-step-text', text: 'Generating branches and connectors' })
        ]),
        h('div', { class: 'mindmap-generation-step', data: { step: '3' } }, [
          h('span', { class: 'mindmap-step-dot' }),
          h('span', { class: 'mindmap-step-text', text: 'Rendering mind map' })
        ])
      ])
    ]);
  }

  function setMindMapGenerationStep(modal, stepIndex) {
    if (!modal || !modal.parentNode) return;
    modal.querySelectorAll('.mindmap-generation-step').forEach(function (step) {
      var idx = Number(step.dataset.step);
      step.classList.toggle('done', idx < stepIndex);
      step.classList.toggle('active', idx === stepIndex);
    });
  }

  function runMindMapGenerationSteps(modal, body, downloadBtn, sectionId, chapter) {
    var api = window.AllWebMindMap;
    var timers = [];
    var stepMs = 2000;
    modal._mindmapTimers = timers;

    [1, 2, 3].forEach(function (stepIndex, idx) {
      timers.push(setTimeout(function () {
        setMindMapGenerationStep(modal, stepIndex);
      }, stepMs * (idx + 1)));
    });

    timers.push(setTimeout(function () {
      if (!modal.parentNode || !api || typeof api.create !== 'function') return;
      var card = api.create({
        sectionId:    sectionId,
        chapterId:    chapter.id,
        chapterTitle: chapter.title || 'Chapter'
      });
      if (!card) return;
      body.innerHTML = '';
      body.appendChild(card);
      downloadBtn.disabled = false;
      downloadBtn.removeAttribute('disabled');
      downloadBtn.setAttribute('aria-disabled', 'false');
      modal._mindmapTimers = [];
    }, stepMs * 4));
  }

  function slugifyFileName(s) {
    return String(s || 'chapter')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'chapter';
  }

  function downloadChapterMindMap(sectionId, chapter) {
    var api = window.AllWebMindMap;
    if (!api || typeof api.toSvg !== 'function' || !chapter) return;
    var svgText = api.toSvg({
      sectionId: sectionId,
      chapterId: chapter.id,
      chapterTitle: chapter.title || 'Chapter'
    });
    if (!svgText) return;

    var blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = slugifyFileName(chapter.title || chapter.id) + '-mind-map.svg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function renderChapterMindMap(sectionId, chapter) {
    var api = window.AllWebMindMap;
    if (!api || typeof api.create !== 'function') return; // mindmap.js not loaded yet
    if (!sectionId || !chapter || !chapter.id) return;
    if (typeof api.verifyChecksum === 'function') {
      try { api.verifyChecksum(CONTENT); } catch (_) { /* never break the page over a sanity check */ }
    }
    // doLoadChapter() can fire twice in quick succession (initial route +
    // explicit nav-click), so guard against double launch cards.
    if (dom.contentArea.querySelector('.chapter-mindmap-launch')) return;
    var glassWrap = dom.contentArea.querySelector('.chapter-glass-wrap');
    if (!glassWrap || !glassWrap.parentNode) return;

    if (typeof api.has === 'function' && !api.has({ sectionId: sectionId, chapterId: chapter.id })) return;

    var launch = h('div', { class: 'chapter-mindmap-launch' }, [
      h('div', { class: 'chapter-mindmap-launch-copy' }, [
        h('span', { class: 'chapter-mindmap-eyebrow', text: 'Chapter Mind Map' }),
        h('p', { text: 'Open a colour-coded visual recap of this chapter.' })
      ]),
      h('button', {
        class: 'chapter-mindmap-open',
        type: 'button',
        on: { click: function () { openChapterMindMapModal(sectionId, chapter); } }
      }, ['Generate Mind Map'])
    ]);

    glassWrap.parentNode.insertBefore(launch, glassWrap.nextSibling);
  }

  // ===================== CALLOUT BOXES =====================
  function parseCallouts() {
    var md = dom.contentArea.querySelector('.md-content');
    if (!md) return;
    md.querySelectorAll('blockquote').forEach(function (bq) {
      var first = bq.querySelector('p');
      if (!first) return;
      var html = first.innerHTML;
      var calloutTypes = [
        { re: /^\s*\[!(NOTE|INFO)\]\s*/i, type: 'info', icon: '\u2139\uFE0F', label: 'Note' },
        { re: /^\s*\[!(TIP|HINT)\]\s*/i, type: 'tip', icon: '\uD83D\uDCA1', label: 'Tip' },
        { re: /^\s*\[!(WARNING|WARN|CAUTION)\]\s*/i, type: 'warning', icon: '\u26A0\uFE0F', label: 'Warning' },
        { re: /^\s*\[!(DANGER|IMPORTANT|CRITICAL)\]\s*/i, type: 'danger', icon: '\uD83D\uDED1', label: 'Important' },
        { re: /^\s*<strong>(Note|Info)[:.]?<\/strong>\s*/i, type: 'info', icon: '\u2139\uFE0F', label: 'Note' },
        { re: /^\s*<strong>(Tip|Hint)[:.]?<\/strong>\s*/i, type: 'tip', icon: '\uD83D\uDCA1', label: 'Tip' },
        { re: /^\s*<strong>(Warning|Caution)[:.]?<\/strong>\s*/i, type: 'warning', icon: '\u26A0\uFE0F', label: 'Warning' },
        { re: /^\s*<strong>(Danger|Important|Critical)[:.]?<\/strong>\s*/i, type: 'danger', icon: '\uD83D\uDED1', label: 'Important' }
      ];
      for (var i = 0; i < calloutTypes.length; i++) {
        var ct = calloutTypes[i];
        if (ct.re.test(html)) {
          first.innerHTML = html.replace(ct.re, '');
          bq.classList.add('callout', 'callout-' + ct.type);
          var header = h('div', { class: 'callout-header', html: '<span class="callout-icon">' + ct.icon + '</span> ' + ct.label });
          bq.insertBefore(header, bq.firstChild);
          break;
        }
      }
    });
  }

  // ===================== MERMAID DIAGRAMS =====================
  function initMermaid() {
    if (typeof mermaid === 'undefined') return;
    var theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';
    mermaid.initialize({ startOnLoad: false, theme: theme, securityLevel: 'loose', flowchart: { curve: 'basis' } });
    state.mermaidReady = true;
  }

  var mermaidIdCounter = 0;

  function decodeBase64Utf8(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function base64ToUint8Array(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // mermaid.ink encodes diagrams in two ways:
  //   1. /svg/<base64>             -> base64 of the raw mermaid source (legacy)
  //   2. /svg/pako:<base64url>     -> base64url(zlib.deflate(JSON.stringify({code, mermaid: {...}})))
  // Returns the raw mermaid diagram source (e.g. "flowchart LR ...") or null if it cannot be decoded.
  function extractMermaidSourceFromMermaidInkUrl(src) {
    if (!src) return null;
    var match = src.match(/mermaid\.ink\/(?:img|svg)\/(pako:)?([A-Za-z0-9+/=_-]+)/);
    if (!match) return null;
    var isPako = !!match[1];
    var b64 = match[2].replace(/-/g, '+').replace(/_/g, '/');
    try {
      if (isPako) {
        if (typeof pako === 'undefined' || !pako) return null;
        var bytes = base64ToUint8Array(b64);
        var inflated = null;
        try {
          if (typeof pako.inflate === 'function') inflated = pako.inflate(bytes, { to: 'string' });
        } catch (_) { inflated = null; }
        if (inflated == null) {
          try {
            if (typeof pako.inflateRaw === 'function') inflated = pako.inflateRaw(bytes, { to: 'string' });
          } catch (_) { inflated = null; }
        }
        if (!inflated) return null;
        var parsed;
        try { parsed = JSON.parse(inflated); } catch (_) { return null; }
        if (parsed && typeof parsed.code === 'string' && parsed.code.length) return parsed.code;
        return null;
      }
      return decodeBase64Utf8(b64);
    } catch (e) {
      return null;
    }
  }

  function getActiveChapterContext() {
    var section = CONTENT.find(function (s) { return s.id === state.activeSection; });
    var chapter = section && (section.chapters || []).find(function (c) { return c.id === state.activeChapter; });
    return {
      sectionTitle: section ? section.title : '(unknown section)',
      sectionId: state.activeSection || '(none)',
      chapterTitle: chapter ? chapter.title : '(unknown chapter)',
      chapterId: state.activeChapter || '(none)'
    };
  }

  // Mermaid v11 sometimes *resolves* with an error-SVG instead of rejecting.
  // Its error SVG contains the literal text "Syntax error in text" and/or
  // an element with aria-roledescription="error".
  function isMermaidErrorSvg(svg) {
    if (!svg || typeof svg !== 'string') return false;
    if (svg.indexOf('aria-roledescription="error"') !== -1) return true;
    if (/Syntax error in text/i.test(svg)) return true;
    if (/mermaid version /i.test(svg) && /error/i.test(svg)) return true;
    return false;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderMermaidErrorCard(container, code, reason) {
    var ctx = getActiveChapterContext();
    var preview = (code || '').split(/\r?\n/).slice(0, 2).join(' | ').slice(0, 120);
    try {
      console.warn(
        '[Mermaid] Failed to render diagram\n' +
        '  Section : ' + ctx.sectionTitle + ' (' + ctx.sectionId + ')\n' +
        '  Chapter : ' + ctx.chapterTitle + ' (' + ctx.chapterId + ')\n' +
        '  Reason  : ' + (reason || 'unknown') + '\n' +
        '  Preview : ' + preview + '\n' +
        '----- Diagram source -----\n' + (code || '(empty)')
      );
    } catch (e) { }

    container.innerHTML =
      '<div class="mermaid-error">' +
      '<div class="mermaid-error-title">Diagram could not be rendered</div>' +
      '<div class="mermaid-error-meta">' +
      '<strong>' + escapeHtml(ctx.chapterTitle) + '</strong> ' +
      '<span class="mermaid-error-sub">in ' + escapeHtml(ctx.sectionTitle) + '</span>' +
      '</div>' +
      '<div class="mermaid-error-reason">' + escapeHtml(reason || 'Mermaid reported a syntax error.') + '</div>' +
      '<details class="mermaid-error-details">' +
      '<summary>Show diagram source</summary>' +
      '<pre class="mermaid-error-src">' + escapeHtml(code || '') + '</pre>' +
      '</details>' +
      '</div>';
  }

  // Mermaid v11 is stricter than the version behind mermaid.ink: unquoted labels
  // that contain "--" are parsed as edge syntax and the diagram blows up. Diagrams
  // like `subgraph sync [Synchronous -- Tight Coupling]` or node labels such as
  // `P0[Partition 0 -- ordered]` render fine on mermaid.ink but fail locally on v11.
  // The fix is to wrap any unquoted bracket/paren/brace label that contains "--"
  // (or "\n" newlines for forced line breaks) in double quotes so v11 accepts it.
  function sanitizeMermaidSource(code) {
    if (typeof code !== 'string' || !code) return code;

    // Quote subgraph titles with brackets: `subgraph id [Any -- text]` -> `subgraph id ["Any -- text"]`.
    code = code.replace(
      /(\bsubgraph\s+[A-Za-z_][\w.-]*\s*\[)([^"\]][^\]]*)(\])/g,
      function (_, open, label, close) {
        if (!/--|\\n/.test(label)) return open + label + close;
        return open + '"' + label.replace(/"/g, '\\"') + '"' + close;
      }
    );

    // Quote subgraph titles without an id: `subgraph Any -- text`.
    code = code.replace(
      /^(\s*subgraph\s+)([^\n\r"][^\n\r]*?)(\s*)$/gm,
      function (match, open, label, tail) {
        // Skip if it looks like just an id (no whitespace, no dashes) or already quoted.
        if (!/--|\\n|\s/.test(label)) return match;
        if (/^"/.test(label)) return match;
        // Skip "subgraph id [title]" which is handled above (has `[` somewhere).
        if (/\[/.test(label)) return match;
        return open + '"' + label.replace(/"/g, '\\"') + '"' + tail;
      }
    );

    // Quote unquoted edge-middle labels: `A -->|text -- with dashes| B`.
    code = code.replace(
      /(-->?|---?|-\.-|==>?|~~~?)\|([^|\n]*)\|/g,
      function (match, arrow, label) {
        if (!/--|\\n/.test(label)) return match;
        if (/^"/.test(label.replace(/^\s+/, ''))) return match;
        return arrow + '|"' + label.replace(/"/g, '\\"') + '"|';
      }
    );

    // Quote unquoted node labels that contain "--" or "\n" inside [...], (...), {...}.
    // We scan character-by-character so nested/complex bracket content doesn't confuse
    // us with a single greedy regex.
    var out = '';
    var i = 0;
    var len = code.length;
    while (i < len) {
      var m = code.slice(i).match(/^([A-Za-z_][\w.-]*)([\[\(\{])/);
      if (!m) { out += code.charAt(i); i++; continue; }
      var ident = m[1];
      var openCh = m[2];
      var closeCh = openCh === '[' ? ']' : (openCh === '(' ? ')' : '}');
      var start = i + ident.length + 1;
      // Walk forward looking for the matching closer, skipping quoted strings so we
      // don't bail early on a bracket inside a label like `node["a][b"]`.
      var end = -1;
      var depth = 1;
      var k = start;
      var inQuote = null;
      while (k < len) {
        var ch = code.charAt(k);
        if (inQuote) {
          if (ch === '\\' && k + 1 < len) { k += 2; continue; }
          if (ch === inQuote) inQuote = null;
          k++; continue;
        }
        if (ch === '"' || ch === '\'' || ch === '`') { inQuote = ch; k++; continue; }
        if (ch === openCh) { depth++; k++; continue; }
        if (ch === closeCh) { depth--; if (depth === 0) { end = k; break; } k++; continue; }
        k++;
      }
      if (end === -1) { out += code.charAt(i); i++; continue; }
      var label = code.slice(start, end);
      var trimmed = label.replace(/^\s+|\s+$/g, '');
      var alreadyQuoted = (trimmed.charAt(0) === '"' && trimmed.charAt(trimmed.length - 1) === '"') ||
        (trimmed.charAt(0) === '`' && trimmed.charAt(trimmed.length - 1) === '`');
      var risky = /--|\\n/.test(label);
      if (!alreadyQuoted && risky) {
        out += ident + openCh + '"' + label.replace(/"/g, '\\"') + '"' + closeCh;
      } else {
        out += ident + openCh + label + closeCh;
      }
      i = end + 1;
    }
    return out;
  }

  function renderMermaidInkFallback(container, originalSrc) {
    if (!navigator.onLine) {
      var message = document.createElement("p");
      message.className = "mermaid-error";
      message.textContent = "Diagram unavailable offline. Reconnect to retry.";
      container.innerHTML = '';
      container.appendChild(message);
      return true;
    }

    if (!originalSrc) return false;
    var theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';
    var url = originalSrc.split('#')[0].split('?')[0];
    var themed = url + '?theme=' + theme + '&bgColor=!transparent';
    var img = h('img', { src: themed, class: 'mermaid-ink-fallback', alt: 'Diagram' });
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    container.innerHTML = '';
    container.appendChild(img);
    return true;
  }

  function renderMermaidInto(container, code, originalSrc) {
    var uid = 'mmd-' + (++mermaidIdCounter);
    var cleanCode = sanitizeMermaidSource(code);
    function handleFailure(reason) {
      try { console.warn('[MQ-ERR] ' + uid + ': ' + reason + '\n--- code ---\n' + cleanCode); } catch (e) { }
      if (originalSrc && renderMermaidInkFallback(container, originalSrc)) return;
      renderMermaidErrorCard(container, cleanCode, reason);
    }
    try {
      mermaid.render(uid, cleanCode).then(function (result) {
        if (isMermaidErrorSvg(result && result.svg)) {
          handleFailure('Mermaid v11 syntax error.');
          return;
        }
        container.innerHTML = result.svg;
      }).catch(function (err) {
        handleFailure((err && (err.message || err.str)) || 'Mermaid threw an error.');
      });
    } catch (e) {
      handleFailure((e && (e.message || e.toString())) || 'Mermaid render crashed synchronously.');
    }
  }

  function renderMermaidDiagrams() {
    // Lazy init in case Mermaid hadn't finished loading when init() ran.
    if (!state.mermaidReady) initMermaid();
    if (!state.mermaidReady) {
      // Mermaid still missing - retry shortly so we don't silently drop diagrams.
      setTimeout(renderMermaidDiagrams, 200);
      return;
    }
    var md = dom.contentArea.querySelector('.md-content');
    if (!md) return;

    var pending = [];
    var codeBlocks = md.querySelectorAll('pre code.language-mermaid, pre code.lang-mermaid');
    codeBlocks.forEach(function (code) {
      var pre = code.closest('pre');
      if (!pre) return;
      pending.push({ sourceEl: pre, code: code.textContent || '', originalSrc: null });
    });

    var imgs = md.querySelectorAll('img[src*="mermaid.ink"]');
    imgs.forEach(function (img) {
      var src = img.getAttribute('src') || '';
      var decoded = extractMermaidSourceFromMermaidInkUrl(src);
      // Even if we can't decode the source locally, capture the img so we can
      // render it as a themed mermaid.ink fallback instead of leaving a stray
      // light-theme <img> on a dark background.
      pending.push({ sourceEl: img, code: decoded, originalSrc: src });
    });

    if (!pending.length) return;

    var theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';
    try { mermaid.initialize({ startOnLoad: false, theme: theme, securityLevel: 'loose', flowchart: { curve: 'basis' } }); } catch (e) { }

    pending.forEach(function (item) {
      var wrapper = h('div', { class: 'mermaid-wrapper' });
      var container = h('div', { class: 'mermaid-container' });
      if (item.code) container.setAttribute('data-mermaid-src', item.code);
      if (item.originalSrc) container.setAttribute('data-mermaid-ink-src', item.originalSrc);
      wrapper.appendChild(container);

      var skeleton = item.sourceEl.closest('.img-skeleton-wrap');
      if (skeleton) skeleton.parentNode.replaceChild(wrapper, skeleton);
      else if (item.sourceEl.parentNode) item.sourceEl.parentNode.replaceChild(wrapper, item.sourceEl);

      if (item.code) {
        renderMermaidInto(container, item.code, item.originalSrc);
      } else {
        renderMermaidInkFallback(container, item.originalSrc);
      }
    });
  }

  function reRenderMermaid() {
    var wrappers = dom.contentArea.querySelectorAll('.mermaid-wrapper');
    if (!wrappers.length) return;
    var theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';
    try { mermaid.initialize({ startOnLoad: false, theme: theme, securityLevel: 'loose', flowchart: { curve: 'basis' } }); } catch (e) { }

    setTimeout(function () {
      wrappers.forEach(function (wrapper) {
        var oldContainer = wrapper.querySelector('.mermaid-container');
        if (!oldContainer) return;
        var code = oldContainer.getAttribute('data-mermaid-src');
        var originalSrc = oldContainer.getAttribute('data-mermaid-ink-src');

        var newContainer = h('div', { class: 'mermaid-container' });
        if (code) newContainer.setAttribute('data-mermaid-src', code);
        if (originalSrc) newContainer.setAttribute('data-mermaid-ink-src', originalSrc);
        wrapper.replaceChild(newContainer, oldContainer);

        if (code) {
          renderMermaidInto(newContainer, code, originalSrc);
        } else if (originalSrc) {
          renderMermaidInkFallback(newContainer, originalSrc);
        }
      });
    }, 50);
  }

  // ===================== IMAGE SKELETONS =====================
  function wrapTables() {
    dom.contentArea.querySelectorAll('.md-content table').forEach(function (table) {
      if (table.parentNode.classList.contains('table-wrapper')) return;
      var wrapper = h('div', { class: 'table-wrapper' });
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  function skeletonIcon(name, sw) { return '<div class="img-skeleton-icon">' + svg(name, null, sw) + '</div>'; }

  function wrapImageSkeletons() {
    dom.contentArea.querySelectorAll('.md-content img').forEach(function (img) {
      if (img.parentNode.classList.contains('img-skeleton-wrap')) return;
      if (img.closest('.mermaid-wrapper')) return;
      var wrap = h('div', { class: 'img-skeleton-wrap' });
      var skeleton = h('div', { class: 'img-skeleton', html: skeletonIcon('image', 1.5) });
      img.parentNode.insertBefore(wrap, img);
      wrap.appendChild(skeleton);
      wrap.appendChild(img);
      img.addEventListener('load', function () { img.classList.add('loaded'); skeleton.classList.add('hidden'); wrap.style.minHeight = ''; });
      if (!img.getAttribute('data-original-src')) img.setAttribute('data-original-src', img.src);
      function showError() {
        wrap.classList.add('error');
        skeleton.classList.remove('hidden');
        skeleton.innerHTML = skeletonIcon('refresh') + '<div class="img-error-text">Tap to retry</div>';
        skeleton.onclick = function () {
          skeleton.onclick = null; wrap.classList.remove('error');
          skeleton.innerHTML = skeletonIcon('image', 1.5); img.classList.remove('loaded');
          var baseSrc = img.getAttribute('data-original-src');
          var freshSrc = baseSrc + (baseSrc.indexOf('?') === -1 ? '?' : '&') + '_r=' + Date.now();
          var probe = new Image();
          probe.onload = function () { img.src = freshSrc; };
          probe.onerror = showError;
          probe.src = freshSrc;
        };
      }
      img.addEventListener('error', showError);
      if (img.complete && img.naturalWidth > 0) { img.classList.add('loaded'); skeleton.classList.add('hidden'); wrap.style.minHeight = ''; }
    });
  }

  // ===================== CODE HEADERS =====================
  function addCodeHeaders() {
    dom.contentArea.querySelectorAll('.md-content pre').forEach(function (pre) {
      if (pre.parentNode.classList.contains('code-block-wrapper')) return;
      var code = pre.querySelector('code');
      if (!code) return;
      var lang = 'code';
      code.classList.forEach(function (c) { if (c.indexOf('language-') === 0) lang = c.replace('language-', ''); });
      if (lang === 'mermaid') return;
      var display = lang.charAt(0).toUpperCase() + lang.slice(1);
      display = display.replace('Plaintext', 'Text').replace('Js', 'JavaScript').replace('Ts', 'TypeScript');
      var copyBtn = h('button', { class: 'copy-btn', html: svg('copy') + ' Copy' });
      copyBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(code.textContent).then(function () {
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = svg('check') + ' Copied!';
          setTimeout(function () { copyBtn.classList.remove('copied'); copyBtn.innerHTML = svg('copy') + ' Copy'; }, 2000);
        });
      });
      var toolbar = h('div', { class: 'code-copy-toolbar' }, [
        h('span', { class: 'code-language-label', text: display }),
        copyBtn
      ]);
      var wrapper = h('div', { class: 'code-block-wrapper', style: { position: 'relative' } });
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);
      wrapper.appendChild(toolbar);
    });
  }

  // ===================== CHAPTER ACTIONS TOOLBAR =====================
  function renderChapterActions(sectionId, chapterId) {
    var key = chKey(sectionId, chapterId);
    var toolbar = h('div', { class: 'chapter-actions' });

    var bookmarkBtn = h('button', {
      class: 'action-btn bookmark-btn' + (Store.isBookmarked(key) ? ' active' : ''),
      html: svg(Store.isBookmarked(key) ? 'starFill' : 'star', 16) + (Store.isBookmarked(key) ? ' Bookmarked' : ' Bookmark'),
      on: {
        click: function () {
          var section = CONTENT.find(function (s) { return s.id === sectionId; });
          var chapter = section && section.chapters.find(function (c) { return c.id === chapterId; });
          Store.toggleBookmark(key, chapter ? chapter.title : '', sectionId);
          bookmarkBtn.classList.toggle('active');
          bookmarkBtn.innerHTML = svg(Store.isBookmarked(key) ? 'starFill' : 'star', 16) + (Store.isBookmarked(key) ? ' Bookmarked' : ' Bookmark');
          buildNavigation();
          setActiveNav(sectionId, chapterId);
        }
      }
    });

    var playlistBtn = h('button', {
      class: 'action-btn',
      html: svg('playlist', 16) + ' Add to Playlist',
      on: { click: function () { showAddToPlaylist(sectionId, chapterId); } }
    });

    var notesBtn = h('button', {
      class: 'action-btn',
      html: svg('note', 16) + ' Notes',
      on: { click: function () { toggleNotesPanel(sectionId, chapterId); } }
    });

    toolbar.appendChild(bookmarkBtn);
    toolbar.appendChild(playlistBtn);
    toolbar.appendChild(notesBtn);
    return toolbar;
  }

  // ===================== NOTES =====================
  function toggleNotesPanel(sectionId, chapterId) {
    var existing = dom.contentArea.querySelector('.notes-panel');
    if (existing) { existing.remove(); return; }
    var key = chKey(sectionId, chapterId);
    var saved = Store.getNotes(key);
    var panel = h('div', { class: 'notes-panel' });
    var textarea = h('textarea', { class: 'notes-textarea', 'placeholder': 'Write your notes here\u2026 (auto-saved)' });
    textarea.value = saved;
    var status = h('div', { class: 'notes-status', text: saved ? 'Notes loaded' : 'No notes yet' });
    var saveTimer;
    textarea.addEventListener('input', function () {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        Store.setNotes(key, textarea.value);
        status.textContent = 'Saved';
        setTimeout(function () { status.textContent = ''; }, 1500);
      }, 500);
    });
    panel.appendChild(h('div', { class: 'notes-header', html: '<strong>\uD83D\uDCDD Personal Notes</strong>' }));
    panel.appendChild(textarea);
    panel.appendChild(status);
    var chapNav = dom.contentArea.querySelector('.chapter-nav');
    if (chapNav) dom.contentArea.insertBefore(panel, chapNav);
    else dom.contentArea.appendChild(panel);
    textarea.focus();
  }

  // ===================== PLAYLISTS =====================
  function showAddToPlaylist(sectionId, chapterId) {
    var playlists = Store.getPlaylists();
    var key = chKey(sectionId, chapterId);
    var section = CONTENT.find(function (s) { return s.id === sectionId; });
    var chapter = section && section.chapters.find(function (c) { return c.id === chapterId; });
    var title = chapter ? chapter.title : chapterId;

    var modal = h('div', { class: 'modal-backdrop', on: { click: function (e) { if (e.target === modal) modal.remove(); } } });
    var box = h('div', { class: 'modal-box' });
    box.appendChild(h('h3', { text: 'Add to Playlist' }));
    box.appendChild(h('p', { class: 'modal-subtitle', text: title }));

    if (playlists.length) {
      playlists.forEach(function (pl, idx) {
        if (pl.deleted) return;
        var inPl = pl.items.some(function (it) { return it.k === key; });
        var row = h('div', {
          class: 'playlist-row' + (inPl ? ' in-playlist' : ''), on: {
            click: function () {
              if (inPl) {
                pl.items = pl.items.filter(function (it) { return it.k !== key; });
              } else {
                pl.items.push({ k: key, s: sectionId, c: chapterId, title: title });
              }
              pl.t = Date.now();
              Store.savePlaylists(playlists);
              modal.remove();
            }
          }
        });
        row.appendChild(h('span', { text: pl.name + ' (' + pl.items.length + ')' }));
        row.appendChild(h('span', { class: 'playlist-toggle', text: inPl ? '\u2713 Remove' : '+ Add' }));
        box.appendChild(row);
      });
    }

    var newRow = h('div', { class: 'playlist-new' });
    var inp = h('input', { type: 'text', class: 'playlist-input', 'placeholder': 'New playlist name\u2026' });
    var addBtn = h('button', {
      class: 'playlist-add-btn', text: 'Create', on: {
        click: function () {
          var name = inp.value.trim();
          if (!name) return;
          var newId = 'pl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
          playlists.push({ id: newId, name: name, items: [{ k: key, s: sectionId, c: chapterId, title: title }], created: Date.now(), t: Date.now() });
          Store.savePlaylists(playlists);
          modal.remove();
        }
      }
    });
    newRow.appendChild(inp);
    newRow.appendChild(addBtn);
    box.appendChild(newRow);

    modal.appendChild(box);
    document.body.appendChild(modal);
    inp.focus();
  }

  // ===================== PANELS =====================
  function openPanel(id) {
    var panel = document.getElementById(id);
    var overlay = document.getElementById('panel-overlay');
    if (!panel || !overlay) return;
    document.querySelectorAll('.slide-panel.open').forEach(function (p) { p.classList.remove('open'); });
    panel.classList.add('open');
    overlay.classList.add('active');

    if (id === 'panel-bookmarks') renderBookmarksPanel();
    else if (id === 'panel-playlists') renderPlaylistsPanel();
  }

  function closePanel() {
    document.querySelectorAll('.slide-panel.open').forEach(function (p) { p.classList.remove('open'); });
    var overlay = document.getElementById('panel-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  function renderBookmarksPanel() {
    var body = document.getElementById('panel-bookmarks-body');
    if (!body) return;
    body.innerHTML = '';
    var bookmarks = Store.getBookmarks();
    var keys = Object.keys(bookmarks).sort(function (a, b) { return (bookmarks[b].t || 0) - (bookmarks[a].t || 0); });
    if (!keys.length) { body.innerHTML = '<div class="panel-empty">No bookmarks yet. Star chapters to save them here.</div>'; return; }
    keys.forEach(function (key) {
      var bm = bookmarks[key];
      var parts = key.split('/');
      var sid = parts[0], cid = parts.slice(1).join('/');
      var item = h('div', {
        class: 'panel-item', on: {
          click: function () {
            loadChapter(sid, cid);
            closePanel();
          }
        }
      });
      item.appendChild(h('div', { class: 'panel-item-title', text: bm.title || cid }));
      var domain = getDomain(sid);
      item.appendChild(h('div', { class: 'panel-item-meta', text: domain ? domain.icon + ' ' + domain.label : sid }));
      body.appendChild(item);
    });
  }

  function renderPlaylistsPanel() {
    var body = document.getElementById('panel-playlists-body');
    if (!body) return;
    body.innerHTML = '';
    var playlists = Store.getPlaylists();

    var newRow = h('div', { class: 'panel-new-row' });
    var inp = h('input', { type: 'text', class: 'playlist-input', 'placeholder': 'New playlist\u2026' });
    var addBtn = h('button', {
      class: 'playlist-add-btn', text: 'Create', on: {
        click: function () {
          var name = inp.value.trim();
          if (!name) return;
          var newId = 'pl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
          playlists.push({ id: newId, name: name, items: [], created: Date.now(), t: Date.now() });
          Store.savePlaylists(playlists);
          renderPlaylistsPanel();
        }
      }
    });
    newRow.appendChild(inp);
    newRow.appendChild(addBtn);
    body.appendChild(newRow);

    var activePlaylists = playlists.filter(function (pl) { return !pl.deleted; });
    if (!activePlaylists.length) { body.appendChild(h('div', { class: 'panel-empty', text: 'No playlists yet. Create one to organize your study.' })); return; }

    activePlaylists.forEach(function (pl, plIdx) {
      var plDiv = h('div', { class: 'playlist-section' });
      var plHeader = h('div', { class: 'playlist-header' });
      plHeader.appendChild(h('strong', { text: pl.name + ' (' + pl.items.length + ')' }));
      var delBtn = h('button', {
        class: 'playlist-del', text: '\u00D7', title: 'Delete playlist', on: {
          click: function (e) {
            e.stopPropagation();
            pl.deleted = true;
            pl.t = Date.now();
            Store.savePlaylists(playlists);
            renderPlaylistsPanel();
          }
        }
      });
      plHeader.appendChild(delBtn);
      plDiv.appendChild(plHeader);

      pl.items.forEach(function (it, itIdx) {
        var row = h('div', {
          class: 'panel-item', on: {
            click: function () {
              loadChapter(it.s, it.c);
              closePanel();
            }
          }
        });
        row.appendChild(h('span', { class: 'playlist-idx', text: (itIdx + 1) + '.' }));
        row.appendChild(h('span', { class: 'panel-item-title', text: it.title }));
        var removeBtn = h('button', {
          class: 'playlist-remove', text: '\u00D7', on: {
            click: function (e) {
              e.stopPropagation();
              pl.items.splice(itIdx, 1);
              pl.t = Date.now();
              Store.savePlaylists(playlists);
              renderPlaylistsPanel();
            }
          }
        });
        row.appendChild(removeBtn);
        plDiv.appendChild(row);
      });
      body.appendChild(plDiv);
    });
  }

  // ===================== LOAD CHAPTER =====================
  function loadChapter(sectionId, chapterId, opts) {
    opts = opts || {};
    var domain = getDomain(sectionId);

    // Automatically update the domain filter if we're loading a chapter from a different domain.
    // This ensures the sidebar displays only chapters relevant to the current domain,
    // especially when jumping from bookmarks or study playlists.
    var targetFilter = domain ? domain.prefix : null;
    if (state.activeDomainFilter !== targetFilter) {
      state.activeDomainFilter = targetFilter;
      updateSearchPlaceholder();
      if (typeof buildNavigation === 'function') buildNavigation();
    }

    if (domain && !state.loadedDomains[domain.prefix]) {
      loadDomainContent(domain.prefix, function () { doLoadChapter(sectionId, chapterId, opts); });
      return;
    }
    doLoadChapter(sectionId, chapterId, opts);
  }

  function resolveChapterContent(chapter) {
    if (!chapter || chapter.content) return chapter && chapter.content;

    if (chapter.contentVar) {
      var bag = (typeof window !== 'undefined') ? window[chapter.contentVar] : null;
      if (bag && typeof bag === 'object') {
        var key = chapter.contentSection;
        var text = key ? bag[key] : null;
        if (typeof text !== 'string' && !key) {
          var parts = [];
          Object.keys(bag).forEach(function (k) {
            var v = bag[k];
            if (typeof v === 'string') parts.push(v);
          });
          text = parts.join('\n\n---\n\n');
        }
        if (typeof text === 'string' && text.length) {
          chapter.content = text;
          return chapter.content;
        }
      }
    }

    return null;
  }

  function prefetchExternalChapters(cb) {
    var pending = [];
    CONTENT.forEach(function (section) {
      (section.chapters || []).forEach(function (ch) {
        if (ch.content) return;
        if (ch.contentVar) {
          resolveChapterContent(ch);
          if (!ch.content) pending.push(ch);
          return;
        }
        if (ch.contentFile) pending.push(ch);
      });
    });
    if (!pending.length) { if (cb) cb(); return; }
    var done = 0;
    pending.forEach(function (ch) {
      fetchChapterMarkdown(ch, function () { done++; if (done === pending.length && cb) cb(); });
    });
  }

  var markdownFileCache = {};

  function isFileProtocol() {
    try { return window.location.protocol === 'file:'; } catch (e) { return false; }
  }

  function describeFetchError(err, url) {
    var msg = (err && (err.message || err.toString())) || 'Unknown error';
    if (err && err.code === 'MISSING_VAR') {
      return {
        title: 'Chapter content not loaded',
        detail: msg,
        hint: 'Make sure the corresponding .js file is included in index.html before content.js.',
        raw: msg
      };
    }
    if (isFileProtocol()) {
      return {
        title: 'This page is opened from the file system',
        detail:
          'Browsers block fetch() on file:// URLs for security, so the external markdown ' +
          'files can\'t be loaded.',
        hint:
          'Run a tiny local server from the AllWeb folder, then open http://localhost:8000/ :\n' +
          '  \u2022  python3 -m http.server 8000\n' +
          '  \u2022  npx serve .\n' +
          '  \u2022  Or use VS Code\'s "Live Server" extension.',
        raw: msg
      };
    }
    if (/HTTP 404/i.test(msg)) {
      return {
        title: 'Markdown file not found (404)',
        detail: 'The server responded 404 for ' + url + '.',
        hint: 'Make sure the .md files sit next to index.html in the same folder the server is serving.',
        raw: msg
      };
    }
    if (/Failed to fetch|NetworkError|TypeError/i.test(msg)) {
      return {
        title: 'Network error while loading chapter',
        detail: 'The browser could not reach ' + url + '.',
        hint: 'Check that the local server is still running, then retry.',
        raw: msg
      };
    }
    return {
      title: 'Could not load chapter',
      detail: msg,
      hint: 'Try again in a moment.',
      raw: msg
    };
  }

  function fetchMarkdownFile(url, cb) {
    var entry = markdownFileCache[url];
    if (entry && entry.text) { cb(null, entry.text); return; }
    if (entry && entry.pending) { entry.callbacks.push(cb); return; }

    if (isFileProtocol()) {
      var fileErr = new Error('Fetch blocked on file:// protocol');
      fileErr.code = 'FILE_PROTOCOL';
      try { console.warn('[Tech Primer] ' + fileErr.message + ' (open via a local HTTP server to load ' + url + ')'); } catch (e) { }
      cb(fileErr);
      return;
    }

    markdownFileCache[url] = { pending: true, callbacks: [cb] };
    fetch(url, { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status + ' for ' + url)); })
      .then(function (text) {
        var e = markdownFileCache[url];
        e.text = text; e.pending = false;
        var cbs = e.callbacks; e.callbacks = [];
        cbs.forEach(function (fn) { try { fn(null, text); } catch (err) { } });
      })
      .catch(function (err) {
        var e = markdownFileCache[url];
        delete markdownFileCache[url];
        var cbs = (e && e.callbacks) || [];
        cbs.forEach(function (fn) { try { fn(err); } catch (e2) { } });
      });
  }

  function extractMarkdownSection(fullText, sectionHeading) {
    if (!sectionHeading) return fullText;
    var needle = String(sectionHeading).trim().toLowerCase();
    var lines = fullText.split(/\r?\n/);
    var start = -1, end = lines.length, startLevel = 0;
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
      if (!m) continue;
      var level = m[1].length;
      var title = m[2].trim().toLowerCase();
      if (start === -1) {
        if (title === needle) { start = i; startLevel = level; }
      } else if (level <= startLevel) {
        end = i;
        break;
      }
    }
    if (start === -1) return fullText;
    return lines.slice(start, end).join('\n');
  }

  function fetchChapterMarkdown(chapter, cb) {
    if (chapter.contentVar) {
      var resolved = resolveChapterContent(chapter);
      if (resolved) { cb(null, resolved); return; }
      var missingErr = new Error(
        'Global "' + chapter.contentVar + '"' +
        (chapter.contentSection ? ' (section "' + chapter.contentSection + '")' : '') +
        ' is not available.'
      );
      missingErr.code = 'MISSING_VAR';
      cb(missingErr);
      return;
    }
    if (!chapter.contentFile) {
      cb(new Error('Chapter has no contentVar or contentFile.'));
      return;
    }
    fetchMarkdownFile(chapter.contentFile, function (err, text) {
      if (err) { cb(err); return; }
      chapter.content = extractMarkdownSection(text, chapter.contentSection);
      cb(null, chapter.content);
    });
  }

  function renderChapterLoading() {
    dom.contentArea.innerHTML = '';
    dom.contentArea.appendChild(h('div', {
      class: 'chapter-loading',
      style: { padding: '48px 12px', textAlign: 'center', opacity: '0.75', fontSize: '14px' },
      html: '<div style="display:inline-flex;align-items:center;gap:10px;"><div class="spinner" style="width:18px;height:18px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite"></div><span>Loading chapter&hellip;</span></div>'
    }));
  }

  function renderChapterError(errOrMessage, onRetry) {
    var err = (errOrMessage && typeof errOrMessage === 'object') ? errOrMessage : new Error(String(errOrMessage || ''));
    var info = describeFetchError(err, (err && err.url) || '');
    var isFile = (err && err.code === 'FILE_PROTOCOL') || isFileProtocol();

    var serverCmd = 'python3 -m http.server 8000';
    var hintHtml = escapeHtml(info.hint || '').replace(/\n/g, '<br>');

    var html =
      '<div class="chapter-error-card">' +
      '<div class="chapter-error-icon">\u26A0\uFE0F</div>' +
      '<div class="chapter-error-title">' + escapeHtml(info.title) + '</div>' +
      '<div class="chapter-error-detail">' + escapeHtml(info.detail) + '</div>' +
      (isFile
        ? ('<div class="chapter-error-cmdline">' +
          '<code id="chapter-error-cmd">' + escapeHtml(serverCmd) + '</code>' +
          '<button type="button" class="chapter-error-copy" data-copy="' + escapeHtml(serverCmd) + '">Copy</button>' +
          '</div>')
        : '') +
      (info.hint ? '<div class="chapter-error-hint">' + hintHtml + '</div>' : '') +
      '<div class="chapter-error-actions">' +
      '<button type="button" class="chapter-error-retry">Retry</button>' +
      '</div>' +
      '<details class="chapter-error-raw"><summary>Technical details</summary>' +
      '<pre>' + escapeHtml(info.raw || '') + '</pre>' +
      '</details>' +
      '</div>';

    dom.contentArea.innerHTML = '';
    var wrap = h('div', {
      class: 'chapter-error',
      style: { padding: '48px 20px', maxWidth: '620px', margin: '0 auto' },
      html: html
    });
    dom.contentArea.appendChild(wrap);

    var retry = wrap.querySelector('.chapter-error-retry');
    if (retry) retry.addEventListener('click', function () {
      if (typeof onRetry === 'function') onRetry();
    });
    var copy = wrap.querySelector('.chapter-error-copy');
    if (copy) copy.addEventListener('click', function () {
      var txt = copy.getAttribute('data-copy') || '';
      try {
        navigator.clipboard.writeText(txt).then(function () {
          copy.textContent = 'Copied';
          setTimeout(function () { copy.textContent = 'Copy'; }, 1200);
        }).catch(function () { copy.textContent = 'Copy failed'; });
      } catch (e) { copy.textContent = 'Copy failed'; }
    });
  }

  function normalizeChapterHeading(text) {
    return String(text == null ? '' : text)
      .replace(/[`*_~]/g, '')
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/[?!.,:;]+$/g, '')
      .trim()
      .toLowerCase();
  }

  function stripMatchingLeadingHeading(markdown, title) {
    if (!markdown || !title) return markdown;
    var lines = String(markdown).split(/\r?\n/);
    var first = 0;
    while (first < lines.length && !lines[first].trim()) first++;
    if (first >= lines.length) return markdown;

    var match = lines[first].match(/^#{1,6}\s+(.*)$/);
    if (!match) return markdown;
    if (normalizeChapterHeading(match[1]) !== normalizeChapterHeading(title)) return markdown;

    var next = first + 1;
    while (next < lines.length && !lines[next].trim()) next++;
    return lines.slice(next).join('\n');
  }

  function doLoadChapter(sectionId, chapterId, opts) {
    opts = opts || {};
    var section = CONTENT.find(function (s) { return s.id === sectionId; });
    if (!section) return;
    var chapter = section.chapters.find(function (c) { return c.id === chapterId; });
    if (!chapter) return;
    if (!chapter.content && (chapter.contentVar || chapter.contentFile)) {
      if (chapter.contentVar) {
        resolveChapterContent(chapter);
      }
      if (!chapter.content) {
        state.activeSection = sectionId;
        state.activeChapter = chapterId;
        renderChapterLoading();
        fetchChapterMarkdown(chapter, function (err) {
          if (err) {
            try { err.url = chapter.contentFile || chapter.contentVar; } catch (e) { }
            if (state.activeSection === sectionId && state.activeChapter === chapterId) {
              renderChapterError(err, function () {
                if (chapter.contentFile) delete markdownFileCache[chapter.contentFile];
                doLoadChapter(sectionId, chapterId, opts);
              });
            }
            return;
          }
          if (state.activeSection === sectionId && state.activeChapter === chapterId) {
            doLoadChapter(sectionId, chapterId, opts);
          }
        });
        return;
      }
    }
    if (!chapter.content) return;

    document.body.classList.remove('home-page');
    state.activeSection = sectionId;
    state.activeChapter = chapterId;
    removeParallaxShapes();

    dom.sidebar.classList.remove('hidden');
    dom.guideMain.classList.remove('full-width');
    updateSidebarToggleVisibility();

    Store.setLastRead(sectionId, chapterId);

    var domainObj = getDomain(sectionId);
    var domainBadge = domainObj
      ? '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;background:var(--accent-light);color:var(--accent);margin-right:8px;">' + domainObj.icon + ' ' + domainObj.label + '</span>'
      : '';
    var time = readingTime(chapter.content, chapter);
    var displayContent = stripMatchingLeadingHeading(chapter.content, chapter.title);
    var MARKDOWN_POLICY = {
      ALLOWED_TAGS: [
        "a", "blockquote", "br", "code", "del", "div", "em", "h1", "h2",
        "h3", "h4", "h5", "h6", "hr", "img", "li", "ol", "p", "pre",
        "span", "strong", "table", "tbody", "td", "th", "thead", "tr", "ul"
      ],
      ALLOWED_ATTR: [
        "alt", "aria-label", "class", "data-mermaid-url", "href", "id",
        "rel", "role", "src", "target", "title"
      ],
      ALLOW_DATA_ATTR: true
    };

    function escapeHtmlAttribute(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function replaceMermaidInkImages(markdown) {
      var pattern = /!\[([^\]]*)\]\((https:\/\/mermaid\.ink\/img\/pako:[^)\s]+)\)/g;
      return markdown.replace(pattern, function (_match, alt, sourceUrl) {
        return [
          '<div class="mermaid-local"',
          ' data-mermaid-url="' + escapeHtmlAttribute(sourceUrl) + '"',
          ' role="img"',
          ' aria-label="' + escapeHtmlAttribute(alt || "Diagram") + '">',
          "</div>"
        ].join("");
      });
    }

    function renderMarkdown(markdown) {
      if (!window.marked || !window.DOMPurify) {
        throw new Error("Markdown libraries are unavailable");
      }

      var localMarkdown = replaceMermaidInkImages(markdown);
      var rawHtml = window.marked.parse(localMarkdown);
      return window.DOMPurify.sanitize(rawHtml, MARKDOWN_POLICY);
    }

    var chapterHeader = h('div', { class: 'chapter-header' }, [
      h('div', { class: 'chapter-section-label', text: section.title }),
      h('h1', { class: 'chapter-title', text: chapter.title })
    ]);
    var mdDiv = h('div', { class: 'md-content', html: renderMarkdown(displayContent) });
    /* Wrap chapter content in the same liquid-glass material family as the shell. */
    var glassWrap = h('div', { class: 'chapter-glass-wrap' });
    glassWrap.appendChild(badge);
    glassWrap.appendChild(chapterHeader);
    glassWrap.appendChild(renderChapterActions(sectionId, chapterId));
    glassWrap.appendChild(mdDiv);

    dom.contentArea.innerHTML = '';
    dom.contentArea.appendChild(glassWrap);

    highlightCode();
    wrapSubSections();
    enhanceContent();
    parseCallouts();
    addCodeHeaders();
    wrapTables();
    renderMermaidDiagrams();
    wrapImageSkeletons();
    renderChapterMindMap(sectionId, chapter);
    addChapterNav(sectionId, chapterId);
    buildChapterToc();
    observeContent();
    setActiveNav(sectionId, chapterId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateDocumentMeta(section, chapter);

    if (!opts.noHistory) {
      var url = getChapterUrl(sectionId, chapterId);
      if (opts.replaceHistory) history.replaceState(null, '', url);
      else history.pushState(null, '', url);
    }
  }

  // ===================== CHAPTER TOC =====================
  function buildChapterToc() {
    var md = dom.contentArea.querySelector('.md-content');
    dom.chapterTocNav.innerHTML = '';
    if (!md) { dom.chapterToc.classList.remove('visible'); return; }
    var headings = md.querySelectorAll('h2, h3, h4, h5');
    if (headings.length < 3) { dom.chapterToc.classList.remove('visible'); removeTocScroll(); return; }
    headings.forEach(function (heading, i) {
      var id = 'toc-' + i;
      heading.id = id;
      dom.chapterTocNav.appendChild(h('a', {
        class: 'toc-link', text: heading.textContent,
        data: { target: id, level: heading.tagName[1] },
        on: {
          click: function () {
            var t = document.getElementById(id);
            if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - getHeaderClearance(), behavior: 'smooth' });
          }
        }
      }));
    });
    dom.chapterToc.classList.add('visible');
    removeTocScroll();
    tocScrollHandler = function () { updateTocActive(headings); };
    window.addEventListener('scroll', tocScrollHandler, { passive: true });
    updateTocActive(headings);
  }

  function updateTocActive(headings) {
    var activeId = null;
    var threshold = getHeaderClearance() + 8;
    headings.forEach(function (el) { if (el.getBoundingClientRect().top <= threshold) activeId = el.id; });
    dom.chapterTocNav.querySelectorAll('.toc-link').forEach(function (l) {
      l.classList.toggle('active', l.dataset.target === activeId);
    });
  }

  function getHeaderClearance() {
    var fallback = 112;
    try {
      var computed = getComputedStyle(document.documentElement);
      var parsed = parseFloat(computed.scrollPaddingTop);
      if (Number.isFinite(parsed)) return parsed;
      var header = dom.header || document.querySelector('.header');
      return header ? header.getBoundingClientRect().bottom + 24 : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function removeTocScroll() {
    if (tocScrollHandler) { window.removeEventListener('scroll', tocScrollHandler); tocScrollHandler = null; }
  }

  // ===================== CHAPTER NAV =====================
  function chapterNavBtn(dir, entry) {
    var label = h('span', { class: 'chapter-nav-label', text: dir === 'prev' ? 'Previous' : 'Next' });
    var title = h('span', { class: 'chapter-nav-title', text: entry.chapter.title });
    var info = h('div', null, [label, title]);
    var icon = dir === 'prev' ? svg('prevArr', 16) : svg('nextArr', 16);
    return h('button', {
      class: 'chapter-nav-btn ' + dir,
      html: dir === 'prev' ? icon + info.outerHTML : info.outerHTML + icon,
      on: { click: function () { loadChapter(entry.sectionId, entry.chapter.id); } }
    });
  }

  function addChapterNav(sectionId, chapterId) {
    var idx = state.flatChapters.findIndex(function (fc) { return fc.sectionId === sectionId && fc.chapter.id === chapterId; });
    if (idx === -1) return;
    var prev = idx > 0 ? state.flatChapters[idx - 1] : null;
    var next = idx < state.flatChapters.length - 1 ? state.flatChapters[idx + 1] : null;
    if (!prev && !next) return;
    var nav = h('div', { class: 'chapter-nav' });
    nav.appendChild(prev ? chapterNavBtn('prev', prev) : h('div', { style: { flex: '1 1 0' } }));
    if (next) nav.appendChild(chapterNavBtn('next', next));
    dom.contentArea.appendChild(nav);
  }

  // ===================== SEARCH =====================
  function highlightTerms(text, terms) {
    if (!terms.length) return text;
    var escaped = terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    var re = new RegExp('(' + escaped.join('|') + ')', 'gi');
    return text.replace(re, '<span class="search-highlight">$1</span>');
  }

  function findMatchContext(content, terms, contextLen) {
    var strip = content.replace(/[#*`\[\]()|\->\~\_\!\^]/g, ' ').replace(/\s+/g, ' ').trim();
    var lower = strip.toLowerCase();
    var bestIdx = -1;
    for (var i = 0; i < terms.length; i++) {
      var idx = lower.indexOf(terms[i]);
      if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx;
    }
    if (bestIdx === -1) return strip.substring(0, contextLen);
    var start = Math.max(0, bestIdx - 30);
    var end = Math.min(strip.length, start + contextLen);
    var snippet = strip.substring(start, end);
    return (start > 0 ? '\u2026' : '') + snippet + (end < strip.length ? '\u2026' : '');
  }

  function syncSearchBlur(show) { dom.guideMain.classList.toggle('search-blur', show); }

  function handleSearch(query) {
    query = (query || '').trim();
    if (query.length < 2) { dom.searchResults.classList.remove('active'); dom.searchResults.innerHTML = ''; syncSearchBlur(false); return; }

    var matches = [];
    if (state.fuseInstance) {
      var results = state.fuseInstance.search(query, { limit: 20 });
      results.forEach(function (r) {
        matches.push({
          sectionId: r.item.sectionId,
          sectionTitle: r.item.sectionTitle,
          chapter: { id: r.item.chapterId, title: r.item.chapterTitle, content: r.item.contentSnippet },
          score: r.score
        });
      });
    } else {
      var terms = query.toLowerCase().split(/\s+/).filter(function (t) { return t.length > 0; });
      var searchScope = state.activeDomainFilter
        ? CONTENT.filter(function (s) { return s.id.indexOf(state.activeDomainFilter) === 0; })
        : CONTENT;
      searchScope.forEach(function (section) {
        section.chapters.forEach(function (ch) {
          var titleLower = ch.title.toLowerCase();
          var contentLower = (ch.content || '').toLowerCase();
          var titleHits = 0, contentHits = 0;
          terms.forEach(function (t) { if (titleLower.indexOf(t) !== -1) titleHits++; if (contentLower.indexOf(t) !== -1) contentHits++; });
          if (titleHits + contentHits < terms.length) return;
          if (!terms.every(function (t) { return titleLower.indexOf(t) !== -1 || contentLower.indexOf(t) !== -1; })) return;
          matches.push({ sectionId: section.id, sectionTitle: section.title, chapter: ch, score: titleHits * 10 + contentHits });
        });
      });
      matches.sort(function (a, b) { return b.score - a.score; });
      matches = matches.slice(0, 20);
    }

    var terms = query.toLowerCase().split(/\s+/).filter(function (t) { return t.length > 0; });

    if (!matches.length) {
      var scopeLabel = '';
      if (state.activeDomainFilter) {
        for (var i = 0; i < DOMAINS.length; i++) {
          if (DOMAINS[i].prefix === state.activeDomainFilter) { scopeLabel = ' in ' + DOMAINS[i].label; break; }
        }
      }
      dom.searchResults.innerHTML = '<div class="search-no-results">No results found' + scopeLabel + '</div>';
      dom.searchResults.classList.add('active');
      syncSearchBlur(true);
      return;
    }

    dom.searchResults.innerHTML = '';
    matches.forEach(function (m) {
      var domain = getDomain(m.sectionId);
      var domainTag = domain ? '<span style="font-size:11px;opacity:0.7;margin-left:4px;">' + domain.icon + ' ' + domain.label + '</span>' : '';
      var preview = findMatchContext(m.chapter.content || '', terms, 140);
      var item = h('div', {
        class: 'search-result-item',
        data: { testid: 'search-result' },
        on: {
          click: function () {
            loadChapter(m.sectionId, m.chapter.id);
            dom.searchResults.classList.remove('active');
            syncSearchBlur(false);
            dom.searchInput.value = '';
            if (dom.searchInputMobile) dom.searchInputMobile.value = '';
            closeSidebar();
            closePanel();
          }
        }
      }, [
        h('div', { class: 'search-result-title', html: highlightTerms(m.chapter.title, terms) }),
        h('div', { class: 'search-result-section', html: m.sectionTitle + domainTag }),
        h('div', { class: 'search-result-preview', html: highlightTerms(preview, terms) })
      ]);
      dom.searchResults.appendChild(item);
    });
    dom.searchResults.classList.add('active');
    syncSearchBlur(true);
  }

  // ===================== 3D CARD TILT =====================
  function initCardTilt() {
    document.querySelectorAll('.welcome-domain').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        card.classList.remove('tilt-reset');
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var cx = rect.width / 2;
        var cy = rect.height / 2;
        var rotX = ((cy - y) / cy) * 12;
        var rotY = ((x - cx) / cx) * 12;
        card.style.transform = 'perspective(800px) rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg) translateZ(8px) scale(1.03)';
        card.style.boxShadow = '0 ' + Math.round(20 + Math.abs(rotX)) + 'px ' + Math.round(40 + Math.abs(rotY)) + 'px rgba(0,0,0,0.18)';
      });
      card.addEventListener('mouseleave', function () {
        card.classList.add('tilt-reset');
        card.style.transform = '';
        card.style.boxShadow = '';
        setTimeout(function () { card.classList.remove('tilt-reset'); }, 700);
      });
    });
  }

  // ===================== ANIMATION EFFECTS =====================
  var parallaxState = null;

  function initParallaxShapes() {
    removeParallaxShapes();

    /* Prefer the WebGL backdrop when available — it carries the same
     * domain-tinted blob aesthetic but with depth, parallax, and theme
     * syncing. We mark the state with a sentinel so removeParallaxShapes
     * knows whether there's any DOM to clean up. */
    if (window.AetherBg && window.AetherBg.isActive && window.AetherBg.isActive()) {
      var theme = document.documentElement.getAttribute('data-theme') || 'light';
      try { window.AetherBg.setTheme(theme); } catch (e) { }
      parallaxState = { aether: true };
      return;
    }
    if (window.AetherBg && window.AetherBg.init && window.AetherBg.init()) {
      var theme2 = document.documentElement.getAttribute('data-theme') || 'light';
      try { window.AetherBg.setTheme(theme2); } catch (e) { }
      parallaxState = { aether: true };
      return;
    }

    /* Graceful fallback: the original CSS parallax blobs. Used when WebGL is
     * blocked or the import fails. Identical behaviour to the pre-3D site. */
    var shapes = [
      { size: 300, x: '8%', y: 80, speed: 0.3, color: 'var(--accent)' },
      { size: 180, x: '78%', y: 180, speed: 0.5, color: 'var(--domain-ms)' },
      { size: 220, x: '55%', y: 420, speed: 0.2, color: 'var(--domain-mq)' },
      { size: 140, x: '18%', y: 520, speed: 0.4, color: 'var(--domain-sd)' },
      { size: 260, x: '88%', y: 60, speed: 0.15, color: 'var(--accent)' },
      { size: 160, x: '34%', y: 260, speed: 0.25, color: 'var(--domain-dp)' }
    ];
    var container = document.createElement('div');
    container.className = 'parallax-shapes';
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:-1;overflow:hidden;opacity:0;transition:opacity 0.6s ease;';
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var shapeOpacity = isDark ? 0.06 : 0.14;
    var els = [];
    shapes.forEach(function (s) {
      var el = document.createElement('div');
      el.style.cssText = 'position:absolute;border-radius:50%;width:' + s.size + 'px;height:' + s.size + 'px;left:' + s.x + ';top:' + s.y + 'px;background:' + s.color + ';opacity:' + shapeOpacity + ';will-change:transform;filter:blur(60px);';
      container.appendChild(el);
      els.push({ el: el, speed: s.speed });
    });
    document.body.appendChild(container);
    requestAnimationFrame(function () { container.style.opacity = '1'; });
    var handler = function () {
      var scrollY = window.scrollY;
      els.forEach(function (item) { item.el.style.transform = 'translateY(' + (-scrollY * item.speed) + 'px)'; });
    };
    window.addEventListener('scroll', handler, { passive: true });
    parallaxState = { container: container, handler: handler };
  }

  function removeParallaxShapes() {
    /* Always tear down the welcome 3D scene when leaving the welcome page —
     * keeps the GPU idle while the user reads chapters. */
    if (window.AetherWelcome && window.AetherWelcome.isActive && window.AetherWelcome.isActive()) {
      try { window.AetherWelcome.dispose(); } catch (e) { }
    }

    if (!parallaxState) return;

    /* WebGL bg keeps running site-wide — only CSS-fallback containers need
     * removing here. */
    if (parallaxState.container) parallaxState.container.remove();
    if (parallaxState.handler) window.removeEventListener('scroll', parallaxState.handler);
    parallaxState = null;
  }

  function initRippleEffect() {
    document.querySelectorAll('.welcome-domain').forEach(function (card) {
      card.addEventListener('mousedown', function (e) {
        var rect = card.getBoundingClientRect();
        var ripple = document.createElement('div');
        ripple.className = 'ripple-effect';
        var size = Math.max(rect.width, rect.height) * 2;
        ripple.style.width = size + 'px';
        ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
        card.appendChild(ripple);
        ripple.addEventListener('animationend', function () { ripple.remove(); });
      });
    });
  }

  function initMagneticNav() {
    var sidebar = dom.sidebar;
    if (!sidebar) return;
    sidebar.addEventListener('mousemove', function (e) {
      var items = sidebar.querySelectorAll('.nav-item:not(.active)');
      items.forEach(function (item) {
        var rect = item.getBoundingClientRect();
        var cy = rect.top + rect.height / 2;
        var dist = Math.abs(e.clientY - cy);
        var maxDist = 80;
        if (dist < maxDist) {
          var strength = 1 - (dist / maxDist);
          item.style.setProperty('--mag-x', (strength * 4).toFixed(1) + 'px');
        } else {
          item.style.removeProperty('--mag-x');
        }
      });
    });
    sidebar.addEventListener('mouseleave', function () {
      sidebar.querySelectorAll('.nav-item').forEach(function (item) { item.style.removeProperty('--mag-x'); });
    });
  }

  // ===================== WELCOME PAGE =====================
  function showWelcome() {
    document.body.classList.add('home-page');
    state.activeSection = null;
    state.activeChapter = null;
    state.activeDomainFilter = null;
    updateDocumentMeta();
    updateSearchPlaceholder();
    dom.sidebarNav.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
    dom.chapterToc.classList.remove('visible');
    dom.sidebar.classList.add('hidden');
    dom.guideMain.classList.add('full-width');
    updateSidebarToggleVisibility();
    removeTocScroll();
    buildNavigation();

    function onDomainClick(prefix) {
      state.activeDomainFilter = prefix;
      updateSearchPlaceholder();
      loadDomainContent(prefix, function () {
        buildNavigation();
        var firstSec = CONTENT.find(function (s) { return s.id.indexOf(prefix) === 0; });
        if (firstSec && firstSec.chapters.length && firstSec.chapters[0].content) {
          dom.sidebar.classList.remove('hidden');
          dom.guideMain.classList.remove('full-width');
          dom.sidebarToggle.classList.add('visible');
          var hdr = dom.sidebarNav.querySelector('.sidebar-section-header');
          if (hdr) { hdr.classList.add('expanded'); hdr.nextElementSibling.classList.add('expanded'); }
          loadChapter(firstSec.id, firstSec.chapters[0].id);
        }
      });
    }

    function makeDomainCard(d) {
      var secs = CONTENT.filter(function (s) { return s.id.indexOf(d.prefix) === 0; });
      var chCount = secs.reduce(function (a, s) { return a + s.chapters.length; }, 0);
      return h('div', { class: 'welcome-domain', data: { domain: d.prefix }, on: { click: function () { onDomainClick(d.prefix); } } }, [
        h('div', { class: 'welcome-domain-icon', text: d.icon }),
        h('h3', { text: d.label }),
        h('p', { text: d.desc }),
        h('div', { class: 'welcome-domain-meta' }, [
          h('span', { class: 'welcome-domain-count', text: chCount + ' chapter' + (chCount !== 1 ? 's' : '') })
        ])
      ]);
    }

    var domainsContainer = h('div', { class: 'welcome-domains-container' });
    DOMAIN_CATEGORIES.forEach(function (cat) {
      var catDomains = DOMAINS.filter(function (d) { return d.category === cat.key; });
      if (!catDomains.length) return;
      var grid = h('div', { class: 'welcome-domains welcome-domains-' + catDomains.length });
      catDomains.forEach(function (d) { grid.appendChild(makeDomainCard(d)); });
      var group = h('div', { class: 'welcome-category' }, [
        h('div', { class: 'welcome-category-header' }, [
          h('span', { class: 'welcome-category-label', text: cat.label }),
          h('span', { class: 'welcome-category-count', text: catDomains.length + (catDomains.length === 1 ? ' domain' : ' domains') })
        ]),
        cat.desc ? h('div', { class: 'welcome-category-desc', text: cat.desc }) : null,
        grid
      ].filter(Boolean));
      domainsContainer.appendChild(group);
    });

    // Any domain not assigned to a known category falls back to its own group
    // so no chapter goes missing if categorization drifts later.
    var uncategorized = DOMAINS.filter(function (d) {
      return !DOMAIN_CATEGORIES.some(function (c) { return c.key === d.category; });
    });
    if (uncategorized.length) {
      var grid = h('div', { class: 'welcome-domains welcome-domains-' + uncategorized.length });
      uncategorized.forEach(function (d) { grid.appendChild(makeDomainCard(d)); });
      domainsContainer.appendChild(h('div', { class: 'welcome-category' }, [
        h('div', { class: 'welcome-category-header' }, [
          h('span', { class: 'welcome-category-label', text: 'Other' })
        ]),
        grid
      ]));
    }

    function stat(val, label) {
      return h('div', { class: 'welcome-stat' }, [
        h('div', { class: 'welcome-stat-value', text: String(val) }),
        h('div', { class: 'welcome-stat-label', text: label })
      ]);
    }

    var totalChapters = CONTENT.reduce(function (a, s) { return a + s.chapters.length; }, 0);

    /* Stage element for the 3D welcome scene — mounted into below. The class
     * `welcome-3d-active` is added by AetherWelcome.mount() on success, which
     * hides the legacy emoji icon via CSS. */
    var welcome3dStage = h('div', { class: 'welcome-3d-stage' });

    var welcome = h('div', { class: 'welcome' }, [
      welcome3dStage,
      h('div', { class: 'welcome-icon', text: GUIDE_ICON }),
      h('h1', { text: GUIDE_TITLE }),
      h('p', { html: 'Your complete reference across <strong>' + DOMAINS.length + ' domains</strong> and <strong>' + totalChapters + ' chapters</strong> of software engineering knowledge.' }),
      h('div', { class: 'welcome-stats' }, [
        stat(DOMAINS.length, 'Domains'),
        stat(CONTENT.length, 'Sections'),
        stat(totalChapters, 'Chapters')
      ]),
    ]);

    dom.contentArea.innerHTML = '';
    dom.contentArea.appendChild(welcome);

    /* Mount the 3D welcome scene if WebGL is available. The orbiters are
     * coloured per-domain and clicking one fires the same onDomainClick
     * handler the cards below already use. */
    if (window.AetherWelcome && window.AetherWelcome.mount) {
      try {
        var domainSeeds = DOMAINS.map(function (d) {
          var cssVar = '--domain-' + d.file;
          var col = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || '#b09828';
          return { prefix: d.prefix, label: d.label, color: col };
        });
        window.AetherWelcome.mount(welcome3dStage, {
          domains: domainSeeds,
          size: 320,
          onDomainClick: onDomainClick,
        });
      } catch (e) { /* fall through — emoji icon stays visible */ }
    }

    var lastRead = Store.getLastRead();
    if (lastRead) {
      var lrSection = CONTENT.find(function (s) { return s.id === lastRead.s; });
      var lrChapter = lrSection && lrSection.chapters.find(function (c) { return c.id === lastRead.c; });
      if (lrChapter) {
        var resumeBanner = h('div', {
          class: 'resume-banner', on: {
            click: function () {
              var d = getDomain(lastRead.s);
              if (d) { state.activeDomainFilter = d.prefix; updateSearchPlaceholder(); buildNavigation(); }
              loadChapter(lastRead.s, lastRead.c);
            }
          }
        });
        resumeBanner.appendChild(h('div', { class: 'resume-text', html: '<strong>Continue reading:</strong> ' + lrChapter.title }));
        resumeBanner.appendChild(h('div', { class: 'resume-arrow', html: '\u2192' }));
        dom.contentArea.appendChild(resumeBanner);
      }
    }

    dom.contentArea.appendChild(h('div', { class: 'welcome-domain-label', text: 'Choose a Domain', style: { marginTop: '16px' } }));
    dom.contentArea.appendChild(domainsContainer);
    initCardTilt();
    initRippleEffect();
    initParallaxShapes();

    history.pushState(null, '', window.location.pathname);
  }

  // ===================== OBSERVE & PROGRESS =====================
  function observeContent() {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('revealed'); observer.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    dom.contentArea.querySelectorAll('.md-content h2, .md-content h3, .md-content h4, .md-content pre, .md-content blockquote, .table-wrapper, .sub-section, .mermaid-wrapper')
      .forEach(function (el) { el.classList.add('reveal-on-scroll'); observer.observe(el); });
  }

  function updateProgress() {
    var top = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    dom.progressBar.style.width = (max > 0 ? (top / max) * 100 : 0) + '%';
    dom.backToTop.classList.toggle('visible', top > 300);
    document.querySelector('.header').classList.toggle('scrolled', top > 10);
  }

  // ===================== URL ROUTING =====================
  // Query routes are crawlable as distinct URLs on static hosts:
  // `?section=ms-learning&chapter=quick-reference...`.
  // Legacy `#section/chapter` URLs still load and are replaced with query URLs.
  function handleRoute() {
    var url = new URL(window.location);
    var sid = url.searchParams.get('section');
    var cid = url.searchParams.get('chapter');
    var replaceHistory = false;

    if (!sid || !cid) {
      var hash = window.location.hash.slice(1);
      if (!hash) return false;
      var parts = hash.split('/');
      if (parts.length < 2) return false;
      sid = parts[0];
      cid = parts.slice(1).join('/');
      replaceHistory = true;
    }

    var sec = CONTENT.find(function (s) { return s.id === sid; });
    if (sec) {
      var domain = getDomain(sid);
      if (domain) { state.activeDomainFilter = domain.prefix; updateSearchPlaceholder(); buildNavigation(); }
      loadChapter(sid, cid, { noHistory: !replaceHistory, replaceHistory: replaceHistory });
      return true;
    }
    return false;
  }

  // ===================== INIT =====================
  function init() {
    dom.contentArea = document.getElementById('content-area');
    dom.sidebarNav = document.getElementById('sidebar-nav');
    dom.searchInput = document.getElementById('search-input');
    dom.searchInputMobile = document.getElementById('search-input-mobile');
    dom.searchResults = document.getElementById('search-results');
    dom.progressBar = document.getElementById('progress-bar');
    dom.backToTop = document.getElementById('back-to-top');
    dom.sidebar = document.getElementById('sidebar');
    dom.overlay = document.getElementById('sidebar-overlay');
    dom.menuToggle = document.getElementById('menu-toggle');
    dom.themeToggle = document.getElementById('theme-toggle');
    dom.chapterToc = document.getElementById('chapter-toc');
    dom.chapterTocNav = document.getElementById('chapter-toc-nav');
    dom.sidebarToggle = document.getElementById('sidebar-toggle');
    dom.guideMain = document.querySelector('.guide-main');

    configureMarked();
    initTheme();
    initContentFromManifest();
    buildNavigation();
    applyPreferences();
    setupPreferences();

    // Defer Mermaid init until idle - it's only used inside chapter content,
    // and the welcome page never has any diagrams. Falls back to setTimeout
    // when requestIdleCallback isn't available.
    var idle = window.requestIdleCallback || function (cb) { return setTimeout(cb, 0); };
    idle(function () { initMermaid(); });

    // Coalesce repeated buildNavigation calls during async content loads
    // into a single rebuild after everything settles.
    var navRebuildScheduled = false;
    function scheduleNavRebuild() {
      if (navRebuildScheduled) return;
      navRebuildScheduled = true;
      idle(function () { navRebuildScheduled = false; buildNavigation(); });
    }

    ensureAllContentLoaded(function () {
      scheduleNavRebuild();
      initFuse();
      prefetchExternalChapters(function () {
        scheduleNavRebuild();
        initFuse();
      });
      if (!state.activeChapter && !handleRoute()) showWelcome();
    });

    if (!handleRoute()) showWelcome();

    dom.themeToggle.addEventListener('click', toggleTheme);
    dom.themeToggle.addEventListener('keydown', function (e) { if (e.key === 'Enter') toggleTheme(); });
    dom.menuToggle.addEventListener('click', function () { dom.sidebar.classList.contains('open') ? closeSidebar() : openSidebar(); });
    dom.overlay.addEventListener('click', closeSidebar);
    dom.sidebarToggle.addEventListener('click', function () {
      if (isWideMode()) {
        dom.sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
      } else {
        dom.sidebar.classList.toggle('hidden');
        dom.guideMain.classList.toggle('full-width');
      }
    });

    document.getElementById('logo-link').addEventListener('click', function (e) { e.preventDefault(); showWelcome(); });
    dom.backToTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateSidebarToggleVisibility);
    window.addEventListener('popstate', function () { if (!handleRoute()) showWelcome(); });

    function onSearch(e) {
      clearTimeout(searchTimer);
      var v = e.target.value;
      searchTimer = setTimeout(function () { handleSearch(v); }, 200);
    }
    dom.searchInput.addEventListener('input', onSearch);
    if (dom.searchInputMobile) dom.searchInputMobile.addEventListener('input', onSearch);

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search-wrapper')) { dom.searchResults.classList.remove('active'); syncSearchBlur(false); }
      if (!e.target.closest('.prefs-dropdown') && !e.target.closest('#btn-preferences')) {
        var dd = document.getElementById('prefs-dropdown');
        if (dd) dd.classList.remove('active');
      }
      if (!e.target.closest('#account-dropdown') && !e.target.closest('#btn-account')) {
        var ad = document.getElementById('account-dropdown');
        if (ad) ad.classList.remove('active');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); dom.searchInput.focus(); }
      if (e.key === 'Escape') {
        dom.searchResults.classList.remove('active'); syncSearchBlur(false); dom.searchInput.blur(); closeSidebar(); closePanel();
        if (typeof closeMindMapModal === 'function') closeMindMapModal();
        var dd = document.getElementById('prefs-dropdown'); if (dd) dd.classList.remove('active');
        var ad = document.getElementById('account-dropdown'); if (ad) ad.classList.remove('active');
      }
    });

    document.getElementById('btn-bookmarks').addEventListener('click', function () { openPanel('panel-bookmarks'); });
    document.getElementById('btn-playlists').addEventListener('click', function () { openPanel('panel-playlists'); });
    document.getElementById('btn-preferences').addEventListener('click', function () {
      var dd = document.getElementById('prefs-dropdown');
      if (dd) dd.classList.toggle('active');
    });

    document.getElementById('panel-overlay').addEventListener('click', closePanel);
    document.querySelectorAll('.panel-close').forEach(function (btn) {
      btn.addEventListener('click', closePanel);
    });

    initAccountUi();

    initMagneticNav();
  }

  // ===================== ACCOUNT UI & SYNC BOOTSTRAP =====================
  // Renders the header account button (avatar when signed-in, generic icon
  // when signed-out), drives the dropdown, and kicks off Auth.load() +
  // Store.initSync() once at boot. Repaints sidebar nav / open panels /
  // active-chapter bookmark button when the store changes (sign-in merge,
  // cross-tab storage event, etc.).
  var SIGNED_OUT_BTN_HTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>';

  function renderAccountUi() {
    var btn = document.getElementById('btn-account');
    var dd = document.getElementById('account-dropdown');
    if (!btn || !dd) return;
    var u = Auth.user;
    if (u) {
      btn.classList.add('signed-in');
      btn.classList.remove('has-error');
      btn.setAttribute('title', u.email || u.name || 'Account');
      btn.innerHTML = u.picture
        ? '<img class="acct-btn-avatar" src="' + u.picture + '" alt="" referrerpolicy="no-referrer">'
        : SIGNED_OUT_BTN_HTML;
      var av = document.getElementById('acct-avatar');
      var nm = document.getElementById('acct-name');
      var em = document.getElementById('acct-email');
      if (av) {
        if (u.picture) { av.src = u.picture; av.style.display = ''; }
        else av.style.display = 'none';
      }
      if (nm) nm.textContent = u.name || '';
      if (em) em.textContent = u.email || '';
    } else {
      btn.classList.remove('signed-in');
      btn.setAttribute('title', 'Sign in with Google');
      btn.innerHTML = SIGNED_OUT_BTN_HTML;
      // Don't auto-close the dropdown when there's a pending login error to
      // surface; the caller in initAccountUi() opens it deliberately.
      if (!Auth.pendingLoginError) dd.classList.remove('active');
      btn.classList.toggle('has-error', !!Auth.pendingLoginError);
    }
    renderLoginError();
  }

  // Inject (or update, or remove) a one-line error banner inside the
  // account dropdown when Auth.pendingLoginError is set. Reuses the
  // existing `.acct-sync.error` styling so we don't have to grow the CSS
  // surface for what should be a rare event.
  function renderLoginError() {
    var dd = document.getElementById('account-dropdown');
    if (!dd) return;
    var existing = dd.querySelector('.acct-login-error');
    if (!Auth.pendingLoginError) {
      if (existing) existing.remove();
      return;
    }
    if (!existing) {
      existing = document.createElement('div');
      existing.className = 'acct-login-error acct-sync error';
      existing.setAttribute('role', 'alert');
      // Insert at the top of the dropdown so the message is the first thing
      // the user sees once it's open.
      dd.insertBefore(existing, dd.firstChild);
    }
    existing.textContent = Auth.pendingLoginError.message;
  }

  function setSyncStatus(text, kind) {
    var el = document.getElementById('acct-sync');
    if (!el) return;
    el.className = 'acct-sync' + (kind ? ' ' + kind : '');
    el.textContent = text || '';
  }

  function refreshUiAfterStoreChange() {
    if (state.activeChapter && state.activeSection) {
      var key = chKey(state.activeSection, state.activeChapter.id);
      var btn = document.querySelector('.bookmark-btn');
      if (btn) {
        var on = Store.isBookmarked(key);
        btn.classList.toggle('active', on);
        btn.innerHTML = svg(on ? 'starFill' : 'star', 16) + (on ? ' Bookmarked' : ' Bookmark');
      }
    }
    if (typeof buildNavigation === 'function') buildNavigation();
    var bp = document.getElementById('panel-bookmarks');
    if (bp && bp.classList.contains('open')) renderBookmarksPanel();
    var pp = document.getElementById('panel-playlists');
    if (pp && pp.classList.contains('open')) renderPlaylistsPanel();
  }

  function initAccountUi() {
    var btn = document.getElementById('btn-account');
    var dd = document.getElementById('account-dropdown');
    var so = document.getElementById('btn-signout');
    if (!btn || !dd || !so) return;

    btn.addEventListener('click', function () {
      // Signed-in: just toggle the dropdown.
      if (Auth.user) {
        dd.classList.toggle('active');
        return;
      }
      // Signed-out with a pending login-error: two-click pattern. The
      // dropdown is auto-revealed on boot to show the message; the FIRST
      // post-boot click of the button acknowledges + retries sign-in.
      // (This avoids the trap where the dropdown is already open and the
      // user clicks the button expecting "retry" but gets a no-op toggle.)
      if (Auth.pendingLoginError) {
        Auth.pendingLoginError = null;
        Auth.signIn();
        return;
      }
      Auth.signIn();
    });
    so.addEventListener('click', function () { Auth.signOut(); });

    // Clear the login-error banner the moment the dropdown is closed so
    // we don't keep nagging after the user has acknowledged it.
    document.addEventListener('click', function (e) {
      if (!Auth.pendingLoginError) return;
      if (e.target.closest('#account-dropdown') || e.target.closest('#btn-account')) return;
      Auth.pendingLoginError = null;
      renderAccountUi();
    });

    Auth.onChange(renderAccountUi);
    Store.onChange(refreshUiAfterStoreChange);
    renderAccountUi();

    // Auto-reveal the dropdown on boot if a callback came back with an
    // error. We do this BEFORE Auth.load() so the user sees the message
    // immediately, even if /api/me is slow.
    if (Auth.pendingLoginError) dd.classList.add('active');

    Auth.load().then(function (user) {
      renderAccountUi();
      if (!user) return null;
      setSyncStatus('Syncing\u2026', '');
      return Store.initSync().then(function (ok) {
        setSyncStatus(ok ? 'Synced' : 'Offline (saved locally)', ok ? 'success' : 'error');
        if (ok) setTimeout(function () { setSyncStatus('', ''); }, 3000);
      });
    });
  }

  var appStarted = false;

  function renderBootError(error) {
    var contentArea = document.getElementById("content-area");
    if (!contentArea) return;

    contentArea.textContent = "";
    var card = document.createElement("section");
    card.className = "chapter-error-card";

    var heading = document.createElement("h2");
    heading.textContent = "TechPrimer could not load";

    var message = document.createElement("p");
    message.textContent = navigator.onLine
      ? "Reload the page to retry."
      : "Reconnect once so the required reading files can be restored.";

    card.appendChild(heading);
    card.appendChild(message);
    contentArea.appendChild(card);
    console.error(error);
  }

  function boot() {
    if (appStarted) return;
    appStarted = true;

    if (
      !window.TP_VENDOR_READY ||
      typeof window.TP_VENDOR_READY.then !== "function"
    ) {
      renderBootError(new Error("Vendor readiness promise is unavailable"));
      return;
    }

    window.TP_VENDOR_READY
      .then(function () {
        init();
      })
      .catch(renderBootError);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
