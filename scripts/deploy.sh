#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-/opt/kioti-case-dashboard}"

echo "▶ Deploying Kioti Case Dashboard"
echo "  Path : $PROJECT_DIR"
echo "  Time : $(date -u '+%Y-%m-%d %H:%M UTC')"
echo ""

cd "$PROJECT_DIR"

echo "[1/4] git pull origin main"
git pull origin main

echo ""
echo "[2/4] Ensuring external Docker resources exist"
docker network inspect kioti-network >/dev/null 2>&1 \
  || docker network create kioti-network
docker volume inspect kioti_postgres_data >/dev/null 2>&1 \
  || docker volume create kioti_postgres_data

echo ""
echo "[3/4] docker compose up -d --build --remove-orphans"
docker compose up -d --build --remove-orphans

echo ""
echo "[4/4] Pruning unused Docker images"
docker image prune -f

echo ""
echo "✅ Deploy complete — $(git rev-parse --short HEAD)"
