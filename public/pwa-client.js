(function () {
  "use strict";

  var registration = null;
  var hasController = Boolean(
    "serviceWorker" in navigator && navigator.serviceWorker.controller
  );
  var acceptedReleaseId = null;
  var reloading = false;
  var statusElement = null;
  var updateButton = null;
  var beforeUpdateHooks = [];
  var readinessWait = null;
  var tabId = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
  var peers = new Map();
  var broadcast = "BroadcastChannel" in window
    ? new BroadcastChannel("techprimer-pwa")
    : null;

  function setState(state, text) {
    window.dispatchEvent(new CustomEvent("tp:pwa-state", {
      detail: { state: state, text: text }
    }));

    if (!statusElement) return;
    statusElement.dataset.state = state;
    var msgEl = statusElement.querySelector("[data-pwa-message]");
    if (msgEl) msgEl.textContent = text;
    statusElement.hidden = state === "ready" && navigator.onLine;
  }

  function postWorkerMessage(worker, message) {
    return new Promise(function (resolve, reject) {
      if (!worker) {
        reject(new Error("Service worker is unavailable"));
        return;
      }

      var channel = new MessageChannel();
      var timeout = window.setTimeout(function () {
        reject(new Error("Service worker response timed out"));
      }, 5000);

      channel.port1.onmessage = function (event) {
        window.clearTimeout(timeout);
        resolve(event.data);
      };

      worker.postMessage(message, [channel.port2]);
    });
  }

  async function getWorkerRelease(worker) {
    var response = await postWorkerMessage(worker, {
      type: "GET_RELEASE_STATUS"
    });
    return response.releaseId;
  }

  async function verifyActiveRelease() {
    var active = registration && registration.active;
    var response = await postWorkerMessage(active, {
      type: "VERIFY_RELEASE"
    });

    if (response.missing.length > 0) {
      window.__TP_OFFLINE_READY__ = false;
      setState(
        "repair-required",
        "Offline files need to be restored. Reconnect and reload."
      );
      return false;
    }

    window.__TP_OFFLINE_READY__ = true;
    setState(
      navigator.onLine ? "ready" : "offline-reading",
      navigator.onLine ? "Ready to read offline." : "Offline reading mode."
    );
    return true;
  }

  async function showWaitingUpdate(worker, shouldBroadcast) {
    var releaseId = await getWorkerRelease(worker);
    if (!updateButton) return;
    updateButton.hidden = false;
    updateButton.textContent = "Update";
    updateButton.dataset.force = "false";
    updateButton.dataset.releaseId = releaseId;
    setState("update-waiting", "Update available.");
    if (shouldBroadcast !== false) {
      sendBroadcast({
        type: "UPDATE_AVAILABLE",
        releaseId: releaseId
      });
    }
  }

  function observeInstallingWorker(worker) {
    worker.addEventListener("statechange", function () {
      if (worker.state === "installing") {
        setState(
          hasController ? "update-installing" : "preparing-first-release",
          hasController
            ? "Downloading an update."
            : "Preparing offline reading."
        );
      }

      if (
        worker.state === "installed" &&
        navigator.serviceWorker.controller
      ) {
        showWaitingUpdate(registration.waiting || worker).catch(function () {
          setState("error", "Unable to prepare the update.");
        });
      }
    });
  }

  function sendBroadcast(message) {
    if (!broadcast) return;
    broadcast.postMessage(Object.assign({
      tabId: tabId,
      sentAt: Date.now()
    }, message));
  }

  function announceTab() {
    sendBroadcast({
      type: "TAB_ALIVE",
      visible: document.visibilityState === "visible"
    });
  }

  function prunePeers() {
    var oldestAllowed = Date.now() - 15000;
    peers.forEach(function (peer, peerId) {
      if (peer.lastSeen < oldestAllowed) {
        peers.delete(peerId);
      }
    });
  }

  async function runBeforeUpdateHooks() {
    for (var index = 0; index < beforeUpdateHooks.length; index += 1) {
      await Promise.resolve(beforeUpdateHooks[index]());
    }
  }

  async function prepareThisTab(releaseId) {
    acceptedReleaseId = releaseId;
    await runBeforeUpdateHooks();
    sendBroadcast({
      type: "READY_FOR_UPDATE",
      releaseId: releaseId
    });
  }

  function markPeerReady(message) {
    if (!readinessWait || readinessWait.releaseId !== message.releaseId) return;
    readinessWait.ready.add(message.tabId);

    var allReady = Array.from(readinessWait.expected).every(function (peerId) {
      return readinessWait.ready.has(peerId);
    });
    if (allReady) {
      readinessWait.finish(true);
    }
  }

  function waitForPeerReadiness(releaseId) {
    prunePeers();
    var expected = new Set(peers.keys());
    expected.delete(tabId);

    if (expected.size === 0) {
      return Promise.resolve(true);
    }

    return new Promise(function (resolve) {
      var settled = false;
      var timer = window.setTimeout(function () {
        finish(false);
      }, 3000);

      function finish(ready) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        readinessWait = null;
        resolve(ready);
      }

      readinessWait = {
        releaseId: releaseId,
        expected: expected,
        ready: new Set(),
        finish: finish
      };

      sendBroadcast({
        type: "PREPARE_UPDATE",
        releaseId: releaseId
      });
    });
  }

  function reloadForRelease(releaseId) {
    if (reloading) return;
    var storageKey = "tp-activated-release";
    if (sessionStorage.getItem(storageKey) === releaseId) return;

    reloading = true;
    sessionStorage.setItem(storageKey, releaseId);
    window.location.reload();
  }

  async function activateWaitingWorker(releaseId) {
    if (!registration || !registration.waiting) {
      throw new Error("The waiting service worker is unavailable");
    }

    acceptedReleaseId = releaseId;
    setState("activating", "Applying update.");
    registration.waiting.postMessage({
      type: "SKIP_WAITING",
      releaseId: releaseId
    });
  }

  async function acceptUpdate() {
    if (!registration || !registration.waiting) return;

    var releaseId = updateButton.dataset.releaseId;
    var force = updateButton.dataset.force === "true";
    await prepareThisTab(releaseId);

    if (!force) {
      var peersReady = await waitForPeerReadiness(releaseId);
      if (!peersReady) {
        updateButton.textContent = "Update anyway";
        updateButton.dataset.force = "true";
        setState(
          "update-waiting",
          "Another TechPrimer tab did not respond. Close it or update anyway."
        );
        return;
      }
    }

    await activateWaitingWorker(releaseId);
  }

  async function register() {
    if (!("serviceWorker" in navigator)) {
      setState("unsupported", "Offline installation is not supported.");
      return;
    }

    setState("registering", "Checking offline reading files.");
    registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none"
    });

    registration.addEventListener("updatefound", function () {
      if (registration.installing) {
        observeInstallingWorker(registration.installing);
      }
    });

    if (registration.installing) {
      observeInstallingWorker(registration.installing);
    }

    if (registration.waiting && navigator.serviceWorker.controller) {
      await showWaitingUpdate(registration.waiting);
    }

    await navigator.serviceWorker.ready;
    await verifyActiveRelease();

    if (navigator.onLine) {
      await registration.update();
    }
  }

  function initializeDom() {
    statusElement = document.getElementById("pwa-status");
    updateButton = document.getElementById("pwa-update-button");
    if (updateButton) {
      updateButton.addEventListener("click", function () {
        acceptUpdate().catch(function () {
          setState("error", "Unable to activate the update.");
        });
      });
    }
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      hasController = true;
      if (!acceptedReleaseId) {
        verifyActiveRelease().catch(function () {
          setState("error", "Unable to verify offline files.");
        });
        return;
      }

      reloadForRelease(acceptedReleaseId);
    });

    navigator.serviceWorker.addEventListener("message", function (event) {
      var message = event.data || {};
      if (message.type !== "RELEASE_ACTIVATED") return;
      hasController = true;

      if (!acceptedReleaseId) {
        verifyActiveRelease().catch(function () {
          setState("error", "Unable to verify offline files.");
        });
        return;
      }

      sendBroadcast({
        type: "RELOAD_RELEASE",
        releaseId: message.releaseId
      });
      reloadForRelease(message.releaseId);
    });
  }

  window.addEventListener("online", function () {
    if (registration) {
      registration.update().catch(function () {
        setState("error", "Unable to check for updates.");
      });
    }
    verifyActiveRelease().catch(function () {
      setState("repair-required", "Offline files need to be restored.");
    });
  });

  window.addEventListener("offline", function () {
    setState("offline-reading", "Offline reading mode.");
  });

  if (broadcast) {
    broadcast.addEventListener("message", function (event) {
      var message = event.data || {};
      if (!message.tabId || message.tabId === tabId) return;

      if (message.type === "TAB_ALIVE") {
        peers.set(message.tabId, {
          lastSeen: Number(message.sentAt) || Date.now(),
          visible: Boolean(message.visible)
        });
        return;
      }

      if (message.type === "UPDATE_AVAILABLE") {
        if (registration && registration.waiting) {
          showWaitingUpdate(registration.waiting, false).catch(function () {
            setState("error", "Unable to inspect the waiting update.");
          });
        }
        return;
      }

      if (message.type === "PREPARE_UPDATE") {
        prepareThisTab(message.releaseId).catch(function () {
          setState("error", "This tab could not prepare for the update.");
        });
        return;
      }

      if (message.type === "READY_FOR_UPDATE") {
        markPeerReady(message);
        return;
      }

      if (message.type === "RELOAD_RELEASE") {
        reloadForRelease(message.releaseId);
      }
    });

    window.setInterval(announceTab, 5000);
    document.addEventListener("visibilitychange", announceTab);
  }

  window.TechPrimerPWA = {
    registerBeforeUpdate: function (hook) {
      if (typeof hook !== "function") {
        throw new TypeError("The before-update hook must be a function");
      }
      beforeUpdateHooks.push(hook);
      return function () {
        var index = beforeUpdateHooks.indexOf(hook);
        if (index >= 0) beforeUpdateHooks.splice(index, 1);
      };
    },
    verify: verifyActiveRelease
  };

  document.addEventListener("DOMContentLoaded", function () {
    initializeDom();
    announceTab();
    register().catch(function () {
      setState("error", "Offline reading could not be prepared.");
    });
  });
})();
