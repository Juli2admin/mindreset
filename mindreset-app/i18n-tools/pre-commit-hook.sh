#!/usr/bin/env bash
#
# pre-commit-hook.sh — i18n parity gate
#
# Runs `npm run i18n:check` from mindreset-app/ before every commit.
# Blocks the commit if any locale bundle drifts from en.json's key
# structure. Repair drift with `npm run i18n:sync` (mechanical EN→
# placeholder propagation) before re-committing.
#
# Installation (run once, from repo root):
#   ln -sf ../../mindreset-app/i18n-tools/pre-commit-hook.sh .git/hooks/pre-commit
#   chmod +x mindreset-app/i18n-tools/pre-commit-hook.sh
#
# The hook only runs when at least one staged file is a messages/*.json
# bundle — commits that touch unrelated files are unaffected.
#
# To bypass for a specific commit (use sparingly — drift on main breaks
# Vercel pre-build):
#   git commit --no-verify
#

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
APP_DIR="$REPO_ROOT/mindreset-app"

# Only run if a messages bundle is staged in this commit.
if ! git diff --cached --name-only | grep -q "^mindreset-app/messages/.*\.json$"; then
  exit 0
fi

cd "$APP_DIR"

echo "[pre-commit] messages bundle staged — running i18n:check..."
if ! npm run --silent i18n:check; then
  echo ""
  echo "[pre-commit] BLOCKED — locale bundles drifted from en.json key structure."
  echo "[pre-commit] Repair with: cd mindreset-app && npm run i18n"
  echo "[pre-commit] (sync + check chained). Then re-stage and re-commit."
  exit 1
fi
echo "[pre-commit] i18n:check OK."
