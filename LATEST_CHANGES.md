# 최근 수정 사항 및 배포 파일 목록

## 📝 이번 수정으로 변경된 파일

### 1. `frontend/js/app.js`
**수정 내용:**
- 관리자 페이지에서 돌아가기 시 화면이 정리되지 않는 문제 수정
- `showMainDashboard()` 함수 개선: 모든 페이지를 명시적으로 숨김
- `showPage()` 함수 개선: 페이지 전환 시 관리자 페이지를 확실히 숨김

**변경 사항:**
- 관리자 페이지, 업무관리 페이지, 사진 페이지 등 모든 페이지를 명시적으로 숨김 처리
- 메인 대시보드로 돌아갈 때 깔끔하게 정리됨

### 2. `hn.conf`
**수정 내용:**
- 브라우저 캐시 설정 변경
- JavaScript/CSS 파일: 1년 캐시 → 1시간 캐시로 변경
- 이미지/폰트 파일: 1년 캐시 유지 (변경이 적으므로)

**변경 사항:**
```nginx
# 이전: 모든 정적 파일을 1년간 캐시
expires 1y;

# 수정 후: JS/CSS는 1시간, 이미지는 1년
location ~* \.(js|css)$ {
    expires 1h;
}
location ~* \.(png|jpg|...)$ {
    expires 1y;
}
```

## 📦 Azure 서버에 업로드할 파일

### 필수 업로드 파일 (2개)

1. ✅ **`frontend/js/app.js`**
   - 관리자 페이지 숨김 로직 개선
   - 위치: `frontend/js/app.js`

2. ✅ **`hn.conf`**
   - Nginx 캐시 설정 변경
   - 위치: 프로젝트 루트

## 🚀 Azure 서버 배포 방법

### 1단계: 파일 업로드

Azure 서버에 다음 파일들을 업로드:

```
frontend/js/
  └── app.js          ✅ 필수

프로젝트 루트/
  └── hn.conf         ✅ 필수
```

### 2단계: Nginx 설정 적용

```bash
# Azure 서버에 SSH 접속
ssh azureadmin@azure-server-ip

# 프로젝트 디렉토리로 이동
cd /home/azureadmin/apps/hn_install/Home-Network-Installation-Management

# Nginx 설정 파일 복사
sudo cp hn.conf /etc/nginx/sites-available/hn-app

# 심볼릭 링크 확인 (이미 있다면 생략)
sudo ln -sf /etc/nginx/sites-available/hn-app /etc/nginx/sites-enabled/hn-app

# Nginx 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
```

### 3단계: 브라우저 캐시 클리어

**중요:** 브라우저에서 강력 새로고침을 해야 합니다!

- **Windows:** `Ctrl + F5`
- **Mac:** `Cmd + Shift + R`
- 또는 **시크릿 모드**로 접속 테스트

## ✅ 배포 후 확인 사항

1. **관리자 페이지 테스트:**
   - 로그인 → 관리자 카드 클릭
   - "돌아가기" 버튼 클릭
   - 관리자 페이지가 완전히 숨겨지는지 확인 ✅

2. **캐시 설정 확인:**
   - 브라우저 개발자 도구 (F12) → Network 탭
   - `app.js` 파일 요청 확인
   - `Cache-Control` 헤더가 `public, must-revalidate`인지 확인
   - `Expires` 헤더가 1시간 후인지 확인

## 📋 전체 배포 파일 목록 (참고)

이전에 수정했던 파일들도 함께 배포해야 할 수 있습니다:

**백엔드:**
- `backend/app.py` (SSL 인증서 검증 설정)
- `backend/auth.py` (SSL 인증서 검증 설정)
- `backend/sites.py` (SSL 인증서 검증 설정 + PostgREST 필터 수정)

**프론트엔드:**
- `frontend/js/auth.js` (API_BASE_URL 설정)
- `frontend/js/app.js` (이번 수정 + export 경로)

**설정:**
- `hn.conf` (이번 수정: 캐시 설정)

## 🎯 요약

**이번에 수정한 파일:**
1. `frontend/js/app.js` - 관리자 페이지 숨김 로직 개선
2. `hn.conf` - 브라우저 캐시 설정 변경

**Azure 서버에 업로드:**
- 위 2개 파일 업로드
- Nginx 설정 적용 및 재시작
- 브라우저 캐시 클리어



