// 탭별 임시 저장 관리자
const TempStorage = {
    // 임시 저장소 키
    STORAGE_KEY: 'hn_temp_site_data',
    
    // 임시 데이터 저장
    saveTempData(tabName, data) {
        try {
            const allData = this.getAllTempData();
            allData[tabName] = {
                data: data,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allData));
            console.log(`💾 ${tabName} 탭 임시 저장 완료:`, data);
        } catch (error) {
            console.error(`❌ ${tabName} 탭 임시 저장 실패:`, error);
        }
    },
    
    // 임시 데이터 로드
    loadTempData(tabName) {
        try {
            const allData = this.getAllTempData();
            const tabData = allData[tabName];
            
            if (tabData && tabData.data) {
                console.log(`📂 ${tabName} 탭 임시 데이터 로드:`, tabData.data);
                return tabData.data;
            }
            return null;
        } catch (error) {
            console.error(`❌ ${tabName} 탭 임시 데이터 로드 실패:`, error);
            return null;
        }
    },
    
    // 모든 임시 데이터 가져오기
    getAllTempData() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('❌ 임시 데이터 파싱 실패:', error);
            return {};
        }
    },
    
    // 특정 탭의 임시 데이터 삭제
    clearTempData(tabName) {
        try {
            const allData = this.getAllTempData();
            delete allData[tabName];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allData));
            console.log(`🗑️ ${tabName} 탭 임시 데이터 삭제 완료`);
        } catch (error) {
            console.error(`❌ ${tabName} 탭 임시 데이터 삭제 실패:`, error);
        }
    },
    
    // 모든 임시 데이터 삭제
    clearAllTempData() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            console.log('🗑️ 모든 임시 데이터 삭제 완료');
        } catch (error) {
            console.error('❌ 모든 임시 데이터 삭제 실패:', error);
        }
    },
    
    // 임시 데이터가 있는지 확인
    hasTempData(tabName) {
        const allData = this.getAllTempData();
        return allData[tabName] && allData[tabName].data;
    },
    
    // 모든 탭에 임시 데이터가 있는지 확인
    hasAnyTempData() {
        const allData = this.getAllTempData();
        return Object.keys(allData).length > 0;
    }
};

// 전역 함수로 노출
window.TempStorage = TempStorage;
