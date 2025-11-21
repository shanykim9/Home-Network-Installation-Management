from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import os
import bcrypt
import jwt
from datetime import datetime, timedelta
from supabase import create_client, Client
import pandas as pd
from io import BytesIO
from pathlib import Path
import ssl

# 환경 변수 로드
load_dotenv()

app = Flask(__name__)
# 환경변수 미설정 시에도 문자열 기본값을 보장
app.config['SECRET_KEY'] = str(os.getenv('FLASK_SECRET_KEY') or 'dev-secret-key-change-in-production')

# CORS 설정 - 개발용으로 모든 도메인 허용
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": ["Content-Type", "Authorization", "User-Agent", "Accept", "Accept-Language", "Accept-Encoding"], "expose_headers": ["Content-Type", "Authorization"]}})

# Supabase 클라이언트 초기화
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_ANON_KEY')

# 환경 변수가 없을 때 경고 메시지 출력 (ASCII 전용)
if not supabase_url or not supabase_key:
    print("[WARN] Supabase 환경 변수가 설정되지 않았습니다!")
    print("       .env 파일을 생성하고 다음 내용을 추가하세요:")
    print("       SUPABASE_URL=your_supabase_url_here")
    print("       SUPABASE_ANON_KEY=your_supabase_anon_key_here")
    print("       FLASK_SECRET_KEY=your_secret_key_here")
    print("       현재는 더미 데이터로 실행됩니다.")
    
    # 더미 Supabase 클라이언트 (개발용)
    class DummySupabase:
        def table(self, name):
            return DummyTable()
    
    class DummyTable:
        def select(self, *args):
            return self
        def eq(self, *args):
            return self
        def insert(self, data):
            return DummyResult()
        def update(self, data):
            return DummyResult()
        def execute(self):
            return DummyResult()
    
    class DummyResult:
        def __init__(self):
            self.data = []
    
    supabase = DummySupabase()
else:
    # SSL 인증서 검증 설정 (개발 환경에서 자체 서명 인증서 문제 해결)
    # 환경 변수로 SSL 검증 여부 제어 (기본값: True, 개발 환경에서 False로 설정 가능)
    verify_ssl = os.getenv('SUPABASE_VERIFY_SSL', 'false').lower() in ('true', '1', 'yes')
    
    if not verify_ssl:
        # 개발 환경: SSL 검증 비활성화 (자체 서명 인증서 문제 해결)
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        
        # Python의 SSL 검증을 비활성화
        import ssl
        ssl._create_default_https_context = ssl._create_unverified_context
        
        # httpx의 SSL 검증을 비활성화하기 위한 환경 설정
        os.environ['PYTHONHTTPSVERIFY'] = '0'
        os.environ['CURL_CA_BUNDLE'] = ''
        os.environ['REQUESTS_CA_BUNDLE'] = ''
        
        print("[WARN] SSL 검증이 비활성화되었습니다. 개발 환경에서만 사용하세요!")
        print("[WARN] 프로덕션 환경에서는 SUPABASE_VERIFY_SSL=true로 설정하세요!")
    
    # Supabase 클라이언트 생성
    # SSL 검증이 비활성화된 경우, 환경 변수를 통해 httpx가 자동으로 비활성화하도록 함
    try:
        # Supabase 클라이언트를 기본 방식으로 생성
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # SSL 검증이 비활성화된 경우, 내부 httpx 클라이언트의 verify 옵션만 변경
        if not verify_ssl:
            try:
                # postgrest 클라이언트의 httpx 세션에 verify=False 설정
                if hasattr(supabase, 'postgrest') and hasattr(supabase.postgrest, 'session'):
                    # 기존 클라이언트의 설정을 유지하면서 verify만 False로 변경
                    original_client = supabase.postgrest.session
                    if hasattr(original_client, 'base_url'):
                        from httpx import Client as HttpxClient
                        # 기존 base_url과 다른 설정을 유지하면서 verify만 False로
                        new_client = HttpxClient(
                            base_url=original_client.base_url,
                            verify=False,
                            timeout=original_client.timeout if hasattr(original_client, 'timeout') else 30.0,
                            headers=original_client.headers if hasattr(original_client, 'headers') else {}
                        )
                        supabase.postgrest.session = new_client
            except Exception as e:
                print(f"[WARN] httpx 클라이언트 verify 설정 실패, SSL 검증 비활성화가 적용되지 않을 수 있습니다: {e}")
    except Exception as e:
        print(f"[ERROR] Supabase 클라이언트 생성 실패: {e}")
        print(f"[ERROR] 더미 클라이언트로 대체합니다. Supabase 연결이 작동하지 않을 수 있습니다.")
        import traceback
        traceback.print_exc()
        # 에러가 발생해도 서버는 시작되도록 더미 클라이언트 사용
        class DummySupabase:
            def table(self, name):
                return DummyTable()
        
        class DummyTable:
            def select(self, *args):
                return self
            def eq(self, *args):
                return self
            def insert(self, data):
                return DummyResult()
            def update(self, data):
                return DummyResult()
            def execute(self):
                return DummyResult()
        
        class DummyResult:
            def __init__(self):
                self.data = []
        
        supabase = DummySupabase()

