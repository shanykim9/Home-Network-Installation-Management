# 통합 배포 가이드 (Azure & AWS 동일 코드 사용)

## ✅ 좋은 소식: 대부분의 코드는 완전히 동일합니다!

현재 코드는 **Azure와 AWS에서 거의 동일하게 사용**할 수 있습니다. 차이점은 **경로 설정 파일**뿐입니다.

## 📁 코드 호환성 분석

### ✅ 완전히 동일한 파일 (그대로 사용)

**백엔드 코드:**
- `backend/app.py` ✅ (경로 자동 감지)
- `backend/auth.py` ✅
- `backend/sites.py` ✅

**프론트엔드 코드:**
- `frontend/js/auth.js` ✅
- `frontend/js/app.js` ✅
- `frontend/js/*.js` (모든 파일) ✅

**이유:**
- 백엔드 코드는 `Path(__file__).resolve().parent`를 사용하여 자동으로 경로를 찾습니다
- 프론트엔드 코드는 상대 경로를 사용하므로 환경에 독립적입니다

### ⚠️ 경로만 다른 파일 (각 서버에서 수정 필요)

**Nginx 설정:**
- `hn.conf` - 경로만 다름
  - Azure: `/home/azureadmin/apps/hn_install/...`
  - AWS: `/home/awsuser/apps/hn_install/...` (또는 실제 경로)

**Systemd 서비스:**
- `hn-backend.service` - 경로만 다름
  - Azure: `/home/azureadmin/apps/hn_install/...`
  - AWS: `/home/awsuser/apps/hn_install/...` (또는 실제 경로)

## 🔧 통합 배포 방법

### 방법 1: 템플릿 파일 사용 (권장)

각 서버에서 경로만 수정하여 사용:

#### 1단계: Nginx 설정 (각 서버에서 경로 수정)

**Azure 서버:**
```bash
# hn.conf 파일에서 경로 확인
root /home/azureadmin/apps/hn_install/Home-Network-Installation-Management/frontend;
```

**AWS 서버:**
```bash
# hn.conf 파일에서 경로를 AWS 경로로 수정
# 예: root /home/awsuser/apps/hn_install/Home-Network-Installation-Management/frontend;
# 또는 실제 AWS 서버의 경로로 수정
```

#### 2단계: Systemd 서비스 (각 서버에서 경로 수정)

**Azure 서버:**
```ini
User=azureadmin
WorkingDirectory=/home/azureadmin/apps/hn_install/Home-Network-Installation-Management/backend
Environment="PATH=/home/azureadmin/apps/hn_install/.venv/bin"
ExecStart=/home/azureadmin/apps/hn_install/.venv/bin/gunicorn -w 3 -b 127.0.0.1:8000 app:app
```

**AWS 서버:**
```ini
User=awsuser  # 또는 실제 사용자명
WorkingDirectory=/home/awsuser/apps/hn_install/Home-Network-Installation-Management/backend
Environment="PATH=/home/awsuser/apps/hn_install/.venv/bin"
ExecStart=/home/awsuser/apps/hn_install/.venv/bin/gunicorn -w 3 -b 127.0.0.1:8000 app:app
```

### 방법 2: 범용 스크립트 사용

각 서버에서 자동으로 경로를 감지하여 설정하는 스크립트:

```bash
#!/bin/bash
# 범용 Nginx 설정 스크립트 (Azure & AWS 모두 사용 가능)

# 현재 사용자와 경로 자동 감지
CURRENT_USER=$(whoami)
PROJECT_DIR=$(pwd)
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "=== Nginx 설정 생성 (자동 경로 감지) ==="
echo "사용자: $CURRENT_USER"
echo "프로젝트 경로: $PROJECT_DIR"
echo "프론트엔드 경로: $FRONTEND_DIR"

# Nginx 설정 생성
sudo tee /etc/nginx/sites-available/hn-app > /dev/null << EOF
server {
    listen 80;
    server_name _;

    root $FRONTEND_DIR;
    index index.html;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~ ^/(auth|sites|export|users|admin|contacts-master|check-project-no|uploads) {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# 심볼릭 링크 생성
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/sites-enabled/hn-app
sudo ln -s /etc/nginx/sites-available/hn-app /etc/nginx/sites-enabled/hn-app

# Nginx 테스트 및 재시작
sudo nginx -t && sudo systemctl restart nginx
```

