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

  // 프로젝트 번호 중복 체크
  async function checkProjectNoDuplicate(projectNo) {
    try {
      console.log('🔍 중복 체크 요청:', projectNo);
      const res = await apiRequest('/check-project-no', {
        method: 'POST',
        body: { project_no: projectNo }
      });
      
      if (res.is_duplicate) {
        // 중복인 경우
        Swal.fire({
          title: '중복된 프로젝트 번호',
          html: `${res.message}<br><br><strong>기존 현장:</strong> ${res.existing_site.site_name}`,
          icon: 'warning',
          confirmButtonText: '확인'
        });
        return false;
      } else {
        // 사용 가능한 경우
        Swal.fire({
          title: '프로젝트 번호 확인',
          text: res.message,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        return true;
      }
    } catch (err) {
      console.error('중복 체크 오류:', err);
      Swal.fire('오류', '프로젝트 번호 중복 체크 중 오류가 발생했습니다.', 'error');
      return false;
    }
  }

  // 프로젝트 번호 입력 시 실시간 중복 체크
  window.checkProjectNoOnInput = function() {
    const prefix = document.getElementById('project-no-prefix').value;
    const number = document.getElementById('project-no-number').value;
    
    // 4자리 숫자가 모두 입력되었을 때만 중복 체크
    if (number.length === 4) {
      const projectNo = prefix + number;
      checkProjectNoDuplicate(projectNo);
    }
  };

  async function loadBasic(){
    const siteId = getSelectedSiteId();
    if(!siteId) return;
    try{
      const res = await apiRequest(`/sites/${siteId}`, { method: 'GET' });
      const s = res.site || {};
      // 프로젝트 No. 로드
      if (s.project_no) {
        const prefix = s.project_no.substring(0, 3); // "NA/" 또는 "NE/"
        const number = s.project_no.substring(3); // "1234"
        
        document.getElementById('project-no-prefix').value = prefix;
        document.getElementById('project-no-number').value = number;
      } else {
        // 기본값 설정
        document.getElementById('project-no-prefix').value = 'NA/';
        document.getElementById('project-no-number').value = '';
      }
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
      
      // 제품 BI
      const productBiEl = document.getElementById('product-bi');
      if(productBiEl) productBiEl.value = s.product_bi || '';
      
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
    // 프로젝트 No. 조합
    const prefix = document.getElementById('project-no-prefix').value;
    const number = document.getElementById('project-no-number').value;
    const projectNo = prefix + number;
    
    const body = {
      project_no: projectNo,
      construction_company: document.getElementById('construction-company').value,
      site_name: document.getElementById('site-name').value,
      address: document.getElementById('address').value,
      detail_address: document.getElementById('detail-address').value,
      household_count: parseInt(document.getElementById('household-count').value||'0',10),
      registration_date: document.getElementById('registration-date').value || null,
      delivery_date: document.getElementById('delivery-date').value || null,
      completion_date: document.getElementById('completion-date').value || null,
      certification_audit: document.getElementById('certification-audit').value || 'N',
      home_iot: document.getElementById('home-iot').value || 'N',
      product_bi: (document.getElementById('product-bi') && document.getElementById('product-bi').value) || null
    };

    // 프로젝트 No. 형식 검사
    const pattern = /^(NA|NE)\/\d{4}$/;
    if(!pattern.test(projectNo.trim())){
      Swal.fire('안내','프로젝트 No.는 NA/ 또는 NE/로 시작하고 4자리 숫자여야 합니다.','info');
      document.getElementById('project-no-number').focus();
      return;
    }

    // 신규 등록 시에만 중복 체크 (수정 시에는 중복 체크하지 않음)
    if (!siteId) {
      const isDuplicate = await checkProjectNoDuplicate(projectNo);
      if (isDuplicate === false) {
        // 중복인 경우 저장 중단
        return;
      }
    }

    try{
      if(siteId){
        await apiRequest(`/sites/${siteId}`, { method: 'PATCH', body: body });
        // 프로젝트 No 브로드캐스트
        try{ if(window.updateAllTabsWithSiteInfo){ window.updateAllTabsWithSiteInfo({ project_no: body.project_no }); } }catch(_){ }
        Swal.fire({icon:'success', title:'기본정보 수정 완료', timer:1500, showConfirmButton:false});
      }else{
        const createRes = await apiRequest('/sites', { method: 'POST', body: body });
        const created = createRes.site || null;
        Swal.fire({icon:'success', title:'현장 등록 완료', timer:1500, showConfirmButton:false});
        if(window.loadSitesIntoSelect){ await window.loadSitesIntoSelect(); }
        // 선택 및 브로드캐스트
        const select = document.getElementById('site-select');
        if(created && created.id && select){ select.value = String(created.id); }
        try{ if(window.updateAllTabsWithSiteInfo){ window.updateAllTabsWithSiteInfo(created || { project_no: body.project_no }); } }catch(_){ }
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
    if(form){ 
      // 제출은 최종 저장이므로 여기서는 임시 저장 용도로만 사용하지 않음
      form.addEventListener('submit', saveBasic); 
    }
    // 탭 이동 시 임시 저장을 위해 필드 변경 이벤트 등록
    ['project-no','construction-company','site-name','address','detail-address','household-count','registration-date','delivery-date','completion-date','certification-audit','home-iot','product-bi']
      .forEach(id=>{
        const el = document.getElementById(id);
        if(el){
          el.addEventListener('change', ()=>{
            const temp = {
              project_no: document.getElementById('project-no').value,
              construction_company: document.getElementById('construction-company').value,
              site_name: document.getElementById('site-name').value,
              address: document.getElementById('address').value,
              detail_address: document.getElementById('detail-address').value,
              household_count: document.getElementById('household-count').value,
              registration_date: document.getElementById('registration-date').value,
              delivery_date: document.getElementById('delivery-date').value,
              completion_date: document.getElementById('completion-date').value,
              certification_audit: document.getElementById('certification-audit').value || 'N',
              home_iot: document.getElementById('home-iot').value || 'N',
              product_bi: (document.getElementById('product-bi') && document.getElementById('product-bi').value) || null
            };
            try{ if(window.saveToTempStorage){ window.saveToTempStorage('basic', temp); } }catch(_){ }
          });
        }
      });
  });
  // 전역 노출: 현장 선택 시 순차 로드 체인에서 사용
  window.loadBasic = loadBasic;
})();