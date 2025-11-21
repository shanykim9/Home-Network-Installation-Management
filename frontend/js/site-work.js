// 현장별 업무관리 (To do / Done / 알람 List)
(function(){
  // 내부 상태
  let activeTab = 'todo';
  let rowsTodo = [];   // {id?, site_id, content, alarm_date, done(false), delete_flag(false), tempId}
  let rowsDone = [];   // {id?, site_id, content, done_date, delete_flag(false)}
  let rowsAlarms = []; // {id, site_name, content, alarm_date, alarm_confirmed}
  // 초기화 가드: 이벤트 중복 바인딩 방지
  let __workInitDone = false;

  function getSelectedWorkSiteId(){
    const select = document.getElementById('work-site-select');
    return select && select.value ? parseInt(select.value,10) : null;
  }

  // 사이트 셀렉트 로드: 공용 로더로 통일 (중복 제거/디바운스 적용)
  async function loadSitesForWork(){
    try{
      if(typeof window.loadSitesIntoSelect === 'function'){
        await window.loadSitesIntoSelect();
      }
    }catch(err){ console.error(err); }
  }

  // 탭 전환
  function activateWorkTab(tab){
    activeTab = tab;
    document.querySelectorAll('.work-tab-btn').forEach(btn=>{
      btn.classList.remove('text-blue-600','border-b-2','border-blue-600');
      btn.classList.add('text-gray-600');
    });
    document.querySelectorAll('.work-tab-panel').forEach(p=>p.classList.add('hidden'));
    const btn = document.querySelector(`.work-tab-btn[data-tab="${tab}"]`);
    const panel = document.querySelector(`#work-tab-${tab}`);
    if(btn){ btn.classList.remove('text-gray-600'); btn.classList.add('text-blue-600','border-b-2','border-blue-600'); }
    if(panel){ panel.classList.remove('hidden'); }
  }

  // 행 DOM 생성 헬퍼
  function createTodoRow(row){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="py-2 pr-4"><input type="date" class="work-input-alarm w-44" value="${row.alarm_date||''}"></td>
      <td class="py-2 pr-4"><input type="text" class="work-input-content w-80 border rounded px-2 py-1" value="${row.content||''}" placeholder="할 일을 입력"></td>
      <td class="py-2 pr-2 text-center">
        <input type="checkbox" class="work-input-done" ${row.done?'checked':''} title="완료 처리">
      </td>
      <td class="py-2 pl-2 text-center">
        <input type="checkbox" class="work-input-delete" ${row.delete_flag?'checked':''} title="삭제">
      </td>
    `;
    tr.dataset.id = row.id || '';
    tr.dataset.tempId = row.tempId || '';
    return tr;
  }
  function createTodoCard(row){
    const div = document.createElement('div');
    div.className = 'p-3 border rounded-lg bg-white shadow-sm';
    div.innerHTML = `
      <div class="flex flex-col gap-2">
        <div>
          <div class="text-xs text-gray-500 mb-1">알람일</div>
          <input type="date" class="work-input-alarm w-full" value="${row.alarm_date||''}">
        </div>
        <div>
          <div class="text-xs text-gray-500 mb-1">할 일</div>
          <textarea class="work-input-content w-full border rounded px-3 py-2 resize-none" rows="2" placeholder="할 일을 입력">${row.content||''}</textarea>
        </div>
        <div class="flex items-center justify-between gap-4 text-sm">
          <label class="flex items-center gap-2">
            <input type="checkbox" class="work-input-done" ${row.done?'checked':''}>
            완료
          </label>
          <label class="flex items-center gap-2 text-red-500">
            <input type="checkbox" class="work-input-delete" ${row.delete_flag?'checked':''}>
            삭제
          </label>
        </div>
      </div>
    `;
    div.dataset.id = row.id || '';
    div.dataset.tempId = row.tempId || '';
    return div;
  }
  function createDoneRow(row){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="py-2 pr-4"><input type="date" class="work-input-done-date w-44" value="${row.done_date||''}"></td>
      <td class="py-2 pr-4"><input type="text" class="work-input-done-content w-80 border rounded px-2 py-1" value="${row.content||''}" placeholder="한 일을 입력"></td>
      <td class="py-2 pl-2 text-center">
        <input type="checkbox" class="work-input-delete" ${row.delete_flag?'checked':''} title="삭제">
      </td>
    `;
    tr.dataset.id = row.id || '';
    tr.dataset.tempId = row.tempId || '';
    return tr;
  }
  function createDoneCard(row){
    const div = document.createElement('div');
    div.className = 'p-3 border rounded-lg bg-white shadow-sm';
    div.innerHTML = `
      <div class="flex flex-col gap-2">
        <div>
          <div class="text-xs text-gray-500 mb-1">일자</div>
          <input type="date" class="work-input-done-date w-full" value="${row.done_date||''}">
        </div>
        <div>
          <div class="text-xs text-gray-500 mb-1">한 일</div>
          <textarea class="work-input-done-content w-full border rounded px-3 py-2 resize-none" rows="2" placeholder="한 일을 입력">${row.content||''}</textarea>
        </div>
        <div class="flex justify-end text-sm text-red-500">
          <label class="flex items-center gap-2">
            <input type="checkbox" class="work-input-delete" ${row.delete_flag?'checked':''}>
            삭제
          </label>
        </div>
      </div>
    `;
    div.dataset.id = row.id || '';
    div.dataset.tempId = row.tempId || '';
    return div;
  }
  function createAlarmRow(row){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="py-2 pr-4">${row.site_name||''}</td>
      <td class="py-2 pr-4">${row.content||''}</td>
      <td class="py-2"><input type="checkbox" class="work-input-alarm-confirm" ${row.alarm_confirmed?'checked':''}></td>
    `;
    tr.dataset.id = row.id || '';
    return tr;
  }

  function renderTodo(){
    const tbody = document.getElementById('work-todo-tbody');
    const cards = document.getElementById('work-todo-cards');
    const isElementVisible = (el)=>{
      if(!el) return false;
      if(el.offsetParent !== null) return true;
      const style = window.getComputedStyle(el);
      if(style.display === 'none' || style.visibility === 'hidden') return false;
      const opacity = parseFloat(style.opacity || '1');
      return opacity > 0;
    };
    if(tbody){
      tbody.innerHTML = '';
      rowsTodo.forEach(row=> tbody.appendChild(createTodoRow(row)) );
    }
    if(cards){
      cards.innerHTML = '';
      rowsTodo.forEach(row=> cards.appendChild(createTodoCard(row)) );
    }
  }
  function renderDone(){
    const tbody = document.getElementById('work-done-tbody');
    const cards = document.getElementById('work-done-cards');
    if(tbody){
      tbody.innerHTML = '';
      rowsDone.forEach(row=> tbody.appendChild(createDoneRow(row)) );
    }
    if(cards){
      cards.innerHTML = '';
      rowsDone.forEach(row=> cards.appendChild(createDoneCard(row)) );
    }
  }
  function renderAlarms(){
    const tbody = document.getElementById('work-alarms-tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    rowsAlarms.forEach(row=> tbody.appendChild(createAlarmRow(row)) );
  }

  // 배지 업데이트 (미확인 알람 수)
  function updateBellBadge(count){
    const badge = document.getElementById('work-bell-badge');
    if(!badge) return;
    if(count > 0){
      badge.textContent = String(count);
      badge.classList.remove('hidden');
      badge.style.display = 'flex';
    }else{
      badge.textContent = '';
      badge.classList.add('hidden');
    }
  }

  // 서버 통신
  async function fetchLists(){
    const siteId = getSelectedWorkSiteId();
    if(!siteId) return;
    try{
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const [todoRes, doneRes, alarmRes] = await Promise.all([
        apiRequest(`/sites/${siteId}/work-items?status=todo`,{method:'GET'}),
        apiRequest(`/sites/${siteId}/work-items?status=done`,{method:'GET'}),
        apiRequest(`/sites/${siteId}/alarms?scope=mine&today=${today}`,{method:'GET'})
      ]);
      console.log('📥 To do 항목:', todoRes.items?.length || 0, '개');
      console.log('📥 Done 항목:', doneRes.items?.length || 0, '개');
      rowsTodo = (todoRes.items||[]).map(x=>({ id:x.id, site_id:x.site_id, content:x.content||'', alarm_date:x.alarm_date||'', done:false, delete_flag:false }));
      rowsDone = (doneRes.items||[]).map(x=>({ id:x.id, site_id:x.site_id, content:x.content||'', done_date:(x.done_date||'').slice(0,10), delete_flag:false }));
      rowsAlarms = (alarmRes.items||[]);
      renderTodo(); renderDone(); renderAlarms();
      updateBellBadge(alarmRes.count||rowsAlarms.filter(a=>!a.alarm_confirmed).length);
    }catch(err){ 
      console.error('❌ 데이터 로드 오류:', err); 
    }
  }

  // 저장 로직
  async function saveTodo(){
    const siteId = getSelectedWorkSiteId();
    if(!siteId){ Swal.fire('안내','현장을 먼저 선택하세요.','info'); return; }
    const tbody = document.getElementById('work-todo-tbody');
    const cards = document.getElementById('work-todo-cards');
    const isElementVisible = (el)=>{
      if(!el) return false;
      if(el.offsetParent !== null) return true;
      const style = window.getComputedStyle(el);
      if(style.display === 'none' || style.visibility === 'hidden') return false;
      const opacity = parseFloat(style.opacity || '1');
      return opacity > 0;
    };
    const nowLocal = new Date();
    const payload = [];
    const consume = (idGetter, alarmGetter, contentGetter, doneGetter, deleteGetter)=>{
      const id = idGetter();
      const alarm_date_raw = alarmGetter();
      // 알람일 처리: 빈 문자열, null, undefined를 모두 null로 변환
      // null을 명시적으로 전달해야 백엔드에서 업데이트가 정상적으로 이루어짐
      let alarm_date = null;
      if(alarm_date_raw != null && alarm_date_raw !== ''){
        // null이 아니고 빈 문자열도 아닌 경우에만 처리
        const trimmed = String(alarm_date_raw).trim();
        alarm_date = trimmed || null;  // trim 후에도 빈 문자열이면 null
      }
      const content = contentGetter();
      const done = doneGetter();
      const shouldDelete = deleteGetter();
      if(shouldDelete && id){
        payload.push({ id, site_id: siteId, delete_flag: true });
        return;
      }
      if(!content) return;
      const item = { id, site_id: siteId, content, alarm_date };
      if(done){
        item.status = 'done';
        const yyyy = nowLocal.getFullYear();
        const mm = String(nowLocal.getMonth()+1).padStart(2,'0');
        const dd = String(nowLocal.getDate()).padStart(2,'0');
        item.done_date = `${yyyy}-${mm}-${dd}`;
      }else{
        item.status = 'todo';
      }
      payload.push(item);
    };
    if(tbody){
      const tableEl = tbody.closest('table') || tbody;
      if(isElementVisible(tableEl)){
        tbody.querySelectorAll('tr').forEach(tr=>{
          if(!isElementVisible(tr)) return;
          consume(
            ()=> tr.dataset.id ? parseInt(tr.dataset.id,10) : null,
            ()=> {
              const input = tr.querySelector('.work-input-alarm');
              return input ? input.value : null;
            },
            ()=> tr.querySelector('.work-input-content').value.trim(),
            ()=> tr.querySelector('.work-input-done').checked,
            ()=> tr.querySelector('.work-input-delete').checked
          );
        });
      }
    }
    if(cards){
      if(isElementVisible(cards)){
        cards.querySelectorAll('div[data-temp-id], div[data-id], .p-3.border.rounded-lg').forEach(div=>{
          if(!isElementVisible(div)) return;
          consume(
            ()=> div.dataset.id ? parseInt(div.dataset.id,10) : null,
            ()=> {
              const input = div.querySelector('.work-input-alarm');
              return input ? input.value : null;
            },
            ()=> {
              const el = div.querySelector('.work-input-content');
              return el ? el.value.trim() : '';
            },
            ()=> {
              const el = div.querySelector('.work-input-done');
              return el ? el.checked : false;
            },
            ()=> {
              const el = div.querySelector('.work-input-delete');
              return el ? el.checked : false;
            }
          );
        });
      }
    }
    try{
      // 디버깅: 전송할 데이터 로그 출력
      console.log('📤 저장할 데이터:', payload);
      const res = await apiRequest(`/sites/${siteId}/work-items`, { method:'POST', body:{ items: payload } });
      console.log('✅ 저장 응답:', res);
      Swal.fire({icon:'success', title:'저장 완료', timer:1200, showConfirmButton:false});
      // 저장 후 서버에서 최신 데이터를 다시 불러와서 UI 동기화
      // 약간의 지연을 두어 서버 업데이트가 완료되도록 함
      await new Promise(resolve => setTimeout(resolve, 100));
      await fetchLists();
    }catch(err){
      console.error('❌ 저장 오류:', err);
      Swal.fire('오류', err.message || '저장 실패', 'error');
      // 에러 발생 시에도 서버 데이터로 복구
      await fetchLists();
    }
  }

  async function saveDone(){
    const siteId = getSelectedWorkSiteId();
    if(!siteId){ Swal.fire('안내','현장을 먼저 선택하세요.','info'); return; }
    const tbody = document.getElementById('work-done-tbody');
    const cards = document.getElementById('work-done-cards');
    const isElementVisible = (el)=>{
      if(!el) return false;
      if(el.offsetParent !== null) return true;
      const style = window.getComputedStyle(el);
      if(style.display === 'none' || style.visibility === 'hidden') return false;
      const opacity = parseFloat(style.opacity || '1');
      return opacity > 0;
    };
    const payload = [];
    const consume = (idGetter, dateGetter, contentGetter, deleteGetter)=>{
      const id = idGetter();
      const done_date = dateGetter();
      const content = contentGetter();
      const shouldDelete = deleteGetter();
      if(shouldDelete && id){
        payload.push({ id, site_id: siteId, delete_flag: true });
        return;
      }
      if(!content || !done_date) return;
      payload.push({ id, site_id: siteId, content, done_date, status:'done' });
    };
    if(tbody){
      const tableEl = tbody.closest('table') || tbody;
      if(isElementVisible(tableEl)){
        tbody.querySelectorAll('tr').forEach(tr=>{
          if(!isElementVisible(tr)) return;
          consume(
            ()=> tr.dataset.id ? parseInt(tr.dataset.id,10) : null,
            ()=> {
              const el = tr.querySelector('.work-input-done-date');
              return el ? el.value || null : null;
            },
            ()=> tr.querySelector('.work-input-done-content').value.trim(),
            ()=> tr.querySelector('.work-input-delete').checked
          );
        });
      }
    }
    if(cards){
      if(isElementVisible(cards)){
        cards.querySelectorAll('div[data-temp-id], div[data-id], .p-3.border.rounded-lg').forEach(div=>{
          if(!isElementVisible(div)) return;
          consume(
            ()=> div.dataset.id ? parseInt(div.dataset.id,10) : null,
            ()=> {
              const el = div.querySelector('.work-input-done-date');
              return el ? el.value || null : null;
            },
            ()=> {
              const el = div.querySelector('.work-input-done-content');
              return el ? el.value.trim() : '';
            },
            ()=> {
              const el = div.querySelector('.work-input-delete');
              return el ? el.checked : false;
            }
          );
        });
      }
    }
    try{
      const res = await apiRequest(`/sites/${siteId}/work-items`, { method:'POST', body:{ items: payload } });
      Swal.fire({icon:'success', title:'저장 완료', timer:1200, showConfirmButton:false});
      await fetchLists();
    }catch(err){ Swal.fire('오류', err.message || '저장 실패', 'error'); }
  }

  async function saveAlarms(){
    const siteId = getSelectedWorkSiteId();
    if(!siteId){ Swal.fire('안내','현장을 먼저 선택하세요.','info'); return; }
    const tbody = document.getElementById('work-alarms-tbody');
    const idsToConfirm = [];
    tbody.querySelectorAll('tr').forEach(tr=>{
      const id = tr.dataset.id ? parseInt(tr.dataset.id,10) : null;
      const confirmed = tr.querySelector('.work-input-alarm-confirm').checked;
      if(confirmed && id){ idsToConfirm.push(id); }
    });
    try{
      if(idsToConfirm.length){
        await apiRequest(`/sites/${siteId}/alarms/confirm`, { method:'POST', body:{ ids: idsToConfirm } });
      }
      Swal.fire({icon:'success', title:'저장 완료', timer:1200, showConfirmButton:false});
      await fetchLists();
    }catch(err){ Swal.fire('오류', err.message || '저장 실패', 'error'); }
  }

  // + 버튼 동작: 활성 탭에 맞게 빈 행 추가
  function addRow(){
    if(activeTab === 'todo'){
      const row = { content:'', alarm_date:'', done:false, delete_flag:false, tempId: 't'+Date.now() };
      rowsTodo.push(row); renderTodo();
    }else if(activeTab === 'done'){
      const yyyy = new Date().getFullYear();
      const mm = String(new Date().getMonth()+1).padStart(2,'0');
      const dd = String(new Date().getDate()).padStart(2,'0');
      const row = { content:'', done_date:`${yyyy}-${mm}-${dd}`, delete_flag:false, tempId: 'd'+Date.now() };
      rowsDone.push(row); renderDone();
    }else if(activeTab === 'alarms'){
      // 알람 탭은 직접 추가 없음
    }
  }

  // 초기화 진입점
  async function init(){
    // 이벤트 바인딩 (중복 방지)
    if(__workInitDone){
      // 재진입 시 리스트만 재로딩
      activateWorkTab('todo');
      await fetchLists();
      return;
    }
    __workInitDone = true;

    const navBtns = document.querySelectorAll('.work-tab-btn');
    navBtns.forEach(btn=> btn.addEventListener('click', ()=> activateWorkTab(btn.dataset.tab)) );
    const addBtn = document.getElementById('work-add-row');
    if(addBtn) addBtn.addEventListener('click', ()=>{ addRow(); setTimeout(()=>{ document.dispatchEvent(new CustomEvent('tab:activated', { detail: { tab: activeTab } })); }, 0); });
    const btnSaveTodo = document.getElementById('work-save-todo');
    if(btnSaveTodo) btnSaveTodo.addEventListener('click', saveTodo);
    const btnSaveDone = document.getElementById('work-save-done');
    if(btnSaveDone) btnSaveDone.addEventListener('click', saveDone);
    const btnSaveAlarms = document.getElementById('work-save-alarms');
    if(btnSaveAlarms) btnSaveAlarms.addEventListener('click', saveAlarms);
    const bell = document.getElementById('work-bell');
    if(bell) bell.addEventListener('click', ()=> activateWorkTab('alarms'));
    const refreshBtn = document.getElementById('work-refresh-sites');
    if(refreshBtn) refreshBtn.addEventListener('click', (e)=>{ e.preventDefault(); loadSitesForWork(); });
    const select = document.getElementById('work-site-select');
    if(select) select.addEventListener('change', fetchLists);

    activateWorkTab('todo');
    await loadSitesForWork();
    await fetchLists();

    // textarea 자동 확장 (내부 스크롤 제거)
    const autogrow = (ta)=>{
      if(!ta) return;
      ta.style.height = 'auto';
      ta.style.overflowY = 'hidden';
      ta.style.height = Math.min(ta.scrollHeight, 320) + 'px'; // 최대 약 8~10줄
    };
    const delegateAutogrow = ()=>{
      document.querySelectorAll('.work-input-content, .work-input-done-content').forEach(el=>{
        autogrow(el);
        if(!el.__ag){
          el.addEventListener('input', ()=> autogrow(el));
          el.addEventListener('change', ()=> autogrow(el));
          el.__ag = true;
        }
      });
    };
    // 최초/탭전환 후/행추가 후에도 보장
    delegateAutogrow();
    document.addEventListener('tab:activated', delegateAutogrow);
    // addBtn 리스너는 위에서 한번만 등록하며, 탭 활성화 이벤트로 autogrow를 트리거합니다.
  }

  // 전역에서 호출
  window.initWorkPage = init;
})();


