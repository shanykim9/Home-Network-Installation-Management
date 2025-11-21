#!/bin/bash
# 백엔드 서버 상태 확인 및 재시작 스크립트

echo "=== 백엔드 서버 상태 확인 ==="
echo ""

# 1. Systemd 서비스 상태 확인
echo "1. Systemd 서비스 상태:"
sudo systemctl status hn-backend.service --no-pager -l | head -20
echo ""

# 2. 포트 8000 사용 확인
echo "2. 포트 8000 사용 확인:"
if sudo netstat -tlnp | grep :8000 || sudo ss -tlnp | grep :8000; then
    echo "✅ 포트 8000에서 프로세스가 실행 중입니다."
else
    echo "❌ 포트 8000에서 실행 중인 프로세스가 없습니다."
fi
echo ""

# 3. 최근 로그 확인
echo "3. 최근 에러 로그 (마지막 30줄):"
sudo journalctl -u hn-backend.service -n 30 --no-pager
echo ""

# 4. 서비스 재시작 옵션
echo "=== 서비스 재시작 방법 ==="
echo "다음 명령어로 서비스를 재시작할 수 있습니다:"
echo "  sudo systemctl restart hn-backend.service"
echo ""
echo "서비스를 재시작하시겠습니까? (y/n)"
read -r answer
if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    echo "서비스를 재시작합니다..."
    sudo systemctl restart hn-backend.service
    sleep 2
    echo ""
    echo "재시작 후 상태:"
    sudo systemctl status hn-backend.service --no-pager -l | head -15
fi

