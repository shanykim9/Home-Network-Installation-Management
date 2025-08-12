-- 홈 네트워크 관리 시스템 데이터베이스 마이그레이션
-- 날짜 필드 추가 (등록일, 납품예정, 준공일, 상세주소)

-- sites 테이블에 새로운 필드들 추가
ALTER TABLE sites 
ADD COLUMN detail_address TEXT,
ADD COLUMN registration_date DATE,
ADD COLUMN delivery_date DATE,
ADD COLUMN completion_date DATE;

-- 기존 데이터에 대한 기본값 설정 (필요한 경우)
UPDATE sites SET 
    detail_address = '' WHERE detail_address IS NULL,
    registration_date = NULL WHERE registration_date IS NULL,
    delivery_date = NULL WHERE delivery_date IS NULL,
    completion_date = NULL WHERE completion_date IS NULL;

-- 필드 설명 추가 (PostgreSQL의 경우)
COMMENT ON COLUMN sites.detail_address IS '상세주소';
COMMENT ON COLUMN sites.registration_date IS '등록일';
COMMENT ON COLUMN sites.delivery_date IS '납품예정일';
COMMENT ON COLUMN sites.completion_date IS '준공일';
