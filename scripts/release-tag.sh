#!/usr/bin/env bash
# Create a version tag, push it, and publish a GitHub release on `releases`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

usage() {
  cat <<'EOF'
Usage: scripts/release-tag.sh VERSION [DESCRIPTION]

  VERSION      Semver without leading v (e.g. 2.1.0)
  DESCRIPTION  Git tag message and GitHub release notes (optional)

Examples:
  scripts/release-tag.sh 2.1.0
  scripts/release-tag.sh 2.1.1 "Fix registration timing edge case"

Requires: git, gh (authenticated), on branch `releases` recommended.
EOF
  exit 1
}

[[ $# -ge 1 ]] || usage

RAW="${1#v}"
TAG="v${RAW}"
shift || true

if [[ ! "$RAW" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
  echo "error: VERSION must look like 2.1.0 or 2.1.0-beta.1 (got: ${RAW})" >&2
  exit 1
fi

DESC="${*:-}"
if [[ -z "$DESC" ]]; then
  if [[ -t 0 ]]; then
    read -r -p "Release description: " DESC
  fi
  DESC="${DESC:-Release ${TAG}}"
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI not found (https://cli.github.com/)" >&2
  exit 1
fi

MANIFEST_VER="$(grep -E '"version"' manifest.json | head -1 | sed -E 's/.*"version": "([^"]+)".*/\1/')"
if [[ "$MANIFEST_VER" != "$RAW" ]]; then
  echo "warning: manifest.json version is ${MANIFEST_VER}, tagging ${TAG}" >&2
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "releases" ]]; then
  echo "warning: not on releases branch (on ${BRANCH})" >&2
fi

GITHUB_REPO="$(git remote get-url origin 2>/dev/null | sed -E 's#.*github\.com[:/]([^/]+/[^/.]+)(\.git)?$#\1#')"
if [[ -z "$GITHUB_REPO" ]]; then
  echo "error: could not parse owner/repo from git remote origin" >&2
  exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "tag ${TAG} already exists locally; skipping git tag" >&2
else
  git tag -a "$TAG" -m "$DESC"
  git push origin "$TAG"
fi

gh release create "$TAG" \
  --repo "$GITHUB_REPO" \
  --title "$TAG" \
  --notes "$DESC" \
  --target releases

echo "Created and pushed ${TAG}; GitHub release published on releases."
