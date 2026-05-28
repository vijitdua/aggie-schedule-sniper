/**
 * Minimal .ics builder for Aggie Schedule Sniper.
 */
(function (root) {
  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function parseUsDate(value) {
    const match = (value || "").match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (!match) {
      return null;
    }
    const month = new Date(`${match[1]} 1, 2000`).getMonth();
    if (Number.isNaN(month)) {
      return null;
    }
    return new Date(Number(match[3]), month, Number(match[2]));
  }

  function parseUsDateTime(dateStr, timeStr) {
    const dateMatch = (dateStr || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const timeMatch = (timeStr || "").match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
    if (!dateMatch || !timeMatch) {
      return null;
    }
    let hour = Number(timeMatch[1]) % 12;
    if (/pm/i.test(timeMatch[3])) {
      hour += 12;
    }
    return new Date(
      Number(dateMatch[3]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[1]),
      hour,
      Number(timeMatch[2]),
    );
  }

  function parseTimeOnDate(baseDate, timeStr) {
    const timeMatch = (timeStr || "").match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
    if (!timeMatch || !baseDate) {
      return null;
    }
    let hour = Number(timeMatch[1]) % 12;
    if (/pm/i.test(timeMatch[3])) {
      hour += 12;
    }
    return new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      hour,
      Number(timeMatch[2]),
    );
  }

  function formatIcsUtc(date) {
    return [
      date.getUTCFullYear(),
      pad(date.getUTCMonth() + 1),
      pad(date.getUTCDate()),
      "T",
      pad(date.getUTCHours()),
      pad(date.getUTCMinutes()),
      pad(date.getUTCSeconds()),
      "Z",
    ].join("");
  }

  function escapeText(value) {
    return (value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function slugify(value) {
    return (value || "schedule")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
  }

  function buildRrule(byDay, untilDate) {
    const parts = [`FREQ=WEEKLY`, `BYDAY=${byDay.join(",")}`];
    if (untilDate) {
      parts.push(`UNTIL=${formatIcsUtc(untilDate)}`);
    }
    return parts.join(";");
  }

  function buildIcs(events) {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Aggie Schedule Sniper//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    for (const event of events) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${event.uid}`);
      lines.push(`DTSTAMP:${formatIcsUtc(new Date())}`);
      lines.push(`DTSTART:${formatIcsUtc(event.start)}`);
      lines.push(`DTEND:${formatIcsUtc(event.end)}`);
      lines.push(`SUMMARY:${escapeText(event.summary)}`);
      if (event.location) {
        lines.push(`LOCATION:${escapeText(event.location)}`);
      }
      if (event.description) {
        lines.push(`DESCRIPTION:${escapeText(event.description)}`);
      }
      if (event.rrule) {
        lines.push(`RRULE:${event.rrule}`);
      }
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    return `${lines.join("\r\n")}\r\n`;
  }

  root.ASS_ICS = {
    buildIcs,
    parseUsDate,
    parseUsDateTime,
    parseTimeOnDate,
    slugify,
    buildRrule,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
