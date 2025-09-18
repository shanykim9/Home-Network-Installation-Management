// 공용부연동 탭: 주차관제/원격검침/CCTV
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

  async function loadCommon(){
    const siteId = getSelectedSiteId();
    if(!siteId) {
      // 현장이 선택되지 않은 경우 기본값으로 설정
      setItem('parking','Y','');
      setItem('metering','Y','');
      setItem('cctv','Y','');
      return;
    }
    try{
      const res = await apiRequest(`/sites/${siteId}/integrations/common`, { method: 'GET' });
      const items = res.items || [];
      
      // 먼저 기본값으로 초기화
      setItem('parking','Y','');
      setItem('metering','Y','');
      setItem('cctv','Y','');
      
      // 서버 데이터가 있으면 덮어쓰기
      items.forEach(x=>{
        if(x.integration_type==='parking_control') setItem('parking', x.enabled, x.company_name);
        if(x.integration_type==='remote_metering') setItem('metering', x.enabled, x.company_name);
        if(x.integration_type==='cctv') setItem('cctv', x.enabled, x.company_name);
      });
    }catch(err){
      console.error(err);
      // 에러 발생 시에도 기본값으로 설정
      setItem('parking','Y','');
      setItem('metering','Y','');
      setItem('cctv','Y','');
      Swal.fire('오류','공용부연동을 불러오지 못했습니다.','error');
    }
  }

  async function saveCommon(e){
    e && e.preventDefault && e.preventDefault();
    const siteId = getSelectedSiteId();
    if(!siteId){
      Swal.fire('안내','먼저 상단의 "현장 선택"에서 현장을 선택하세요.','info');
      return;
    }
    const projectNo = document.getElementById('common-project-no').value;
    const items = [
      {integration_type:'parking_control', enabled: document.getElementById('parking_enabled').value, company_name: document.getElementById('parking_company').value || null, project_no: projectNo},
      {integration_type:'remote_metering', enabled: document.getElementById('metering_enabled').value, company_name: document.getElementById('metering_company').value || null, project_no: projectNo},
      {integration_type:'cctv', enabled: document.getElementById('cctv_enabled').value, company_name: document.getElementById('cctv_company').value || null, project_no: projectNo},
    ];
    try{
      await apiRequest(`/sites/${siteId}/integrations/common`, { method: 'POST', body: { items } });
      if(!window.__batchSaving){ Swal.fire({icon:'success', title:'저장 완료', timer:1500, showConfirmButton:false}); }
      loadCommon();
    }catch(err){
      console.error(err);
      Swal.fire('오류','공용부연동 저장 중 오류가 발생했습니다.','error');
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const form = document.getElementById('common-form');
    if(form){ form.addEventListener('submit', saveCommon); }
    const select = document.getElementById('site-select');
    if(select){ select.addEventListener('change', loadCommon); }
    
    // 페이지 로드 시 기본값을 'Y'로 설정 (강제 설정)
    setTimeout(() => {
      // 직접 DOM 요소에 값 설정
      const parkingEl = document.getElementById('parking_enabled');
      const meteringEl = document.getElementById('metering_enabled');
      const cctvEl = document.getElementById('cctv_enabled');
      
      if(parkingEl) parkingEl.value = 'Y';
      if(meteringEl) meteringEl.value = 'Y';
      if(cctvEl) cctvEl.value = 'Y';
      
      console.log('공용부연동 기본값 설정:', {
        parking: parkingEl?.value,
        metering: meteringEl?.value,
        cctv: cctvEl?.value
      });
    }, 100);
  });
  // 전역 노출
  window.loadCommon = loadCommon;
  // 최종 저장에서 직접 호출할 수 있도록 노출
  window.saveCommon = saveCommon;
})();