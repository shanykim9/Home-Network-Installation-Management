-- 등록번호 관련 컬럼 제거 마이그레이션 (수정된 버전)
-- 외래키 제약조건을 먼저 삭제한 후 컬럼을 제거합니다.

-- 1. 외래키 제약조건 삭제
ALTER TABLE site_contacts DROP CONSTRAINT IF EXISTS fk_contacts_registration;
ALTER TABLE site_products DROP CONSTRAINT IF EXISTS fk_products_registration;
ALTER TABLE site_household_integrations DROP CONSTRAINT IF EXISTS fk_household_registration;
ALTER TABLE site_common_integrations DROP CONSTRAINT IF EXISTS fk_common_registration;

-- 2. sites 테이블에서 registration_no 컬럼 제거
ALTER TABLE sites DROP COLUMN IF EXISTS registration_no;

-- 3. site_contacts 테이블에서 registration_no 컬럼 제거 (만약 존재한다면)
ALTER TABLE site_contacts DROP COLUMN IF EXISTS registration_no;

-- 4. site_products 테이블에서 registration_no 컬럼 제거 (만약 존재한다면)
ALTER TABLE site_products DROP COLUMN IF EXISTS registration_no;

-- 5. site_household_integrations 테이블에서 registration_no 컬럼 제거 (만약 존재한다면)
ALTER TABLE site_household_integrations DROP COLUMN IF EXISTS registration_no;

-- 6. site_common_integrations 테이블에서 registration_no 컬럼 제거 (만약 존재한다면)
ALTER TABLE site_common_integrations DROP COLUMN IF EXISTS registration_no;

-- 7. project_no 컬럼을 NOT NULL로 설정 (이미 NOT NULL이지만 확인)
ALTER TABLE sites ALTER COLUMN project_no SET NOT NULL;

-- 마이그레이션 완료 메시지
SELECT '등록번호 컬럼 및 외래키 제약조건 제거 마이그레이션이 완료되었습니다.' as migration_status;
