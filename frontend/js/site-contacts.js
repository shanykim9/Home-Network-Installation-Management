// 연락처 탭 로직
(function(){
  function getSelectedSiteId(){
    const select = document.getElementById('site-select');
    return select && select.value ? parseInt(select.value,10) : null;
  }

  // 전화번호 하이픈 자동 포맷
  function formatPhone(value){
    const digits = String(value||'').replace(/\D/g,'');
    if(digits.length <= 3) return digits;
    if(digits.length <= 7) return digits.replace(/(\d{3})(\d+)/, '$1-$2');
    if(digits.length <= 11) return digits.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
    return digits; // 초과 시 원본 유지
  }

  // 사용자 목록 캐시 (users 테이블)
  const usersCache = [];

  async function loadUsers(q){
    const params = new URLSearchParams();
    if(q) params.set('q', q);
    const res = await apiRequest(`/users?${params.toString()}`, { method: 'GET' });
    const items = res.items||[];
    if(!q){
      usersCache.length = 0;
      usersCache.push(...items);
    }
    return items;
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

      // 보이는 콤보박스(select)와 동기화
      try{
        const pmSel = document.getElementById('pm_name-select');
        if(pmSel){
          // 옵션이 아직 없으면 rebuild 트리거 (초기 진입 대비)
          if(pmSel.options.length <= 1){ pmSel.dispatchEvent(new Event('rebuild')); }
          const match = Array.from(pmSel.options).find(o=>o.value === (c.pm_name||''));
          pmSel.value = match ? match.value : '';
        }
        const salesSel = document.getElementById('sales_manager_name-select');
        if(salesSel){
          if(salesSel.options.length <= 1){ salesSel.dispatchEvent(new Event('rebuild')); }
          const match2 = Array.from(salesSel.options).find(o=>o.value === (c.sales_manager_name||''));
          salesSel.value = match2 ? match2.value : '';
        }
      }catch(_){/* ignore */}
      // 저장된 이름과 사용자 목록이 매칭되면 전화 동기화 (비어있거나 다른 경우만)
      try {
        if(c.pm_name){
          const m = usersCache.find(it=>String(it.name).trim()===String(c.pm_name).trim());
          if(m && (!c.pm_phone || c.pm_phone.trim()==='')){
            document.getElementById('pm_phone').value = formatPhone(m.phone||'');
          }
        }
        if(c.sales_manager_name){
          const m2 = usersCache.find(it=>String(it.name).trim()===String(c.sales_manager_name).trim());
          if(m2 && (!c.sales_manager_phone || c.sales_manager_phone.trim()==='')){
            document.getElementById('sales_manager_phone').value = formatPhone(m2.phone||'');
          }
        }
      }catch(_){/* ignore */}
      document.getElementById('construction_manager_name').value = c.construction_manager_name || '';
      document.getElementById('construction_manager_phone').value = c.construction_manager_phone || '';
      document.getElementById('installer_name').value = c.installer_name || '';
      document.getElementById('installer_phone').value = c.installer_phone || '';
      document.getElementById('network_manager_name').value = c.network_manager_name || '';
      document.getElementById('network_manager_phone').value = c.network_manager_phone || '';

      // 동적 리스트 반영
      buildDynamicList('sales-list', c.sales_list||[], 'sales');
      buildDynamicList('construction-list', c.construction_list||[], 'construction');
      buildDynamicList('installer-list', c.installer_list||[], 'installer');
      buildDynamicList('network-list', c.network_list||[], 'network');
    }catch(err){
      console.error(err);
      Swal.fire('오류','연락처 정보를 불러오지 못했습니다.','error');
    }
  }

  // 서버 값 로드 후, 임시 저장값을 비어있는 필드에만 보조 적용
  function overlayTempDataIfAny(){
    try{
      const temp = (typeof TempStorage !== 'undefined') ? TempStorage.loadTempData('contacts') : null;
      if(!temp) return;
      const setIfEmpty = (id, val) => {
        const el = document.getElementById(id);
        if(!el) return;
        if(!el.value || String(el.value).trim()===''){
          el.value = val || '';
        }
      };
      setIfEmpty('pm_name', temp.pm_name);
      setIfEmpty('pm_phone', temp.pm_phone);
      setIfEmpty('sales_manager_name', temp.sales_manager_name);
      setIfEmpty('sales_manager_phone', temp.sales_manager_phone);
      setIfEmpty('construction_manager_name', temp.construction_manager_name);
      setIfEmpty('construction_manager_phone', temp.construction_manager_phone);
      setIfEmpty('installer_name', temp.installer_name);
      setIfEmpty('installer_phone', temp.installer_phone);
      setIfEmpty('network_manager_name', temp.network_manager_name);
      setIfEmpty('network_manager_phone', temp.network_manager_phone);
    }catch(_){/* ignore */}
  }

  // 원복: 일반 저장 방식
  function collectDynamicList(containerId){
    const wrap = document.getElementById(containerId);
    if(!wrap) return [];
    const rows = Array.from(wrap.querySelectorAll('[data-row="1"]'));
    return rows.map(r=>({
      name: String(r.querySelector('input[data-field="name"]')?.value||'').trim(),
      phone: String(r.querySelector('input[data-field="phone"]')?.value||'').trim(),
    })).filter(it=>it.name || it.phone);
  }

  function buildDynamicList(containerId, items, kind){
    const wrap = document.getElementById(containerId);
    if(!wrap) return;
    // 기존 추가 행 제거(첫 기본 행 제외)
    Array.from(wrap.children).forEach((ch, idx)=>{ if(idx>0) ch.remove(); });
    const addBtnId = `${kind}-add`;
    const addBtn = document.getElementById(addBtnId);
    function addRow(name='', phone=''){
      const row = document.createElement('div');
      row.className = 'flex gap-2 items-center';
      row.setAttribute('data-row','1');
      row.innerHTML = `
        <input type="text" data-field="name" class="flex-1 px-3 py-2 border border-gray-300 rounded-md" placeholder="이름" value="${name}">
        <input type="text" data-field="phone" class="w-44 px-3 py-2 border border-gray-300 rounded-md" placeholder="전화" value="${phone}">
        <button type="button" class="px-3 py-2 border rounded text-red-600" data-remove="1">-</button>
      `;
      wrap.appendChild(row);
      const rm = row.querySelector('[data-remove="1"]');
      rm.addEventListener('click', ()=>{ row.remove(); });
    }
    (items||[]).forEach(it=> addRow(it.name||'', it.phone||''));
    if(addBtn){
      addBtn.onclick = ()=> addRow('', '');
    }
  }

  async function conservativeSaveContacts(){
    const siteId = getSelectedSiteId();
    if(!siteId){
      Swal.fire('안내','먼저 상단의 "현장 선택"에서 현장을 선택하세요.','info');
      return;
    }
    // 현재 서버 값 조회
    let current = {};
    try{ const res = await apiRequest(`/sites/${siteId}/contacts`, { method: 'GET' }); current = res.contacts || {}; }catch(_){ current = {}; }

    const draft = {
      project_no: document.getElementById('contacts-project-no').value || current.project_no || null,
      pm_name: document.getElementById('pm_name').value.trim(),
      pm_phone: document.getElementById('pm_phone').value.trim(),
      sales_manager_name: document.getElementById('sales_manager_name').value.trim(),
      sales_manager_phone: document.getElementById('sales_manager_phone').value.trim(),
      construction_manager_name: document.getElementById('construction_manager_name').value.trim(),
      construction_manager_phone: document.getElementById('construction_manager_phone').value.trim(),
      installer_name: document.getElementById('installer_name').value.trim(),
      installer_phone: document.getElementById('installer_phone').value.trim(),
      network_manager_name: document.getElementById('network_manager_name').value.trim(),
      network_manager_phone: document.getElementById('network_manager_phone').value.trim(),
    };

    // 단순 저장 페이로드 구성
    const payload = {};
    const normalize = (v)=> v===''? null : v;
    const compareAndAssign = (key, transform=(x)=>x)=>{
      const newVal = normalize(transform(draft[key]));
      const oldVal = normalize(current[key]);
      if(newVal===null || newVal===undefined) return; // 보수적: 빈 값은 보내지 않음
      if(String(newVal) !== String(oldVal||'')) payload[key] = newVal;
    };
    payload.project_no = draft.project_no || current.project_no || null;
    payload.pm_name = draft.pm_name || null;
    payload.pm_phone = draft.pm_phone ? formatPhone(draft.pm_phone) : null;
    payload.sales_manager_name = draft.sales_manager_name || null;
    payload.sales_manager_phone = draft.sales_manager_phone ? formatPhone(draft.sales_manager_phone) : null;
    payload.construction_manager_name = draft.construction_manager_name || null;
    payload.construction_manager_phone = draft.construction_manager_phone || null;
    payload.installer_name = draft.installer_name || null;
    payload.installer_phone = draft.installer_phone || null;
    payload.network_manager_name = draft.network_manager_name || null;
    payload.network_manager_phone = draft.network_manager_phone || null;
    // 동적 리스트 수집 및 추가
    payload.sales_list = collectDynamicList('sales-list');
    payload.construction_list = collectDynamicList('construction-list');
    payload.installer_list = collectDynamicList('installer-list');
    payload.network_list = collectDynamicList('network-list');

    try{
      await apiRequest(`/sites/${siteId}/contacts`, { method: 'POST', body: payload });
      if(!window.__batchSaving){ Swal.fire({ icon:'success', title:'저장 완료', timer:1500, showConfirmButton:false }); }
      loadContacts();
    }catch(err){
      console.error(err);
      Swal.fire('오류','연락처 저장 중 오류가 발생했습니다.','error');
    }
  }

  async function saveContacts(e){
    e && e.preventDefault && e.preventDefault();
    return conservativeSaveContacts();
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

    // 입력 포맷 및 마스터 연동
    const pmName = document.getElementById('pm_name');
    const pmPhone = document.getElementById('pm_phone');
    const salesName = document.getElementById('sales_manager_name');
    const salesPhone = document.getElementById('sales_manager_phone');

    if(pmPhone){ pmPhone.addEventListener('input', ()=>{ pmPhone.value = formatPhone(pmPhone.value); }); }
    if(salesPhone){ salesPhone.addEventListener('input', ()=>{ salesPhone.value = formatPhone(salesPhone.value); }); }

    // 사용자 목록 기반 콤보박스 (users 테이블 사용)
    async function attachUsersToInput(inputEl, phoneEl){
      if(!inputEl) return;
      // select 생성 및 주입
      const selectId = `${inputEl.id}-select`;
      let selectEl = document.getElementById(selectId);
      if(!selectEl){
        selectEl = document.createElement('select');
        selectEl.id = selectId;
        selectEl.className = 'w-full px-3 py-2 border border-gray-300 rounded-md bg-white';
        // input 앞에 select 삽입
        inputEl.parentNode.insertBefore(selectEl, inputEl);
      }

      // 옵션 갱신 함수
      async function rebuildOptions(){
        if(usersCache.length === 0){
          await loadUsers('');
        }
        const items = usersCache;
        selectEl.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '선택하세요';
        selectEl.appendChild(placeholder);
        items.forEach(it=>{
          const opt = document.createElement('option');
          opt.value = it.name;
          opt.textContent = it.name;
          opt.setAttribute('data-phone', it.phone||'');
          selectEl.appendChild(opt);
        });
        const direct = document.createElement('option');
        direct.value = '__DIRECT__';
        direct.textContent = '직접 입력';
        selectEl.appendChild(direct);
      }

      function applyFromSelect(){
        const val = selectEl.value;
        if(val==='__DIRECT__'){
          // 직접 입력 모드로 전환
          inputEl.classList.remove('hidden');
          inputEl.value = '';
          if(phoneEl){ phoneEl.value=''; }
          inputEl.focus();
          return;
        }
        if(val===''){
          // 선택 초기화
          if(phoneEl){ phoneEl.value=''; }
          inputEl.value = '';
          return;
        }
        inputEl.value = val;
        const opt = selectEl.selectedOptions[0];
        const phone = opt ? opt.getAttribute('data-phone') : '';
        if(phoneEl){ phoneEl.value = formatPhone(phone||''); }
      }

      // 초기 빌드 및 표시
      rebuildOptions().then(()=>{
        // 기존 값 매칭
        const currentName = String(inputEl.value||'').trim();
        if(currentName){
          const match = usersCache.find(it=>String(it.name).trim()===currentName);
          if(match){ selectEl.value = match.name; }
        }
        // 기본은 select 보이기, input 숨기기
        inputEl.classList.add('hidden');
        applyFromSelect();
      });

      selectEl.addEventListener('change', applyFromSelect);
      // 외부 트리거로 옵션을 다시 구성할 수 있게 훅 추가
      selectEl.addEventListener('rebuild', ()=>{
        rebuildOptions().then(()=>{
          applyFromSelect();
        });
      });
    }

    attachUsersToInput(pmName, pmPhone);
    attachUsersToInput(salesName, salesPhone);

    // 빈 상태에서도 + 버튼이 동작하도록 기본 빌드 실행
    try{
      buildDynamicList('sales-list', [], 'sales');
      buildDynamicList('construction-list', [], 'construction');
      buildDynamicList('installer-list', [], 'installer');
      buildDynamicList('network-list', [], 'network');
    }catch(_){/* ignore */}

    // 탭 활성화/로그인 완료 시 서버 우선 로드 후 임시값 보조 적용
    async function reloadContactsFromServerThenOverlay(){
      await loadContacts();
      overlayTempDataIfAny();
    }

    function rebuildSelectIfExists(inputEl){
      if(!inputEl) return;
      const selectId = `${inputEl.id}-select`;
      const el = document.getElementById(selectId);
      if(!el) return;
      el.dispatchEvent(new Event('rebuild'));
    }

    // 로그인 완료 시 사용자 목록 재로드(앱 초기 진입에서 토큰 준비 전 호출 보완)
    document.addEventListener('auth:ready', ()=>{
      usersCache.length = 0; // 초기화 후 재빌드
      rebuildSelectIfExists(pmName);
      rebuildSelectIfExists(salesName);
      reloadContactsFromServerThenOverlay();
    });

    // 탭 전환 시 연락처 탭이면 목록 재구성
    document.addEventListener('tab:activated', (e)=>{
      if(!e?.detail?.tab || e.detail.tab !== 'contacts') return;
      rebuildSelectIfExists(pmName);
      rebuildSelectIfExists(salesName);
      reloadContactsFromServerThenOverlay();
    });
  });
  // 전역 노출 (현장 선택 트리거 등에서 활용)
  window.loadContacts = loadContacts;
  window.saveContactsForm = conservativeSaveContacts;
  // 최종 저장에서 직접 호출할 수 있도록 노출
  window.saveContacts = saveContacts;
})();