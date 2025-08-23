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
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY')
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": ["Content-Type", "Authorization", "User-Agent", "Accept", "Accept-Language", "Accept-Encoding"], "expose_headers": ["Content-Type", "Authorization"]}})

# Supabase 클라이언트 초기화
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_ANON_KEY')
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
    print("🚀 Flask 서버 시작 중...")
    print("📡 서버 주소: http://0.0.0.0:5000")
    print("🔧 디버그 모드: 활성화")
    print("🌐 CORS: 모든 도메인 허용")
    app.run(debug=True, host='0.0.0.0', port=5000)
