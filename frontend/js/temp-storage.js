// 탭별 임시 저장 관리자 (프로젝트별 네임스페이스 지원)
const TempStorage = {
    // 스토리지 키(구조 변경 없이 유지)
    STORAGE_KEY: 'hn_temp_site_data',

    // 내부: 전체 스토리지 객체 읽기
    _readAll() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            // 구(단일 레벨) 구조가 감지되면 초기화하여 섞임 방지
            const looksLegacy = parsed && (
                Object.prototype.hasOwnProperty.call(parsed, 'basic') ||
                Object.prototype.hasOwnProperty.call(parsed, 'contacts') ||
                Object.prototype.hasOwnProperty.call(parsed, 'products') ||
                Object.prototype.hasOwnProperty.call(parsed, 'household') ||
                Object.prototype.hasOwnProperty.call(parsed, 'common')
            );
            return looksLegacy ? {} : parsed;
        } catch (error) {
            console.error('❌ 임시 데이터 파싱 실패:', error);
            return {};
        }
    },

    // 내부: 전체 스토리지 객체 저장
    _writeAll(obj) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(obj || {}));
        } catch (error) {
            console.error('❌ 임시 데이터 저장 실패:', error);
        }
    },

    // 현재 컨텍스트 키 구하기
    // 규칙: project_no가 있으면 해당 번호, 없으면 '_draft'
    getCurrentKey() {
        // 1) 기본정보 탭의 prefix+number
        try {
            const prefix = document.getElementById('project-no-prefix')?.value || '';
            const number = document.getElementById('project-no-number')?.value || '';
            const combined = (prefix + number).trim();
            if (combined.length >= 3) return combined;
        } catch(_) {}

        // 2) 다른 탭 상단의 프로젝트 No. 표시 필드
        const ids = ['contacts-project-no','products-project-no','household-project-no','common-project-no'];
        for (let i = 0; i < ids.length; i++) {
            try {
                const v = document.getElementById(ids[i])?.value || '';
                if (String(v).trim()) return String(v).trim();
            } catch(_) {}
        }

        // 3) 기본: 드래프트
        return '_draft';
    },

    // 임시 데이터 저장(현재 컨텍스트)
    saveTempData(tabName, data) {
        try {
            const key = this.getCurrentKey();
            const all = this._readAll();
            if (!all[key]) all[key] = {};
            all[key][tabName] = { data: data, timestamp: new Date().toISOString() };
            this._writeAll(all);
            console.log(`💾 [${key}] ${tabName} 탭 임시 저장 완료:`, data);
        } catch (error) {
            console.error(`❌ ${tabName} 탭 임시 저장 실패:`, error);
        }
    },

    // 임시 데이터 로드(현재 컨텍스트)
    loadTempData(tabName) {
        try {
            const key = this.getCurrentKey();
            const all = this._readAll();
            const tabData = all?.[key]?.[tabName];
            if (tabData && tabData.data) {
                console.log(`📂 [${key}] ${tabName} 탭 임시 데이터 로드:`, tabData.data);
                return tabData.data;
            }
            return null;
        } catch (error) {
            console.error(`❌ ${tabName} 탭 임시 데이터 로드 실패:`, error);
            return null;
        }
    },

    // 현재 컨텍스트의 모든 탭 임시 데이터(간결형) 가져오기
    getAllTempData() {
        try {
            const key = this.getCurrentKey();
            const all = this._readAll();
            const ctx = all?.[key] || {};
            // { tab: {data,timestamp} } -> { tab: data }
            const result = {};
            Object.keys(ctx).forEach(tab => { if (ctx[tab]?.data) result[tab] = ctx[tab].data; });
            return result;
        } catch (error) {
            console.error('❌ 임시 데이터 파싱 실패:', error);
            return {};
        }
    },

    // 특정 탭의 임시 데이터 삭제(현재 컨텍스트)
    clearTempData(tabName) {
        try {
            const key = this.getCurrentKey();
            const all = this._readAll();
            if (all?.[key]) {
                delete all[key][tabName];
                this._writeAll(all);
            }
            console.log(`🗑️ [${key}] ${tabName} 탭 임시 데이터 삭제 완료`);
        } catch (error) {
            console.error(`❌ ${tabName} 탭 임시 데이터 삭제 실패:`, error);
        }
    },

    // 현재 컨텍스트 전체 삭제 (다른 프로젝트 영향 없음)
    clearCurrentContext() {
        try {
            const key = this.getCurrentKey();
            const all = this._readAll();
            if (all && Object.prototype.hasOwnProperty.call(all, key)) {
                delete all[key];
                this._writeAll(all);
            }
            console.log(`🗑️ [${key}] 임시 데이터(모든 탭) 삭제 완료`);
        } catch (error) {
            console.error('❌ 현재 컨텍스트 삭제 실패:', error);
        }
    },

    // 모든 컨텍스트 삭제(필요 시)
    clearAllTempData() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            console.log('🗑️ 모든 임시 데이터 삭제 완료');
        } catch (error) {
            console.error('❌ 모든 임시 데이터 삭제 실패:', error);
        }
    },

    // (선택) 현재 컨텍스트에 임시 데이터 존재 여부
    hasTempData(tabName) {
        const all = this.getAllTempData();
        return !!(all && all[tabName]);
    },

    // (선택) 현재 컨텍스트에 임시 데이터가 하나라도 있는지
    hasAnyTempData() {
        const all = this.getAllTempData();
        return Object.keys(all || {}).length > 0;
    }
};

// 전역 함수로 노출
window.TempStorage = TempStorage;
