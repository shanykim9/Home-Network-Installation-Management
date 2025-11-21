#!/bin/bash
# Azure 서버 Nginx 설정 수정 스크립트

echo "=== Azure 서버 Nginx 설정 수정 시작 ==="

# 1. 백업 생성
echo "1. 기존 설정 백업 중..."
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)
echo "   ✅ 백업 완료"

# 2. hn.conf 내용을 Nginx 설정에 적용
echo "2. hn.conf 내용 적용 중..."
sudo tee /etc/nginx/sites-available/hn-app > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    # 프런트엔드 정적 파일 경로 (index.html이 여기 있어야 합니다)
    root /home/azureadmin/apps/hn_install/Home-Network-Installation-Management/frontend;
    index index.html;

    # 정적 파일 우선 처리 (js, css, images 등)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 백엔드 API는 Gunicorn(Flask)으로 직접 프록시 (AWS와 동일)
    location ~ ^/(auth|sites|export|users|admin|contacts-master|check-project-no|uploads) {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA 라우팅: 존재하지 않는 경로는 index.html로
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

echo "   ✅ 설정 파일 작성 완료"

# 2-1. sites-enabled에 심볼릭 링크 생성
echo "2-1. sites-enabled에 심볼릭 링크 생성 중..."
if [ -L /etc/nginx/sites-enabled/default ]; then
    sudo rm /etc/nginx/sites-enabled/default
fi
if [ -L /etc/nginx/sites-enabled/hn-app ]; then
    sudo rm /etc/nginx/sites-enabled/hn-app
fi
sudo ln -s /etc/nginx/sites-available/hn-app /etc/nginx/sites-enabled/hn-app
echo "   ✅ 심볼릭 링크 생성 완료"

# 3. Nginx 설정 테스트
echo "3. Nginx 설정 테스트 중..."
if sudo nginx -t; then
    echo "   ✅ Nginx 설정 테스트 성공"
else
    echo "   ❌ Nginx 설정 테스트 실패!"
    echo "   백업 파일에서 복원하세요:"
    echo "   sudo cp /etc/nginx/sites-available/default.backup.* /etc/nginx/sites-available/default"
    echo "   sudo rm /etc/nginx/sites-enabled/hn-app"
    echo "   sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default"
    exit 1
fi

# 4. Nginx 재시작
echo "4. Nginx 재시작 중..."
sudo systemctl restart nginx

if sudo systemctl is-active --quiet nginx; then
    echo "   ✅ Nginx 재시작 성공"
else
    echo "   ❌ Nginx 재시작 실패!"
    echo "   로그 확인: sudo journalctl -u nginx -n 50 --no-pager"
    exit 1
fi

echo ""
echo "=== Nginx 설정 수정 완료 ==="
echo ""
echo "다음 단계:"
echo "1. 브라우저에서 강력 새로고침 (Ctrl + F5)"
echo "2. 로그인 테스트"
echo "3. 문제가 있으면 로그 확인:"
echo "   sudo journalctl -u nginx -n 50 --no-pager"
echo "   sudo journalctl -u hn-backend -n 50 --no-pager"

