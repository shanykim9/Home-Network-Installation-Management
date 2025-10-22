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
    created_by INTEGER,
    deleted_at TIMESTAMP WITH TIME ZONE NULL
);
CREATE INDEX IF NOT EXISTS idx_site_photos_site ON site_photos(site_id);
COMMIT;

-- (선택) 사용자 활성/삭제 컬럼 추가 및 승격 RPC 생성
BEGIN;
-- 일부 Postgres/Supabase 버전에서는 ALTER TABLE IF NOT EXISTS를 지원하지 않습니다.
-- 테이블 지정은 단순히 ALTER TABLE로 두고, 컬럼 단위로 IF NOT EXISTS를 사용합니다.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE OR REPLACE FUNCTION public.promote_to_admin(p_user_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admins_count int;
BEGIN
  PERFORM pg_advisory_xact_lock(123456789);

  SELECT count(*) INTO v_admins_count
  FROM public.users
  WHERE user_role = 'admin'
    AND (is_active IS DISTINCT FROM false)
    AND deleted_at IS NULL;

  IF v_admins_count >= 2 THEN
    RAISE EXCEPTION '관리자는 최대 2명입니다.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.users
     SET user_role = 'admin',
         updated_at = now()
   WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id);
END;
$$;
COMMIT;

-- 롤백 예시
-- BEGIN;
--   DROP TABLE IF EXISTS work_items;
--   DROP TABLE IF EXISTS site_photos;
-- COMMIT;


