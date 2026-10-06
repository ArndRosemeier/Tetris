#!/usr/bin/env bash
#
# publish.sh — build Tetris for its subpath and publish it to the apps host.
#
# The app is served from https://apps.futuremagic.de/Tetris/ , which is the PUBLIC host
# described by the `apps-publish` skill. This script encodes that skill's procedure for
# THIS app so nobody hand-rolls a deploy:
#
#   1. build with the subpath base (TETRIS_BASE=/Tetris/) — a root-absolute build served
#      under a subpath renders a BLANK page, and nothing downstream catches it;
#   2. PROVE the built entry actually carries the subpath, rather than trusting the config;
#   3. publish by SYMLINK, so every later rebuild goes live with no copy step;
#   4. verify BY CONTENT against the local origin (which bypasses the CDN): the served
#      entry must reference the SAME hashed asset this build just wrote, and that asset
#      must be fetchable. A 200 proves nothing — a stale copy answers 200 too;
#   5. refresh the hub, because the hub's card grid is generated at BUILD time from the
#      apps root, so a new app stays invisible there until it is rebuilt.
#
# EXIT CODES
#   0 = published and verified against the local origin, and the hub was refreshed
#   1 = failed; a partial state is reported loudly, never smoothed over
#
# Usage:
#   bash scripts/publish.sh                  # the whole job
#   PUBLISH_SKIP_HUB=1 bash scripts/publish.sh   # the app only (no hub rebuild)
#
# Env:
#   APPS_ROOT_DIR   the directory the static host serves   [$HOME/apps]
#   LOCAL_ORIGIN    the local origin that bypasses the CDN [http://127.0.0.1:8082]
#   PUBLISH_SLUG    the URL path segment                   [Tetris]

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLUG="${PUBLISH_SLUG:-Tetris}"
APPS_ROOT="${APPS_ROOT_DIR:-$HOME/apps}"
TARGET="$APPS_ROOT/$SLUG"
LOCAL_ORIGIN="${LOCAL_ORIGIN:-http://127.0.0.1:8082}"
BASE="/$SLUG/"
PROJECT="${REPO##*/}"

echo "=== publish $PROJECT -> $LOCAL_ORIGIN/$SLUG/ ==="
echo "repo   = $REPO"
echo "target = $TARGET"
echo "base   = $BASE"
echo

# --- 1. build, with the subpath base --------------------------------------------
echo "--- 1. build with TETRIS_BASE=$BASE ---"
if ! (cd "$REPO" && TETRIS_BASE="$BASE" pnpm run build); then
  echo "FAILED: the build failed — nothing was published" >&2
  exit 1
fi

if [ ! -f "$REPO/dist/index.html" ]; then
  echo "FAILED: dist/index.html is missing after a successful build" >&2
  exit 1
fi

# --- 2. prove the subpath is in the built entry ---------------------------------
# The skill's blank-page trap: a root-absolute build served under a subpath renders
# nothing. Assert the fact, do not infer it from the config.
echo
echo "--- 2. does the built entry carry the subpath? ---"
if ! grep -q "/$SLUG/assets/" "$REPO/dist/index.html"; then
  echo "FAILED: dist/index.html does not reference /$SLUG/assets/ — it was built for the root," >&2
  echo "        and would render a BLANK page at $LOCAL_ORIGIN/$SLUG/. Nothing published." >&2
  grep -o 'assets/[^"]*' "$REPO/dist/index.html" | head -5 >&2
  exit 1
fi
ENTRY_HTML_HASH="$(grep -o "assets/[^\"]*\.js" "$REPO/dist/index.html" | head -1)"
echo "built entry references: $ENTRY_HTML_HASH"

# --- 3. publish by symlink ------------------------------------------------------
# Resolve the target FIRST. If it is a symlink it points into some other root, and a
# copy would write THROUGH the link. A symlink to our own dist is the intended state.
if [ -e "$TARGET" ] && [ ! -L "$TARGET" ]; then
  echo "FAILED: $TARGET exists and is NOT a symlink." >&2
  echo "        Refusing to overwrite a real directory — inspect it, resolve it by hand." >&2
  exit 1
fi
echo
echo "--- 3. publish (symlink so rebuilds go live) ---"
ln -sfn "$REPO/dist" "$TARGET"
echo "linked: $TARGET -> $(readlink -f "$TARGET")"

# --- 4. verify BY CONTENT, against the local origin -----------------------------
echo
echo "--- 4. verify by content against the local origin (bypasses the CDN) ---"
SERVED="$(mktemp)"
trap 'rm -f "$SERVED"' EXIT
CODE="$(curl -sS --max-time 10 -o "$SERVED" -w '%{http_code}' "$LOCAL_ORIGIN/$SLUG/" 2>/dev/null)" || CODE="000"
echo "HTTP $CODE from $LOCAL_ORIGIN/$SLUG/"
if [ "$CODE" != "200" ]; then
  echo "FAILED: expected 200, got $CODE. Is the static host running on that port?" >&2
  exit 1
fi

SERVED_HASH="$(grep -o "assets/[^\"]*\.js" "$SERVED" | head -1)"
echo "served entry references: $SERVED_HASH"
if [ "$SERVED_HASH" != "$ENTRY_HTML_HASH" ]; then
  echo "FAILED: the SERVED page references a different asset than this build wrote." >&2
  echo "        built=$ENTRY_HTML_HASH served=$SERVED_HASH — this is a STALE publish." >&2
  exit 1
fi

ASSET_CODE="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "$LOCAL_ORIGIN/$SLUG/$ENTRY_HTML_HASH" 2>/dev/null)" || ASSET_CODE="000"
echo "HTTP $ASSET_CODE for $SLUG/$ENTRY_HTML_HASH"
if [ "$ASSET_CODE" != "200" ]; then
  echo "FAILED: the hashed asset is not fetchable ($ASSET_CODE) — relative resolution is broken" >&2
  exit 1
fi
echo "VERIFIED: the served entry is THIS build and its asset resolves."

# --- 5. refresh the hub ---------------------------------------------------------
# The hub's cards are generated at BUILD time from the apps root, so without this the
# new app is live but INVISIBLE on https://apps.futuremagic.de/ .
if [ "${PUBLISH_SKIP_HUB:-0}" = "1" ]; then
  echo
  echo "SKIPPED the hub refresh (PUBLISH_SKIP_HUB=1). The app is live; its hub card may be MISSING."
else
  HUB="$HOME/projects/futuremagic/scripts/publish-apps-root.sh"
  echo
  echo "--- 5. refresh the hub ($HUB) ---"
  if [ ! -f "$HUB" ]; then
    echo "NOTE: no hub script at $HUB — this host has no hub; nothing to refresh."
  elif ! bash "$HUB"; then
    echo "FAILED: the app IS published, but the HUB REFRESH FAILED." >&2
    echo "        The app is live at $LOCAL_ORIGIN/$SLUG/ ; its hub card may be stale or missing." >&2
    echo "        Fix forward: re-run $HUB" >&2
    exit 1
  fi
fi

echo
echo "PUBLISHED: $ENTRY_HTML_HASH"
echo "  public URL: https://apps.futuremagic.de/$SLUG/"
exit 0
