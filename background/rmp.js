/**
 * RateMyProfessors lookup for UC Davis instructors (background service worker).
 */
(function () {
  const RMP_ENDPOINT = "https://www.ratemyprofessors.com/graphql";
  const RMP_AUTH = "Basic dGVzdDp0ZXN0";
  const FETCH_TIMEOUT_MS = 8000;
  const MAX_ATTEMPTS = 3;

  function rmpLog(event, detail) {
    console.log("[ass:rmp]", event, detail ?? "");
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function cleanName(value) {
    return (value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z\-'\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function nameParts(value) {
    return cleanName(value).split(/[\s\-]+/).filter(Boolean);
  }

  function buildSearchTerms(lastName, firstInitial) {
    const raw = (lastName || "").trim();
    if (!raw) {
      return [];
    }

    const initial = (firstInitial || "").trim().toUpperCase();
    const terms = new Set();
    const lastWord = raw.split(/\s+/).pop();
    const hyphenPieces = lastWord.split("-").filter(Boolean);

    const add = (piece) => {
      if (!piece) {
        return;
      }
      terms.add(piece);
      if (initial) {
        terms.add(`${initial} ${piece}`);
      }
    };

    add(raw);
    add(lastWord);
    hyphenPieces.forEach(add);
    if (hyphenPieces.length > 1) {
      add(hyphenPieces.join(" "));
      add(hyphenPieces.join(""));
    }

    return [...terms];
  }

  function pickTeacher(candidates, lastName, firstInitial) {
    const wantedParts = nameParts(lastName);
    const wantedInitial = (firstInitial || "").trim().toUpperCase();
    if (!wantedParts.length) {
      return null;
    }

    for (const teacher of candidates) {
      const teacherParts = nameParts(teacher.lastName);
      const sharesPart = wantedParts.some((part) => teacherParts.includes(part));
      const initialOk =
        !wantedInitial ||
        (teacher.firstName || "").toUpperCase().startsWith(wantedInitial);
      if (sharesPart && initialOk) {
        return teacher;
      }
    }
    return null;
  }

  function teacherFromNode(node) {
    if (!node) {
      return null;
    }
    const wouldTake =
      typeof node.wouldTakeAgainPercentRounded === "number"
        ? Math.round(node.wouldTakeAgainPercentRounded)
        : null;
    return {
      name: `${node.firstName || ""} ${node.lastName || ""}`.trim(),
      rating: node.avgRating,
      difficulty: node.avgDifficulty,
      wouldTakeAgainPercent: wouldTake,
      reviewCount: node.numRatings,
      profileUrl: node.legacyId
        ? `https://www.ratemyprofessors.com/professor/${node.legacyId}`
        : null,
    };
  }

  async function queryTeachers(searchText, schoolId, signal) {
    const response = await fetch(RMP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: RMP_AUTH,
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({
        query: `
          query TeacherSearch($query: TeacherSearchQuery!, $count: Int) {
            newSearch {
              teachers(query: $query, first: $count) {
                edges {
                  node {
                    firstName
                    lastName
                    avgRating
                    avgDifficulty
                    numRatings
                    wouldTakeAgainPercentRounded
                    legacyId
                  }
                }
              }
            }
          }
        `,
        variables: {
          query: { text: searchText, schoolID: schoolId },
          count: 50,
        },
      }),
      signal,
    });

    if (response.status === 429) {
      throw new Error("rate_limited");
    }
    if (!response.ok) {
      throw new Error(`http_${response.status}`);
    }

    const payload = await response.json();
    const edges = payload?.data?.newSearch?.teachers?.edges || [];
    return edges.map((edge) => edge?.node).filter(Boolean);
  }

  async function queryWithRetry(searchText, schoolId) {
    let attempt = 0;
    while (attempt < MAX_ATTEMPTS) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const teachers = await queryTeachers(searchText, schoolId, controller.signal);
        clearTimeout(timer);
        return teachers;
      } catch (error) {
        clearTimeout(timer);
        const retryable =
          error?.name === "AbortError" || String(error?.message).includes("rate_limited");
        if (retryable && attempt < MAX_ATTEMPTS) {
          await sleep(400 * attempt);
          continue;
        }
        throw error;
      }
    }
    return [];
  }

  async function lookupProfessor(lastName, firstInitial, config) {
    const schoolId = config.rmpSchoolId || "U2Nob29sLTEwNzM=";
    const terms = buildSearchTerms(lastName, firstInitial);

    for (const term of terms) {
      const teachers = await queryWithRetry(term, schoolId);
      const match = pickTeacher(teachers, lastName, firstInitial);
      if (match) {
        const professor = teacherFromNode(match);
        if (
          professor &&
          professor.rating != null &&
          Number(professor.reviewCount) > 0
        ) {
          return { ok: true, professor };
        }
      }
    }

    return { ok: false, reason: "not_found" };
  }

  async function handleLookup(message, sendResponse, loadConfig) {
    const lastName = (message.lastName || "").trim();
    const firstInitial = (message.firstInitial || "").trim();

    if (!lastName || /^staff$/i.test(lastName) || /(^|\s)staff(\s|$)/i.test(lastName)) {
      sendResponse({ ok: false, reason: "skipped" });
      return;
    }

    try {
      const config = await loadConfig();
      const result = await lookupProfessor(lastName, firstInitial, config);
      sendResponse(result);
    } catch (error) {
      rmpLog("lookup_failed", { error: String(error) });
      sendResponse({ ok: false, reason: "error", error: String(error) });
    }
  }

  self.ASS_RMP = { handleLookup };
})();
