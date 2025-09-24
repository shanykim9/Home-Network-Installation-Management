# 홈 네트워크 관리 시스템

아파트 신축 시 홈 네트워크 제품 설치를 관리하는 웹 애플리케이션입니다.

## 🛠 기술 스택

- **프론트엔드**: 바닐라 JavaScript + Tailwind CSS
- **백엔드**: Python Flask
- **데이터베이스**: Supabase (PostgreSQL)

## 📋 주요 기능

### 1. 사용자 인증
- 자체 회원가입/로그인 시스템
- JWT 토큰 기반 인증
- 일반사용자/관리자 권한 구분

### 2. 현장 관리
- 현장 등록 (등록번호 자동 생성)
- 현장별 접근 권한 관리
- 기본 정보, 연락처, 제품 수량 관리

### 3. 현장별 업무관리
- 스마트플랜: 날짜별 할 일/한 일 관리
- Action Plan: 날짜별 이슈사항 관리

### 4. 현장별 전체조회
- 등록된 현장들의 전체 현황 조회
- Excel 파일 다운로드 (현장별/전체)

## 🚀 설치 및 실행

### 1. 의존성 설치
```bash
pip install -r requirements.txt
```

### 2. 환경 변수 설정
`.env` 파일을 편집하여 Supabase 연결 정보를 입력하세요:
```
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
FLASK_SECRET_KEY=your_secret_key_here
```

### 3. 데이터베이스 설정
Supabase 콘솔에서 다음 순서로 SQL을 실행하세요.

1) 기본 스키마 생성
   - `database_migration_create_tables.sql`

2) 현장별 업무관리(Work Items) 추가
   - `database_migration_add_work_items.sql`

모두 성공하면 `work_items` 테이블과 인덱스가 생성되어 To do/Done/알람 List 저장이 동작합니다.

### 4. 서버 실행
```bash
cd backend
python app.py
```

브라우저에서 `http://localhost:5000`으로 접속하세요.

## 📁 프로젝트 구조

```
HN_App/
├── backend/
│   ├── app.py          # Flask 메인 애플리케이션
│   ├── auth.py         # 사용자 인증 관련 라우트
│   └── sites.py        # 현장 관리 관련 라우트
├── frontend/
│   ├── index.html      # 메인 HTML 파일
│   ├── js/
│   │   ├── auth.js     # 인증 관련 JavaScript
│   │   └── app.js      # 메인 애플리케이션 JavaScript
│   └── css/            # CSS 파일들
├── .env                # 환경 변수 설정
├── requirements.txt    # Python 의존성
├── database_schema.sql # 데이터베이스 스키마
└── README.md          # 프로젝트 설명서
```

## 🔧 다음 단계

현재 기본 틀이 완성되었습니다. 다음 단계로 세부 메뉴 기능들을 추가할 예정입니다:

1. 현장 등록 상세 기능 (연락처, 제품 수량, 연동 정보)
2. 현장별 업무관리 상세 기능 (스마트플랜, Action Plan)
3. 현장별 전체조회 상세 기능
4. Excel 다운로드 기능
5. UI/UX 개선

## 🎯 사용 권한

- **일반사용자**: 본인이 등록한 현장만 접근 가능
- **관리자**: 모든 현장 접근 가능 + 사용자 관리