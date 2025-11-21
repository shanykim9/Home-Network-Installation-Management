# 배포 체크리스트 (Azure & AWS)

## ✅ 현재 코드 상태

현재 수정된 코드는 **Azure Cloud와 AWS Cloud 모두에서 정상적으로 작동**하도록 설계되었습니다.

## 📋 배포 전 확인 사항

### 1. 환경 변수 설정 (.env 파일)

각 서버(Azure, AWS)의 `.env` 파일에 다음 변수들이 설정되어 있는지 확인:

```bash
# 필수: Supabase 연결 정보
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
FLASK_SECRET_KEY=your_secret_key_here

# 중요: 프로덕션 환경에서는 반드시 true로 설정!
SUPABASE_VERIFY_SSL=true
```

### 2. Nginx 설정

#### Azure 서버
- `hn.conf` 파일을 `/etc/nginx/sites-available/default` 또는 해당 위치에 복사
- Nginx 설정 테스트: `sudo nginx -t`
- Nginx 재시작: `sudo systemctl restart nginx`

#### AWS 서버
- AWS 서버의 Nginx 설정이 Azure와 동일한지 확인
- 동일한 경로 패턴 사용: `/(auth|sites|export|users|admin|contacts-master|check-project-no|uploads)`

### 3. 파일 배포

다음 파일들을 양쪽 서버에 배포:

**백엔드 파일:**
- `backend/app.py`
- `backend/auth.py`
- `backend/sites.py`

**프론트엔드 파일:**
- `frontend/js/auth.js`
- `frontend/js/app.js`

**설정 파일:**
- `hn.conf` (Azure용)

### 4. 서비스 재시작

```bash
# Gunicorn 서비스 재시작
sudo systemctl restart hn-backend

# 서비스 상태 확인
sudo systemctl status hn-backend

# 로그 확인
sudo journalctl -u hn-backend -f
```

## ⚠️ 중요 주의사항

### SSL 검증 설정

**프로덕션 환경(Azure, AWS)에서는 반드시 SSL 검증을 활성화해야 합니다!**

현재 코드의 기본값은 `false`이지만, 프로덕션에서는 보안을 위해 `true`로 설정해야 합니다.

```bash
# .env 파일에 추가
SUPABASE_VERIFY_SSL=true
```

**이유:**
- SSL 검증을 비활성화하면 중간자 공격(Man-in-the-Middle)에 취약해집니다
- 프로덕션 환경에서는 항상 SSL 검증을 활성화해야 합니다
- 개발 환경에서만 SSL 검증을 비활성화할 수 있습니다

## 🔍 배포 후 확인 사항

1. **로그인 기능 테스트**
   - 로그인 페이지 접속
   - 실제 계정으로 로그인 시도
   - 에러 없이 로그인되는지 확인

2. **현장 사진 기능 테스트**
   - 현장 선택 드롭다운에서 현장 선택
   - 에러 없이 사진 목록이 표시되는지 확인
   - "등록된 사진이 없습니다" 메시지가 정상적으로 표시되는지 확인

3. **서버 로그 확인**
   ```bash
   # 에러가 없는지 확인
   sudo journalctl -u hn-backend -n 100 --no-pager
   ```

## 📝 환경별 차이점

### Azure Cloud
- Nginx 설정 파일: `hn.conf` 사용
- 경로: `/home/azureadmin/apps/hn_install/Home-Network-Installation-Management/`

### AWS Cloud
- Nginx 설정: Azure와 동일한 패턴 사용
- 경로: AWS 서버의 실제 경로에 맞게 조정

## ✅ 최종 확인

배포 후 다음을 확인하세요:

- [ ] 로그인 기능 정상 작동
- [ ] 현장 사진 목록 조회 정상 작동
- [ ] 서버 로그에 에러 없음
- [ ] SSL 검증이 프로덕션에서 활성화됨 (SUPABASE_VERIFY_SSL=true)

