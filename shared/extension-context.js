/**
 * Guard chrome.* calls after extension reload (context invalidated).
 */
(function (root) {
  function extensionOk() {
    try {
      return Boolean(chrome.runtime?.id);
    } catch {
      return false;
    }
  }

  root.ASS_EXTENSION = { extensionOk };
})(typeof globalThis !== "undefined" ? globalThis : self);
