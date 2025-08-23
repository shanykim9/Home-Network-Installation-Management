-- Supabase DB 마이그레이션: 현장 등록 관련 테이블 생성
-- 실행 전 반드시 백업을 수행하세요!

-- 1. 연락처 테이블 생성
CREATE TABLE IF NOT EXISTS site_contacts (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    project_no VARCHAR(10) NOT NULL,
    pm_name VARCHAR(100),
    pm_phone VARCHAR(20),
    sales_manager_name VARCHAR(100),
    sales_manager_phone VARCHAR(20),
    construction_manager_name VARCHAR(100),
    construction_manager_phone VARCHAR(20),
    installer_name VARCHAR(100),
    installer_phone VARCHAR(20),
    network_manager_name VARCHAR(100),
    network_manager_phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 제품수량 테이블 생성
CREATE TABLE IF NOT EXISTS site_products (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    project_no VARCHAR(10) NOT NULL,
    wallpad_model VARCHAR(100),
    wallpad_qty INTEGER DEFAULT 0,
    doorphone_model VARCHAR(100),
    doorphone_qty INTEGER DEFAULT 0,
    lobbyphone_model VARCHAR(100),
    lobbyphone_qty INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 세대부연동 테이블 생성
CREATE TABLE IF NOT EXISTS site_household_integrations (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    project_no VARCHAR(10) NOT NULL,
    lighting_enabled CHAR(1) DEFAULT 'N' CHECK (lighting_enabled IN ('Y', 'N')),
    lighting_company VARCHAR(100),
    standby_enabled CHAR(1) DEFAULT 'N' CHECK (standby_enabled IN ('Y', 'N')),
    standby_company VARCHAR(100),
    gas_enabled CHAR(1) DEFAULT 'N' CHECK (gas_enabled IN ('Y', 'N')),
    gas_company VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 공용부연동 테이블 생성
CREATE TABLE IF NOT EXISTS site_common_integrations (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    project_no VARCHAR(10) NOT NULL,
    parking_enabled CHAR(1) DEFAULT 'N' CHECK (parking_enabled IN ('Y', 'N')),
    parking_company VARCHAR(100),
    metering_enabled CHAR(1) DEFAULT 'N' CHECK (metering_enabled IN ('Y', 'N')),
    metering_company VARCHAR(100),
    cctv_enabled CHAR(1) DEFAULT 'N' CHECK (cctv_enabled IN ('Y', 'N')),
    cctv_company VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_site_contacts_site_id ON site_contacts(site_id);
CREATE INDEX IF NOT EXISTS idx_site_contacts_project_no ON site_contacts(project_no);
CREATE INDEX IF NOT EXISTS idx_site_products_site_id ON site_products(site_id);
CREATE INDEX IF NOT EXISTS idx_site_products_project_no ON site_products(project_no);
CREATE INDEX IF NOT EXISTS idx_site_household_site_id ON site_household_integrations(site_id);
CREATE INDEX IF NOT EXISTS idx_site_household_project_no ON site_household_integrations(project_no);
CREATE INDEX IF NOT EXISTS idx_site_common_site_id ON site_common_integrations(site_id);
CREATE INDEX IF NOT EXISTS idx_site_common_project_no ON site_common_integrations(project_no);

-- 6. 고유 제약 조건 (한 현장당 하나의 레코드만)
ALTER TABLE site_contacts ADD CONSTRAINT unique_site_contact UNIQUE (site_id);
ALTER TABLE site_products ADD CONSTRAINT unique_site_product UNIQUE (site_id);
ALTER TABLE site_household_integrations ADD CONSTRAINT unique_site_household UNIQUE (site_id);
ALTER TABLE site_common_integrations ADD CONSTRAINT unique_site_common UNIQUE (site_id);

-- 7. 마이그레이션 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ 현장 등록 관련 테이블 생성 완료!';
    RAISE NOTICE '   - site_contacts (연락처)';
    RAISE NOTICE '   - site_products (제품수량)';
    RAISE NOTICE '   - site_household_integrations (세대부연동)';
    RAISE NOTICE '   - site_common_integrations (공용부연동)';
    RAISE NOTICE '   - 인덱스 및 제약 조건 설정 완료';
END $$;
