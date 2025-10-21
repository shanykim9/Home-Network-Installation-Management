from flask import Blueprint, request, jsonify, send_from_directory, send_file
from datetime import datetime, date
import jwt
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from pathlib import Path
from io import BytesIO
import zipfile
import json
import requests
import pandas as pd
from typing import Literal
from flask import current_app

# 환경 변수 로드
load_dotenv()

# auth.py와 동일한 기본 비밀키 정책 적용 (토큰 검증 시 일관성)
SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key-change-in-production')

# Supabase 클라이언트 초기화
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_ANON_KEY')
supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')  # Storage 전용 사용 권장

try:
    print(f"[INFO] Supabase URL: {supabase_url}")
    print(f"[INFO] Supabase Key: {supabase_key[:20]}..." if supabase_key else "[WARN] Supabase Key 없음")
except Exception:
    pass

if not supabase_url or not supabase_key:
    try:
        print("[WARN] Supabase 환경 변수가 설정되지 않았습니다! 더미 데이터로 실행됩니다.")
    except Exception:
        pass
    
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
        def delete(self):
            return self
        def execute(self):
            return DummyResult()
        def limit(self, n):
            return self
        def order(self, field, desc=False):
            return self
        def in_(self, field, values):
            return self
        def range(self, start, end):
            return self
    
    class DummyResult:
        def __init__(self):
            self.data = []
    
    supabase = DummySupabase()
    try:
        print("[OK] 더미 Supabase 클라이언트 초기화 완료")
    except Exception:
        pass
