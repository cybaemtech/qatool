#!/usr/bin/env bash
# post-merge.sh — runs automatically after a task-agent merge.
# Installs dependencies and pushes the DB schema.
set -e

echo "[post-merge] Installing dependencies..."
pnpm install

echo "[post-merge] Pushing DB schema..."
pnpm --filter @workspace/db run push

echo "[post-merge] Done."
