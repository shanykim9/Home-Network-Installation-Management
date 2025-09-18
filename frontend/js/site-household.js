// 세대부연동 탭: 조명SW/대기전력SW/가스감지기
(function(){
  function getSelectedSiteId(){
    const select = document.getElementById('site-select');
    return select && select.value ? parseInt(select.value,10) : null;
  }

  function setItem(prefix, enabled, company){
    const e = document.getElementById(prefix + '_enabled');
    const c = document.getElementById(prefix + '_company');
    if(e) e.value = enabled || 'Y';
    if(c) c.value = company || '';
  }

  async function loadHousehold(){
    const siteId = getSelectedSiteId();
    if(!siteId) {
      // 현장이 선택되지 않은 경우 기본값으로 설정
      setItem('lighting','Y','');
      setItem('standby','Y','');
      setItem('gas','Y','');
      return;
    }
    try{
      const res = await apiRequest(`/sites/${siteId}/integrations/household`, { method: 'GET' });
      const items = res.items || [];
      
      // 먼저 기본값으로 초기화
      setItem('lighting','Y','');
      setItem('standby','Y','');
      setItem('gas','Y','');
      
      // 서버 데이터가 있으면 덮어쓰기
      items.forEach(x=>{
        if(x.integration_type==='lighting_sw') setItem('lighting', x.enabled, x.company_name);
        if(x.integration_type==='standby_power_sw') setItem('standby', x.enabled, x.company_name);
        if(x.integration_type==='gas_detector') setItem('gas', x.enabled, x.company_name);
      });
    }catch(err){
      console.error(err);
      // 에러 발생 시에도 기본값으로 설정
      setItem('lighting','Y','');
      setItem('standby','Y','');
      setItem('gas','Y','');
      Swal.fire('오류','세대부연동을 불러오지 못했습니다.','error');
    }
  }

  async function saveHousehold(e){
    e && e.preventDefault && e.preventDefault();
    const siteId = getSelectedSiteId();
    if(!siteId){
      Swal.fire('안내','먼저 상단의 "현장 선택"에서 현장을 선택하세요.','info');
      return;
    }
    const projectNo = document.getElementById('household-project-no').value;
    const items = [
      {integration_type:'lighting_sw', enabled: document.getElementById('lighting_enabled').value, company_name: document.getElementById('lighting_company').value || null, project_no: projectNo},
      {integration_type:'standby_power_sw', enabled: document.getElementById('standby_enabled').value, company_name: document.getElementById('standby_company').value || null, project_no: projectNo},
      {integration_type:'gas_detector', enabled: document.getElementById('gas_enabled').value, company_name: document.getElementById('gas_company').value || null, project_no: projectNo},
    ];
    try{
      await apiRequest(`/sites/${siteId}/integrations/household`, { method: 'POST', body: { items } });
      if(!window.__batchSaving){ Swal.fire({icon:'success', title:'저장 완료', timer:1500, showConfirmButton:false}); }
      loadHousehold();
    }catch(err){
      console.error(err);
      Swal.fire('오류','세대부연동 저장 중 오류가 발생했습니다.','error');
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const form = document.getElementById('household-form');
    if(form){ form.addEventListener('submit', saveHousehold); }
    const select = document.getElementById('site-select');
    if(select){ select.addEventListener('change', loadHousehold); }
    
    // 페이지 로드 시 기본값을 'Y'로 설정 (강제 설정)
    setTimeout(() => {
      setItem('lighting','Y','');
      setItem('standby','Y','');
      setItem('gas','Y','');
    }, 100);
  });
  // 전역 노출
  window.loadHousehold = loadHousehold;
  // 최종 저장에서 직접 호출할 수 있도록 노출
  window.saveHousehold = saveHousehold;
})();