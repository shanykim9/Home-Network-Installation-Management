# .env 파일 위치와 차이점 설명

## 🎯 핵심 개념

**.env 파일은 각 환경(로컬 PC, AWS 서버, Azure 서버)마다 별도로 존재합니다!**

## 📁 .env 파일의 위치

### 1. 로컬 PC (개발 환경)
```
C:\Users\10140057\Desktop\CursorAi\Home-Network-Installation-Management\
└── .env  ← 여기에 있음 (프로젝트 루트)
```

### 2. AWS 서버 (프로덕션 환경)
```
/home/awsuser/apps/hn_install/Home-Network-Installation-Management/
└── .env  ← 여기에 있음 (서버의 프로젝트 루트)
```

### 3. Azure 서버 (프로덕션 환경)
```
/home/azureadmin/apps/hn_install/Home-Network-Installation-Management/
└── .env  ← 여기에 있음 (서버의 프로젝트 루트)
```

## 🔍 중요한 차이점

### 각 .env 파일은 독립적입니다!

| 위치 | 환경 | SUPABASE_VERIFY_SSL 설정 | 이유 |
|------|------|-------------------------|------|
| **로컬 PC** | 개발 | `false` 또는 없음 | 개발 테스트용, SSL 검증 불필요 |
| **AWS 서버** | 프로덕션 | `true` (필수!) | 실제 사용자 보안 필요 |
| **Azure 서버** | 프로덕션 | `true` (필수!) | 실제 사용자 보안 필요 |

## 📝 설정 방법

### 방법 1: 로컬 PC의 .env 파일 수정

**위치:** 프로젝트 루트 디렉토리
```
C:\Users\10140057\Desktop\CursorAi\Home-Network-Installation-Management\.env
```

**내용:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
FLASK_SECRET_KEY=your_secret_key
SUPABASE_VERIFY_SSL=false  # 개발 환경이므로 false 가능
```

**효과:**
- ✅ 로컬 PC에서만 적용됨
- ✅ AWS/Azure 서버에는 영향 없음
- ✅ 개발 테스트용

### 방법 2: AWS 서버의 .env 파일 수정

**위치:** AWS 서버의 프로젝트 루트
```
/home/awsuser/apps/hn_install/Home-Network-Installation-Management/.env
```

**수정 방법:**
```bash
# AWS 서버에 SSH 접속
ssh awsuser@aws-server-ip

# 프로젝트 디렉토리로 이동
cd /home/awsuser/apps/hn_install/Home-Network-Installation-Management

# .env 파일 편집
nano .env
# 또는
vi .env
```

**내용 추가:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
FLASK_SECRET_KEY=your_secret_key
SUPABASE_VERIFY_SSL=true  # 프로덕션 환경이므로 true 필수!
```

**효과:**
- ✅ AWS 서버에서만 적용됨
- ✅ 로컬 PC, Azure 서버에는 영향 없음
- ✅ AWS 서버의 실제 사용자에게 적용

### 방법 3: Azure 서버의 .env 파일 수정

**위치:** Azure 서버의 프로젝트 루트
```
/home/azureadmin/apps/hn_install/Home-Network-Installation-Management/.env
```

**수정 방법:**
```bash
# Azure 서버에 SSH 접속
ssh azureadmin@azure-server-ip

# 프로젝트 디렉토리로 이동
cd /home/azureadmin/apps/hn_install/Home-Network-Installation-Management

# .env 파일 편집
nano .env
# 또는
vi .env
```

