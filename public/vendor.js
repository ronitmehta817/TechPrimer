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
    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    document.head.appendChild(s);
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
    'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js',
    'https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js',
  ];
  vendorScripts.forEach(addScript);

  addInline('module',
    'import Fuse from "https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.mjs";'
    + 'window.Fuse = Fuse;');
})();
