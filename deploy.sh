#!/bin/sh
# Stock Pile 1차 배포 스크립트
# Oracle Cloud ARM A1 (Ubuntu 22.04) 기준
set -e

echo "==> .env.prod 확인"
if [ ! -f .env.prod ]; then
  echo "ERROR: .env.prod 파일이 없습니다. .env.prod.example 을 복사해서 작성하세요."
  exit 1
fi

echo "==> SSL 인증서 확인"
if [ ! -f nginx/certs/fullchain.pem ]; then
  echo "INFO: SSL 인증서 없음 — Let's Encrypt로 발급합니다."
  mkdir -p nginx/certs
  # certbot standalone으로 발급 (80 포트가 비어 있어야 함)
  DOMAIN=$(grep DOMAIN .env.prod | cut -d= -f2)
  sudo certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos -m admin@"$DOMAIN"
  sudo cp /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem nginx/certs/
  sudo cp /etc/letsencrypt/live/"$DOMAIN"/privkey.pem nginx/certs/
  sudo chmod 644 nginx/certs/*.pem
fi

echo "==> Docker 이미지 빌드 및 실행"
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo "==> 완료. 로그 확인: docker compose -f docker-compose.prod.yml logs -f"