**내용 추가:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
FLASK_SECRET_KEY=your_secret_key
SUPABASE_VERIFY_SSL=true  # 프로덕션 환경이므로 true 필수!
```

**효과:**
- ✅ Azure 서버에서만 적용됨
- ✅ 로컬 PC, AWS 서버에는 영향 없음
- ✅ Azure 서버의 실제 사용자에게 적용

## ⚠️ 자주 하는 실수

### ❌ 잘못된 생각
"로컬 PC의 .env 파일에 추가하면 AWS/Azure 서버에도 자동으로 적용된다"

### ✅ 올바른 이해
"각 환경의 .env 파일은 완전히 독립적이다"

## 🔄 코드와 .env 파일의 관계

### 코드 (app.py, auth.py, sites.py)
```python
# 코드는 모든 환경에서 동일
verify_ssl = os.getenv('SUPABASE_VERIFY_SSL', 'false')
```

**동작 방식:**
1. 코드가 실행될 때 `.env` 파일을 읽음
2. 각 환경의 `.env` 파일에서 `SUPABASE_VERIFY_SSL` 값을 읽음
3. 로컬 PC → 로컬의 .env 파일 읽음
4. AWS 서버 → AWS 서버의 .env 파일 읽음
5. Azure 서버 → Azure 서버의 .env 파일 읽음

## 📊 전체 구조도

```
┌─────────────────────────────────────────┐
│  로컬 PC (개발 환경)                    │
│  ┌───────────────────────────────────┐ │
│  │ .env 파일                         │ │
│  │ SUPABASE_VERIFY_SSL=false        │ │
│  └───────────────────────────────────┘ │
│  ┌───────────────────────────────────┐ │
│  │ 코드 (app.py, auth.py, sites.py) │ │
│  │ → 로컬 .env 파일 읽음           │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  AWS 서버 (프로덕션 환경)                │
│  ┌───────────────────────────────────┐ │
│  │ .env 파일                         │ │
│  │ SUPABASE_VERIFY_SSL=true         │ │
│  └───────────────────────────────────┘ │
│  ┌───────────────────────────────────┐ │
│  │ 코드 (app.py, auth.py, sites.py) │ │
│  │ → AWS 서버의 .env 파일 읽음      │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Azure 서버 (프로덕션 환경)              │
│  ┌───────────────────────────────────┐ │
│  │ .env 파일                         │ │
│  │ SUPABASE_VERIFY_SSL=true         │ │
│  └───────────────────────────────────┘ │
│  ┌───────────────────────────────────┐ │
│  │ 코드 (app.py, auth.py, sites.py) │ │
│  │ → Azure 서버의 .env 파일 읽음    │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## ✅ 올바른 설정 방법

### 1단계: 로컬 PC (선택사항)
```bash
# 로컬 PC의 .env 파일
SUPABASE_VERIFY_SSL=false  # 개발용이므로 false 가능
```

### 2단계: AWS 서버 (필수!)
```bash
# AWS 서버에 SSH 접속 후
cd /home/awsuser/apps/hn_install/Home-Network-Installation-Management
nano .env

# 추가
SUPABASE_VERIFY_SSL=true
```

### 3단계: Azure 서버 (필수!)
```bash
# Azure 서버에 SSH 접속 후
cd /home/azureadmin/apps/hn_install/Home-Network-Installation-Management
nano .env

# 추가
SUPABASE_VERIFY_SSL=true
```

### 4단계: 서비스 재시작
```bash
# 각 서버에서
sudo systemctl restart hn-backend
```

## 🎓 비유로 이해하기

### 집 열쇠 비유
- **로컬 PC의 .env**: 내 집 열쇠 (내 집만 열림)
- **AWS 서버의 .env**: AWS 집 열쇠 (AWS 집만 열림)
- **Azure 서버의 .env**: Azure 집 열쇠 (Azure 집만 열림)

각 집마다 다른 열쇠가 필요하듯, 각 환경마다 다른 .env 파일이 필요합니다!

## 📝 요약

1. **.env 파일은 각 환경마다 별도로 존재**
2. **로컬 PC의 .env ≠ AWS 서버의 .env ≠ Azure 서버의 .env**
3. **각각 독립적으로 설정해야 함**
4. **프로덕션 환경(AWS, Azure)에서는 `SUPABASE_VERIFY_SSL=true` 필수!**

