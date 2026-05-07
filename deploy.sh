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

  # nginx가 80 포트를 점유 중이면 certbot standalone이 실패하므로 일시 중지
  docker compose -f docker-compose.prod.yml stop nginx 2>/dev/null || true

  DOMAIN=$(grep '^DOMAIN=' .env.prod | cut -d= -f2)
  sudo certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos -m godkor200@gmail.com
  sudo cp /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem nginx/certs/
  sudo cp /etc/letsencrypt/live/"$DOMAIN"/privkey.pem nginx/certs/
  sudo chmod 644 nginx/certs/*.pem
fi

echo "==> Nginx 설정 선택 (인증서 존재 여부 기준)"
if [ -f nginx/certs/fullchain.pem ] && [ -f nginx/certs/privkey.pem ]; then
  export NGINX_CONF=./nginx/nginx.conf
  echo "INFO: HTTPS 모드 (nginx/nginx.conf)"
else
  export NGINX_CONF=./nginx/nginx.http.conf
  echo "WARN: 인증서 없음 — HTTP 모드로 실행"
fi

echo "==> Docker 이미지 빌드 및 실행"
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo "==> nginx 재시작 (upstream IP 갱신)"
docker compose -f docker-compose.prod.yml --env-file .env.prod restart nginx

echo "==> 완료. 로그 확인: docker compose -f docker-compose.prod.yml logs -f"