else:
    supabase: Client = create_client(supabase_url, supabase_key)
    try:
        print("[OK] Supabase 클라이언트 초기화 완료")
    except Exception:
        pass
    supabase_service: Client | None = None
    try:
        if supabase_service_key:
            supabase_service = create_client(supabase_url, supabase_service_key)
            try:
                print("[OK] Supabase 서비스 키 클라이언트 준비(스토리지 전용)")
            except Exception:
                pass
    except Exception:
        supabase_service = None
        try:
            print("[WARN] Supabase 서비스 키 클라이언트 초기화 실패: 환경 변수 또는 권한을 확인하세요")
        except Exception:
            pass

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
# =============================
# 관리자: 사용자 역할 변경
# =============================
@sites_bp.route('/admin/users/<int:user_id>', methods=['PATCH'])
def admin_update_user_role(user_id):
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

        body = request.get_json() or {}
        new_role = (body.get('user_role') or '').strip()
        if new_role not in ['admin', 'user']:
            return jsonify({'error': 'user_role은 admin 또는 user만 가능합니다.'}), 400
        # 자기 자신을 user로 강등 금지(옵션)
        if user_id == payload.get('user_id') and new_role != 'admin':
            return jsonify({'error': '자기 자신을 일반사용자로 강등할 수 없습니다.'}), 400

        res = supabase.table('users').update({'user_role': new_role}).eq('id', user_id).execute()
        return jsonify({'message': '역할이 변경되었습니다.', 'user': (res.data[0] if res.data else None)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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

        # 관리자 전용으로 제한
        if payload.get('user_role') != 'admin':
            return jsonify({'error': '관리자만 접근 가능합니다.'}), 403

        q = request.args.get('q')  # 검색어

        query = supabase.table('users').select('id, name, phone, user_role')
        rows = query.execute()
        items = rows.data or []

        # 더미 모드에서도 관리자 전용 정책 유지

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
        # 사진 목록은 로그인한 사용자라면 모두 열람 가능(팀 공유 정책 없음)
        site_info = site.data[0]
        contacts = supabase.table('site_contacts').select('*').eq('site_id', site_id).limit(1).execute()
        base = contacts.data[0] if contacts.data else None

        # 추가 연락처(복수) 목록 로드: sales|construction|installer|network
        def _load_list(kind: str):
            try:
                rows = supabase.table('site_contact_people').select('*').eq('site_id', site_id).eq('person_type', kind).order('id', desc=True).execute()
                return [{'name': (r.get('name') or ''), 'phone': (r.get('phone') or '')} for r in (rows.data or [])]
            except Exception as e_list:
                msg = str(e_list)
                # 테이블이 없는 경우에도 빈 리스트 반환
                if 'site_contact_people' in msg and ('does not exist' in msg or 'relation' in msg or 'schema cache' in msg):
                    return []
                # 기타 오류는 빈 리스트로 처리(UX 우선)
                return []

        result = base or {}
        result = dict(result)
        result['sales_list'] = _load_list('sales')
        result['construction_list'] = _load_list('construction')
        result['installer_list'] = _load_list('installer')
        result['network_list'] = _load_list('network')
        return jsonify({'contacts': result}), 200
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
        # 사진 업로드는 로그인한 사용자라면 모두 가능(팀 공유 정책 없음)
        
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
            # 단일 필드(하위 리스트의 첫 항목으로 보정 가능)
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
        
        # 1) 메인 레코드 upsert
        existing = supabase.table('site_contacts').select('id').eq('site_id', site_id).limit(1).execute()
        if existing.data:
            contact_id = existing.data[0]['id']
            result = supabase.table('site_contacts').update(payload_data).eq('id', contact_id).execute()
        else:
            result = supabase.table('site_contacts').insert(payload_data).execute()

        # 2) 복수 연락처 리스트 저장(있다면 교체 방식)
        def _normalize_list(arr):
            if not isinstance(arr, list):
                return []
            norm = []
            for it in arr:
                name = str((it or {}).get('name') or '').strip()
                phone = str((it or {}).get('phone') or '').strip()
                if not name and not phone:
                    continue
                norm.append({'name': name, 'phone': phone})
            return norm

        sales_list = _normalize_list(data.get('sales_list'))
        construction_list = _normalize_list(data.get('construction_list'))
        installer_list = _normalize_list(data.get('installer_list'))
        network_list = _normalize_list(data.get('network_list'))

        # 단일 필드 보정: 첫 항목을 반영(이전 스키마와 호환)
        def _set_first_to_payload(list_val, name_key, phone_key):
            if list_val and not payload_data.get(name_key):
                payload_data[name_key] = list_val[0]['name']
            if list_val and not payload_data.get(phone_key):
                payload_data[phone_key] = list_val[0]['phone']
        _set_first_to_payload(sales_list, 'sales_manager_name', 'sales_manager_phone')
        _set_first_to_payload(construction_list, 'construction_manager_name', 'construction_manager_phone')
        _set_first_to_payload(installer_list, 'installer_name', 'installer_phone')
        _set_first_to_payload(network_list, 'network_manager_name', 'network_manager_phone')

        # 테이블 없을 수 있으므로 안전 처리
        def _replace(kind: str, items: list):
            try:
                # 기존 삭제
                supabase.table('site_contact_people').delete().eq('site_id', site_id).eq('person_type', kind).execute()
            except Exception as e_del:
                # 생성 안된 경우 무시
                if 'site_contact_people' not in str(e_del):
                    pass
            if not items:
                return
            try:
                payload_rows = [{
                    'site_id': site_id,
                    'person_type': kind,
                    'name': it['name'],
                    'phone': it['phone'],
                    'created_by': payload['user_id'],
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                } for it in items]
                supabase.table('site_contact_people').insert(payload_rows).execute()
            except Exception as e_ins:
                # 테이블이 없으면 조용히 패스(프론트에서 SQL 적용 유도)
                if 'site_contact_people' not in str(e_ins):
                    print(f"⚠️ site_contact_people 저장 오류({kind}): {e_ins}")

        _replace('sales', sales_list)
        _replace('construction', construction_list)
        _replace('installer', installer_list)
        _replace('network', network_list)

        print(f"✅ 연락처 저장 성공: {result.data[0] if result.data else 'None'}")
        return jsonify({'message': '연락처가 저장되었습니다.', 'contacts': result.data[0] if result.data else payload_data}), 200
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
# 현장 사진등록 및 관리
# =============================

@sites_bp.route('/sites/<int:site_id>/photos', methods=['GET'])
def list_site_photos(site_id):
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

        # 페이징 파라미터 (기본: page=1, page_size=20)
        try:
            page = max(1, int(request.args.get('page', '1')))
        except Exception:
            page = 1
        try:
            page_size = int(request.args.get('page_size', '20'))
            if page_size <= 0 or page_size > 100:
                page_size = 20
        except Exception:
            page_size = 20
        start = (page - 1) * page_size
        end = start + page_size - 1

        # count 포함하여 조회(가능한 경우)
        try:
            q = supabase.table('site_photos').select('*', count='exact').eq('site_id', site_id)
            # 소프트 삭제 제외(컬럼이 존재할 때만)
            try:
                q = q.is_('deleted_at', None)
            except Exception:
                pass
            rows = q.order('id', desc=True).range(start, end).execute()
            total = getattr(rows, 'count', None)
        except Exception as e_sel:
            # 테이블 미생성/스키마 캐시 오류 시 빈 목록
            msg = str(e_sel)
            if 'site_photos' in msg and (
                'relation' in msg or 'does not exist' in msg or 'schema cache' in msg or 'PGRST' in msg
            ):
                return jsonify({'items': [], 'page': page, 'page_size': page_size, 'total': 0, 'has_more': False}), 200
            try:
                q2 = supabase.table('site_photos').select('*').eq('site_id', site_id)
                try:
                    q2 = q2.is_('deleted_at', None)
                except Exception:
                    pass
                rows = q2.order('id', desc=True).range(start, end).execute()
                total = None
            except Exception as e_sel2:
                return jsonify({'error': f'사진 목록 조회 실패: {str(e_sel2)}'}), 500

        items = rows.data or []
        has_more = False
        if total is not None:
            has_more = (start + len(items)) < total
        else:
            has_more = len(items) == page_size

        return jsonify({'items': items, 'page': page, 'page_size': page_size, 'total': total, 'has_more': has_more}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sites_bp.route('/sites/<int:site_id>/photos', methods=['POST'])
def upload_site_photo(site_id):
    """멀티파트 업로드: title(텍스트), file(이미지)
    - 촬영/앨범 모두 클라이언트가 파일로 업로드
    - 서버는 저장 시 uploaded_at(UTC ISO) 자동 기록
    - 파일은 backend/uploads/YYYY/MM/site_{site_id}_<timestamp>.<ext>
    - DB에는 파일 메타와 표시용 경로('/uploads/..') 저장
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
        site = supabase.table('sites').select('id, created_by, site_name').eq('id', site_id).execute()
        if not site.data:
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        site_info = site.data[0]
        if payload['user_role'] != 'admin' and site_info['created_by'] != payload['user_id']:
            return jsonify({'error': '접근 권한이 없습니다.'}), 403

        # 멀티파트 파싱
        title = (request.form.get('title') or '').strip()
        file = request.files.get('file')
        if not file:
            return jsonify({'error': '이미지 파일이 필요합니다.'}), 400

        # 파일 크기 제한 (8MB)
        try:
            content = file.read()
        except Exception:
            return jsonify({'error': '파일을 읽을 수 없습니다.'}), 400
        MAX_SIZE = 8 * 1024 * 1024
        if content is None or len(content) == 0:
            return jsonify({'error': '빈 파일은 업로드할 수 없습니다.'}), 400
        if len(content) > MAX_SIZE:
            return jsonify({'error': '파일이 너무 큽니다. 최대 8MB까지 업로드할 수 있습니다.'}), 413

        now = datetime.utcnow()
        yyyy = str(now.year)
        mm = str(now.month).zfill(2)

        public_path = None
        # Supabase Storage 사용 여부
        if supabase_url and supabase_key:
            try:
                from werkzeug.utils import secure_filename
                orig = secure_filename(file.filename or 'image')
                ext = (orig.rsplit('.', 1)[-1].lower() if '.' in orig else 'jpg')
                object_path = f"site_{site_id}/{yyyy}/{mm}/site_{site_id}_{int(now.timestamp()*1000)}.{ext}"
                bucket = 'site-photos'

                # 업로드
                storage_client = None
                try:
                    storage_client = (supabase_service if 'supabase_service' in globals() and supabase_service else supabase)
                except Exception:
                    storage_client = supabase
                storage = storage_client.storage.from_(bucket)
                content_type = file.mimetype or 'application/octet-stream'
                # supabase-py는 file_options의 키를 camelCase로 기대합니다.
                storage.upload(object_path, content, { 'contentType': content_type, 'upsert': 'false' })

                # 퍼블릭 URL 구성
                public_path = f"{supabase_url}/storage/v1/object/public/{bucket}/{object_path}"
            except Exception as up_err:
                return jsonify({'error': '스토리지 업로드 실패', 'error_detail': str(up_err)}), 500
        else:
            # 로컬 저장 (더미 모드)
            base_dir = Path(__file__).resolve().parent
            uploads_dir = base_dir / 'uploads' / yyyy / mm
            uploads_dir.mkdir(parents=True, exist_ok=True)
            from werkzeug.utils import secure_filename
            orig = secure_filename(file.filename or 'image')
            ext = (orig.rsplit('.', 1)[-1].lower() if '.' in orig else 'jpg')
            fname = f"site_{site_id}_{int(now.timestamp()*1000)}.{ext}"
            full_path = uploads_dir / fname
            try:
                with open(full_path, 'wb') as f:
                    f.write(content)
            except Exception as werr:
                return jsonify({'error': '로컬 파일 저장 실패', 'error_detail': str(werr)}), 500
            public_path = f"/uploads/{yyyy}/{mm}/{fname}"

        row = {
            'site_id': site_id,
            'title': title or None,
            'image_url': public_path,
            'uploaded_at': now.isoformat(),
            'created_by': payload['user_id']
        }

        try:
            res = supabase.table('site_photos').insert(row).execute()
            saved = res.data[0] if res.data else row
        except Exception as ins_err:
            msg = str(ins_err)
            if 'site_photos' in msg and (
                'relation' in msg or 'does not exist' in msg or 'schema cache' in msg or 'PGRST' in msg
            ):
                return jsonify({'error': 'site_photos 테이블이 없습니다. Supabase SQL로 테이블을 먼저 생성해 주세요.'}), 500
            return jsonify({'error': '사진 메타 저장 실패', 'error_detail': msg}), 500

        return jsonify({'message': '사진이 저장되었습니다.', 'photo': saved}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sites_bp.route('/sites/<int:site_id>/photos/<int:photo_id>', methods=['DELETE'])
def delete_site_photo(site_id, photo_id):
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401

        # 권한 확인: 사진 레코드와 현장 소유자 검사
        site = supabase.table('sites').select('id, created_by').eq('id', site_id).execute()
        if not site.data:
            return jsonify({'error': '현장을 찾을 수 없습니다.'}), 404
        site_info = site.data[0]

        photo_rows = supabase.table('site_photos').select('id, site_id, created_by, image_url').eq('id', photo_id).eq('site_id', site_id).limit(1).execute()
        if not photo_rows.data:
            return jsonify({'error': '사진을 찾을 수 없습니다.'}), 404
        photo = photo_rows.data[0]

        # 사진 삭제는 로그인한 사용자라면 모두 가능(팀 공유 정책 없음)

        # 관리자=하드 삭제, 일반=소프트 삭제
        hard_delete = (payload.get('user_role') == 'admin')
        if not hard_delete:
            # 소프트 삭제: deleted_at만 표시
            try:
                supabase.table('site_photos').update({'deleted_at': datetime.utcnow().isoformat()}).eq('id', photo_id).eq('site_id', site_id).execute()
                return jsonify({'message': '사진이 삭제되었습니다.(소프트)'}), 200
            except Exception:
                # 컬럼이 없으면 하드 삭제로 폴백
                pass

        # 파일 삭제 시도 (베스트에포트)
        try:
            public_path = photo.get('image_url') or ''
            if supabase_url and supabase_key and '/storage/v1/object/public/' in public_path:
                # 예: https://<proj>.supabase.co/storage/v1/object/public/site-photos/site_1/....jpg
                try:
                    bucket = 'site-photos'
                    prefix = f"{supabase_url}/storage/v1/object/public/{bucket}/"
                    if public_path.startswith(prefix):
                        object_path = public_path[len(prefix):]
                        storage_client = None
                        try:
                            storage_client = (supabase_service if 'supabase_service' in globals() and supabase_service else supabase)
                        except Exception:
                            storage_client = supabase
                        storage_client.storage.from_(bucket).remove([object_path])
                except Exception:
                    pass
            elif public_path.startswith('/uploads/'):
                # 로컬 파일 삭제
                rel = public_path[len('/uploads/'):]
                base_dir = Path(__file__).resolve().parent
                full_path = base_dir / 'uploads' / rel
                if full_path.exists():
                    try:
                        full_path.unlink(missing_ok=True)
                    except Exception:
                        pass
        except Exception:
            pass

        supabase.table('site_photos').delete().eq('id', photo_id).eq('site_id', site_id).execute()
        return jsonify({'message': '사진이 삭제되었습니다.(하드)'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================
# 데이터 내보내기(관리자: 전체, 일반: 본인 현장)
# =============================
@sites_bp.route('/export', methods=['GET'])
def export_data():
    try:
        # 인증
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': '인증 토큰이 필요합니다.'}), 401
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401

        user_id = payload.get('user_id')
        user_role = payload.get('user_role')

        # 파라미터
        fmt = (request.args.get('format') or 'both').lower()  # csv|xlsx|both
        scope = (request.args.get('scope') or 'auto').lower()  # auto|site
        site_id_param = request.args.get('site_id')
        include_photos = str(request.args.get('include_photos', 'true')).lower() in ['1','true','yes','y']
        start_date = (request.args.get('start_date') or '').strip()  # YYYY-MM-DD
        end_date = (request.args.get('end_date') or '').strip()      # YYYY-MM-DD

        # 접근 범위: 관리자면 전체, 일반이면 본인이 만든 현장만
        if user_role == 'admin':
            base_q = supabase.table('sites').select('id')
        else:
            base_q = supabase.table('sites').select('id').eq('created_by', user_id)

        if scope == 'site' and site_id_param:
            try:
                sid = int(site_id_param)
                sites_rows = base_q.eq('id', sid).order('id', desc=True).execute()
            except Exception:
                sites_rows = base_q.order('id', desc=True).execute()
        else:
            sites_rows = base_q.order('id', desc=True).execute()
        site_ids = [r['id'] for r in (sites_rows.data or [])]

        # 선택된 현장이 없으면 빈 ZIP 반환
        if not site_ids:
            buf = BytesIO()
            with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
                zf.writestr('README.txt', 'No data for export.')
            buf.seek(0)
            ts = datetime.utcnow().strftime('%Y%m%d_%H%M')
            return send_file(buf, mimetype='application/zip', as_attachment=True, download_name=f'export_{ts}.zip')

        def fetch_table(name, filter_by_site=True):
            q = supabase.table(name).select('*')
            if filter_by_site:
                q = q.in_('site_id', site_ids)
            rows = q.execute()
            return rows.data or []

        # 데이터 수집
        data_sites = fetch_table('sites', filter_by_site=False)
        # sites 범위를 사용자 범위로 축소(일반 사용자일 때)
        if user_role != 'admin':
            data_sites = [r for r in data_sites if r.get('id') in site_ids]
        data_contacts = fetch_table('site_contacts')
        # 복수 연락처 테이블은 없을 수 있으므로 예외 보호
        try:
            data_contact_people = fetch_table('site_contact_people')
        except Exception:
            data_contact_people = []
        data_products = fetch_table('site_products')
        data_work_items = fetch_table('work_items')
        # 소프트 삭제 제외
        try:
            data_photos = supabase.table('site_photos').select('*').in_('site_id', site_ids).is_('deleted_at', None).execute().data or []
        except Exception:
            data_photos = fetch_table('site_photos')

        # Excel 단일 시트용 병합 데이터프레임(table 구분 컬럼 포함)
        def df_with_table(rows, table_name):
            try:
                df = pd.DataFrame(rows)
            except Exception:
                df = pd.DataFrame()
            if 'table' not in df.columns:
                df['table'] = table_name
            else:
                df['table'] = table_name
            return df

        df_all = pd.concat([
            df_with_table(data_sites, 'sites'),
            df_with_table(data_contacts, 'site_contacts'),
            df_with_table(data_contact_people, 'site_contact_people'),
            df_with_table(data_products, 'site_products'),
            df_with_table(data_work_items, 'work_items'),
            df_with_table(data_photos, 'site_photos'),
        ], ignore_index=True, sort=False)

        # ZIP 빌드
        ts = datetime.utcnow().strftime('%Y%m%d_%H%M')
        buf = BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            # CSV들
            def write_csv(path, rows):
                try:
                    import csv
                    from io import StringIO
                    sio = StringIO()
                    if rows:
                        cols = sorted({k for r in rows for k in r.keys()})
                    else:
                        cols = []
                    writer = csv.DictWriter(sio, fieldnames=cols, extrasaction='ignore')
                    writer.writeheader()
                    for r in rows:
                        writer.writerow({k: r.get(k) for k in cols})
                    # UTF-8 BOM
                    zf.writestr(path, '\ufeff' + sio.getvalue())
                except Exception as e_csv:
                    zf.writestr(path + '.error.txt', str(e_csv))

            if fmt in ['csv','both']:
                write_csv('data/sites.csv', data_sites)
                write_csv('data/site_contacts.csv', data_contacts)
                write_csv('data/site_contact_people.csv', data_contact_people)
                write_csv('data/site_products.csv', data_products)
                write_csv('data/work_items.csv', data_work_items)
                write_csv('data/site_photos.csv', data_photos)

            # Excel 한 시트
            if fmt in ['xlsx','both']:
                try:
                    xls = BytesIO()
                    with pd.ExcelWriter(xls, engine='openpyxl') as writer:
                        # 하나의 시트에 모두(컬럼 유니온) + table 컬럼 포함
                        df_all.to_excel(writer, sheet_name='export', index=False)
                    xls.seek(0)
                    zf.writestr('data/export.xlsx', xls.read())
                except Exception as e_xlsx:
                    # 실패 시 안내 파일만 기록
                    zf.writestr('data/export.xlsx.error.txt', str(e_xlsx))

            # 사진 ZIP 포함(원본 다운로드)
            if include_photos and data_photos:
                def in_date_range(uploaded_at_iso: str) -> bool:
                    if not (start_date or end_date):
                        return True
                    try:
                        dt = datetime.fromisoformat((uploaded_at_iso or '').replace('Z','+00:00'))
                    except Exception:
                        return True
                    if start_date:
                        try:
                            s = datetime.fromisoformat(start_date + 'T00:00:00+00:00')
                            if dt < s:
                                return False
                        except Exception:
                            pass
                    if end_date:
                        try:
                            e = datetime.fromisoformat(end_date + 'T23:59:59+00:00')
                            if dt > e:
                                return False
                        except Exception:
                            pass
                    return True

                for ph in data_photos:
                    try:
                        if not in_date_range(str(ph.get('uploaded_at') or '')):
                            continue
                        url = ph.get('image_url')
                        if not url:
                            continue
                        r = requests.get(url, timeout=20)
                        if r.status_code != 200:
                            continue
                        site_id = ph.get('site_id')
                        fname = url.split('/')[-1]
                        yymm = 'unknown'
                        try:
                            dt = datetime.fromisoformat((ph.get('uploaded_at') or '').replace('Z','+00:00'))
                            yymm = f"{dt.year}/{str(dt.month).zfill(2)}"
                        except Exception:
                            pass
                        arcname = f"photos/site_{site_id}/{yymm}/{fname}"
                        zf.writestr(arcname, r.content)
                    except Exception:
                        continue

        buf.seek(0)
        return send_file(buf, mimetype='application/zip', as_attachment=True, download_name=f'export_{ts}.zip')
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


