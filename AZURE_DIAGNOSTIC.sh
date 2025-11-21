#!/bin/bash
# Azure 서버 진단 스크립트

echo "=== Azure 서버 진단 시작 ==="
echo ""

# 1. Nginx 설정 확인
echo "1. Nginx 설정 확인:"
if sudo grep -q "location ~ \^/(auth|sites" /etc/nginx/sites-available/default 2>/dev/null; then
    echo "   ✅ Nginx API 라우팅 설정 존재"
    echo "   설정 내용:"
    sudo grep -A 5 "location ~ \^/(auth|sites" /etc/nginx/sites-available/default | head -10
else
    echo "   ❌ Nginx API 라우팅 설정 없음!"
    echo "   hn.conf 파일을 적용해야 합니다."
fi
echo ""

# 2. Nginx 상태 확인
echo "2. Nginx 상태:"
if sudo systemctl is-active --quiet nginx; then
    echo "   ✅ Nginx 실행 중"
else
    echo "   ❌ Nginx 중지됨!"
fi
echo ""

# 3. 백엔드 서비스 상태
echo "3. 백엔드 서비스 상태:"
if sudo systemctl is-active --quiet hn-backend; then
    echo "   ✅ 백엔드 서비스 실행 중"
else
    echo "   ❌ 백엔드 서비스 중지됨!"
fi
echo ""

# 4. 포트 8000 확인
echo "4. 포트 8000 확인:"
if sudo netstat -tlnp 2>/dev/null | grep -q ":8000" || sudo ss -tlnp 2>/dev/null | grep -q ":8000"; then
    echo "   ✅ 포트 8000 리스닝 중"
    sudo netstat -tlnp 2>/dev/null | grep ":8000" || sudo ss -tlnp 2>/dev/null | grep ":8000"
else
    echo "   ❌ 포트 8000 리스닝 안 됨!"
    echo "   백엔드 서비스가 실행되지 않았습니다."
fi
echo ""

# 5. auth.js 파일 확인
echo "5. auth.js 파일 확인:"
if [ -f "/home/azureadmin/apps/hn_install/Home-Network-Installation-Management/frontend/js/auth.js" ]; then
    if grep -q "API_BASE_URL = ''" /home/azureadmin/apps/hn_install/Home-Network-Installation-Management/frontend/js/auth.js; then
        echo "   ✅ API_BASE_URL 설정 정상 (빈 문자열)"
    else
        echo "   ❌ API_BASE_URL 설정 문제!"
        echo "   현재 설정:"
        grep "API_BASE_URL" /home/azureadmin/apps/hn_install/Home-Network-Installation-Management/frontend/js/auth.js | head -1
    fi
else
    echo "   ❌ auth.js 파일을 찾을 수 없음!"
fi
echo ""

# 6. 백엔드 로그 확인 (최근 에러)
echo "6. 백엔드 최근 로그 (에러만):"
sudo journalctl -u hn-backend -n 20 --no-pager | grep -i error || echo "   에러 없음"
echo ""

# 7. Nginx 로그 확인 (최근 에러)
echo "7. Nginx 최근 로그 (에러만):"
sudo tail -20 /var/log/nginx/error.log 2>/dev/null | grep -i error || echo "   에러 없음"
echo ""

# 8. 로컬 테스트 (백엔드 직접 접속)
echo "8. 백엔드 직접 접속 테스트:"
if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/auth/login -X POST -H "Content-Type: application/json" -d '{}' | grep -q "40[04]"; then
    echo "   ✅ 백엔드 응답 중 (400/404는 정상 - 인증 실패이지만 서버는 작동 중)"
else
    echo "   ❌ 백엔드에 접속할 수 없음!"
fi
echo ""

echo "=== 진단 완료 ==="
echo ""
echo "문제 해결 순서:"
echo "1. Nginx 설정이 없으면: sudo cp hn.conf /etc/nginx/sites-available/default && sudo nginx -t && sudo systemctl restart nginx"
echo "2. 백엔드 서비스가 중지되었으면: sudo systemctl restart hn-backend"
echo "3. 포트 8000이 리스닝 안 되면: sudo systemctl status hn-backend 확인"

