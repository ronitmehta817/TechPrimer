(function () {
  'use strict';

  function addLink(attrs) {
    var l = document.createElement('link');
    Object.keys(attrs).forEach(function (k) {
      if (attrs[k] === true) l.setAttribute(k, '');
      else l.setAttribute(k, attrs[k]);
    });
    document.head.appendChild(l);
  }

  function addScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.addEventListener('load', resolve, { once: true });
      s.addEventListener('error', function () {
        reject(new Error('Unable to load ' + src));
      }, { once: true });
      document.head.appendChild(s);
    });
  }

  function addInline(type, code) {
    var s = document.createElement('script');
    if (type) s.type = type;
    s.textContent = code;
    document.head.appendChild(s);
  }

  addLink({ rel: 'preconnect', href: 'https://fonts.googleapis.com' });
  addLink({ rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true });

  addLink({
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?'
        + 'family=Inter:wght@300;400;500;600;700;800'
        + '&family=JetBrains+Mono:wght@400;500;600'
        + '&display=swap',
  });

  addInline('importmap', JSON.stringify({
    imports: {
      three: 'https://cdn.jsdelivr.net/npm/three@0.183.0/build/three.module.js',
    },
  }));

  var vendorScripts = [
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/python.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/java.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/javascript.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/bash.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/json.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/yaml.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/xml.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/sql.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/properties.min.js',
    'https://cdn.jsdelivr.net/npm/mermaid@11.16.1/dist/mermaid.min.js',
    'https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js',
  ];
  var coreScriptsReady = Promise.all(vendorScripts.map(addScript));

  var fuseReady = import(
    'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.mjs'
  ).then(function (module) {
    window.Fuse = module.default;
  });
  window.TP_CORE_VENDOR_READY = Promise.all([
    coreScriptsReady,
    fuseReady
  ]);

  var pdfVendorScripts = [
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    'https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/svg2pdf.js@2.7.0/dist/svg2pdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/fflate@0.8.3/umd/index.js',
  ];
  var pdfScriptsReady = pdfVendorScripts.reduce(function (chain, src) {
    return chain.then(function () { return addScript(src); });
  }, Promise.resolve());
  window.TP_PDF_EXPORT_READY = Promise.all([
    window.TP_CORE_VENDOR_READY,
    pdfScriptsReady
  ]);
})();
