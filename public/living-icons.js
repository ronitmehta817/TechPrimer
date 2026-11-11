/*
 * TechPrimer diagram icon set (original artwork, drawn for this lab).
 *
 * 24x24 grid, 1.75 stroke, round caps and joins, no fill. Every icon is plain SVG
 * markup, so it can be inlined, turned into a data URI for a Mermaid label,
 * or registered as an Iconify pack for Mermaid's native icon shapes.
 *
 * Works as a browser global (window.TPIcons) and in Node (globalThis.TPIcons).
 */
(function (root) {
  'use strict';

  // id -> [category, inner SVG markup]
  var DEF = {
    // ---- people & clients
    user:        ['people',    '<circle cx="12" cy="8" r="3.6"/><path d="M5 20.2c0-3.9 3.1-7 7-7s7 3.1 7 7"/>'],
    users:       ['people',    '<circle cx="9" cy="8.5" r="3"/><path d="M3 19.5c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16.4 13.9c2.9.2 5.1 2.4 5.1 5.3"/>'],
    monitor:     ['people',    '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M8 20.5h8M12 16.5v4"/>'],
    phone:       ['people',    '<rect x="6.8" y="2.5" width="10.4" height="19" rx="2.4"/><path d="M10.8 18.5h2.4"/>'],

    // ---- edge & routing
    gateway:     ['edge',      '<path d="M5 21V10.5a7 7 0 0 1 14 0V21"/><path d="M2.5 15.5h11M10.5 12.3l3.2 3.2-3.2 3.2"/>'],
    loadbalancer:['edge',      '<circle cx="12" cy="4.6" r="2.3"/><path d="M12 6.9V12M12 12 5.6 16.7M12 12v4.7M12 12l6.4 4.7"/><circle cx="5.5" cy="19" r="2.3"/><circle cx="12" cy="19" r="2.3"/><circle cx="18.5" cy="19" r="2.3"/>'],
    cdn:         ['edge',      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3.1 3.2 14.9 0 18M12 3c-3.2 3.1-3.2 14.9 0 18"/>'],
    router:      ['edge',      '<path d="M3.5 12H9l4-6.2h5.5M9 12l4 6.2h5.5"/><path d="M16.2 3.3l2.5 2.5-2.5 2.5M16.2 15.7l2.5 2.5-2.5 2.5"/>'],
    registry:    ['edge',      '<rect x="4.5" y="3" width="15" height="18" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>'],
    lock:        ['edge',      '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5v-3a4 4 0 0 1 8 0v3M12 14.8v2.4"/>'],

    // ---- compute
    service:     ['compute',   '<path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4z"/><circle cx="12" cy="12" r="2.7"/>'],
    server:      ['compute',   '<rect x="3.5" y="3.5" width="17" height="7" rx="2"/><rect x="3.5" y="13.5" width="17" height="7" rx="2"/><path d="M7.5 7h.01M7.5 17h.01"/>'],
    worker:      ['compute',   '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>'],
    api:         ['compute',   '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.6 5l-3.2 14"/>'],
    scheduler:   ['compute',   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.6 2"/>'],
    search:      ['compute',   '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.4 15.4 5.1 5.1"/>'],
    payment:     ['compute',   '<rect x="2.5" y="5" width="19" height="14" rx="2.4"/><path d="M2.5 10h19M6 15h4"/>'],
    plug:        ['compute',   '<path d="M9 3v5M15 3v5M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0zM12 17v4"/>'],
    box:         ['compute',   '<path d="M12 2.8 20.5 7.5v9L12 21.2 3.5 16.5v-9z"/><path d="M3.8 7.7 12 12.3l8.2-4.6M12 12.3v8.7"/>'],

    // ---- data
    database:    ['data',      '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.55 3.35 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-13"/><path d="M4.5 12c0 1.55 3.35 2.8 7.5 2.8s7.5-1.25 7.5-2.8"/>'],
    cache:       ['data',      '<path d="M13.4 2.5 5.5 13.6h5.9l-.9 7.9 8-11.1h-5.9z"/>'],
    bucket:      ['data',      '<ellipse cx="12" cy="7.2" rx="7.5" ry="2.6"/><path d="M4.5 7.2 6.2 19a2 2 0 0 0 2 1.7h7.6a2 2 0 0 0 2-1.7l1.7-11.8"/>'],
    file:        ['data',      '<path d="M6 2.5h8l4.5 4.5v14.5H6z"/><path d="M14 2.5V7h4.5M9.2 12.2h6M9.2 16h6"/>'],
    chart:       ['data',      '<path d="M3.5 3.5v17h17"/><rect x="7.5" y="12" width="3" height="5.5" rx=".7"/><rect x="12" y="8" width="3" height="9.5" rx=".7"/><rect x="16.5" y="5" width="3" height="12.5" rx=".7"/>'],
    check:       ['data',      '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.8 5.4-5.6"/>'],

    // ---- messaging
    queue:       ['messaging', '<rect x="2.5" y="6.5" width="19" height="9" rx="2"/><path d="M8.8 6.5v9M15.2 6.5v9"/><path d="M6 19.5h12M15.3 17.2l2.7 2.3-2.7 2.3"/>'],
    eventbus:    ['messaging', '<circle cx="12" cy="12" r="2.1"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>'],
    mail:        ['messaging', '<rect x="3" y="5" width="18" height="14" rx="2.2"/><path d="m3.6 7.2 8.4 6.3 8.4-6.3"/>'],
    chat:        ['messaging', '<path d="M5 4.5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7.5L7 21v-3.5H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z"/><path d="M8 9.5h8M8 13h5"/>'],
    bell:        ['messaging', '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.8 2.3H4.2z"/><path d="M10 21.5h4"/>'],

    // ---- alerts & flow control
    dlq:         ['alert',     '<rect x="3" y="5" width="18" height="14" rx="2.2"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/>'],
    error:       ['alert',     '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>'],
    retry:       ['neutral',   '<path d="M20 12a8 8 0 1 1-2.7-6"/><path d="M20.2 3.6v4.4h-4.4"/>'],
    decision:    ['neutral',   '<path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/><path d="M9.8 10a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.9-1.1 1.6M12 16.6h.01"/>'],
    sliders:     ['neutral',   '<path d="M4 7h9.5M18 7h2M4 17h2M10.5 17H20"/><circle cx="15.7" cy="7" r="2.2"/><circle cx="8.3" cy="17" r="2.2"/>']
  };

  var NICE = {
    user: 'User', users: 'Users', monitor: 'Client / browser', phone: 'Mobile app',
    gateway: 'API gateway', loadbalancer: 'Load balancer', cdn: 'CDN', router: 'Router', registry: 'Service registry', lock: 'Auth / secrets',
    service: 'Service', server: 'Server', worker: 'Worker / job', api: 'API / endpoint', scheduler: 'Scheduler', search: 'Search', payment: 'Payments', plug: 'Third party', box: 'Orders / inventory',
    database: 'Database', cache: 'Cache', bucket: 'Object storage', file: 'Template / file', chart: 'Analytics', check: 'Success',
    queue: 'Queue', eventbus: 'Event bus', mail: 'Email', chat: 'SMS / chat', bell: 'Push / alert',
    dlq: 'Dead-letter queue', error: 'Failure', retry: 'Retry / backoff', decision: 'Decision', sliders: 'Preferences / config'
  };

  // Violet and pink only (no yellow, no blue): two hue families, shades tell the categories apart.
  var PALETTE = {
    people:    { light: { fg: '#7c3aed', bg: '#f0e9ff' }, dark: { fg: '#b794ff', bg: '#251a45' } },  // violet
    edge:      { light: { fg: '#9333ea', bg: '#f4e8ff' }, dark: { fg: '#d8a4ff', bg: '#301848' } },  // purple
    compute:   { light: { fg: '#6d28d9', bg: '#ece4fc' }, dark: { fg: '#a98bff', bg: '#2a1a4d' } },  // deep violet
    data:      { light: { fg: '#db2777', bg: '#fde7f1' }, dark: { fg: '#ff7ab8', bg: '#3d1830' } },  // pink
    messaging: { light: { fg: '#ec4899', bg: '#ffe8f4' }, dark: { fg: '#ff9ccf', bg: '#421a35' } },  // light pink
    alert:     { light: { fg: '#be185d', bg: '#fbe3ee' }, dark: { fg: '#ff6fa8', bg: '#45142b' } },  // deep pink
    neutral:   { light: { fg: '#70648f', bg: '#eeecf4' }, dark: { fg: '#b0a2c8', bg: '#1e1c2e' } }   // muted violet-grey
  };

  var STROKE = 'fill="none" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';

  function ids() { return Object.keys(DEF); }
  function category(id) { return DEF[id] ? DEF[id][0] : 'neutral'; }
  function colors(id, theme) { return PALETTE[category(id)][theme === 'dark' ? 'dark' : 'light']; }
  function body(id) { return DEF[id] ? DEF[id][1] : ''; }

  /** Full standalone <svg>. opts: size, color (default currentColor), title */
  function svg(id, opts) {
    opts = opts || {};
    var size = opts.size || 24;
    var color = opts.color || 'currentColor';
    var title = opts.title ? '<title>' + opts.title + '</title>' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" ' +
      'stroke="' + color + '" ' + STROKE + ' role="img" aria-label="' + (opts.title || NICE[id] || id) + '">' + title + body(id) + '</svg>';
  }

  function toBase64(str) {
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
    return Buffer.from(str, 'utf8').toString('base64');
  }
  /** data: URI of a coloured icon, safe to drop in an <img src> or a Mermaid label. */
  function dataUri(id, color, size) {
    return 'data:image/svg+xml;base64,' + toBase64(svg(id, { color: color, size: size || 24 }));
  }

  /** Iconify-format pack, for mermaid.registerIconPacks (flowchart icon shapes + architecture diagrams). */
  function iconifyPack() {
    var icons = {};
    ids().forEach(function (id) {
      icons[id] = { body: '<g stroke="currentColor" ' + STROKE + '>' + body(id) + '</g>' };
    });
    return { prefix: 'tp', width: 24, height: 24, icons: icons };
  }

  // ------------------------------------------------------------ icon picker ---
  var EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

  /** Plain text of a Mermaid label: no emoji, no markup, single spaces. */
  function cleanLabel(label) {
    return String(label == null ? '' : label)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(EMOJI, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Ordered: first match wins. Wording only; no node ids.
  var RULES = [
    [/\bdead.?letter\b|\bdlq\b/, 'dlq'],
    [/\b(fail\w*|error|reject\w*|invalid)\b/, 'error'],
    [/\b(delivered|success\w*|completed?|confirmed|accepted)\b/, 'check'],
    [/\b(retry|backoff)\b/, 'retry'],
    [/\b(load.?balanc\w*|lb|nginx|haproxy)\b/, 'loadbalancer'],
    [/\bgateway\b|\bgw\b|\bingress\b|\bgate\b/, 'gateway'],
    [/\b(cdn|cloudfront|content delivery network)\b/, 'cdn'],
    [/\b(registry|discovery|consul|eureka)\b/, 'registry'],
    [/\b(redis|cache|memcache\w*)\b/, 'cache'],
    [/\bevent (bus|broker)\b|\bmessage bus\b|\bbus\b|\bbroker\b/, 'eventbus'],
    [/\b(kafka|sqs|rabbit\w*|queues?|topics?|streams?|pub.?sub|outbox)\b/, 'queue'],
    [/\b(s3|bucket|blob|object store\w*)\b/, 'bucket'],
    [/\b(db|database|postgres\w*|mysql|mongo\w*|dynamo\w*|sql|datastore|shards?|replicas?|repositor(y|ies)|\w+ data|\w+ store|data (source|lake))\b/, 'database'],
    [/\b(e-?mail|sendgrid|ses|mailgun|smtp)\b/, 'mail'],
    [/\b(sms|twilio)\b/, 'chat'],
    [/\b(push|firebase|fcm|apns|alert)\b/, 'bell'],
    [/\b(template\w*)\b/, 'file'],
    [/\b(preferences?|config\w*|settings?|polic(y|ies)|rules?|strateg(y|ies))\b/, 'sliders'],
    [/\b(analytics|metrics|monitor\w*|grafana|prometheus|cloudwatch|reports?|reporting)\b/, 'chart'],
    [/\b(scheduler|cron|timer|schedule\w*)\b/, 'scheduler'],
    [/\b(router|routing|route|handlers?|controllers?|dispatchers?)\b/, 'router'],
    [/\b(auth\w*|login|oauth|token|secrets?|iam|jwt)\b/, 'lock'],
    [/\b(search|elastic\w*)\b/, 'search'],
    [/\b(payments?|billing|checkout|stripe)\b/, 'payment'],
    [/\b(inventory|stock|warehouse|orders?|catalog|products?|shipping|shipments?|booking|deliver(y|ies))\b/, 'box'],
    [/\b(workers?|jobs?|batch|consumers?|processors?|executors?|lambda|serverless|functions?|faas|encode\w*|transcod\w*)\b/, 'worker'],
    [/\b(sidecar|proxy|envoy)\b/, 'router'],
    [/\b(users|customers|audience|crowd)\b/, 'users'],
    [/\b(users?|customers?|drivers?|person|actor|admin)\b/, 'user'],
    [/\b(clients?|browser|web ?app|web|frontend|front.end|ui)\b/, 'monitor'],
    [/\b(mobile|ios|android)\b/, 'phone'],
    [/\b(third.?party|providers?|partners?|external|vendor)\b/, 'plug'],
    [/\b(api|rest|grpc|endpoint)\b/, 'api'],
    [/\bnotifications?\b/, 'bell'],
    [/\b(server|host|node|instance|machine|vm|monolith\w*|application|origin)\b/, 'server'],
    [/\b(services?|svc|microservices?|app|producers?|publishers?)\b/, 'service']
  ];

  /** Choose an icon id for a node from its wording (and shape as a fallback). null = leave it plain. */
  function matchRules(text) {
    for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(text)) return RULES[i][1];
    return null;
  }
  function pick(label, shape) {
    if (shape === 'diamond' || shape === 'rhombus') return 'decision';
    var clean = cleanLabel(label);
    var hit = matchRules(clean.toLowerCase());
    // CamelCase names (ExitGate, FeePolicy): retry on the split words, only if the plain text found nothing,
    // so brand-like names such as PostgreSQL are not torn apart first.
    if (!hit) hit = matchRules(clean.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase());
    if (hit) return hit;
    if (shape === 'cylinder' || shape === 'database') return 'database';
    return null;
  }

  root.TPIcons = {
    ids: ids, category: category, colors: colors, body: body, svg: svg, dataUri: dataUri,
    iconifyPack: iconifyPack, pick: pick, cleanLabel: cleanLabel, nice: NICE, palette: PALETTE,
    rules: RULES.map(function (r) { return { pattern: r[0].source, icon: r[1] }; })
  };
})(typeof window !== 'undefined' ? window : globalThis);
