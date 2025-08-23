// 탭 전환 로직
(function(){
  // 모바일 전용 스와이프 네비게이션
  function initSwipe(){
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints>0);
    if(!isTouch) return; // 데스크톱 비활성화

    let startX = 0;
    let endX = 0;
    let swiping = false;
    const threshold = 50; // 일반적인 감도

    document.addEventListener('touchstart', (e)=>{
      swiping = true;
      startX = e.touches[0].clientX;
    }, {passive:true});

    document.addEventListener('touchmove', (e)=>{
      if(!swiping) return;
      endX = e.touches[0].clientX;
    }, {passive:true});

    document.addEventListener('touchend', ()=>{
      if(!swiping) return;
      const dx = endX - startX;
      if(Math.abs(dx) > threshold){
        const tabs = Array.from(document.querySelectorAll('.tab-btn'));
        const activeIdx = tabs.findIndex(b=>b.classList.contains('border-blue-600'));
        if(dx < 0){
          // 왼쪽으로 스와이프 → 다음 탭 (마지막 탭에서 멈춤)
          if(activeIdx < tabs.length-1){ tabs[activeIdx+1].click(); }
        }else{
          // 오른쪽으로 스와이프 → 이전 탭 (첫 탭에서 멈춤)
          if(activeIdx > 0){ tabs[activeIdx-1].click(); }
        }
      }
      swiping = false;
      startX = endX = 0;
    });
  }
  function activateTab(tab){
    // 현재 활성 탭의 데이터 임시 저장
    const currentActiveTab = document.querySelector('.tab-btn.border-blue-600');
    if (currentActiveTab) {
      const currentTabName = currentActiveTab.getAttribute('data-tab');
      saveCurrentTabData(currentTabName);
    }

    // 탭 UI 전환
    document.querySelectorAll('.tab-btn').forEach(btn=>{
      btn.classList.remove('text-blue-600','border-b-2','border-blue-600');
      btn.classList.add('text-gray-600');
    });
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.add('hidden'));

    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    const activePanel = document.querySelector(`.tab-panel[data-tab="${tab}"]`);
    if(activeBtn){
      activeBtn.classList.remove('text-gray-600');
      activeBtn.classList.add('text-blue-600','border-b-2','border-blue-600');
    }
    if(activePanel){
      activePanel.classList.remove('hidden');
    }

    // 새로 활성화된 탭의 임시 데이터 로드
    loadTabData(tab);
  }

  // 현재 탭의 데이터 임시 저장
  function saveCurrentTabData(tabName) {
    if (!tabName) return;
    
    try {
      let data = {};
      
      switch(tabName) {
        case 'basic':
          data = {
            project_no: document.getElementById('project-no-prefix')?.value + document.getElementById('project-no-number')?.value,
            construction_company: document.getElementById('construction-company')?.value,
            site_name: document.getElementById('site-name')?.value,
            address: document.getElementById('address')?.value,
            detail_address: document.getElementById('detail-address')?.value,
            household_count: document.getElementById('household-count')?.value,
            registration_date: document.getElementById('registration-date')?.value,
            delivery_date: document.getElementById('delivery-date')?.value,
            completion_date: document.getElementById('completion-date')?.value,
            certification_audit: document.getElementById('certification-audit')?.value,
            home_iot: document.getElementById('home-iot')?.value
          };
          break;
        case 'contacts':
          data = {
            pm_name: document.getElementById('pm_name')?.value,
            pm_phone: document.getElementById('pm_phone')?.value,
            sales_manager_name: document.getElementById('sales_manager_name')?.value,
            sales_manager_phone: document.getElementById('sales_manager_phone')?.value,
            construction_manager_name: document.getElementById('construction_manager_name')?.value,
            construction_manager_phone: document.getElementById('construction_manager_phone')?.value,
            installer_name: document.getElementById('installer_name')?.value,
            installer_phone: document.getElementById('installer_phone')?.value,
            network_manager_name: document.getElementById('network_manager_name')?.value,
            network_manager_phone: document.getElementById('network_manager_phone')?.value
          };
          break;
        case 'products':
          data = {
            wallpad_model: document.getElementById('wallpad_model')?.value,
            wallpad_qty: document.getElementById('wallpad_qty')?.value,
            doorphone_model: document.getElementById('doorphone_model')?.value,
            doorphone_qty: document.getElementById('doorphone_qty')?.value,
            lobbyphone_model: document.getElementById('lobbyphone_model')?.value,
            lobbyphone_qty: document.getElementById('lobbyphone_qty')?.value
          };
          break;
        case 'household':
          data = {
            lighting_enabled: document.getElementById('lighting_enabled')?.value,
            lighting_company: document.getElementById('lighting_company')?.value,
            standby_enabled: document.getElementById('standby_enabled')?.value,
            standby_company: document.getElementById('standby_company')?.value,
            gas_enabled: document.getElementById('gas_enabled')?.value,
            gas_company: document.getElementById('gas_company')?.value
          };
          break;
        case 'common':
          data = {
            parking_enabled: document.getElementById('parking_enabled')?.value,
            parking_company: document.getElementById('parking_company')?.value,
            metering_enabled: document.getElementById('metering_enabled')?.value,
            metering_company: document.getElementById('metering_company')?.value,
            cctv_enabled: document.getElementById('cctv_enabled')?.value,
            cctv_company: document.getElementById('cctv_company')?.value
          };
          break;
      }
      
      // 빈 값 제거
      data = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== '' && v !== null && v !== undefined));
      
      if (Object.keys(data).length > 0) {
        TempStorage.saveTempData(tabName, data);
      }
    } catch (error) {
      console.error(`❌ ${tabName} 탭 데이터 저장 실패:`, error);
    }
  }

  // 탭 데이터 로드
  function loadTabData(tabName) {
    if (!tabName) return;
    
    try {
      const tempData = TempStorage.loadTempData(tabName);
      if (!tempData) return;
      
      console.log(`📂 ${tabName} 탭 임시 데이터 로드:`, tempData);
      
      switch(tabName) {
        case 'basic':
          if (tempData.project_no) {
            const prefix = tempData.project_no.substring(0, 3);
            const number = tempData.project_no.substring(3);
            if (document.getElementById('project-no-prefix')) document.getElementById('project-no-prefix').value = prefix;
            if (document.getElementById('project-no-number')) document.getElementById('project-no-number').value = number;
          }
          if (tempData.construction_company) document.getElementById('construction-company').value = tempData.construction_company;
          if (tempData.site_name) document.getElementById('site-name').value = tempData.site_name;
          if (tempData.address) document.getElementById('address').value = tempData.address;
          if (tempData.detail_address) document.getElementById('detail-address').value = tempData.detail_address;
          if (tempData.household_count) document.getElementById('household-count').value = tempData.household_count;
          if (tempData.registration_date) document.getElementById('registration-date').value = tempData.registration_date;
          if (tempData.delivery_date) document.getElementById('delivery-date').value = tempData.delivery_date;
          if (tempData.completion_date) document.getElementById('completion-date').value = tempData.completion_date;
          if (tempData.certification_audit) document.getElementById('certification-audit').value = tempData.certification_audit;
          if (tempData.home_iot) document.getElementById('home-iot').value = tempData.home_iot;
          break;
        case 'contacts':
          if (tempData.pm_name) document.getElementById('pm_name').value = tempData.pm_name;
          if (tempData.pm_phone) document.getElementById('pm_phone').value = tempData.pm_phone;
          if (tempData.sales_manager_name) document.getElementById('sales_manager_name').value = tempData.sales_manager_name;
          if (tempData.sales_manager_phone) document.getElementById('sales_manager_phone').value = tempData.sales_manager_phone;
          if (tempData.construction_manager_name) document.getElementById('construction_manager_name').value = tempData.construction_manager_name;
          if (tempData.construction_manager_phone) document.getElementById('construction_manager_phone').value = tempData.construction_manager_phone;
          if (tempData.installer_name) document.getElementById('installer_name').value = tempData.installer_name;
          if (tempData.installer_phone) document.getElementById('installer_phone').value = tempData.installer_phone;
          if (tempData.network_manager_name) document.getElementById('network_manager_name').value = tempData.network_manager_name;
          if (tempData.network_manager_phone) document.getElementById('network_manager_phone').value = tempData.network_manager_phone;
          break;
        case 'products':
          if (tempData.wallpad_model) document.getElementById('wallpad_model').value = tempData.wallpad_model;
          if (tempData.wallpad_qty) document.getElementById('wallpad_qty').value = tempData.wallpad_qty;
          if (tempData.doorphone_model) document.getElementById('doorphone_model').value = tempData.doorphone_model;
          if (tempData.doorphone_qty) document.getElementById('doorphone_qty').value = tempData.doorphone_qty;
          if (tempData.lobbyphone_model) document.getElementById('lobbyphone_model').value = tempData.lobbyphone_model;
          if (tempData.lobbyphone_qty) document.getElementById('lobbyphone_qty').value = tempData.lobbyphone_qty;
          break;
        case 'household':
          if (tempData.lighting_enabled) document.getElementById('lighting_enabled').value = tempData.lighting_enabled;
          if (tempData.lighting_company) document.getElementById('lighting_company').value = tempData.lighting_company;
          if (tempData.standby_enabled) document.getElementById('standby_enabled').value = tempData.standby_enabled;
          if (tempData.standby_company) document.getElementById('standby_company').value = tempData.standby_company;
          if (tempData.gas_enabled) document.getElementById('gas_enabled').value = tempData.gas_enabled;
          if (tempData.gas_company) document.getElementById('gas_company').value = tempData.gas_company;
          break;
        case 'common':
          if (tempData.parking_enabled) document.getElementById('parking_enabled').value = tempData.parking_enabled;
          if (tempData.parking_company) document.getElementById('parking_company').value = tempData.parking_company;
          if (tempData.metering_enabled) document.getElementById('metering_enabled').value = tempData.metering_enabled;
          if (tempData.metering_company) document.getElementById('metering_company').value = tempData.metering_company;
          if (tempData.cctv_enabled) document.getElementById('cctv_enabled').value = tempData.cctv_enabled;
          if (tempData.cctv_company) document.getElementById('cctv_company').value = tempData.cctv_company;
          break;
      }
    } catch (error) {
      console.error(`❌ ${tabName} 탭 데이터 로드 실패:`, error);
    }
  }

  // 사이트 목록 로드
  async function loadSitesIntoSelect(){
    const select = document.getElementById('site-select');
    if(!select) return;
    // 로그인 토큰 없으면 호출하지 않음
    if (typeof TokenManager === 'undefined' || !TokenManager.isValid()) {
      return;
    }
    select.innerHTML = '<option value="">현장을 선택하세요</option>';
    try{
      const res = await apiRequest('/sites', { method: 'GET' });
      (res.sites||[]).forEach(site=>{
        const opt = document.createElement('option');
        opt.value = site.id;
        opt.textContent = site.site_name;
        select.appendChild(opt);
      });
    }catch(err){
      // 인증 오류 등은 로그인 전일 수 있으므로 조용히 무시
      if (String(err.message || '').includes('인증 토큰')) return;
      if (String(err.message || '').includes('유효하지 않은 토큰')) return;
      console.error(err);
      Swal.fire('오류','현장 목록을 불러오지 못했습니다.','error');
    }
  }

  // 모든 탭에 프로젝트 No. 표시
  function updateAllTabsWithSiteInfo(siteInfo) {
    if (!siteInfo) return;
    
    const { project_no } = siteInfo;
    
    // 각 탭의 프로젝트 No. 업데이트
    const tabs = ['contacts', 'products', 'household', 'common'];
    tabs.forEach(tab => {
      const projNoElement = document.getElementById(`${tab}-project-no`);
      
      if (projNoElement) projNoElement.value = project_no || '';
    });
  }

  // 최종 저장 기능
  async function finalSave() {
    try {
      // 현재 활성 탭의 데이터도 임시 저장
      const currentActiveTab = document.querySelector('.tab-btn.border-blue-600');
      if (currentActiveTab) {
        const currentTabName = currentActiveTab.getAttribute('data-tab');
        saveCurrentTabData(currentTabName);
      }

      // 모든 임시 데이터 가져오기
      const allTempData = TempStorage.getAllTempData();
      
      if (!TempStorage.hasAnyTempData()) {
        Swal.fire('안내', '저장할 데이터가 없습니다.', 'info');
        return;
      }

      // 저장 확인 다이얼로그
      const result = await Swal.fire({
        title: '최종 저장',
        html: `
          <div class="text-left">
            <p class="mb-2">다음 탭들의 데이터를 저장하시겠습니까?</p>
            <ul class="text-sm text-gray-600">
              ${Object.keys(allTempData).map(tab => `<li>• ${getTabDisplayName(tab)}</li>`).join('')}
            </ul>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '저장',
        cancelButtonText: '취소'
      });

      if (!result.isConfirmed) return;

      // 로딩 표시
      Swal.fire({
        title: '저장 중...',
        text: '모든 데이터를 저장하고 있습니다.',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // 각 탭별로 저장
      const savePromises = [];
      
      if (allTempData.basic) {
        savePromises.push(saveBasicData(allTempData.basic));
      }
      
      if (allTempData.contacts) {
        savePromises.push(saveContactsData(allTempData.contacts));
      }
      
      if (allTempData.products) {
        savePromises.push(saveProductsData(allTempData.products));
      }
      
      if (allTempData.household) {
        savePromises.push(saveHouseholdData(allTempData.household));
      }
      
      if (allTempData.common) {
        savePromises.push(saveCommonData(allTempData.common));
      }

      // 모든 저장 완료 대기
      await Promise.all(savePromises);

      // 성공 메시지
      Swal.fire({
        icon: 'success',
        title: '저장 완료!',
        text: '모든 데이터가 성공적으로 저장되었습니다.',
        timer: 2000,
        showConfirmButton: false
      });

      // 임시 데이터 삭제
      TempStorage.clearAllTempData();

    } catch (error) {
      console.error('❌ 최종 저장 실패:', error);
      Swal.fire('오류', '데이터 저장 중 오류가 발생했습니다.', 'error');
    }
  }

  // 탭 표시 이름 가져오기
  function getTabDisplayName(tabName) {
    const tabNames = {
      'basic': '기본정보',
      'contacts': '연락처',
      'products': '제품수량',
      'household': '세대부연동',
      'common': '공용부연동'
    };
    return tabNames[tabName] || tabName;
  }

  // 각 탭별 저장 함수들
  async function saveBasicData(data) {
    // 기본정보는 이미 site-basic.js에서 처리되므로 여기서는 생략
    console.log('💾 기본정보 저장:', data);
    return { success: true, message: '기본정보는 이미 저장되었습니다.' };
  }

  async function saveContactsData(data) {
    try {
      // 현재 선택된 현장 ID 가져오기
      const siteSelect = document.getElementById('site-select');
      if (!siteSelect || !siteSelect.value) {
        throw new Error('현장을 선택해주세요.');
      }
      
      const siteId = siteSelect.value;
      const response = await apiRequest(`/sites/${siteId}/contacts`, {
        method: 'POST',
        body: data
      });
      
      console.log('💾 연락처 저장 성공:', response);
      return { success: true, message: response.message || '연락처 정보가 저장되었습니다.' };
    } catch (error) {
      console.error('❌ 연락처 저장 실패:', error);
      throw new Error(`연락처 저장 실패: ${error.message}`);
    }
  }

  async function saveProductsData(data) {
    try {
      // 현재 선택된 현장 ID 가져오기
      const siteSelect = document.getElementById('site-select');
      if (!siteSelect || !siteSelect.value) {
        throw new Error('현장을 선택해주세요.');
      }
      
      const siteId = siteSelect.value;
      const response = await apiRequest(`/sites/${siteId}/products`, {
        method: 'POST',
        body: data
      });
      
      console.log('💾 제품수량 저장 성공:', response);
      return { success: true, message: response.message || '제품수량 정보가 저장되었습니다.' };
    } catch (error) {
      console.error('❌ 제품수량 저장 실패:', error);
      throw new Error(`제품수량 저장 실패: ${error.message}`);
    }
  }

  async function saveHouseholdData(data) {
    try {
      // 현재 선택된 현장 ID 가져오기
      const siteSelect = document.getElementById('site-select');
      if (!siteSelect || !siteSelect.value) {
        throw new Error('현장을 선택해주세요.');
      }
      
      const siteId = siteSelect.value;
      const response = await apiRequest(`/sites/${siteId}/integrations/household`, {
        method: 'POST',
        body: data
      });
      
      console.log('💾 세대부연동 저장 성공:', response);
      return { success: true, message: response.message || '세대부연동 정보가 저장되었습니다.' };
    } catch (error) {
      console.error('❌ 세대부연동 저장 실패:', error);
      throw new Error(`세대부연동 저장 실패: ${error.message}`);
    }
  }

  async function saveCommonData(data) {
    try {
      // 현재 선택된 현장 ID 가져오기
      const siteSelect = document.getElementById('site-select');
      if (!siteSelect || !siteSelect.value) {
        throw new Error('현장을 선택해주세요.');
      }
      
      const siteId = siteSelect.value;
      const response = await apiRequest(`/sites/${siteId}/integrations/common`, {
        method: 'POST',
        body: data
      });
      
      console.log('💾 공용부연동 저장 성공:', response);
      return { success: true, message: response.message || '공용부연동 정보가 저장되었습니다.' };
    } catch (error) {
      console.error('❌ 공용부연동 저장 실패:', error);
      throw new Error(`공용부연동 저장 실패: ${error.message}`);
    }
  }

  // 외부에서 호출 가능하도록 export
  window.activateTab = activateTab;
  window.updateAllTabsWithSiteInfo = updateAllTabsWithSiteInfo;
  window.loadSitesIntoSelect = loadSitesIntoSelect;
  window.finalSave = finalSave;

  document.addEventListener('DOMContentLoaded', ()=>{
    // 초기 탭: 기본정보
    activateTab('basic');
    initSwipe();

    document.querySelectorAll('.tab-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>activateTab(btn.dataset.tab));
    });

    const refreshBtn = document.getElementById('refresh-sites');
    if(refreshBtn){
      refreshBtn.addEventListener('click', (e)=>{ e.preventDefault(); loadSitesIntoSelect(); });
    }

    // 최종 저장 버튼 이벤트 등록
    const finalSaveBtn = document.getElementById('final-save-btn');
    if (finalSaveBtn) {
      finalSaveBtn.addEventListener('click', finalSave);
    }

    loadSitesIntoSelect();
  });
})();