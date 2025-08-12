from flask import Blueprint, request, jsonify
from datetime import datetime
import jwt
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# 환경 변수 로드
load_dotenv()

# Supabase 클라이언트 초기화
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_ANON_KEY')
supabase: Client = create_client(supabase_url, supabase_key)

# JWT 토큰 검증 함수
def verify_token(token):
    try:
        payload = jwt.decode(token, os.getenv('FLASK_SECRET_KEY'), algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

sites_bp = Blueprint('sites', __name__)

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
        
        # 등록번호 자동 생성 (숫자 증가)
        existing_sites = supabase.table('sites').select('registration_no').order('registration_no', desc=True).limit(1).execute()
        
        if existing_sites.data:
            last_reg_no = existing_sites.data[0]['registration_no']
            new_reg_no = last_reg_no + 1
        else:
            new_reg_no = 1
        
        # 현장 데이터 생성
        site_data = {
            'registration_no': new_reg_no,
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
            'created_by': payload['user_id'],
            'created_at': datetime.utcnow().isoformat()
        }
        
        result = supabase.table('sites').insert(site_data).execute()
        
        if result.data:
            return jsonify({
                'message': '현장이 성공적으로 등록되었습니다.',
                'site': result.data[0]
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
            sites = supabase.table('sites').select('*').order('registration_no', desc=True).execute()
        else:
            sites = supabase.table('sites').select('*').eq('created_by', payload['user_id']).order('registration_no', desc=True).execute()
        
        return jsonify({'sites': sites.data}), 200
        
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
        
        data = request.get_json()
        update_data = {
            'project_no': data.get('project_no'),
            'construction_company': data.get('construction_company'),
            'site_name': data.get('site_name'),
            'address': data.get('address'),
            'detail_address': data.get('detail_address'),
            'household_count': data.get('household_count'),
            'registration_date': data.get('registration_date'),
            'delivery_date': data.get('delivery_date'),
            'completion_date': data.get('completion_date'),
            'certification_audit': data.get('certification_audit'),
            'home_iot': data.get('home_iot'),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # None 값 제거
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        result = supabase.table('sites').update(update_data).eq('id', site_id).execute()
        
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

# 현장 연락처 저장(업서트)
@sites_bp.route('/sites/<int:site_id>/contacts', methods=['POST'])
def upsert_site_contacts(site_id):
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
        payload_data = {
            'site_id': site_id,
            'registration_no': data.get('registration_no'),
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
        }
        existing = supabase.table('site_contacts').select('id').eq('site_id', site_id).limit(1).execute()
        if existing.data:
            contact_id = existing.data[0]['id']
            result = supabase.table('site_contacts').update(payload_data).eq('id', contact_id).execute()
        else:
            result = supabase.table('site_contacts').insert(payload_data).execute()
        return jsonify({'message': '연락처가 저장되었습니다.', 'contacts': result.data[0]}), 200
    except Exception as e:
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

        types = ['lighting_sw','standby_power_sw','gas_detector']
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
        saved = []
        allowed = ['lighting_sw','standby_power_sw','gas_detector']
        for item in items:
            itype = item.get('integration_type')
            if itype not in allowed:
                continue
            payload_data = {
                'site_id': site_id,
                'registration_no': item.get('registration_no'),
                'project_no': item.get('project_no'),
                'integration_type': itype,
                'enabled': (item.get('enabled') or 'N'),
                'company_name': item.get('company_name')
            }
            existing = supabase.table('site_household_integrations').select('id').eq('site_id', site_id).eq('integration_type', itype).limit(1).execute()
            if existing.data:
                iid = existing.data[0]['id']
                res = supabase.table('site_household_integrations').update(payload_data).eq('id', iid).execute()
            else:
                res = supabase.table('site_household_integrations').insert(payload_data).execute()
            if res.data:
                saved.append(res.data[0])
        return jsonify({'message': '세대부연동이 저장되었습니다.', 'items': saved}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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

        types = ['parking_control','remote_metering','cctv']
        rows = supabase.table('site_common_integrations').select('*').eq('site_id', site_id).in_('integration_type', types).execute()
        return jsonify({'items': rows.data or []}), 200
    except Exception as e:
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
        saved = []
        allowed = ['parking_control','remote_metering','cctv']
        for item in items:
            itype = item.get('integration_type')
            if itype not in allowed:
                continue
            payload_data = {
                'site_id': site_id,
                'registration_no': item.get('registration_no'),
                'project_no': item.get('project_no'),
                'integration_type': itype,
                'enabled': (item.get('enabled') or 'N'),
                'company_name': item.get('company_name')
            }
            existing = supabase.table('site_common_integrations').select('id').eq('site_id', site_id).eq('integration_type', itype).limit(1).execute()
            if existing.data:
                iid = existing.data[0]['id']
                res = supabase.table('site_common_integrations').update(payload_data).eq('id', iid).execute()
            else:
                res = supabase.table('site_common_integrations').insert(payload_data).execute()
            if res.data:
                saved.append(res.data[0])
        return jsonify({'message': '공용부연동이 저장되었습니다.', 'items': saved}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 제품수량 조회
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
        products = supabase.table('site_products').select('*').eq('site_id', site_id).in_('product_type', ['wallpad','doorphone','lobbyphone']).execute()
        return jsonify({'products': products.data or []}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 제품수량 저장(업서트, 월패드/도어폰/로비폰)
@sites_bp.route('/sites/<int:site_id>/products', methods=['POST'])
def upsert_site_products(site_id):
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
        saved = []
        for item in items:
            ptype = item.get('product_type')
            if ptype not in ['wallpad','doorphone','lobbyphone']:
                continue
            payload_data = {
                'site_id': site_id,
                'registration_no': item.get('registration_no'),
                'project_no': item.get('project_no'),
                'product_type': ptype,
                'product_model': item.get('product_model'),
                'quantity': item.get('quantity') or 0,
            }
            existing = supabase.table('site_products').select('id').eq('site_id', site_id).eq('product_type', ptype).limit(1).execute()
            if existing.data:
                pid = existing.data[0]['id']
                res = supabase.table('site_products').update(payload_data).eq('id', pid).execute()
            else:
                res = supabase.table('site_products').insert(payload_data).execute()
            if res.data:
                saved.append(res.data[0])
        return jsonify({'message': '제품수량이 저장되었습니다.', 'products': saved}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
