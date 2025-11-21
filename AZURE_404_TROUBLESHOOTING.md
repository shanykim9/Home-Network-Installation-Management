# Azure 서버 HTTP 404 에러 해결 가이드

## 🔍 문제 분석

**증상:**
- 로컬에서는 로그인 정상 작동 ✅
- Azure 서버에서만 HTTP 404 에러 발생 ❌

**가능한 원인:**
1. 프론트엔드 파일이 업데이트되지 않음
2. Nginx 설정이 적용되지 않음
3. 서비스가 재시작되지 않음
4. 브라우저 캐시 문제

## ✅ 해결 방법

### 1단계: 프론트엔드 파일 확인 및 배포

Azure 서버에 SSH 접속 후 확인:

```bash
# Azure 서버 접속
ssh azureadmin@azure-server-ip

# 프로젝트 디렉토리로 이동
cd /home/azureadmin/apps/hn_install/Home-Network-Installation-Management

# auth.js 파일 확인
cat frontend/js/auth.js | head -5
```

**확인 사항:**
- `API_BASE_URL = ''` (빈 문자열)인지 확인
- 만약 `API_BASE_URL = '/api'`로 되어 있다면 수정 필요

**수정 방법:**
```bash
# auth.js 파일 편집
nano frontend/js/auth.js

# 첫 번째 줄 확인 및 수정
# 다음과 같이 되어 있어야 함:
const API_BASE_URL = '';
```

### 2단계: Nginx 설정 확인 및 적용

```bash
# Nginx 설정 파일 확인
sudo cat /etc/nginx/sites-available/default
# 또는
sudo cat /etc/nginx/nginx.conf

# hn.conf 파일이 올바른 위치에 있는지 확인
cat /home/azureadmin/apps/hn_install/Home-Network-Installation-Management/hn.conf
```

**Nginx 설정이 올바른지 확인:**
```nginx
# 다음 내용이 있어야 함:
location ~ ^/(auth|sites|export|users|admin|contacts-master|check-project-no|uploads) {
    proxy_pass http://127.0.0.1:8000;
    ...
}
```

**Nginx 설정 적용:**
```bash
# hn.conf를 Nginx 설정 위치로 복사
sudo cp /home/azureadmin/apps/hn_install/Home-Network-Installation-Management/hn.conf /etc/nginx/sites-available/default

# 또는 기존 설정 파일에 내용 추가/수정
sudo nano /etc/nginx/sites-available/default

# Nginx 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
```

### 3단계: 백엔드 서비스 재시작

```bash
# 백엔드 서비스 상태 확인
sudo systemctl status hn-backend

# 서비스 재시작
sudo systemctl restart hn-backend

# 서비스 상태 재확인
sudo systemctl status hn-backend

# 로그 확인
sudo journalctl -u hn-backend -n 50 --no-pager
```

### 4단계: 브라우저 캐시 클리어

브라우저에서:
1. **Chrome/Edge**: `Ctrl + Shift + Delete` → 캐시 삭제
2. 또는 **시크릿 모드**로 접속 테스트
3. 또는 **강력 새로고침**: `Ctrl + F5`

## 🔧 자동 진단 스크립트

Azure 서버에서 다음 스크립트를 실행하여 문제를 진단:

```bash
#!/bin/bash
echo "=== Azure 서버 진단 시작 ==="

# 1. auth.js 파일 확인
echo "1. auth.js 파일 확인:"
if grep -q "API_BASE_URL = ''" /home/azureadmin/apps/hn_install/Home-Network-Installation-Management/frontend/js/auth.js; then
    echo "   ✅ API_BASE_URL 설정 정상"
else
    echo "   ❌ API_BASE_URL 설정 문제 발견!"
    echo "   수정 필요: const API_BASE_URL = '';"
fi

# 2. Nginx 설정 확인
echo "2. Nginx 설정 확인:"
if sudo grep -q "location ~ \^/(auth|sites" /etc/nginx/sites-available/default 2>/dev/null; then
    echo "   ✅ Nginx API 라우팅 설정 존재"
else
    echo "   ❌ Nginx API 라우팅 설정 없음!"
    echo "   hn.conf 파일을 Nginx에 적용해야 함"
fi

# 3. 백엔드 서비스 상태
echo "3. 백엔드 서비스 상태:"
if sudo systemctl is-active --quiet hn-backend; then
    echo "   ✅ 백엔드 서비스 실행 중"
else
    echo "   ❌ 백엔드 서비스 중지됨!"
fi

# 4. 포트 확인
echo "4. 포트 8000 확인:"
if sudo netstat -tlnp | grep -q ":8000"; then
    echo "   ✅ 포트 8000 리스닝 중"
else
    echo "   ❌ 포트 8000 리스닝 안 됨!"
fi

echo "=== 진단 완료 ==="
```

## 📝 체크리스트

배포 후 다음을 확인하세요:

- [ ] `frontend/js/auth.js` 파일이 `API_BASE_URL = ''`로 설정됨
- [ ] Nginx 설정에 API 라우팅 규칙이 있음
- [ ] Nginx가 재시작됨 (`sudo systemctl restart nginx`)
- [ ] 백엔드 서비스가 재시작됨 (`sudo systemctl restart hn-backend`)
- [ ] 브라우저 캐시를 클리어했음
- [ ] 시크릿 모드에서도 테스트했음

## 🚨 가장 흔한 원인

**90%의 경우:**
- 프론트엔드 파일(`frontend/js/auth.js`)이 업데이트되지 않음
- 또는 Nginx 설정이 적용되지 않음

**해결:**
1. Azure 서버에 SSH 접속
2. `frontend/js/auth.js` 파일 확인 및 수정
3. Nginx 설정 확인 및 재시작
4. 백엔드 서비스 재시작