## 📋 통합 배포 체크리스트

### 공통 파일 (Azure & AWS 동일)

✅ **백엔드:**
- `backend/app.py`
- `backend/auth.py`
- `backend/sites.py`

✅ **프론트엔드:**
- `frontend/js/auth.js`
- `frontend/js/app.js`
- `frontend/js/*.js` (모든 파일)
- `frontend/index.html`
- `frontend/*` (모든 파일)

### 서버별 수정 필요 파일

⚠️ **Nginx 설정:**
- `hn.conf` - 경로만 수정

⚠️ **Systemd 서비스:**
- `hn-backend.service` - 경로만 수정

⚠️ **환경 변수:**
- `.env` - 각 서버마다 독립적 (하지만 구조는 동일)

## 🚀 AWS 서버 배포 가이드

### 1단계: 파일 업로드

AWS 서버에 다음 파일들을 업로드:

```
backend/
  ├── app.py          ✅ 동일
  ├── auth.py         ✅ 동일
  └── sites.py        ✅ 동일

frontend/
  └── js/
      ├── auth.js     ✅ 동일
      └── app.js      ✅ 동일
      └── *.js        ✅ 동일 (모든 파일)
```

### 2단계: Nginx 설정 (경로만 수정)

AWS 서버에서:

```bash
# 1. AWS 서버의 실제 경로 확인
pwd
# 예: /home/awsuser/apps/hn_install/Home-Network-Installation-Management

# 2. hn.conf 파일 편집 (경로만 수정)
nano hn.conf

# root 경로를 AWS 경로로 수정:
# root /home/awsuser/apps/hn_install/Home-Network-Installation-Management/frontend;
```

### 3단계: Systemd 서비스 (경로만 수정)

AWS 서버에서:

```bash
# 1. hn-backend.service 파일 편집
nano hn-backend.service

# 경로를 AWS 경로로 수정:
# User=awsuser
# WorkingDirectory=/home/awsuser/apps/hn_install/Home-Network-Installation-Management/backend
# Environment="PATH=/home/awsuser/apps/hn_install/.venv/bin"
# ExecStart=/home/awsuser/apps/hn_install/.venv/bin/gunicorn -w 3 -b 127.0.0.1:8000 app:app

# 2. 서비스 파일 복사
sudo cp hn-backend.service /etc/systemd/system/hn-backend.service

# 3. 서비스 재로드 및 재시작
sudo systemctl daemon-reload
sudo systemctl restart hn-backend
```

### 4단계: Nginx 설정 적용

```bash
# 1. Nginx 설정 파일 생성
sudo cp hn.conf /etc/nginx/sites-available/hn-app

# 2. 심볼릭 링크 생성
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/hn-app /etc/nginx/sites-enabled/hn-app

# 3. Nginx 테스트 및 재시작
sudo nginx -t
sudo systemctl restart nginx
```

### 5단계: .env 파일 확인

```bash
# .env 파일에 다음이 있는지 확인
SUPABASE_VERIFY_SSL=true
```

## ✅ 최종 확인

### Azure 서버
- [ ] 로그인 정상 작동
- [ ] 현장 사진 목록 조회 정상 작동
- [ ] Nginx 설정 적용됨
- [ ] 백엔드 서비스 실행 중

### AWS 서버
- [ ] 파일 업로드 완료
- [ ] Nginx 설정 경로 수정 완료
- [ ] Systemd 서비스 경로 수정 완료
- [ ] Nginx 재시작 완료
- [ ] 백엔드 서비스 재시작 완료
- [ ] 로그인 테스트 성공

## 🎯 요약

**동일하게 사용 가능:**
- ✅ 모든 백엔드 코드 (app.py, auth.py, sites.py)
- ✅ 모든 프론트엔드 코드 (모든 .js 파일)

**경로만 수정 필요:**
- ⚠️ Nginx 설정 (hn.conf) - root 경로만
- ⚠️ Systemd 서비스 (hn-backend.service) - 경로만

**결론:**
현재 코드는 Azure와 AWS에서 **99% 동일하게 사용**할 수 있습니다! 경로만 수정하면 됩니다.

