#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-/opt/kioti-case-dashboard}"

echo "▶ Deploying Kioti Case Dashboard"
echo "  Path : $PROJECT_DIR"
echo "  Time : $(date -u '+%Y-%m-%d %H:%M UTC')"
echo ""

cd "$PROJECT_DIR"

echo "[1/3] git pull origin main"
git pull origin main

echo ""
echo "[2/3] docker compose up -d --build --remove-orphans"
docker compose up -d --build --remove-orphans

echo ""
echo "[3/3] Pruning unused Docker images"
docker image prune -f

echo ""
echo "✅ Deploy complete — $(git rev-parse --short HEAD)"
