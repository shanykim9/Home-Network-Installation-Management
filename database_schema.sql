-- 홈 네트워크 관리 시스템 데이터베이스 스키마

-- 사용자 테이블
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    user_role VARCHAR(20) DEFAULT 'user' CHECK (user_role IN ('user', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 현장 정보 테이블
CREATE TABLE sites (
    id SERIAL PRIMARY KEY,
    registration_no INTEGER UNIQUE NOT NULL,
    project_no VARCHAR(50) NOT NULL,
    construction_company VARCHAR(100) NOT NULL,
    site_name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    detail_address TEXT,
    address_sido TEXT,
    address_sigungu TEXT,
    household_count INTEGER NOT NULL,
    certification_audit CHAR(1) DEFAULT 'N' CHECK (certification_audit IN ('Y', 'N')),
    home_iot CHAR(1) DEFAULT 'N' CHECK (home_iot IN ('Y', 'N')),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 연락처 정보 테이블
CREATE TABLE site_contacts (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    pm_name VARCHAR(50),
    pm_phone VARCHAR(20),
    sales_manager_name VARCHAR(50),
    sales_manager_phone VARCHAR(20),
    construction_manager_name VARCHAR(50),
    construction_manager_phone VARCHAR(20),
    installer_name VARCHAR(50),
    installer_phone VARCHAR(20),
    network_manager_name VARCHAR(50),
    network_manager_phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 제품 수량 정보 테이블
CREATE TABLE site_products (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    product_type VARCHAR(50) NOT NULL,
    product_model VARCHAR(100),
    quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 세대부 연동 정보 테이블
CREATE TABLE site_household_integrations (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    integration_type VARCHAR(50) NOT NULL,
    enabled CHAR(1) DEFAULT 'N' CHECK (enabled IN ('Y', 'N')),
    company_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 공용부 연동 정보 테이블
CREATE TABLE site_common_integrations (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    integration_type VARCHAR(50) NOT NULL,
    enabled CHAR(1) DEFAULT 'N' CHECK (enabled IN ('Y', 'N')),
    company_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 스마트플랜 테이블
CREATE TABLE smart_plans (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    plan_date DATE NOT NULL,
    todo_items TEXT,
    completed_items TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Action Plan 테이블
CREATE TABLE action_plans (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    issue_date DATE NOT NULL,
    issue_title VARCHAR(200) NOT NULL,
    issue_description TEXT,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_sites_registration_no ON sites(registration_no);
CREATE INDEX idx_sites_created_by ON sites(created_by);
CREATE INDEX idx_smart_plans_site_id ON smart_plans(site_id);
CREATE INDEX idx_smart_plans_date ON smart_plans(plan_date);
CREATE INDEX idx_action_plans_site_id ON action_plans(site_id);
CREATE INDEX idx_action_plans_date ON action_plans(issue_date);

-- Row Level Security (RLS) 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_household_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_common_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;