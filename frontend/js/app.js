// 페이지 전환 함수들
function showAuthPage() {
    document.getElementById('auth-page').classList.remove('hidden');
    document.getElementById('main-dashboard').classList.add('hidden');
    document.getElementById('site-registration-page').classList.add('hidden');
    const adminPage = document.getElementById('admin-page');
    if (adminPage) adminPage.classList.add('hidden');
    document.getElementById('user-info').classList.add('hidden');
}

function showMainDashboard() {
    // 모든 페이지 숨기기
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('site-registration-page').classList.add('hidden');
    
    // 관리자 페이지 명시적으로 숨기기
    const adminPage = document.getElementById('admin-page');
    if (adminPage) {
        adminPage.classList.add('hidden');
    }
    
    // 다른 페이지들도 숨기기
    const workPage = document.getElementById('site-work-page');
    if (workPage) workPage.classList.add('hidden');
    const photosPage = document.getElementById('site-photos-page');
    if (photosPage) photosPage.classList.add('hidden');
    
    // 메인 대시보드만 보이기
    document.getElementById('main-dashboard').classList.remove('hidden');
}

function showPage(pageName) {
    // 모든 페이지 명시적으로 숨기기
    const mainDashboard = document.getElementById('main-dashboard');
    if (mainDashboard) mainDashboard.classList.add('hidden');
    
    const siteRegistration = document.getElementById('site-registration-page');
    if (siteRegistration) siteRegistration.classList.add('hidden');
    
    const workPage = document.getElementById('site-work-page');
    if (workPage) workPage.classList.add('hidden');
    
    const photosPage = document.getElementById('site-photos-page');
    if (photosPage) photosPage.classList.add('hidden');
    
    // 관리자 페이지 반드시 숨기기
    const adminPage = document.getElementById('admin-page');
    if (adminPage) {
        adminPage.classList.add('hidden');
    }
    
    // 요청된 페이지 보이기
    switch(pageName) {
        case 'dashboard':
            showMainDashboard();
            break;
        case 'admin':
            // 관리자 페이지는 위에서 이미 숨겼으므로 다시 보이기
            const adminPageShow = document.getElementById('admin-page');
            if (adminPageShow) {
                document.getElementById('main-dashboard').classList.add('hidden');
                adminPageShow.classList.remove('hidden');
                try{ if (typeof loadAdminUsers === 'function') loadAdminUsers(); }catch(_){ }
            } else {
                Swal.fire('알림', '관리자 페이지를 찾을 수 없습니다.', 'warning');
                showMainDashboard();
            }
            break;
        case 'site-registration':
            document.getElementById('site-registration-page').classList.remove('hidden');
            break;
        case 'daily-work':
            if (workPage) {
                workPage.classList.remove('hidden');
                try{ if (typeof initWorkPage === 'function') initWorkPage(); }catch(_){ }
            } else {
                Swal.fire('알림', '현장별 업무관리 페이지를 찾을 수 없습니다.', 'warning');
                showMainDashboard();
            }
            break;
        case 'site-photos':
            if (photosPage) {
                photosPage.classList.remove('hidden');
                try{ if (typeof initPhotosPage === 'function') initPhotosPage(); }catch(_){ }
            } else {
                Swal.fire('알림', '현장 사진등록 및 관리 페이지를 찾을 수 없습니다.', 'warning');
                showMainDashboard();
            }
            break;
    }
}

