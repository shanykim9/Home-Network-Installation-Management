-- Supabase DB 마이그레이션: sites 테이블에 날짜 필드 추가
-- 실행 전 반드시 백업을 수행하세요!

-- 1. sites 테이블에 새로운 날짜 컬럼들 추가
ALTER TABLE sites 
ADD COLUMN IF NOT EXISTS registration_date DATE,
ADD COLUMN IF NOT EXISTS delivery_date DATE,
ADD COLUMN IF NOT EXISTS completion_date DATE;

-- 2. 기존 데이터 확인 (선택사항)
-- SELECT id, site_name, registration_date, delivery_date, completion_date FROM sites LIMIT 5;

-- 3. 컬럼 추가 확인
-- \d sites

-- 4. 인덱스 추가 (선택사항 - 날짜 검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_sites_registration_date ON sites(registration_date);
CREATE INDEX IF NOT EXISTS idx_sites_delivery_date ON sites(delivery_date);
CREATE INDEX IF NOT EXISTS idx_sites_completion_date ON sites(completion_date);

-- 5. 마이그레이션 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ sites 테이블에 날짜 필드 추가 완료!';
    RAISE NOTICE '   - registration_date (등록일)';
    RAISE NOTICE '   - delivery_date (납품예정)';
    RAISE NOTICE '   - completion_date (준공일)';
END $$;
