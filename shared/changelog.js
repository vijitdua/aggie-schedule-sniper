/**
 * Parse Keep a Changelog markdown into structured releases.
 */
(function (root) {
  function stripInlineMarkdown(text) {
    return String(text || "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();
  }

  /**
   * @param {string} markdown
   * @returns {{ version: string, date: string, sections: { heading: string, bullets: string[] }[] }[]}
   */
  function parseChangelog(markdown) {
    const releases = [];
    let current = null;
    let section = null;

    for (const rawLine of String(markdown || "").split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      const releaseMatch = line.match(/^## \[([^\]]+)\](?:\s*-\s*(.+))?$/);
      if (releaseMatch) {
        const version = releaseMatch[1].trim();
        current = null;
        section = null;
        if (/^unreleased$/i.test(version)) {
          continue;
        }
        current = {
          version,
          date: (releaseMatch[2] || "").trim(),
          sections: [],
        };
        releases.push(current);
        continue;
      }

      if (!current) {
        continue;
      }

      const sectionMatch = line.match(/^###\s+(.+)$/);
      if (sectionMatch) {
        section = {
          heading: sectionMatch[1].trim(),
          bullets: [],
        };
        current.sections.push(section);
        continue;
      }

      const bulletMatch = line.match(/^- (.+)$/);
      if (bulletMatch && section) {
        section.bullets.push(stripInlineMarkdown(bulletMatch[1]));
      }
    }

    return releases;
  }

  root.ASS_CHANGELOG = {
    parseChangelog,
    stripInlineMarkdown,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