async function openExportDialog(){
    const { value: formValues } = await Swal.fire({
        title: '데이터 다운로드',
        html:
            '<div class="text-left space-y-2">'
          + '  <label class="block text-sm">파일 형식</label>'
          + '  <select id="exp-format" class="w-full px-3 py-2 border rounded"><option value="both">CSV+XLSX</option><option value="xlsx">XLSX</option><option value="csv">CSV</option></select>'
          + '  <label class="block text-sm mt-2">범위</label>'
          + '  <select id="exp-scope" class="w-full px-3 py-2 border rounded"><option value="auto">자동(관리자=전체/일반=내 현장 전체)</option><option value="site">선택 현장만</option></select>'
          + '  <div id="exp-site-wrap" class="hidden"><label class="block text-sm mt-2">현장 선택</label><select id="exp-site-select" class="w-full px-3 py-2 border rounded"></select></div>'
          + '  <div class="grid grid-cols-2 gap-2">'
          + '    <div><label class="block text-sm">시작일</label><input type="date" id="exp-start" class="w-full px-3 py-2 border rounded"></div>'
          + '    <div><label class="block text-sm">종료일</label><input type="date" id="exp-end" class="w-full px-3 py-2 border rounded"></div>'
          + '  </div>'
          + '  <label class="inline-flex items-center gap-2"><input type="checkbox" id="exp-photos" checked>사진 원본 포함(기간/현장 범위)</label>'
          + '</div>',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '다운로드',
        didOpen: () => {
            const sel = document.getElementById('exp-scope');
            const wrap = document.getElementById('exp-site-wrap');
            const siteSelect = document.getElementById('exp-site-select');
            if(sel){
                sel.addEventListener('change', ()=>{
                    const v = sel.value;
                    if(v === 'site'){
                        wrap.classList.remove('hidden');
                        try{
                            const photosSel = document.getElementById('photos-site-select') || document.getElementById('site-select');
                            if(photosSel && photosSel.value && siteSelect){ siteSelect.value = String(photosSel.value); }
                        }catch(_){ }
                    }else{
                        wrap.classList.add('hidden');
                        if(siteSelect) siteSelect.value = '';
                    }
                });
            }
            // 사이트 목록 채우기
            (async ()=>{
              try{
                const res = await apiRequest('/sites', { method:'GET' });
                if(siteSelect){
                  siteSelect.innerHTML = '';
                  const ph = document.createElement('option'); ph.value=''; ph.textContent='현장 선택'; siteSelect.appendChild(ph);
                  (res.sites||[]).forEach(s=>{ const o=document.createElement('option'); o.value = s.id; o.textContent = s.site_name || (`site #${s.id}`); siteSelect.appendChild(o); });
                  // 현재 선택된 현장 프리셋
                  const curSel = document.getElementById('photos-site-select') || document.getElementById('site-select');
                  if(curSel && curSel.value) siteSelect.value = String(curSel.value);
                }
              }catch(_){ /* ignore */ }
            })();
        },
        preConfirm: () => {
            return {
                format: document.getElementById('exp-format').value,
                scope: document.getElementById('exp-scope').value,
                siteId: document.getElementById('exp-site-select').value,
                start: document.getElementById('exp-start').value,
                end: document.getElementById('exp-end').value,
                photos: document.getElementById('exp-photos').checked
            };
        }
    });
    if(!formValues) return;
    try{
        Swal.showLoading();
        const params = new URLSearchParams();
        if(formValues.format) params.set('format', formValues.format);
        if(formValues.scope) params.set('scope', formValues.scope);
        if(formValues.scope === 'site'){
            if(!formValues.siteId){
                Swal.close();
                return Swal.fire('안내','현장을 선택하세요.','info');
            }
            params.set('site_id', formValues.siteId);
        }
        if(formValues.start) params.set('start_date', formValues.start);
        if(formValues.end) params.set('end_date', formValues.end);
        if(formValues.photos===false) params.set('include_photos', 'false');
        const token = TokenManager.get();
        const res = await fetch(`/export?${params.toString()}`, { headers: { 'Authorization': token ? `Bearer ${token}` : '' } });
        if(!res.ok){
            const err = await res.json().catch(()=>({error:`HTTP ${res.status}`}));
            throw new Error(err.error || err.message || `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_${new Date().toISOString().slice(0,16).replace(/[:T]/g,'')}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        Swal.close();
    }catch(err){
        Swal.fire('오류', String(err.message || err), 'error');
    }
}

// 주의: 현장 등록/수정 처리는 이제 site-basic.js에서 단일 책임으로 처리합니다.
// 과거의 이중 등록 문제를 방지하기 위해 아래 코드를 비활성화합니다.

// 이벤트 리스너 등록(페이지 전환만 담당)
document.addEventListener('DOMContentLoaded', function() {
    // 이 파일에서는 사이트 폼 submit을 다루지 않습니다.
    // 관리자 사용자 목록 로더를 전역 주입
    window.loadAdminUsers = async function(){
        try{
            const res = await apiRequest('/users', { method: 'GET' });
            const tbody = document.getElementById('admin-users-tbody');
            if(!tbody) return;
            tbody.innerHTML = '';
            (res.items||[]).forEach(u=>{
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="py-2 pr-4">${u.email||''}</td>
                    <td class="py-2 pr-4">${u.name||''}</td>
                    <td class="py-2 pr-4">${u.phone||''}</td>
                    <td class="py-2 pr-4">
                        <select data-user-id="${u.id}" class="px-2 py-1 border rounded">
                            <option value="user" ${u.user_role==='user'?'selected':''}>일반</option>
                            <option value="admin" ${u.user_role==='admin'?'selected':''}>관리자</option>
                        </select>
                    </td>
                    <td class="py-2"><button class="px-3 py-1 border rounded text-blue-600" data-save="${u.id}">변경</button></td>
                `;
                tbody.appendChild(tr);
            });
            // 저장 핸들러 바인딩
            tbody.querySelectorAll('button[data-save]').forEach(btn=>{
                btn.addEventListener('click', async ()=>{
                    const id = btn.getAttribute('data-save');
                    const sel = tbody.querySelector(`select[data-user-id="${id}"]`);
                    if(!sel) return;
                    try{
                        await apiRequest(`/admin/users/${id}`, { method:'PATCH', body: { user_role: sel.value } });
                        Swal.fire({ icon:'success', title:'역할 변경 완료', timer:1200, showConfirmButton:false });
                        loadAdminUsers();
                    }catch(err){ Swal.fire('오류', String(err.message||err), 'error'); }
                });
            });
        }catch(err){
            const tbody = document.getElementById('admin-users-tbody');
            if(tbody){ tbody.innerHTML = '<tr><td colspan="5" class="text-red-600 py-4">목록을 불러올 수 없습니다.</td></tr>'; }
        }
    }
});