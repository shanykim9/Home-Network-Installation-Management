// 공용부연동 탭: 주차관제/원격검침/CCTV
(function(){
  function getSelectedSiteId(){
    const select = document.getElementById('site-select');
    return select && select.value ? parseInt(select.value,10) : null;
  }

  function setItem(prefix, enabled, company, contactPerson, contactPhone, notes){
    const e = document.getElementById(prefix + '_enabled');
    const c = document.getElementById(prefix + '_company');
    const p = document.getElementById(prefix + '_contact_person');
    const ph = document.getElementById(prefix + '_contact_phone');
    const n = document.getElementById(prefix + '_notes');
    if(e) e.value = enabled || 'Y';
    if(c) c.value = company || '';
    if(p) p.value = contactPerson || '';
    if(ph) ph.value = contactPhone || '';
    if(n) n.value = notes || '';
  }

  async function loadCommon(){
    const siteId = getSelectedSiteId();
    if(!siteId) {
      // 현장이 선택되지 않은 경우 기본값으로 설정
      setItem('parking','Y','');
      setItem('metering','Y','');
      setItem('cctv','Y','');
      setItem('elevator','Y','');
      setItem('parcel','Y','');
      setItem('ev','Y','');
      setItem('parkingloc','Y','');
      setItem('onepass','Y','');
      setItem('rfcard','Y','');
      return;
    }
    try{
      const res = await apiRequest(`/sites/${siteId}/integrations/common`, { method: 'GET' });
      const items = res.items || [];
      
      // 먼저 기본값으로 초기화
      setItem('parking','Y','');
      setItem('metering','Y','');
      setItem('cctv','Y','');
      setItem('elevator','Y','');
      setItem('parcel','Y','');
      setItem('ev','Y','');
      setItem('parkingloc','Y','');
      setItem('onepass','Y','');
      setItem('rfcard','Y','');
      
      // 서버 데이터가 있으면 덮어쓰기
      items.forEach(x=>{
        if(x.integration_type==='parking_control') setItem('parking', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='remote_metering') setItem('metering', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='cctv') setItem('cctv', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='elevator') setItem('elevator', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='parcel') setItem('parcel', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='ev_charger') setItem('ev', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='parking_location') setItem('parkingloc', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='onepass') setItem('onepass', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='rf_card') setItem('rfcard', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
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
      {integration_type:'parking_control', enabled: document.getElementById('parking_enabled').value, company_name: document.getElementById('parking_company').value || null, contact_person: document.getElementById('parking_contact_person')?.value || null, contact_phone: document.getElementById('parking_contact_phone')?.value || null, notes: document.getElementById('parking_notes')?.value || null, project_no: projectNo},
      {integration_type:'remote_metering', enabled: document.getElementById('metering_enabled').value, company_name: document.getElementById('metering_company').value || null, contact_person: document.getElementById('metering_contact_person')?.value || null, contact_phone: document.getElementById('metering_contact_phone')?.value || null, notes: document.getElementById('metering_notes')?.value || null, project_no: projectNo},
      {integration_type:'cctv', enabled: document.getElementById('cctv_enabled').value, company_name: document.getElementById('cctv_company').value || null, contact_person: document.getElementById('cctv_contact_person')?.value || null, contact_phone: document.getElementById('cctv_contact_phone')?.value || null, notes: document.getElementById('cctv_notes')?.value || null, project_no: projectNo},
      {integration_type:'elevator', enabled: document.getElementById('elevator_enabled').value, company_name: document.getElementById('elevator_company').value || null, contact_person: document.getElementById('elevator_contact_person')?.value || null, contact_phone: document.getElementById('elevator_contact_phone')?.value || null, notes: document.getElementById('elevator_notes')?.value || null, project_no: projectNo},
      {integration_type:'parcel', enabled: document.getElementById('parcel_enabled').value, company_name: document.getElementById('parcel_company').value || null, contact_person: document.getElementById('parcel_contact_person')?.value || null, contact_phone: document.getElementById('parcel_contact_phone')?.value || null, notes: document.getElementById('parcel_notes')?.value || null, project_no: projectNo},
      {integration_type:'ev_charger', enabled: document.getElementById('ev_enabled').value, company_name: document.getElementById('ev_company').value || null, contact_person: document.getElementById('ev_contact_person')?.value || null, contact_phone: document.getElementById('ev_contact_phone')?.value || null, notes: document.getElementById('ev_notes')?.value || null, project_no: projectNo},
      {integration_type:'parking_location', enabled: document.getElementById('parkingloc_enabled').value, company_name: document.getElementById('parkingloc_company').value || null, contact_person: document.getElementById('parkingloc_contact_person')?.value || null, contact_phone: document.getElementById('parkingloc_contact_phone')?.value || null, notes: document.getElementById('parkingloc_notes')?.value || null, project_no: projectNo},
      {integration_type:'onepass', enabled: document.getElementById('onepass_enabled').value, company_name: document.getElementById('onepass_company').value || null, contact_person: document.getElementById('onepass_contact_person')?.value || null, contact_phone: document.getElementById('onepass_contact_phone')?.value || null, notes: document.getElementById('onepass_notes')?.value || null, project_no: projectNo},
      {integration_type:'rf_card', enabled: document.getElementById('rfcard_enabled').value, company_name: document.getElementById('rfcard_company').value || null, contact_person: document.getElementById('rfcard_contact_person')?.value || null, contact_phone: document.getElementById('rfcard_contact_phone')?.value || null, notes: document.getElementById('rfcard_notes')?.value || null, project_no: projectNo},
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