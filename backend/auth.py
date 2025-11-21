from flask import Blueprint, request, jsonify, current_app
import bcrypt
import jwt
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv
import os
import re

# 환경 변수 로드
load_dotenv()

# JWT 비밀키 조회 유틸 (app.config -> env -> 기본값)
def _get_secret_key() -> str:
    try:
        cfg_val = None
        try:
            cfg_val = (current_app.config.get('SECRET_KEY') if current_app else None)
        except Exception:
            cfg_val = None
        env_val = os.getenv('FLASK_SECRET_KEY')
        key = cfg_val or env_val or 'dev-secret-key-change-in-production'
        return str(key)
    except Exception:
        return 'dev-secret-key-change-in-production'

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
    # SSL 인증서 검증 설정 (app.py와 동일)
    verify_ssl = os.getenv('SUPABASE_VERIFY_SSL', 'false').lower() in ('true', '1', 'yes')
    
    if not verify_ssl:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        import ssl
        ssl._create_default_https_context = ssl._create_unverified_context
        os.environ['PYTHONHTTPSVERIFY'] = '0'
        os.environ['CURL_CA_BUNDLE'] = ''
        os.environ['REQUESTS_CA_BUNDLE'] = ''
    
    try:
        # Supabase 클라이언트를 기본 방식으로 생성
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # SSL 검증이 비활성화된 경우, 내부 httpx 클라이언트의 verify 옵션만 변경
        if not verify_ssl:
            try:
                if hasattr(supabase, 'postgrest') and hasattr(supabase.postgrest, 'session'):
                    original_client = supabase.postgrest.session
                    if hasattr(original_client, 'base_url'):
                        from httpx import Client as HttpxClient
                        new_client = HttpxClient(
                            base_url=original_client.base_url,
                            verify=False,
                            timeout=original_client.timeout if hasattr(original_client, 'timeout') else 30.0,
                            headers=original_client.headers if hasattr(original_client, 'headers') else {}
                        )
                        supabase.postgrest.session = new_client
            except Exception:
                pass
    except Exception:
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
    # 방어: 비밀키가 비문자형인 경우 문자열로 강제
    secret = _get_secret_key()
    try:
        token = jwt.encode(payload, secret, algorithm='HS256')
    except Exception as e:
        # 개발/더미 환경에서 드물게 발생하는 키 타입 이슈를 우회하기 위한 안전장치
        print(f"[AUTH] jwt.encode error: {e}")
        token = 'dev-token'
    # PyJWT 버전에 따라 bytes가 반환될 수 있으므로 문자열 보장
    if isinstance(token, bytes):
        try:
            token = token.decode('utf-8')
        except Exception:
            token = token.decode()
    return token

# JWT 토큰 검증 함수
def verify_token(token):
    try:
        secret = _get_secret_key()
        payload = jwt.decode(token, secret, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        # 더미 환경에서는 디코드 실패 시에도 테스트 사용자로 통과시킴
        if not (os.getenv('SUPABASE_URL') and os.getenv('SUPABASE_ANON_KEY')):
            return {'user_id': 1, 'user_role': 'user'}
        return None

# 이메일 형식/도메인 검증 (@kdiwin.com 전용)
def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@kdiwin\.com$'
    return re.match(pattern, (email or '').strip().lower()) is not None

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
        # 회원가입은 항상 일반 사용자로 고정
        user_role = 'user'
        
        # 이메일 형식/도메인 검증 (@kdiwin.com)
        if not validate_email(email):
            return jsonify({'error': '회사 이메일(@kdiwin.com)로만 회원가입할 수 있습니다.'}), 400
        
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
        try:
            print(f"[AUTH] /login called. has_env_supabase={bool(os.getenv('SUPABASE_URL')) and bool(os.getenv('SUPABASE_ANON_KEY'))}")
            print(f"[AUTH] raw_json={data}")
        except Exception:
            pass

        email = data.get('email') if isinstance(data, dict) else None
        password = data.get('password') if isinstance(data, dict) else None
        
        if not email or not password:
            return jsonify({'error': '이메일과 비밀번호를 입력해주세요.'}), 400

        # 더미 환경은 즉시 성공 반환(서버 전역 플로우 검증 목적)
        if not (supabase_url and supabase_key):
            user_info = {
                'id': 1,
                'email': email,
                'name': '테스트 사용자',
                'user_role': 'user'
            }
            return jsonify({
                'message': '로그인 성공(더미)',
                'token': 'dev-token',
                'user': user_info
            }), 200
        
        # 사용자 조회
        user = supabase.table('users').select('*').eq('email', email).execute()
        try:
            print(f"[AUTH] supabase user lookup result: {user.data}")
        except Exception:
            pass
        
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
        import traceback
        print('[AUTH] login error:', e)
        print(traceback.format_exc())
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