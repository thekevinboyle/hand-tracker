#!/usr/bin/env bash
# check-headers.sh — verify security headers on a running preview/Vercel host.
# Usage: bash scripts/check-headers.sh [base-url]
# Exits non-zero if any required header is missing.
set -euo pipefail
BASE="${1:-http://localhost:4173}"
fail=0

check() {
  local path="$1"
  shift
  local headers
  headers=$(curl -sI "${BASE}${path}")
  for h in "$@"; do
    if ! grep -iq "^${h}" <<<"$headers"; then
      echo "MISSING: ${path} -> ${h}" >&2
      fail=1
    else
      echo "OK:      ${path} -> ${h}"
    fi
  done
}

check "/" \
  "cross-origin-opener-policy: same-origin" \
  "cross-origin-embedder-policy: require-corp" \
  "content-security-policy:" \
  "permissions-policy:" \
  "referrer-policy:"
check "/models/hand_landmarker.task" \
  "content-type:" \
  "cross-origin-opener-policy:"
check "/wasm/vision_wasm_internal.wasm" \
  "content-type: application/wasm"

exit $fail
