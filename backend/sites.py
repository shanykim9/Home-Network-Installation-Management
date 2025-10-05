from flask import Blueprint, request, jsonify
from datetime import datetime, date
import jwt
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# 환경 변수 로드
load_dotenv()

# auth.py와 동일한 기본 비밀키 정책 적용 (토큰 검증 시 일관성)
SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key-change-in-production')

# Supabase 클라이언트 초기화
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_ANON_KEY')

print(f"🌐 Supabase URL: {supabase_url}")
print(f"🔑 Supabase Key: {supabase_key[:20]}..." if supabase_key else "❌ Supabase Key 없음")

if not supabase_url or not supabase_key:
    print("⚠️  Supabase 환경 변수가 설정되지 않았습니다! 더미 데이터로 실행됩니다.")
    
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
        def limit(self, n):
            return self
        def order(self, field, desc=False):
            return self
        def in_(self, field, values):
            return self
    
    class DummyResult:
        def __init__(self):
            self.data = []
    
    supabase = DummySupabase()
    print("✅ 더미 Supabase 클라이언트 초기화 완료")
else:
    supabase: Client = create_client(supabase_url, supabase_key)
    print("✅ Supabase 클라이언트 초기화 완료")

# JWT 토큰 검증 함수
def verify_token(token):
    try:
        payload = jwt.decode(token, str(SECRET_KEY or 'dev-secret-key-change-in-production'), algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

sites_bp = Blueprint('sites', __name__)

# 사용자 목록 조회 API (연락처용)
@sites_bp.route('/users', methods=['GET'])
def get_users():
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401

        q = request.args.get('q')  # 검색어

        query = supabase.table('users').select('id, name, phone, user_role')
        rows = query.execute()
        items = rows.data or []

        # 더미 데이터인 경우 샘플 사용자 반환
        if not items and (not supabase_url or not supabase_key):
            items = [
                {'id': 1, 'name': '홍길동', 'phone': '010-1234-5678', 'user_role': 'user'},
                {'id': 2, 'name': '김영업', 'phone': '010-9876-5432', 'user_role': 'admin'},
                {'id': 3, 'name': '이현장', 'phone': '010-5555-1234', 'user_role': 'user'},
                {'id': 4, 'name': '박관리', 'phone': '010-7777-8888', 'user_role': 'admin'}
            ]

        # 간단한 서버측 필터링 (name 포함 검색)
        if q:
            ql = q.lower()
            items = [it for it in items if (it.get('name','').lower().find(ql) >= 0)]

        return jsonify({'items': items}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 마스터 인명 조회 (역할별 필터 및 검색)
@sites_bp.route('/contacts-master', methods=['GET'])
def get_contacts_master():
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401

        role = request.args.get('role')  # pm | sales | None
        q = request.args.get('q')  # 검색어

        query = supabase.table('contacts_master').select('*').eq('active', True)
        if role in ['pm','sales']:
            query = query.eq('role', role)
        rows = query.execute()
        items = rows.data or []

        # 간단한 서버측 필터링 (name 포함 검색)
        if q:
            ql = q.lower()
            items = [it for it in items if (it.get('name','').lower().find(ql) >= 0)]

        return jsonify({'items': items}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 마스터 인명 추가/수정 (관리자 전용)
@sites_bp.route('/contacts-master', methods=['POST','PATCH'])
def upsert_contacts_master():
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        if payload.get('user_role') != 'admin':
            return jsonify({'error': '관리자만 접근 가능합니다.'}), 403

        data = request.get_json() or {}
        # 기대 필드: id(optional), name, role(pm|sales), phone, active
        item = {
            'name': data.get('name'),
            'role': data.get('role'),
            'phone': data.get('phone'),
            'active': data.get('active', True),
            'updated_at': datetime.utcnow().isoformat()
        }
        if not item['name'] or item['role'] not in ['pm','sales']:
            return jsonify({'error': 'name과 role(pm|sales)은 필수입니다.'}), 400

        if data.get('id'):
            # update
            res = supabase.table('contacts_master').update(item).eq('id', data['id']).execute()
        else:
            # insert
            item['created_at'] = datetime.utcnow().isoformat()
            res = supabase.table('contacts_master').insert(item).execute()

        return jsonify({'item': (res.data[0] if res.data else None)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 현장 등록
@sites_bp.route('/sites', methods=['POST'])
def create_site():
    try:
        # 인증 확인
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        
        data = request.get_json()
        
        # 필수 필드 검증
        required_fields = ['project_no', 'construction_company', 'site_name', 'address', 'household_count']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field}는 필수 입력 항목입니다.'}), 400
        
        # 등록번호는 더 이상 사용하지 않음
        
        # 현장 데이터 생성
        site_data = {
            'project_no': data['project_no'],
            'construction_company': data['construction_company'],
            'site_name': data['site_name'],
            'address': data['address'],
            'detail_address': data.get('detail_address', ''),
            'household_count': data['household_count'],
            'registration_date': data.get('registration_date'),
            'delivery_date': data.get('delivery_date'),
            'completion_date': data.get('completion_date'),
            'certification_audit': data.get('certification_audit', 'N'),
            'home_iot': data.get('home_iot', 'N'),
            'product_bi': data.get('product_bi'),
            'created_by': payload['user_id'],
            'created_at': datetime.utcnow().isoformat()
        }
        
        result = supabase.table('sites').insert(site_data).execute()
        
        # 더미 데이터인 경우에도 성공으로 처리
        if result.data or not supabase_url or not supabase_key:
            # 더미 데이터인 경우 가짜 현장 데이터 반환
            dummy_site = {
                'id': 1,
                'project_no': site_data['project_no'],
                'construction_company': site_data['construction_company'],
                'site_name': site_data['site_name'],
                'address': site_data['address'],
                'created_by': site_data['created_by']
            }
            return jsonify({
                'message': '현장이 성공적으로 등록되었습니다.',
                'site': dummy_site if not result.data else result.data[0]
            }), 201
        else:
            return jsonify({'error': '현장 등록 중 오류가 발생했습니다.'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 현장 목록 조회
@sites_bp.route('/sites', methods=['GET'])
def get_sites():
    try:
        # 인증 확인
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        
        # 관리자는 모든 현장 조회, 일반사용자는 본인이 등록한 현장만 조회
        if payload['user_role'] == 'admin':
            sites = supabase.table('sites').select('*').order('id', desc=True).execute()
        else:
            sites = supabase.table('sites').select('*').eq('created_by', payload['user_id']).order('id', desc=True).execute()
        
        # 더미 데이터인 경우 빈 배열 반환
        sites_data = sites.data if sites.data else []
        
        return jsonify({'sites': sites_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 특정 현장 상세 조회
@sites_bp.route('/sites/<int:site_id>', methods=['GET'])
def get_site_detail(site_id):
    try:
        # 인증 확인
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        
        # 현장 조회
        site = supabase.table('sites').select('*').eq('id', site_id).execute()
        
        if not site.data:
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        
        site_info = site.data[0]
        
        # 권한 확인 (관리자가 아닌 경우 본인이 등록한 현장만 조회 가능)
        if payload['user_role'] != 'admin' and site_info['created_by'] != payload['user_id']:
            return jsonify({'error': '접근 권한이 없습니다.'}), 403
        
        return jsonify({'site': site_info}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 현장 기본정보 수정
@sites_bp.route('/sites/<int:site_id>', methods=['PATCH','PUT'])
def update_site(site_id):
    try:
        print(f"🔧 현장 수정 요청: ID {site_id}")
        print(f"📝 요청 데이터: {request.get_json()}")
        print(f"🔑 인증 헤더: {request.headers.get('Authorization', '없음')}")
        print(f"🌐 Supabase URL: {supabase_url}")
        print(f"🔑 Supabase Key: {supabase_key[:20]}..." if supabase_key else "❌ Supabase Key 없음")
        
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            print("❌ 인증 헤더 없음")
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        
        # 권한 확인
        print(f"🔍 권한 확인 중: site_id={site_id}")
        try:
            site = supabase.table('sites').select('id, created_by').eq('id', site_id).execute()
            print(f"✅ 권한 확인 성공: {site.data}")
        except Exception as db_error:
            print(f"❌ 권한 확인 실패: {db_error}")
            return jsonify({'error': f'데이터베이스 연결 오류: {str(db_error)}'}), 500
            
        if not site.data:
            print("❌ 현장을 찾을 수 없음")
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        site_info = site.data[0]
        if payload['user_role'] != 'admin' and site_info['created_by'] != payload['user_id']:
            print("❌ 접근 권한 없음")
            return jsonify({'error': '접근 권한이 없습니다.'}), 403
        
        data = request.get_json()
        update_data = {
            'project_no': data.get('project_no'),
            'construction_company': data.get('construction_company'),
            'site_name': data.get('site_name'),
            'address': data.get('address'),
            'detail_address': data.get('detail_address'),
            'household_count': data.get('household_count'),
            'registration_date': data.get('registration_date') if data.get('registration_date') else None,
            'delivery_date': data.get('delivery_date') if data.get('delivery_date') else None,
            'completion_date': data.get('completion_date') if data.get('completion_date') else None,
            'certification_audit': data.get('certification_audit'),
            'home_iot': data.get('home_iot'),
            'product_bi': data.get('product_bi'),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # None 값 제거
        update_data = {k: v for k, v in update_data.items() if v is not None}
        print(f"📝 업데이트할 데이터: {update_data}")
        
        try:
            result = supabase.table('sites').update(update_data).eq('id', site_id).execute()
            print(f"✅ 데이터베이스 업데이트 성공: {result.data}")
        except Exception as update_error:
            print(f"❌ 데이터베이스 업데이트 실패: {update_error}")
            return jsonify({'error': f'데이터베이스 업데이트 오류: {str(update_error)}'}), 500
        
        if result.data:
            return jsonify({'message': '현장 정보가 수정되었습니다.', 'site': result.data[0]}), 200
        else:
            return jsonify({'error': '현장 정보 수정 중 오류가 발생했습니다.'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 현장 연락처 조회
@sites_bp.route('/sites/<int:site_id>/contacts', methods=['GET'])
def get_site_contacts(site_id):
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        # 권한 확인
        site = supabase.table('sites').select('id, created_by').eq('id', site_id).execute()
        if not site.data:
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        site_info = site.data[0]
        if payload['user_role'] != 'admin' and site_info['created_by'] != payload['user_id']:
            return jsonify({'error': '접근 권한이 없습니다.'}), 403
        contacts = supabase.table('site_contacts').select('*').eq('site_id', site_id).limit(1).execute()
        return jsonify({'contacts': contacts.data[0] if contacts.data else None}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 현장 제품수량 저장(업서트) - 프론트엔드용
@sites_bp.route('/sites/<int:site_id>/products', methods=['POST'])
def upsert_site_products(site_id):
    try:
        print(f"🔍 제품수량 저장 요청 - 현장 ID: {site_id}")
        print(f"📝 Raw 데이터: {request.get_data()}")
        print(f"📝 Content-Type: {request.headers.get('Content-Type', '없음')}")
        
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        
        # JSON 데이터 안전하게 파싱
        try:
            data = request.get_json()
            print(f"📝 파싱된 JSON 데이터: {data}")
        except Exception as json_error:
            print(f"❌ JSON 파싱 오류: {json_error}")
            return jsonify({'error': '잘못된 JSON 형식입니다.'}), 400
        
        # 권한 확인
        site = supabase.table('sites').select('id, created_by').eq('id', site_id).execute()
        if not site.data:
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        site_info = site.data[0]
        if payload['user_role'] != 'admin' and site_info['created_by'] != payload['user_id']:
            return jsonify({'error': '접근 권한이 없습니다.'}), 403
        
        payload_data = {
            'site_id': site_id,
            'project_no': data.get('project_no'),
            'wallpad_model': data.get('wallpad_model'),
            'wallpad_qty': data.get('wallpad_qty', 0),
            'doorphone_model': data.get('doorphone_model'),
            'doorphone_qty': data.get('doorphone_qty', 0),
            'lobbyphone_model': data.get('lobbyphone_model'),
            'lobbyphone_qty': data.get('lobbyphone_qty', 0),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # None 값 제거
        payload_data = {k: v for k, v in payload_data.items() if v is not None}
        print(f"💾 저장할 데이터: {payload_data}")
        
        existing = supabase.table('site_products').select('id').eq('site_id', site_id).limit(1).execute()
        if existing.data:
            # 기존 데이터 업데이트
            result = supabase.table('site_products').update(payload_data).eq('id', existing.data[0]['id']).execute()
        else:
            # 새 데이터 삽입
            payload_data['created_at'] = datetime.utcnow().isoformat()
            result = supabase.table('site_products').insert(payload_data).execute()
        
        print(f"✅ 제품수량 저장 성공: {result.data[0] if result.data else 'None'}")
        if result.data:
            return jsonify({'message': '제품수량 정보가 저장되었습니다.', 'products': result.data[0]}), 200
        else:
            return jsonify({'error': '제품수량 정보 저장 중 오류가 발생했습니다.'}), 500
            
    except Exception as e:
        print(f"❌ 제품수량 저장 오류: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 현장 연락처 저장(업서트)
@sites_bp.route('/sites/<int:site_id>/contacts', methods=['POST'])
def upsert_site_contacts(site_id):
    try:
        print(f"🔍 연락처 저장 요청 - 현장 ID: {site_id}")
        print(f"📝 Raw 데이터: {request.get_data()}")
        print(f"📝 Content-Type: {request.headers.get('Content-Type', '없음')}")
        
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        
        # JSON 데이터 안전하게 파싱
        try:
            data = request.get_json()
            print(f"📝 파싱된 JSON 데이터: {data}")
        except Exception as json_error:
            print(f"❌ JSON 파싱 오류: {json_error}")
            return jsonify({'error': '잘못된 JSON 형식입니다.'}), 400
        
        # 권한 확인
        site = supabase.table('sites').select('id, created_by').eq('id', site_id).execute()
        if not site.data:
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        site_info = site.data[0]
        if payload['user_role'] != 'admin' and site_info['created_by'] != payload['user_id']:
            return jsonify({'error': '접근 권한이 없습니다.'}), 403
        
        payload_data = {
            'site_id': site_id,
            'project_no': data.get('project_no'),
            'pm_name': data.get('pm_name'),
            'pm_phone': data.get('pm_phone'),
            'sales_manager_name': data.get('sales_manager_name'),
            'sales_manager_phone': data.get('sales_manager_phone'),
            'construction_manager_name': data.get('construction_manager_name'),
            'construction_manager_phone': data.get('construction_manager_phone'),
            'installer_name': data.get('installer_name'),
            'installer_phone': data.get('installer_phone'),
            'network_manager_name': data.get('network_manager_name'),
            'network_manager_phone': data.get('network_manager_phone'),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # None 값 제거
        payload_data = {k: v for k, v in payload_data.items() if v is not None}
        print(f"💾 저장할 데이터: {payload_data}")
        
        existing = supabase.table('site_contacts').select('id').eq('site_id', site_id).limit(1).execute()
        if existing.data:
            contact_id = existing.data[0]['id']
            result = supabase.table('site_contacts').update(payload_data).eq('id', contact_id).execute()
        else:
            result = supabase.table('site_contacts').insert(payload_data).execute()
        
        print(f"✅ 연락처 저장 성공: {result.data[0] if result.data else 'None'}")
        return jsonify({'message': '연락처가 저장되었습니다.', 'contacts': result.data[0]}), 200
    except Exception as e:
        print(f"❌ 연락처 저장 오류: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 세대부연동 조회 (조명SW/대기전력SW/가스감지기)
@sites_bp.route('/sites/<int:site_id>/integrations/household', methods=['GET'])
def get_household_integrations(site_id):
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        # 권한 확인
        site = supabase.table('sites').select('id, created_by').eq('id', site_id).execute()
        if not site.data:
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        site_info = site.data[0]
        if payload['user_role'] != 'admin' and site_info['created_by'] != payload['user_id']:
            return jsonify({'error': '접근 권한이 없습니다.'}), 403

        types = ['lighting_sw','standby_power_sw','gas_detector','heating','ventilation','door_lock','air_conditioner','real_time_metering','environment_sensor']
        rows = supabase.table('site_household_integrations').select('*').eq('site_id', site_id).in_('integration_type', types).execute()
        return jsonify({'items': rows.data or []}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 세대부연동 저장(업서트)
@sites_bp.route('/sites/<int:site_id>/integrations/household', methods=['POST'])
def upsert_household_integrations(site_id):
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        # 권한 확인
        site = supabase.table('sites').select('id, created_by').eq('id', site_id).execute()
        if not site.data:
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        site_info = site.data[0]
        if payload['user_role'] != 'admin' and site_info['created_by'] != payload['user_id']:
            return jsonify({'error': '접근 권한이 없습니다.'}), 403

        data = request.get_json() or {}
        items = data.get('items', [])
        print(f"📝 세대부 저장 요청 items: {items}")

        def _normalize(v):
            if v is None:
                return None
            if isinstance(v, str):
                v2 = v.strip()
                return v2 if v2 != '' else None
            return v

        def _yn(v):
            return 'Y' if str(v or 'N').strip().upper() == 'Y' else 'N'

        saved = []
        allowed = ['lighting_sw','standby_power_sw','gas_detector','heating','ventilation','door_lock','air_conditioner','real_time_metering','environment_sensor']
        for item in items:
            itype = (item.get('integration_type') or '').strip()
            if itype not in allowed:
                print(f"⚠️ 허용되지 않은 타입(세대부): {itype}")
                continue
            payload_data = {
                'site_id': site_id,
                'project_no': _normalize(item.get('project_no')),
                'integration_type': itype,
                'enabled': _yn(item.get('enabled')),
                'company_name': _normalize(item.get('company_name')),
                'contact_person': _normalize(item.get('contact_person')),
                'contact_phone': _normalize(item.get('contact_phone')),
                'notes': _normalize(item.get('notes')),
                'updated_at': datetime.utcnow().isoformat()
            }
            print(f"➡️ 업서트 시도(세대부): {payload_data}")

            # 1) 업데이트 우선(site_id + integration_type)
            try:
                upd = supabase.table('site_household_integrations').update(payload_data).eq('site_id', site_id).eq('integration_type', itype).execute()
                if upd.data:
                    print(f"✅ 업데이트 성공(세대부): {upd.data}")
                    saved.append(upd.data[0])
                    continue
            except Exception as e_upd:
                print(f"❌ 업데이트 오류(세대부): {str(e_upd)}")

            # 2) 없으면 삽입
            try:
                payload_insert = dict(payload_data)
                payload_insert['created_at'] = datetime.utcnow().isoformat()
                ins = supabase.table('site_household_integrations').insert(payload_insert).execute()
                print(f"✅ 삽입 성공(세대부): {ins.data}")
                if ins.data:
                    saved.append(ins.data[0])
            except Exception as e_ins:
                print(f"❌ 삽입 오류(세대부): {str(e_ins)}")
                return jsonify({'error': '세대부연동 저장 실패', 'error_detail': str(e_ins)}), 500

        return jsonify({'message': '세대부연동이 저장되었습니다.', 'items': saved}), 200
    except Exception as e:
        print(f"❌ 세대부연동 전체 오류: {str(e)}")
        return jsonify({'error': '세대부연동 저장 실패', 'error_detail': str(e)}), 500

# 공용부연동 조회 (주차관제/원격검침/CCTV)
@sites_bp.route('/sites/<int:site_id>/integrations/common', methods=['GET'])
def get_common_integrations(site_id):
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        # 권한 확인
        site = supabase.table('sites').select('id, created_by').eq('id', site_id).execute()
        if not site.data:
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        site_info = site.data[0]
        if payload['user_role'] != 'admin' and site_info['created_by'] != payload['user_id']:
            return jsonify({'error': '접근 권한이 없습니다.'}), 403

        types = ['parking_control','remote_metering','cctv','elevator','parcel','ev_charger','parking_location','onepass','rf_card']
        rows = supabase.table('site_common_integrations').select('*').eq('site_id', site_id).in_('integration_type', types).execute()
        return jsonify({'items': rows.data or []}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 현장 세대부연동 저장(업서트) - 프론트엔드용
@sites_bp.route('/sites/<int:site_id>/household', methods=['POST'])
def upsert_site_household(site_id):
    try:
        print(f"🔍 세대부연동 저장 요청 - 현장 ID: {site_id}")
        print(f"📝 Raw 데이터: {request.get_data()}")
        print(f"📝 Content-Type: {request.headers.get('Content-Type', '없음')}")
        
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        
        # JSON 데이터 안전하게 파싱
        try:
            data = request.get_json()
            print(f"📝 파싱된 JSON 데이터: {data}")
        except Exception as json_error:
            print(f"❌ JSON 파싱 오류: {json_error}")
            return jsonify({'error': '잘못된 JSON 형식입니다.'}), 400
        
        # 권한 확인
        site = supabase.table('sites').select('id, created_by').eq('id', site_id).execute()
        if not site.data:
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        site_info = site.data[0]
        if payload['user_role'] != 'admin' and site_info['created_by'] != payload['user_id']:
            return jsonify({'error': '접근 권한이 없습니다.'}), 403
        
        payload_data = {
            'site_id': site_id,
            'project_no': data.get('project_no'),
            'lighting_enabled': data.get('lighting_enabled', 'N'),
            'lighting_company': data.get('lighting_company'),
            'standby_enabled': data.get('standby_enabled', 'N'),
            'standby_company': data.get('standby_company'),
            'gas_enabled': data.get('gas_enabled', 'N'),
            'gas_company': data.get('gas_company'),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # None 값 제거
        payload_data = {k: v for k, v in payload_data.items() if v is not None}
        print(f"💾 저장할 데이터: {payload_data}")
        
        existing = supabase.table('site_household_integrations').select('id').eq('site_id', site_id).limit(1).execute()
        if existing.data:
            # 기존 데이터 업데이트
            result = supabase.table('site_household_integrations').update(payload_data).eq('id', existing.data[0]['id']).execute()
        else:
            # 새 데이터 삽입
            payload_data['created_at'] = datetime.utcnow().isoformat()
            result = supabase.table('site_household_integrations').insert(payload_data).execute()
        
        print(f"✅ 세대부연동 저장 성공: {result.data[0] if result.data else 'None'}")
        if result.data:
            return jsonify({'message': '세대부연동 정보가 저장되었습니다.', 'household': result.data[0]}), 200
        else:
            return jsonify({'error': '세대부연동 정보 저장 중 오류가 발생했습니다.'}), 500
            
    except Exception as e:
        print(f"❌ 세대부연동 저장 오류: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 현장 공용부연동 저장(업서트) - 프론트엔드용
@sites_bp.route('/sites/<int:site_id>/common', methods=['POST'])
def upsert_site_common(site_id):
    try:
        print(f"🔍 공용부연동 저장 요청 - 현장 ID: {site_id}")
        print(f"📝 Raw 데이터: {request.get_data()}")
        print(f"📝 Content-Type: {request.headers.get('Content-Type', '없음')}")
        
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        
        # JSON 데이터 안전하게 파싱
        try:
            data = request.get_json()
            print(f"📝 파싱된 JSON 데이터: {data}")
        except Exception as json_error:
            print(f"❌ JSON 파싱 오류: {json_error}")
            return jsonify({'error': '잘못된 JSON 형식입니다.'}), 400
        
        # 권한 확인
        site = supabase.table('sites').select('id, created_by').eq('id', site_id).execute()
        if not site.data:
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        site_info = site.data[0]
        if payload['user_role'] != 'admin' and site_info['created_by'] != payload['user_id']:
            return jsonify({'error': '접근 권한이 없습니다.'}), 403
        
        payload_data = {
            'site_id': site_id,
            'project_no': data.get('project_no'),
            'parking_enabled': data.get('parking_enabled', 'N'),
            'parking_company': data.get('parking_company'),
            'metering_enabled': data.get('metering_enabled', 'N'),
            'metering_company': data.get('metering_company'),
            'cctv_enabled': data.get('cctv_enabled', 'N'),
            'cctv_company': data.get('cctv_company'),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # None 값 제거
        payload_data = {k: v for k, v in payload_data.items() if v is not None}
        print(f"💾 저장할 데이터: {payload_data}")
        
        existing = supabase.table('site_common_integrations').select('id').eq('site_id', site_id).limit(1).execute()
        if existing.data:
            # 기존 데이터 업데이트
            result = supabase.table('site_common_integrations').update(payload_data).eq('id', existing.data[0]['id']).execute()
        else:
            # 새 데이터 삽입
            payload_data['created_at'] = datetime.utcnow().isoformat()
            result = supabase.table('site_common_integrations').insert(payload_data).execute()
        
        print(f"✅ 공용부연동 저장 성공: {result.data[0] if result.data else 'None'}")
        if result.data:
            return jsonify({'message': '공용부연동 정보가 저장되었습니다.', 'common': result.data[0]}), 200
        else:
            return jsonify({'error': '공용부연동 정보 저장 중 오류가 발생했습니다.'}), 500
            
    except Exception as e:
        print(f"❌ 공용부연동 저장 오류: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 공용부연동 저장(업서트)
@sites_bp.route('/sites/<int:site_id>/integrations/common', methods=['POST'])
def upsert_common_integrations(site_id):
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        # 권한 확인
        site = supabase.table('sites').select('id, created_by').eq('id', site_id).execute()
        if not site.data:
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        site_info = site.data[0]
        if payload['user_role'] != 'admin' and site_info['created_by'] != payload['user_id']:
            return jsonify({'error': '접근 권한이 없습니다.'}), 403

        data = request.get_json() or {}
        items = data.get('items', [])
        print(f"📝 공용부 저장 요청 items: {items}")

        def _normalize(v):
            if v is None:
                return None
            if isinstance(v, str):
                v2 = v.strip()
                return v2 if v2 != '' else None
            return v

        def _yn(v):
            return 'Y' if str(v or 'N').strip().upper() == 'Y' else 'N'

        saved = []
        allowed = ['parking_control','remote_metering','cctv','elevator','parcel','ev_charger','parking_location','onepass','rf_card']
        for item in items:
            itype = (item.get('integration_type') or '').strip()
            if itype not in allowed:
                print(f"⚠️ 허용되지 않은 타입(공용부): {itype}")
                continue
            payload_data = {
                'site_id': site_id,
                'project_no': _normalize(item.get('project_no')),
                'integration_type': itype,
                'enabled': _yn(item.get('enabled')),
                'company_name': _normalize(item.get('company_name')),
                'contact_person': _normalize(item.get('contact_person')),
                'contact_phone': _normalize(item.get('contact_phone')),
                'notes': _normalize(item.get('notes')),
                'updated_at': datetime.utcnow().isoformat()
            }
            print(f"➡️ 업서트 시도(공용부): {payload_data}")

            # 1) 업데이트 우선(site_id + integration_type)
            try:
                upd = supabase.table('site_common_integrations').update(payload_data).eq('site_id', site_id).eq('integration_type', itype).execute()
                if upd.data:
                    print(f"✅ 업데이트 성공(공용부): {upd.data}")
                    saved.append(upd.data[0])
                    continue
            except Exception as e_upd:
                print(f"❌ 업데이트 오류(공용부): {str(e_upd)}")

            # 2) 없으면 삽입
            try:
                payload_insert = dict(payload_data)
                payload_insert['created_at'] = datetime.utcnow().isoformat()
                ins = supabase.table('site_common_integrations').insert(payload_insert).execute()
                print(f"✅ 삽입 성공(공용부): {ins.data}")
                if ins.data:
                    saved.append(ins.data[0])
            except Exception as e_ins:
                print(f"❌ 삽입 오류(공용부): {str(e_ins)}")
                return jsonify({'error': '공용부연동 저장 실패', 'error_detail': str(e_ins)}), 500

        return jsonify({'message': '공용부연동이 저장되었습니다.', 'items': saved}), 200
    except Exception as e:
        print(f"❌ 공용부연동 전체 오류: {str(e)}")
        return jsonify({'error': '공용부연동 저장 실패', 'error_detail': str(e)}), 500

# 제품수량 조회 (평면 스키마: wallpad_*, doorphone_*, lobbyphone_*)
@sites_bp.route('/sites/<int:site_id>/products', methods=['GET'])
def get_site_products(site_id):
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        # 권한 확인
        site = supabase.table('sites').select('id, created_by').eq('id', site_id).execute()
        if not site.data:
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        site_info = site.data[0]
        if payload['user_role'] != 'admin' and site_info['created_by'] != payload['user_id']:
            return jsonify({'error': '접근 권한이 없습니다.'}), 403
        row = supabase.table('site_products').select('*').eq('site_id', site_id).limit(1).execute()
        return jsonify({'products': (row.data[0] if row.data else None)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500



# =============================
# 현장별 업무관리: Work Items / Alarms
# =============================

@sites_bp.route('/sites/<int:site_id>/work-items', methods=['GET'])
def list_work_items(site_id):
    try:
        # 인증 체크
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401

        # 권한 확인
        site = supabase.table('sites').select('id, created_by, site_name').eq('id', site_id).execute()
        if not site.data:
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        site_info = site.data[0]
        if payload['user_role'] != 'admin' and site_info['created_by'] != payload['user_id']:
            return jsonify({'error': '접근 권한이 없습니다.'}), 403

        status = (request.args.get('status') or '').strip().lower()
        q = supabase.table('work_items').select('*').eq('site_id', site_id)
        if status in ['todo', 'done']:
            q = q.eq('status', status)
        rows = q.order('id', desc=True).execute()
        return jsonify({'items': rows.data or []}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sites_bp.route('/sites/<int:site_id>/work-items', methods=['POST'])
def upsert_work_items(site_id):
    """배열 업서트: To do/Done 일괄 저장
    입력 스키마: { items: [ {id?, content, alarm_date?, status('todo'|'done'), done_date?} ] }
    규칙:
      - status=done 저장 시 To do 항목은 status만 'done'으로 업데이트(= To do에서 제외)
      - status=todo 저장 시 alarm_confirmed는 기본 false 유지
    """
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401

        # 권한 확인
        site = supabase.table('sites').select('id, created_by').eq('id', site_id).execute()
        if not site.data:
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        site_info = site.data[0]
        if payload['user_role'] != 'admin' and site_info['created_by'] != payload['user_id']:
            return jsonify({'error': '접근 권한이 없습니다.'}), 403

        data = request.get_json() or {}
        items = data.get('items', [])
        if not isinstance(items, list):
            return jsonify({'error': 'items 배열이 필요합니다.'}), 400

        saved = []
        for it in items:
            content = (it.get('content') or '').strip()
            if not content:
                continue
            status = (it.get('status') or 'todo').strip().lower()
            if status not in ['todo','done']:
                status = 'todo'
            payload_data = {
                'site_id': site_id,
                'content': content,
                'status': status,
                'alarm_date': (it.get('alarm_date') or None),
                'done_date': (it.get('done_date') or None),
                'updated_at': datetime.utcnow().isoformat(),
                'created_by': payload['user_id']
            }
            # done 저장인데 done_date가 없으면 클라이언트 로컬 날짜를 못받은 경우를 대비해 서버 날짜로 보정
            if status == 'done' and not payload_data['done_date']:
                payload_data['done_date'] = date.today().isoformat()

            # todo 상태인 경우 새 알람은 미확인으로 유지
            if status == 'todo':
                payload_data['alarm_confirmed'] = False

            if it.get('id'):
                # 업데이트 (상태 전환 포함)
                res = supabase.table('work_items').update(payload_data).eq('id', it['id']).eq('site_id', site_id).execute()
                if res.data:
                    saved.append(res.data[0])
            else:
                payload_data['created_at'] = datetime.utcnow().isoformat()
                res = supabase.table('work_items').insert(payload_data).execute()
                if res.data:
                    saved.append(res.data[0])

        return jsonify({'message': '작업 항목이 저장되었습니다.', 'items': saved}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sites_bp.route('/sites/<int:site_id>/alarms', methods=['GET'])
def list_alarms(site_id):
    """알람 목록: 조건 alarm_date <= today AND alarm_confirmed = false AND status='todo'"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401

        # 권한 확인
        site = supabase.table('sites').select('id, created_by, site_name').eq('id', site_id).execute()
        if not site.data:
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        site_info = site.data[0]
        if payload['user_role'] != 'admin' and site_info['created_by'] != payload['user_id']:
            return jsonify({'error': '접근 권한이 없습니다.'}), 403

        # today는 클라이언트 로컬 날짜(YYYY-MM-DD) 전달 가능, 없으면 서버 날짜 사용
        today = (request.args.get('today') or date.today().isoformat())

        rows = supabase.table('work_items').select('*') \
            .eq('site_id', site_id) \
            .eq('status', 'todo') \
            .eq('alarm_confirmed', False) \
            .lte('alarm_date', today) \
            .order('id', desc=True).execute()

        items = rows.data or []
        # site_name 포함
        for it in items:
            it['site_name'] = site_info.get('site_name')
        return jsonify({'items': items, 'count': len(items)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sites_bp.route('/sites/<int:site_id>/alarms/confirm', methods=['POST'])
def confirm_alarms(site_id):
    """체크된 알람을 확인 처리: 목록에서 제거되지만 원본의 alarm_date는 유지하고 alarm_confirmed=True로 설정"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401

        # 권한 확인
        site = supabase.table('sites').select('id, created_by').eq('id', site_id).execute()
        if not site.data:
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        site_info = site.data[0]
        if payload['user_role'] != 'admin' and site_info['created_by'] != payload['user_id']:
            return jsonify({'error': '접근 권한이 없습니다.'}), 403

        data = request.get_json() or {}
        ids = data.get('ids', [])
        if not ids:
            return jsonify({'message': '확인할 항목이 없습니다.', 'updated': 0}), 200
        # 일괄 업데이트
        res = supabase.table('work_items').update({
            'alarm_confirmed': True,
            'updated_at': datetime.utcnow().isoformat()
        }).in_('id', ids).eq('site_id', site_id).execute()
        updated_count = len(res.data or [])
        return jsonify({'message': '알람이 확인 처리되었습니다.', 'updated': updated_count}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 프로젝트 번호 중복 체크
@sites_bp.route('/check-project-no', methods=['POST'])
def check_project_no():
    try:
        print(f"🔍 프로젝트 번호 중복 체크 요청")
        print(f"🔑 인증 헤더: {request.headers.get('Authorization', '없음')}")
        print(f"📝 Content-Type: {request.headers.get('Content-Type', '없음')}")
        print(f"📝 Raw 데이터: {request.get_data()}")
        
        # JSON 데이터 안전하게 파싱
        try:
            data = request.get_json()
            print(f"📝 파싱된 JSON 데이터: {data}")
        except Exception as json_error:
            print(f"❌ JSON 파싱 오류: {json_error}")
            return jsonify({'error': '잘못된 JSON 형식입니다.'}), 400
        
        # 인증 확인
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            print("❌ 인증 헤더 없음")
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        
        data = request.get_json()
        project_no = data.get('project_no')
        
        if not project_no:
            return jsonify({'error': '프로젝트 번호가 필요합니다.'}), 400
        
        # 프로젝트 번호 형식 검증 (NA/XXXX 또는 NE/XXXX)
        import re
        if not re.match(r'^(NA|NE)/\d{4}$', project_no):
            return jsonify({'error': '프로젝트 번호 형식이 올바르지 않습니다. (예: NA/1234, NE/5678)'}), 400
        
        # 중복 체크
        existing = supabase.table('sites').select('id, site_name').eq('project_no', project_no).execute()
        
        # 더미 데이터인 경우 항상 사용 가능으로 처리
        if not supabase_url or not supabase_key:
            return jsonify({
                'is_duplicate': False,
                'message': f'프로젝트 번호 "{project_no}"를 사용할 수 있습니다.'
            }), 200
        elif existing.data:
            return jsonify({
                'is_duplicate': True,
                'message': f'프로젝트 번호 "{project_no}"가 이미 사용 중입니다.',
                'existing_site': existing.data[0]
            }), 200
        else:
            return jsonify({
                'is_duplicate': False,
                'message': f'프로젝트 번호 "{project_no}"를 사용할 수 있습니다.'
            }), 200
            
    except Exception as e:
        print(f"❌ 프로젝트 번호 중복 체크 오류: {str(e)}")
        print(f"🔍 오류 타입: {type(e).__name__}")
        import traceback
        print(f"📚 스택 트레이스: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


