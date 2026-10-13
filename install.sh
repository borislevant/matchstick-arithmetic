#!/bin/sh
set -eu

npm ci --include=dev --no-audit --no-fund
npm run build
npm prune --omit=dev --no-audit --no-fund
