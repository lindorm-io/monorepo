#!/usr/bin/env bash
#
# Test the local create-pylon CLI without publishing.
#
# Usage:
#   scripts/create-pylon-local.sh <project-name> [extra-cli-args]
#
# Run from the directory you want the project created in (e.g.
# ~/Projects/lindorm-services/services). The script:
#
#   1. Builds all lindorm packages create-pylon depends on (and the runtime
#      packages a scaffolded service pulls in), so dist/ is current.
#   2. Invokes packages/create-pylon/dist/cli.js from the caller's CWD, so
#      generated files land where you expect.
#   3. Packs each runtime lindorm package and extracts it over the scaffolded
#      project's node_modules/@lindorm/* — the install step inside the CLI
#      pulled the published versions from npm; this swaps them for local
#      builds so `npm run dev` exercises your in-flight changes.
#
# Pass --no-override to skip step 3 if you only want to test scaffold output.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
USER_CWD="$(pwd)"

# Runtime lindorm packages that a scaffolded service may install. Keep this
# in sync with BASE_RUNTIME_DEPENDENCIES + transitive lindorm deps in
# packages/create-pylon/src/types.ts.
RUNTIME_PKGS=(
  amphora
  config
  errors
  iris
  kryptos
  logger
  proteus
  pylon
  types
  worker
)

# Build-time only — create-pylon itself, plus its compile-time lindorm deps
# so its dist/ resolves correctly when invoked.
BUILD_PKGS=(
  case
  iris
  kryptos
  logger
  proteus
  types
  create-pylon
)

OVERRIDE=true
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --no-override) OVERRIDE=false ;;
    *) ARGS+=("$arg") ;;
  esac
done

if [[ ${#ARGS[@]} -lt 1 ]]; then
  echo "usage: $(basename "$0") <project-name> [--no-override] [extra-cli-args]" >&2
  exit 64
fi

PROJECT_NAME="${ARGS[0]}"

echo "[create-pylon-local] Building local lindorm packages..."
(
  cd "$ROOT"
  for pkg in "${BUILD_PKGS[@]}"; do
    npm -w "@lindorm/$pkg" run build --silent
  done
)

cd "$USER_CWD"
echo "[create-pylon-local] Running local create-pylon in $USER_CWD..."
node "$ROOT/packages/create-pylon/dist/cli.js" "${ARGS[@]}"

PROJECT_DIR="$USER_CWD/$PROJECT_NAME"
if [[ ! -d "$PROJECT_DIR" ]]; then
  echo "[create-pylon-local] Project dir $PROJECT_DIR not found; skipping override." >&2
  exit 0
fi

if [[ "$OVERRIDE" != "true" ]]; then
  echo "[create-pylon-local] --no-override set; leaving npm-installed deps in place."
  exit 0
fi

# Build runtime packages too (some overlap with BUILD_PKGS, but cheap if
# already built) so the tarball reflects current source.
echo "[create-pylon-local] Building runtime lindorm packages..."
(
  cd "$ROOT"
  for pkg in "${RUNTIME_PKGS[@]}"; do
    npm -w "@lindorm/$pkg" run build --silent
  done
)

TARBALL_DIR="$(mktemp -d)"
trap 'rm -rf "$TARBALL_DIR"' EXIT

echo "[create-pylon-local] Packing tarballs into $TARBALL_DIR..."
for pkg in "${RUNTIME_PKGS[@]}"; do
  (cd "$ROOT/packages/$pkg" && npm pack --pack-destination "$TARBALL_DIR" --silent >/dev/null)
done

# Locate every node_modules/@lindorm/<pkg> directory walking up from the
# project. If the project is itself inside an npm workspace (e.g.
# lindorm-services/services/<svc>) deps are hoisted to the workspace root,
# so the package may live one or more directories above the scaffolded
# project rather than directly under it.
locate_install_dirs() {
  local pkg=$1
  local dir=$PROJECT_DIR
  while :; do
    local candidate="$dir/node_modules/@lindorm/$pkg"
    if [[ -d "$candidate" ]]; then
      echo "$candidate"
    fi
    local parent
    parent=$(dirname "$dir")
    if [[ "$parent" == "$dir" ]]; then
      break
    fi
    dir=$parent
  done
}

echo "[create-pylon-local] Overlaying local tarballs onto installed @lindorm/* (searching up from $PROJECT_DIR)..."
for pkg in "${RUNTIME_PKGS[@]}"; do
  TARBALL=$(ls "$TARBALL_DIR"/lindorm-"$pkg"-*.tgz 2>/dev/null | head -1 || true)
  if [[ -z "$TARBALL" ]]; then
    echo "  skip @lindorm/$pkg (no tarball — package may not be published-shaped)" >&2
    continue
  fi
  OVERLAID=false
  while IFS= read -r TARGET; do
    [[ -z "$TARGET" ]] && continue
    rm -rf "$TARGET"
    mkdir -p "$TARGET"
    tar -xzf "$TARBALL" -C "$TARGET" --strip-components=1
    echo "  overlaid @lindorm/$pkg -> $TARGET"
    OVERLAID=true
  done < <(locate_install_dirs "$pkg")
  if [[ "$OVERLAID" != "true" ]]; then
    # Not installed anywhere up the tree — nothing to override.
    continue
  fi
done

echo "[create-pylon-local] Done. cd $PROJECT_DIR && npm run dev"
