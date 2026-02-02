-- =====================================================
-- 세대부연동/공용부연동 테이블 수정 마이그레이션
-- 문제: 유니크 제약이 (site_id)만으로 되어 있어서
--       한 현장에 여러 연동타입을 저장할 수 없음
-- 해결: 유니크 제약을 (site_id, integration_type)으로 변경
-- =====================================================

-- 1. 기존 잘못된 유니크 제약 삭제
ALTER TABLE site_household_integrations DROP CONSTRAINT IF EXISTS unique_site_household;
ALTER TABLE site_common_integrations DROP CONSTRAINT IF EXISTS unique_site_common;

-- 2. 세대부연동 테이블에 필요한 컬럼 추가 (없으면)
ALTER TABLE site_household_integrations ADD COLUMN IF NOT EXISTS project_no VARCHAR(10);
ALTER TABLE site_household_integrations ADD COLUMN IF NOT EXISTS contact_person VARCHAR(50);
ALTER TABLE site_household_integrations ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE site_household_integrations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE site_household_integrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. 공용부연동 테이블에 필요한 컬럼 추가 (없으면)
ALTER TABLE site_common_integrations ADD COLUMN IF NOT EXISTS project_no VARCHAR(10);
ALTER TABLE site_common_integrations ADD COLUMN IF NOT EXISTS contact_person VARCHAR(50);
ALTER TABLE site_common_integrations ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE site_common_integrations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE site_common_integrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3-1. integration_type 체크 제약 갱신 (새로운 타입 허용)
ALTER TABLE site_household_integrations
DROP CONSTRAINT IF EXISTS site_household_integrations_integration_type_check;

ALTER TABLE site_household_integrations
ADD CONSTRAINT site_household_integrations_integration_type_check
CHECK (integration_type IN (
  'lighting_sw',
  'standby_power_sw',
  'gas_detector',
  'heating',
  'ventilation',
  'door_lock',
  'air_conditioner',
  'real_time_metering',
  'environment_sensor',
  'vpn',
  'all_off_switch',
  'bathroom_phone',
  'kitchen_tv'
));

ALTER TABLE site_common_integrations
DROP CONSTRAINT IF EXISTS site_common_integrations_integration_type_check;

ALTER TABLE site_common_integrations
ADD CONSTRAINT site_common_integrations_integration_type_check
CHECK (integration_type IN (
  'parking_control',
  'remote_metering',
  'cctv',
  'elevator',
  'parcel',
  'ev_charger',
  'parking_location',
  'onepass',
  'rf_card'
));

-- 4. 올바른 유니크 제약 추가 (site_id + integration_type 조합)
-- 먼저 중복 데이터 제거 (가장 최신 데이터만 유지)
DELETE FROM site_household_integrations a
USING site_household_integrations b
WHERE a.id < b.id 
  AND a.site_id = b.site_id 
  AND a.integration_type = b.integration_type;

DELETE FROM site_common_integrations a
USING site_common_integrations b
WHERE a.id < b.id 
  AND a.site_id = b.site_id 
  AND a.integration_type = b.integration_type;

-- 5. 새로운 유니크 제약 추가
ALTER TABLE site_household_integrations 
ADD CONSTRAINT unique_site_household_type UNIQUE (site_id, integration_type);

ALTER TABLE site_common_integrations 
ADD CONSTRAINT unique_site_common_type UNIQUE (site_id, integration_type);

-- 6. 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_household_site_type ON site_household_integrations(site_id, integration_type);
CREATE INDEX IF NOT EXISTS idx_common_site_type ON site_common_integrations(site_id, integration_type);

-- 확인용 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ 마이그레이션 완료!';
    RAISE NOTICE '   - 세대부연동: (site_id, integration_type) 유니크 제약 적용';
    RAISE NOTICE '   - 공용부연동: (site_id, integration_type) 유니크 제약 적용';
    RAISE NOTICE '   - 필요한 컬럼 추가됨: contact_person, contact_phone, notes, updated_at';
END $$;
