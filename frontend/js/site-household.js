// 세대부연동 탭: 조명SW/대기전력SW/가스감지기
(function(){
  function formatPhone(value){
    const digits = String(value||'').replace(/\D/g,'');
    if(digits.length <= 3) return digits;
    if(digits.length <= 7) return digits.replace(/(\d{3})(\d+)/, '$1-$2');
    if(digits.length <= 11) return digits.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
    return digits;
  }
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
    if(ph) ph.value = formatPhone(contactPhone || '');
    if(n) n.value = notes || '';
  }

  async function loadHousehold(){
    const siteId = getSelectedSiteId();
    if(!siteId) {
      // 현장이 선택되지 않은 경우 기본값으로 설정
      setItem('lighting','Y','');
      setItem('standby','Y','');
      setItem('gas','Y','');
      setItem('vpn','Y','');
      setItem('alloff','Y','');
      setItem('bathphone','Y','');
      setItem('kitchentv','Y','');
      return;
    }
    try{
      const res = await apiRequest(`/sites/${siteId}/integrations/household`, { method: 'GET' });
      const items = res.items || [];
      
      // 먼저 기본값으로 초기화
      setItem('lighting','Y','');
      setItem('standby','Y','');
      setItem('gas','Y','');
      setItem('vpn','Y','');
      setItem('alloff','Y','');
      setItem('bathphone','Y','');
      setItem('kitchentv','Y','');
      
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
        if(x.integration_type==='vpn') setItem('vpn', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='all_off_switch') setItem('alloff', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='bathroom_phone') setItem('bathphone', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
        if(x.integration_type==='kitchen_tv') setItem('kitchentv', x.enabled, x.company_name, x.contact_person, x.contact_phone, x.notes);
      });
    }catch(err){
      console.error(err);
      // 에러 발생 시에도 기본값으로 설정
      setItem('lighting','Y','');
      setItem('standby','Y','');
      setItem('gas','Y','');
      setItem('vpn','Y','');
      setItem('alloff','Y','');
      setItem('bathphone','Y','');
      setItem('kitchentv','Y','');
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
    const gv = (id)=>{ const el=document.getElementById(id); const v=el?el.value:null; return (v&&String(v).trim()!=='')? v : null; };
    const gp = (id)=>{ const v=gv(id); return v? formatPhone(v) : null; };
    const items = [
      {integration_type:'lighting_sw', enabled: gv('lighting_enabled')||'N', company_name: gv('lighting_company'), contact_person: gv('lighting_contact_person'), contact_phone: gp('lighting_contact_phone'), notes: gv('lighting_notes'), project_no: projectNo},
      {integration_type:'standby_power_sw', enabled: gv('standby_enabled')||'N', company_name: gv('standby_company'), contact_person: gv('standby_contact_person'), contact_phone: gp('standby_contact_phone'), notes: gv('standby_notes'), project_no: projectNo},
      {integration_type:'gas_detector', enabled: gv('gas_enabled')||'N', company_name: gv('gas_company'), contact_person: gv('gas_contact_person'), contact_phone: gp('gas_contact_phone'), notes: gv('gas_notes'), project_no: projectNo},
      {integration_type:'heating', enabled: gv('heating_enabled')||'N', company_name: gv('heating_company'), contact_person: gv('heating_contact_person'), contact_phone: gp('heating_contact_phone'), notes: gv('heating_notes'), project_no: projectNo},
      {integration_type:'ventilation', enabled: gv('ventilation_enabled')||'N', company_name: gv('ventilation_company'), contact_person: gv('ventilation_contact_person'), contact_phone: gp('ventilation_contact_phone'), notes: gv('ventilation_notes'), project_no: projectNo},
      {integration_type:'door_lock', enabled: gv('doorlock_enabled')||'N', company_name: gv('doorlock_company'), contact_person: gv('doorlock_contact_person'), contact_phone: gp('doorlock_contact_phone'), notes: gv('doorlock_notes'), project_no: projectNo},
      {integration_type:'air_conditioner', enabled: gv('aircon_enabled')||'N', company_name: gv('aircon_company'), contact_person: gv('aircon_contact_person'), contact_phone: gp('aircon_contact_phone'), notes: gv('aircon_notes'), project_no: projectNo},
      {integration_type:'real_time_metering', enabled: gv('realtime_enabled')||'N', company_name: gv('realtime_company'), contact_person: gv('realtime_contact_person'), contact_phone: gp('realtime_contact_phone'), notes: gv('realtime_notes'), project_no: projectNo},
      {integration_type:'environment_sensor', enabled: gv('env_enabled')||'N', company_name: gv('env_company'), contact_person: gv('env_contact_person'), contact_phone: gp('env_contact_phone'), notes: gv('env_notes'), project_no: projectNo},
      {integration_type:'vpn', enabled: gv('vpn_enabled')||'N', company_name: gv('vpn_company'), contact_person: gv('vpn_contact_person'), contact_phone: gp('vpn_contact_phone'), notes: gv('vpn_notes'), project_no: projectNo},
      {integration_type:'all_off_switch', enabled: gv('alloff_enabled')||'N', company_name: gv('alloff_company'), contact_person: gv('alloff_contact_person'), contact_phone: gp('alloff_contact_phone'), notes: gv('alloff_notes'), project_no: projectNo},
      {integration_type:'bathroom_phone', enabled: gv('bathphone_enabled')||'N', company_name: gv('bathphone_company'), contact_person: gv('bathphone_contact_person'), contact_phone: gp('bathphone_contact_phone'), notes: gv('bathphone_notes'), project_no: projectNo},
      {integration_type:'kitchen_tv', enabled: gv('kitchentv_enabled')||'N', company_name: gv('kitchentv_company'), contact_person: gv('kitchentv_contact_person'), contact_phone: gp('kitchentv_contact_phone'), notes: gv('kitchentv_notes'), project_no: projectNo},
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
    
    // 페이지 로드 시 기본값을 'Y'로 설정 (강제 설정) + 전화 포맷 리스너 등록
    setTimeout(() => {
      setItem('lighting','Y','');
      setItem('standby','Y','');
      setItem('gas','Y','');
      const phones = form ? form.querySelectorAll('input[id$="_contact_phone"]') : [];
      phones.forEach(el=>{
        el.addEventListener('input', ()=>{ el.value = formatPhone(el.value); });
        el.value = formatPhone(el.value);
      });
    }, 100);
  });
  // 전역 노출
  window.loadHousehold = loadHousehold;
  // 최종 저장에서 직접 호출할 수 있도록 노출
  window.saveHousehold = saveHousehold;
})();