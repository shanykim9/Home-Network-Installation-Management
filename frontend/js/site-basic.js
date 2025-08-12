// 기본정보 탭: 현장 선택 시 정보 로드, 저장 시 신규/수정 분기
(function(){
  function getSelectedSiteId(){
    const select = document.getElementById('site-select');
    return select && select.value ? parseInt(select.value,10) : null;
  }

  // 날짜를 한국어 형식으로 표시 (예: 24년 8월 12일)
  function formatDateToKorean(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const year = date.getFullYear().toString().slice(-2); // 뒤의 2자리만
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    return `${year}년 ${month}월 ${day}일`;
  }

  // 날짜 입력 필드의 표시 업데이트
  function updateDateDisplays() {
    const registrationDate = document.getElementById('registration-date').value;
    const deliveryDate = document.getElementById('delivery-date').value;
    const completionDate = document.getElementById('completion-date').value;
    
    document.getElementById('registration-date-display').textContent = formatDateToKorean(registrationDate);
    document.getElementById('delivery-date-display').textContent = formatDateToKorean(deliveryDate);
    document.getElementById('completion-date-display').textContent = formatDateToKorean(completionDate);
  }

  // 날짜 입력 시 표시 업데이트 (HTML에서 호출)
  window.formatDateDisplay = function(inputElement, displayId) {
    const displayElement = document.getElementById(displayId);
    if (displayElement) {
      displayElement.textContent = formatDateToKorean(inputElement.value);
    }
  };

  async function loadBasic(){
    const siteId = getSelectedSiteId();
    if(!siteId) return;
    try{
      const res = await apiRequest(`/sites/${siteId}`, { method: 'GET' });
      const s = res.site || {};
      document.getElementById('registration-no').value = s.registration_no || '';
      document.getElementById('project-no').value = s.project_no || '';
      document.getElementById('construction-company').value = s.construction_company || '';
      document.getElementById('site-name').value = s.site_name || '';
      document.getElementById('address').value = s.address || '';
      document.getElementById('detail-address').value = s.detail_address || '';
      document.getElementById('household-count').value = s.household_count || '';
      document.getElementById('registration-date').value = s.registration_date || '';
      document.getElementById('delivery-date').value = s.delivery_date || '';
      document.getElementById('completion-date').value = s.completion_date || '';
      document.getElementById('certification-audit').value = s.certification_audit || '';
      document.getElementById('home-iot').value = s.home_iot || '';
      
      // 날짜 표시 업데이트
      updateDateDisplays();
      
      // 다른 탭들에도 등록번호와 프로젝트 No. 전달
      if (window.updateAllTabsWithSiteInfo) {
        window.updateAllTabsWithSiteInfo(s);
      }
    }catch(err){
      console.error(err);
      Swal.fire('오류','기본정보를 불러오지 못했습니다.','error');
    }
  }

  async function saveBasic(e){
    e.preventDefault();
    const siteId = getSelectedSiteId();
    const body = {
      project_no: document.getElementById('project-no').value,
      construction_company: document.getElementById('construction-company').value,
      site_name: document.getElementById('site-name').value,
      address: document.getElementById('address').value,
      detail_address: document.getElementById('detail-address').value,
      household_count: parseInt(document.getElementById('household-count').value||'0',10),
      registration_date: document.getElementById('registration-date').value,
      delivery_date: document.getElementById('delivery-date').value,
      completion_date: document.getElementById('completion-date').value,
      certification_audit: document.getElementById('certification-audit').value || 'N',
      home_iot: document.getElementById('home-iot').value || 'N'
    };

    try{
      if(siteId){
        await apiRequest(`/sites/${siteId}`, { method: 'PATCH', body: JSON.stringify(body) });
        Swal.fire({icon:'success', title:'기본정보 수정 완료', timer:1500, showConfirmButton:false});
      }else{
        // 신규 등록 전 다음 등록번호 미리 조회하여 표시(서버는 실제 저장 시에도 자동 증가 처리)
        try{
          const next = await apiRequest('/sites/next-registration-no', { method: 'GET' });
          document.getElementById('registration-no').value = next.next_registration_no || '';
        }catch(_){/* 무시 */}
        await apiRequest('/sites', { method: 'POST', body: JSON.stringify(body) });
        Swal.fire({icon:'success', title:'현장 등록 완료', timer:1500, showConfirmButton:false});
        if(window.loadSitesIntoSelect){ window.loadSitesIntoSelect(); }
      }
    }catch(err){
      console.error(err);
      Swal.fire('오류','기본정보 저장 중 오류가 발생했습니다.','error');
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const select = document.getElementById('site-select');
    if(select){ select.addEventListener('change', loadBasic); }
    const form = document.getElementById('site-form');
    if(form){ form.addEventListener('submit', saveBasic); }
  });
})();