// 세대부연동 탭: 조명SW/대기전력SW/가스감지기
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

  async function loadHousehold(){
    const siteId = getSelectedSiteId();
    if(!siteId) return;
    try{
      const res = await apiRequest(`/sites/${siteId}/integrations/household`, { method: 'GET' });
      const items = res.items || [];
      // 초기화
      setItem('lighting','N','');
      setItem('standby','N','');
      setItem('gas','N','');
      // 반영
      items.forEach(x=>{
        if(x.integration_type==='lighting_sw') setItem('lighting', x.enabled, x.company_name);
        if(x.integration_type==='standby_power_sw') setItem('standby', x.enabled, x.company_name);
        if(x.integration_type==='gas_detector') setItem('gas', x.enabled, x.company_name);
      });
    }catch(err){
      console.error(err);
      Swal.fire('오류','세대부연동을 불러오지 못했습니다.','error');
    }
  }

  async function saveHousehold(e){
    e.preventDefault();
    const siteId = getSelectedSiteId();
    if(!siteId){
      Swal.fire('안내','먼저 상단의 "현장 선택"에서 현장을 선택하세요.','info');
      return;
    }
    const items = [
      { 
        integration_type:'lighting_sw', 
        enabled: document.getElementById('lighting_enabled').value, 
        company_name: document.getElementById('lighting_company').value || null,

        project_no: document.getElementById('household-project-no').value
      },
      { 
        integration_type:'standby_power_sw', 
        enabled: document.getElementById('standby_enabled').value, 
        company_name: document.getElementById('standby_company').value || null,

        project_no: document.getElementById('household-project-no').value
      },
      { 
        integration_type:'gas_detector', 
        enabled: document.getElementById('gas_enabled').value, 
        company_name: document.getElementById('gas_company').value || null,

        project_no: document.getElementById('household-project-no').value
      }
    ];
    try{
      await apiRequest(`/sites/${siteId}/integrations/household`, { method: 'POST', body: JSON.stringify({ items }) });
      Swal.fire({icon:'success', title:'저장 완료', timer:1500, showConfirmButton:false});
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
  });
})();