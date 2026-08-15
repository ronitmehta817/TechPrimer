(function () {
  "use strict";

  var assets = @@VENDOR_ASSETS_JSON@@;

  function loadScript(asset) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + asset.url + '"]');
      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolve();
          return;
        }
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      var script = document.createElement("script");
      script.src = asset.url;
      script.integrity = asset.integrity;
      script.crossOrigin = "anonymous";
      script.async = false;
      script.addEventListener("load", function () {
        script.dataset.loaded = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", function () {
        reject(new Error("Unable to load " + asset.url));
      }, { once: true });
      document.head.appendChild(script);
    });
  }

  function addOptionalFonts() {
    var preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = "https://fonts.gstatic.com";
    preconnect.crossOrigin = "anonymous";
    document.head.appendChild(preconnect);

    var stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(stylesheet);
  }

  function assertGlobals() {
    var required = ["marked", "hljs", "mermaid", "pako", "Fuse", "DOMPurify"];
    var missing = required.filter(function (name) {
      return typeof window[name] === "undefined";
    });

    if (missing.length > 0) {
      throw new Error("Missing required libraries: " + missing.join(", "));
    }
  }

  var highlightLanguages = [
    "python",
    "java",
    "javascript",
    "bash",
    "json",
    "yaml",
    "xml",
    "sql",
    "properties"
  ];

  var highlightReady = loadScript(assets["highlight.js"]).then(function () {
    return Promise.all(highlightLanguages.map(function (language) {
      return loadScript(assets["highlight-languages/" + language + ".js"]);
    }));
  });

  window.TP_VENDOR_READY = Promise.all([
    loadScript(assets["marked.js"]),
    loadScript(assets["mermaid.js"]),
    loadScript(assets["pako.js"]),
    loadScript(assets["fuse.js"]),
    loadScript(assets["dompurify.js"]),
    highlightReady
  ]).then(function () {
    assertGlobals();
    return true;
  });

  if (navigator.onLine) {
    addOptionalFonts();
  }
})();