# JWT 토큰 생성 함수
def generate_token(user_id, user_role):
    payload = {
        'user_id': user_id,
        'user_role': user_role,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

# JWT 토큰 검증 함수
def verify_token(token):
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

# 비밀번호 해시화
def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

# 비밀번호 검증
def check_password(password, hashed):
    return bcrypt.checkpw(password.encode('utf-8'), hashed)

# 정적 파일 경로 설정 (Blueprint 등록 전에 설정)
# - 로컬/서버 어디서 실행해도 안정적으로 frontend 디렉터리를 찾도록 절대경로 사용
_BASE_DIR = Path(__file__).resolve().parent
_FRONTEND_DIR = (_BASE_DIR.parent / 'frontend').resolve()

# Blueprint 등록
from auth import auth_bp
from sites import sites_bp

app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(sites_bp, url_prefix='/')

# 정적 파일 서빙 (API 경로와 충돌 방지를 위해 정적 파일 확장자만 처리)
@app.route('/')
def serve_index():
    # Windows 콘솔 등 일부 환경에서 이모지 출력 시 인코딩 오류가 발생할 수 있어 ASCII만 사용
    print(f"[VISIT] / from {request.remote_addr} - UA: {request.headers.get('User-Agent', 'Unknown')}")
    try:
        return send_from_directory(str(_FRONTEND_DIR), 'index.html')
    except Exception as e:
        print(f"[ERROR] serve_index failed: {e}")
        print(f"[DEBUG] FRONTEND_DIR: {_FRONTEND_DIR}")
        print(f"[DEBUG] index.html exists: {(_FRONTEND_DIR / 'index.html').exists()}")
        raise

# 정적 파일 서빙 (js, css, html 등)
# API 경로와 충돌하지 않도록 정적 파일 확장자만 처리
@app.route('/<path:path>')
def serve_static(path):
    # API 경로는 제외 (Blueprint가 처리)
    if path.startswith(('auth/', 'sites/', 'export', 'users', 'admin', 'contacts-master', 'check-project-no', 'uploads')):
        # API 경로는 Blueprint가 처리하도록 pass (404 반환)
        from flask import abort
        abort(404)
    
    # 정적 파일만 서빙
    try:
        return send_from_directory(str(_FRONTEND_DIR), path)
    except Exception as e:
        print(f"[ERROR] serve_static failed for {path}: {e}")
        from flask import abort
        abort(404)

# 업로드 파일 서빙 (이미지 등)
@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    base_dir = Path(__file__).resolve().parent
    uploads_dir = base_dir / 'uploads'
    uploads_dir.mkdir(parents=True, exist_ok=True)
    return send_from_directory(str(uploads_dir), filename)

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5000)
