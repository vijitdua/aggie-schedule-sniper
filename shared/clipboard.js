/**
 * Clipboard helpers for popup and content script contexts.
 */
window.ASS_CLIPBOARD = {
  async copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return this.copyTextViaExecCommand(text);
    }
  },

  copyTextViaExecCommand(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(ta);
    }
  },
};
