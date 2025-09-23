// 세대부연동 탭: 조명SW/대기전력SW/가스감지기
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
        if(x.integration_type==='lighting_sw') setItem('lighting', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='standby_power_sw') setItem('standby', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='gas_detector') setItem('gas', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='heating') setItem('heating', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='ventilation') setItem('ventilation', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='door_lock') setItem('doorlock', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='air_conditioner') setItem('aircon', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='real_time_metering') setItem('realtime', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='environment_sensor') setItem('env', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
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
      {integration_type:'lighting_sw', enabled: document.getElementById('lighting_enabled').value, company_name: document.getElementById('lighting_company').value || null, contact_person: document.getElementById('lighting_contact_person')?.value || null, contact_phone: document.getElementById('lighting_contact_phone')?.value || null, notes: document.getElementById('lighting_notes')?.value || null, project_no: projectNo},
      {integration_type:'standby_power_sw', enabled: document.getElementById('standby_enabled').value, company_name: document.getElementById('standby_company').value || null, contact_person: document.getElementById('standby_contact_person')?.value || null, contact_phone: document.getElementById('standby_contact_phone')?.value || null, notes: document.getElementById('standby_notes')?.value || null, project_no: projectNo},
      {integration_type:'gas_detector', enabled: document.getElementById('gas_enabled').value, company_name: document.getElementById('gas_company').value || null, contact_person: document.getElementById('gas_contact_person')?.value || null, contact_phone: document.getElementById('gas_contact_phone')?.value || null, notes: document.getElementById('gas_notes')?.value || null, project_no: projectNo},
      {integration_type:'heating', enabled: document.getElementById('heating_enabled').value, company_name: document.getElementById('heating_company').value || null, contact_person: document.getElementById('heating_contact_person')?.value || null, contact_phone: document.getElementById('heating_contact_phone')?.value || null, notes: document.getElementById('heating_notes')?.value || null, project_no: projectNo},
      {integration_type:'ventilation', enabled: document.getElementById('ventilation_enabled').value, company_name: document.getElementById('ventilation_company').value || null, contact_person: document.getElementById('ventilation_contact_person')?.value || null, contact_phone: document.getElementById('ventilation_contact_phone')?.value || null, notes: document.getElementById('ventilation_notes')?.value || null, project_no: projectNo},
      {integration_type:'door_lock', enabled: document.getElementById('doorlock_enabled').value, company_name: document.getElementById('doorlock_company').value || null, contact_person: document.getElementById('doorlock_contact_person')?.value || null, contact_phone: document.getElementById('doorlock_contact_phone')?.value || null, notes: document.getElementById('doorlock_notes')?.value || null, project_no: projectNo},
      {integration_type:'air_conditioner', enabled: document.getElementById('aircon_enabled').value, company_name: document.getElementById('aircon_company').value || null, contact_person: document.getElementById('aircon_contact_person')?.value || null, contact_phone: document.getElementById('aircon_contact_phone')?.value || null, notes: document.getElementById('aircon_notes')?.value || null, project_no: projectNo},
      {integration_type:'real_time_metering', enabled: document.getElementById('realtime_enabled').value, company_name: document.getElementById('realtime_company').value || null, contact_person: document.getElementById('realtime_contact_person')?.value || null, contact_phone: document.getElementById('realtime_contact_phone')?.value || null, notes: document.getElementById('realtime_notes')?.value || null, project_no: projectNo},
      {integration_type:'environment_sensor', enabled: document.getElementById('env_enabled').value, company_name: document.getElementById('env_company').value || null, contact_person: document.getElementById('env_contact_person')?.value || null, contact_phone: document.getElementById('env_contact_phone')?.value || null, notes: document.getElementById('env_notes')?.value || null, project_no: projectNo},
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