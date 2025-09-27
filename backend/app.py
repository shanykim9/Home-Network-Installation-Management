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

# 환경 변수 로드
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key-change-in-production')

# CORS 설정 - 개발용으로 모든 도메인 허용
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": ["Content-Type", "Authorization", "User-Agent", "Accept", "Accept-Language", "Accept-Encoding"], "expose_headers": ["Content-Type", "Authorization"]}})

# Supabase 클라이언트 초기화
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_ANON_KEY')

# 환경 변수가 없을 때 경고 메시지 출력
if not supabase_url or not supabase_key:
    print("⚠️  경고: Supabase 환경 변수가 설정되지 않았습니다!")
    print("   .env 파일을 생성하고 다음 내용을 추가하세요:")
    print("   SUPABASE_URL=your_supabase_url_here")
    print("   SUPABASE_ANON_KEY=your_supabase_anon_key_here")
    print("   FLASK_SECRET_KEY=your_secret_key_here")
    print("   현재는 더미 데이터로 실행됩니다.")
    
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
    supabase: Client = create_client(supabase_url, supabase_key)

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

# Blueprint 등록 (먼저 해야 함)
from auth import auth_bp
from sites import sites_bp

app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(sites_bp, url_prefix='/')

# 정적 파일 서빙
@app.route('/')
def serve_index():
    print(f"🔍 메인 페이지 접속: {request.remote_addr} - User-Agent: {request.headers.get('User-Agent', 'Unknown')}")
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5000)
