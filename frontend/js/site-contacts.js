// 연락처 탭 로직
(function(){
  function getSelectedSiteId(){
    const select = document.getElementById('site-select');
    return select && select.value ? parseInt(select.value,10) : null;
  }

  async function loadContacts(){
    const siteId = getSelectedSiteId();
    if(!siteId) return; // 미선택 시 무시
    try{
      const res = await apiRequest(`/sites/${siteId}/contacts`, { method: 'GET' });
      const c = res.contacts || {};
      document.getElementById('pm_name').value = c.pm_name || '';
      document.getElementById('pm_phone').value = c.pm_phone || '';
      document.getElementById('sales_manager_name').value = c.sales_manager_name || '';
      document.getElementById('sales_manager_phone').value = c.sales_manager_phone || '';
      document.getElementById('construction_manager_name').value = c.construction_manager_name || '';
      document.getElementById('construction_manager_phone').value = c.construction_manager_phone || '';
      document.getElementById('installer_name').value = c.installer_name || '';
      document.getElementById('installer_phone').value = c.installer_phone || '';
      document.getElementById('network_manager_name').value = c.network_manager_name || '';
      document.getElementById('network_manager_phone').value = c.network_manager_phone || '';
    }catch(err){
      console.error(err);
      Swal.fire('오류','연락처 정보를 불러오지 못했습니다.','error');
    }
  }

  async function saveContacts(e){
    e.preventDefault();
    const siteId = getSelectedSiteId();
    if(!siteId){
      Swal.fire('안내','먼저 상단의 "현장 선택"에서 현장을 선택하세요.','info');
      return;
    }
    const payload = {
      registration_no: document.getElementById('contacts-registration-no').value,
      project_no: document.getElementById('contacts-project-no').value,
      pm_name: document.getElementById('pm_name').value.trim() || null,
      pm_phone: document.getElementById('pm_phone').value.trim() || null,
      sales_manager_name: document.getElementById('sales_manager_name').value.trim() || null,
      sales_manager_phone: document.getElementById('sales_manager_phone').value.trim() || null,
      construction_manager_name: document.getElementById('construction_manager_name').value.trim() || null,
      construction_manager_phone: document.getElementById('construction_manager_phone').value.trim() || null,
      installer_name: document.getElementById('installer_name').value.trim() || null,
      installer_phone: document.getElementById('installer_phone').value.trim() || null,
      network_manager_name: document.getElementById('network_manager_name').value.trim() || null,
      network_manager_phone: document.getElementById('network_manager_phone').value.trim() || null,
    };
    try{
      await apiRequest(`/sites/${siteId}/contacts`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      Swal.fire({ icon:'success', title:'저장 완료', timer:1500, showConfirmButton:false });
      loadContacts();
    }catch(err){
      console.error(err);
      Swal.fire('오류','연락처 저장 중 오류가 발생했습니다.','error');
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const contactsForm = document.getElementById('contacts-form');
    if(contactsForm){
      contactsForm.addEventListener('submit', saveContacts);
    }
    const select = document.getElementById('site-select');
    if(select){
      select.addEventListener('change', loadContacts);
    }
  });
})();