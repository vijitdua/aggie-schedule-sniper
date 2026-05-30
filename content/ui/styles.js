(() => {
  const ASS = window.ASS;

  ASS.uiStyles = {
    rootContainer: [
      "margin:16px auto",
      "padding:12px",
      "display:flex",
      "align-items:center",
      "gap:10px",
      "justify-content:center",
      "max-width:760px",
      "background:#fff",
      "border:1px solid #e2e8f0",
      "border-radius:14px",
      "box-shadow:0 4px 12px rgba(0,0,0,.06)",
      "font:600 14px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      "cursor:pointer",
      "z-index:2147483646",
    ].join(";"),

    launcherButton: [
      "display:inline-flex",
      "align-items:center",
      "gap:8px",
      "height:44px",
      "padding:0 14px",
      "border-radius:999px",
      "border:1px solid #d2dbe8",
      "background:#f8fafc",
      "color:#0a2f6b",
      "font:700 14px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto",
      "white-space:nowrap",
      "cursor:pointer",
    ].join(";"),

    chip: [
      "display:none",
      "align-items:center",
      "justify-content:center",
      "height:44px",
      "padding:0 14px",
      "border-radius:999px",
      "border:1px solid #d2dbe8",
      "background:#f8fafc",
      "color:#0a2f6b",
      "font:700 14px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto",
      "white-space:nowrap",
    ].join(";"),

    toneStyles: {
      neutral: {
        background: "#f8fafc",
        borderColor: "#cbd5e1",
        color: "#334155",
        boxShadow: "0 0 0 2px rgba(148,163,184,.12)",
      },
      busy: {
        background: "#eff6ff",
        borderColor: "#2563eb",
        color: "#1d4ed8",
        boxShadow: "0 0 0 2px rgba(37,99,235,.18)",
      },
      success: {
        background: "#ecfdf5",
        borderColor: "#16a34a",
        color: "#166534",
        boxShadow: "0 0 0 2px rgba(22,163,74,.18)",
      },
      danger: {
        background: "#fef2f2",
        borderColor: "#dc2626",
        color: "#991b1b",
        boxShadow: "0 0 0 2px rgba(220,38,38,.18)",
      },
    },

    professorRatingsBlock: [
      "display:block",
      "width:fit-content",
      "max-width:min(100%,280px)",
      "margin:8px 0 10px",
      "padding:10px 12px",
      "background:#fff",
      "border:1px solid #e2e8f0",
      "border-left:3px solid #ffbf00",
      "border-radius:10px",
      "box-shadow:0 4px 12px rgba(1,37,110,.08)",
      "font:400 12px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      "color:#64748b",
      "line-height:1.45",
    ].join(";"),
  };
})();
