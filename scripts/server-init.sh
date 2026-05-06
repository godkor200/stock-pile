#!/bin/bash
# 서버 최초 1회 실행 — Docker 설치 + 코드 클론 + .env.prod 작성
set -e

REPO_URL="${1:?'Usage: server-init.sh <git-repo-url>'}"

echo "==> Docker 설치"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo "Docker 설치 완료. 그룹 반영을 위해 재접속 후 다시 실행하세요."
  exit 0
fi

echo "==> 코드 클론"
if [ ! -d ~/stock-pile ]; then
  git clone "$REPO_URL" ~/stock-pile
fi
cd ~/stock-pile

echo "==> .env.prod 작성"
if [ ! -f .env.prod ]; then
  cp .env.prod.example .env.prod

  # JWT_SECRET 자동 생성
  JWT=$(openssl rand -hex 32)
  sed -i "s/CHANGE_ME_RANDOM_64_CHARS/$JWT/" .env.prod

  echo ""
  echo "==> .env.prod 파일을 열어 아래 항목을 채우세요:"
  echo "    POSTGRES_PASSWORD  — 강력한 비밀번호"
  echo "    GROQ_API_KEY       — https://console.groq.com"
  echo "    NEXT_PUBLIC_JOURNAL_URL — http://\$(curl -s ifconfig.me)/api/journal"
  echo "    NEXT_PUBLIC_REPORT_URL  — http://\$(curl -s ifconfig.me)/api/report"
  echo ""
  echo "편집: nano .env.prod"
  echo "완료 후: bash scripts/server-init.sh (다시 실행하면 배포 시작)"
  exit 0
fi

echo "==> 배포 시작"
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo ""
echo "==> 완료!"
SERVER_IP=$(curl -s ifconfig.me)
echo "접속 주소: http://$SERVER_IP"
echo "로그 확인: docker compose -f docker-compose.prod.yml logs -f"
