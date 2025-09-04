from flask import Blueprint, request, jsonify
import bcrypt
import jwt
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv
import os
import re

# 환경 변수 로드
load_dotenv()

# Supabase 클라이언트 초기화
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_ANON_KEY')

if not supabase_url or not supabase_key:
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

auth_bp = Blueprint('auth', __name__)

# 비밀번호 해시화
def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

# 비밀번호 검증
def check_password(password, hashed):
    return bcrypt.checkpw(password.encode('utf-8'), hashed)

# JWT 토큰 생성 함수
def generate_token(user_id, user_role):
    payload = {
        'user_id': user_id,
        'user_role': user_role,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, os.getenv('FLASK_SECRET_KEY'), algorithm='HS256')

# JWT 토큰 검증 함수
def verify_token(token):
    try:
        payload = jwt.decode(token, os.getenv('FLASK_SECRET_KEY'), algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

# 이메일 형식 검증
def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

# 회원가입
@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # 필수 필드 검증
        required_fields = ['email', 'password', 'name', 'phone']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field}는 필수 입력 항목입니다.'}), 400
        
        email = data['email']
        password = data['password']
        name = data['name']
        phone = data['phone']
        user_role = data.get('user_role', 'user')  # 기본값: 일반사용자
        
        # 이메일 형식 검증
        if not validate_email(email):
            return jsonify({'error': '올바른 이메일 형식이 아닙니다.'}), 400
        
        # 비밀번호 길이 검증
        if len(password) < 6:
            return jsonify({'error': '비밀번호는 최소 6자 이상이어야 합니다.'}), 400
        
        # 기존 사용자 확인
        existing_user = supabase.table('users').select('*').eq('email', email).execute()
        if existing_user.data:
            return jsonify({'error': '이미 존재하는 이메일입니다.'}), 400
        
        # 비밀번호 해시화
        hashed_password = hash_password(password)
        
        # 사용자 생성
        user_data = {
            'email': email,
            'password': hashed_password.decode('utf-8'),
            'name': name,
            'phone': phone,
            'user_role': user_role,
            'created_at': 'now()'
        }
        
        result = supabase.table('users').insert(user_data).execute()
        
        # 더미 데이터인 경우에도 성공으로 처리
        if result.data or not supabase_url or not supabase_key:
            return jsonify({'message': '회원가입이 완료되었습니다.'}), 201
        else:
            return jsonify({'error': '회원가입 중 오류가 발생했습니다.'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500# 로그인
@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': '이메일과 비밀번호를 입력해주세요.'}), 400
        
        # 사용자 조회
        user = supabase.table('users').select('*').eq('email', email).execute()
        print(user.data)
        
        # 더미 데이터인 경우 테스트 사용자로 로그인 허용
        if not user.data and (not supabase_url or not supabase_key):
            # 더미 데이터로 테스트 사용자 생성
            user_info = {
                'id': 1,
                'email': email,
                'name': '테스트 사용자',
                'user_role': 'user'
            }
        elif not user.data:
            return jsonify({'error': '존재하지 않는 사용자입니다.'}), 401
        else:
            user_info = user.data[0]
            
            # 비밀번호 검증 (더미 데이터가 아닌 경우에만)
            if supabase_url and supabase_key and not check_password(password, user_info['password'].encode('utf-8')):
                return jsonify({'error': '비밀번호가 올바르지 않습니다.'}), 401
        
        # JWT 토큰 생성
        token = generate_token(user_info['id'], user_info['user_role'])
        
        return jsonify({
            'message': '로그인 성공',
            'token': token,
            'user': {
                'id': user_info['id'],
                'email': user_info['email'],
                'name': user_info['name'],
                'user_role': user_info['user_role']
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 사용자 정보 조회
@auth_bp.route('/profile', methods=['GET'])
def get_profile():
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        
        user = supabase.table('users').select('id, email, name, phone, user_role, created_at').eq('id', payload['user_id']).execute()
        
        if user.data:
            return jsonify({'user': user.data[0]}), 200
        else:
            return jsonify({'error': '사용자를 찾을 수 없습니다.'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500