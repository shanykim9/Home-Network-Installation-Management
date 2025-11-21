# HTTP 502 Bad Gateway 에러 해결 가이드

## 문제 원인

**HTTP 502 Bad Gateway** 에러는 Nginx가 백엔드 Flask 서버(Gunicorn)에 연결할 수 없을 때 발생합니다.

### 주요 원인:
1. ✅ **백엔드 서버가 실행되지 않음** (가장 흔한 원인)
2. 백엔드 서버가 크래시됨
3. 백엔드 서버가 다른 포트에서 실행 중
4. 백엔드 서버 시작 시 에러 발생

## 해결 방법

### 1단계: 백엔드 서버 상태 확인

Azure 서버에 SSH로 접속한 후 다음 명령어를 실행하세요:

```bash
# 백엔드 서비스 상태 확인
sudo systemctl status hn-backend.service

# 또는 자동 확인 스크립트 사용
./CHECK_BACKEND_STATUS.sh
```

### 2단계: 에러 로그 확인

```bash
# 최근 에러 로그 확인 (마지막 50줄)
sudo journalctl -u hn-backend.service -n 50 --no-pager

# 실시간 로그 확인
sudo journalctl -u hn-backend.service -f
```

### 3단계: 백엔드 서버 재시작

```bash
# 서비스 재시작
sudo systemctl restart hn-backend.service

# 재시작 후 상태 확인
sudo systemctl status hn-backend.service --no-pager -l | head -20
```

### 4단계: 포트 확인

```bash
# 포트 8000에서 실행 중인 프로세스 확인
sudo netstat -tlnp | grep :8000
# 또는
sudo ss -tlnp | grep :8000
```

포트 8000에서 프로세스가 실행 중이어야 합니다.

## 수정된 내용

### 1. 백엔드 서버 시작 시 에러 처리 개선

**문제:** Supabase 클라이언트 생성 실패 시 서버가 시작되지 않음

**해결:**
- `backend/app.py`: Supabase 클라이언트 생성 실패 시 더미 클라이언트로 대체하여 서버가 시작되도록 수정
- `backend/sites.py`: 들여쓰기 오류 수정 및 동일한 에러 처리 추가

### 2. 백엔드 상태 확인 스크립트 추가

`CHECK_BACKEND_STATUS.sh` 스크립트를 생성하여 다음을 확인할 수 있습니다:
- Systemd 서비스 상태
- 포트 8000 사용 여부
- 최근 에러 로그
- 서비스 재시작 옵션

## 예상되는 에러 메시지

### 에러 1: "ModuleNotFoundError"
```
ModuleNotFoundError: No module named 'xxx'
```
**해결:** 가상환경이 활성화되지 않았거나 패키지가 설치되지 않음
```bash
cd /home/azureadmin/apps/hn_install
source .venv/bin/activate
pip install -r Home-Network-Installation-Management/backend/requirements.txt
```

### 에러 2: "Supabase 클라이언트 생성 실패"
```
[ERROR] Supabase 클라이언트 생성 실패: ...
```
**해결:** `.env` 파일의 Supabase 설정 확인
```bash
cd /home/azureadmin/apps/hn_install/Home-Network-Installation-Management/backend
cat .env | grep SUPABASE
```

### 에러 3: "Address already in use"
```
OSError: [Errno 98] Address already in use
```
**해결:** 포트 8000이 이미 사용 중
```bash
# 포트 8000을 사용하는 프로세스 확인 및 종료
sudo lsof -ti:8000 | xargs sudo kill -9
# 또는
sudo fuser -k 8000/tcp
```

## 빠른 복구 명령어

```bash
# 1. 서비스 중지
sudo systemctl stop hn-backend.service

# 2. 포트 확인 및 정리 (필요시)
sudo fuser -k 8000/tcp

# 3. 서비스 재시작
sudo systemctl start hn-backend.service

# 4. 상태 확인
sudo systemctl status hn-backend.service

# 5. 로그 확인
sudo journalctl -u hn-backend.service -n 30 --no-pager
```

## 추가 확인 사항

### Nginx 설정 확인
```bash
# Nginx 설정 테스트
sudo nginx -t

# Nginx 재시작 (필요시)
sudo systemctl restart nginx
```

### 환경 변수 확인
```bash
cd /home/azureadmin/apps/hn_install/Home-Network-Installation-Management/backend
cat .env
```

필수 환경 변수:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `FLASK_SECRET_KEY`
- `SUPABASE_VERIFY_SSL` (선택)

## 문제가 계속되면

1. **에러 로그 전체 확인:**
   ```bash
   sudo journalctl -u hn-backend.service --no-pager > backend_errors.log
   cat backend_errors.log
   ```

2. **수동으로 서버 시작 테스트:**
   ```bash
   cd /home/azureadmin/apps/hn_install/Home-Network-Installation-Management/backend
   source /home/azureadmin/apps/hn_install/.venv/bin/activate
   python app.py
   ```
   
   이렇게 실행했을 때 에러 메시지를 확인하면 정확한 원인을 파악할 수 있습니다.

