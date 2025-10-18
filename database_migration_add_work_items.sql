-- 마이그레이션: 현장별 업무관리 work_items 테이블 생성
-- 실행 순서: database_migration_create_tables.sql 적용 이후 실행 권장

BEGIN;

CREATE TABLE IF NOT EXISTS work_items (
    id BIGSERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'todo', -- 'todo' | 'done'
    alarm_date DATE NULL,
    alarm_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    done_date DATE NULL,
    created_by INTEGER NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_items_site ON work_items(site_id);
CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status);
CREATE INDEX IF NOT EXISTS idx_work_items_alarm ON work_items(alarm_confirmed, alarm_date);

COMMIT;

-- 별도: 현장 사진 테이블 (필요 시 함께 적용)
BEGIN;
CREATE TABLE IF NOT EXISTS site_photos (
    id BIGSERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    title TEXT,
    image_url TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_by INTEGER
);
CREATE INDEX IF NOT EXISTS idx_site_photos_site ON site_photos(site_id);
COMMIT;

-- 롤백 예시
-- BEGIN;
--   DROP TABLE IF EXISTS work_items;
--   DROP TABLE IF EXISTS site_photos;
-- COMMIT;


