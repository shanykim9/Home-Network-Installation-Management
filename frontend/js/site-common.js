// 공용부연동 탭: 주차관제/원격검침/CCTV
(function(){
  function getSelectedSiteId(){
    const select = document.getElementById('site-select');
    return select && select.value ? parseInt(select.value,10) : null;
  }

  function setItem(prefix, enabled, company){
    const e = document.getElementById(prefix + '_enabled');
    const c = document.getElementById(prefix + '_company');
    if(e) e.value = enabled || 'N';
    if(c) c.value = company || '';
  }

  async function loadCommon(){
    const siteId = getSelectedSiteId();
    if(!siteId) return;
    try{
      const res = await apiRequest(`/sites/${siteId}/integrations/common`, { method: 'GET' });
      const items = res.items || [];
      setItem('parking','N','');
      setItem('metering','N','');
      setItem('cctv','N','');
      items.forEach(x=>{
        if(x.integration_type==='parking_control') setItem('parking', x.enabled, x.company_name);
        if(x.integration_type==='remote_metering') setItem('metering', x.enabled, x.company_name);
        if(x.integration_type==='cctv') setItem('cctv', x.enabled, x.company_name);
      });
    }catch(err){
      console.error(err);
      Swal.fire('오류','공용부연동을 불러오지 못했습니다.','error');
    }
  }

  async function saveCommon(e){
    e.preventDefault();
    const siteId = getSelectedSiteId();
    if(!siteId){
      Swal.fire('안내','먼저 상단의 "현장 선택"에서 현장을 선택하세요.','info');
      return;
    }
    const items = [
      { 
        integration_type:'parking_control', 
        enabled: document.getElementById('parking_enabled').value, 
        company_name: document.getElementById('parking_company').value || null,
        registration_no: document.getElementById('common-registration-no').value,
        project_no: document.getElementById('common-project-no').value
      },
      { 
        integration_type:'remote_metering', 
        enabled: document.getElementById('metering_enabled').value, 
        company_name: document.getElementById('metering_company').value || null,
        registration_no: document.getElementById('common-registration-no').value,
        project_no: document.getElementById('common-project-no').value
      },
      { 
        integration_type:'cctv', 
        enabled: document.getElementById('cctv_enabled').value, 
        company_name: document.getElementById('cctv_company').value || null,
        registration_no: document.getElementById('common-registration-no').value,
        project_no: document.getElementById('common-project-no').value
      }
    ];
    try{
      await apiRequest(`/sites/${siteId}/integrations/common`, { method: 'POST', body: JSON.stringify({ items }) });
      Swal.fire({icon:'success', title:'저장 완료', timer:1500, showConfirmButton:false});
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
  });
})();