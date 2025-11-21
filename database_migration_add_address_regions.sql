-- 주소 체계 3단 분리를 위한 컬럼 추가 스크립트
-- Supabase SQL Editor에서 순서대로 실행하세요.

ALTER TABLE sites ADD COLUMN IF NOT EXISTS detail_address TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS address_sido TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS address_sigungu TEXT;

-- 기존 address 값을 기반으로 시/도, 시/군/구 추정 (간단 분리)
UPDATE sites
SET
    address_sido = COALESCE(NULLIF(address_sido, ''), split_part(trim(address), ' ', 1)),
    address_sigungu = COALESCE(
        NULLIF(address_sigungu, ''),
        CASE
            WHEN array_length(regexp_split_to_array(trim(address), '\s+'), 1) >= 2
                THEN (regexp_split_to_array(trim(address), '\s+'))[2]
            ELSE NULL
        END
    )
WHERE address IS NOT NULL;

-- 필요 시 detail_address는 기존 address에서 제거된 나머지를 직접 보정해주세요.

