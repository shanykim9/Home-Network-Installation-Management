// 탭 전환 로직
(function(){
  function activateTab(tab){
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
        opt.textContent = `[${site.registration_no}] ${site.site_name}`;
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

  // 모든 탭에 등록번호와 프로젝트 No. 표시
  function updateAllTabsWithSiteInfo(siteInfo) {
    if (!siteInfo) return;
    
    const { registration_no, project_no } = siteInfo;
    
    // 각 탭의 등록번호와 프로젝트 No. 업데이트
    const tabs = ['contacts', 'products', 'household', 'common'];
    tabs.forEach(tab => {
      const regNoElement = document.getElementById(`${tab}-registration-no`);
      const projNoElement = document.getElementById(`${tab}-project-no`);
      
      if (regNoElement) regNoElement.value = registration_no || '';
      if (projNoElement) projNoElement.value = project_no || '';
    });
  }

  // 외부에서 호출 가능하도록 export
  window.updateAllTabsWithSiteInfo = updateAllTabsWithSiteInfo;

  // 외부에서 호출 가능하도록 export
  window.loadSitesIntoSelect = loadSitesIntoSelect;

  document.addEventListener('DOMContentLoaded', ()=>{
    // 초기 탭: 기본정보
    activateTab('basic');

    document.querySelectorAll('.tab-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>activateTab(btn.dataset.tab));
    });

    const refreshBtn = document.getElementById('refresh-sites');
    if(refreshBtn){
      refreshBtn.addEventListener('click', (e)=>{ e.preventDefault(); loadSitesIntoSelect(); });
    }

    loadSitesIntoSelect();
  });
})();