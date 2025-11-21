// 공용부연동 탭: 주차관제/원격검침/CCTV
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
    const gv = (id)=>{ const el=document.getElementById(id); const v=el?el.value:null; return (v&&String(v).trim()!=='')? v : null; };
    const gp = (id)=>{ const v=gv(id); return v? formatPhone(v) : null; };
    const items = [
      {integration_type:'parking_control', enabled: gv('parking_enabled')||'N', company_name: gv('parking_company'), contact_person: gv('parking_contact_person'), contact_phone: gp('parking_contact_phone'), notes: gv('parking_notes'), project_no: projectNo},
      {integration_type:'remote_metering', enabled: gv('metering_enabled')||'N', company_name: gv('metering_company'), contact_person: gv('metering_contact_person'), contact_phone: gp('metering_contact_phone'), notes: gv('metering_notes'), project_no: projectNo},
      {integration_type:'cctv', enabled: gv('cctv_enabled')||'N', company_name: gv('cctv_company'), contact_person: gv('cctv_contact_person'), contact_phone: gp('cctv_contact_phone'), notes: gv('cctv_notes'), project_no: projectNo},
      {integration_type:'elevator', enabled: gv('elevator_enabled')||'N', company_name: gv('elevator_company'), contact_person: gv('elevator_contact_person'), contact_phone: gp('elevator_contact_phone'), notes: gv('elevator_notes'), project_no: projectNo},
      {integration_type:'parcel', enabled: gv('parcel_enabled')||'N', company_name: gv('parcel_company'), contact_person: gv('parcel_contact_person'), contact_phone: gp('parcel_contact_phone'), notes: gv('parcel_notes'), project_no: projectNo},
      {integration_type:'ev_charger', enabled: gv('ev_enabled')||'N', company_name: gv('ev_company'), contact_person: gv('ev_contact_person'), contact_phone: gp('ev_contact_phone'), notes: gv('ev_notes'), project_no: projectNo},
      {integration_type:'parking_location', enabled: gv('parkingloc_enabled')||'N', company_name: gv('parkingloc_company'), contact_person: gv('parkingloc_contact_person'), contact_phone: gp('parkingloc_contact_phone'), notes: gv('parkingloc_notes'), project_no: projectNo},
      {integration_type:'onepass', enabled: gv('onepass_enabled')||'N', company_name: gv('onepass_company'), contact_person: gv('onepass_contact_person'), contact_phone: gp('onepass_contact_phone'), notes: gv('onepass_notes'), project_no: projectNo},
      {integration_type:'rf_card', enabled: gv('rfcard_enabled')||'N', company_name: gv('rfcard_company'), contact_person: gv('rfcard_contact_person'), contact_phone: gp('rfcard_contact_phone'), notes: gv('rfcard_notes'), project_no: projectNo},
    ];
    try{
      const response = await apiRequest(`/sites/${siteId}/integrations/common`, { method: 'POST', body: { items } });
      // 저장할 데이터가 없을 때 안내 메시지 표시
      if(response.no_data){
        if(!window.__batchSaving){ Swal.fire({icon:'info', title:'안내', text:'저장할 내용이 없습니다.', timer:2000, showConfirmButton:false}); }
        return;
      }
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
      
      // 전화 포맷 핸들러 등록
      const phones = form ? form.querySelectorAll('input[id$="_contact_phone"]') : [];
      phones.forEach(el=>{
        el.addEventListener('input', ()=>{ el.value = formatPhone(el.value); });
        el.value = formatPhone(el.value);
      });
      
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