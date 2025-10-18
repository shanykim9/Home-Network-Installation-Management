(function(){
  let __photosInitDone = false;
  const gridId = 'photos-grid';

  function getSelectedPhotosSiteId(){
    const sel = document.getElementById('photos-site-select');
    return sel && sel.value ? parseInt(sel.value,10) : null;
  }

  function renderPhotos(items){
    const grid = document.getElementById(gridId);
    if(!grid) return;
    grid.innerHTML = '';
    const list = Array.isArray(items) ? items : [];
    if(list.length === 0){
      const empty = document.createElement('div');
      empty.className = 'text-center text-gray-500 py-8';
      empty.textContent = '등록된 사진이 없습니다. 사진을 등록해 주세요.';
      grid.appendChild(empty);
      // 상단 안내 배너(중복 생성 방지)
      const parent = grid.parentElement;
      if(parent){
        let banner = document.getElementById('photos-empty-banner');
        if(!banner){
          banner = document.createElement('div');
          banner.id = 'photos-empty-banner';
          banner.className = 'mt-2 text-center text-sm text-gray-500';
          parent.insertBefore(banner, grid.nextSibling);
        }
        banner.textContent = '등록된 사진이 없습니다. 상단의 사진촬영/앨범에서 불러오기를 사용해 등록해 주세요.';
      }
      return;
    }
    // 목록이 있으면 배너 제거
    const oldBanner = document.getElementById('photos-empty-banner');
    if(oldBanner && oldBanner.parentElement){ oldBanner.parentElement.removeChild(oldBanner); }
    list.forEach(p=>{
      const card = document.createElement('div');
      card.className = 'border rounded-lg overflow-hidden bg-white shadow-sm';
      card.innerHTML = `
        <div class="aspect-[4/3] bg-gray-100 overflow-hidden">
          <img src="${p.image_url}" alt="photo" class="w-full h-full object-cover">
        </div>
        <div class="p-3 flex items-start justify-between gap-3">
          <div>
            <div class="font-medium text-gray-800 truncate">${p.title||''}</div>
            <div class="text-xs text-gray-500 mt-1">${(p.uploaded_at||'').replace('T',' ').slice(0,16)}</div>
          </div>
          <button class="text-red-600 hover:text-red-700 px-2 py-1" data-photo-id="${p.id}"><i class="fas fa-trash"></i></button>
        </div>
      `;
      grid.appendChild(card);
      const delBtn = card.querySelector('button[data-photo-id]');
      if(delBtn){
        delBtn.addEventListener('click', ()=> deletePhoto(p.id));
      }
    });
  }

  async function loadPhotos(){
    const siteId = getSelectedPhotosSiteId();
    if(!siteId) { renderPhotos([]); return; }
    try{
      const page = window.__photosPage || 1;
      const pageSize = 20;
      const res = await apiRequest(`/sites/${siteId}/photos?page=${page}&page_size=${pageSize}`, { method:'GET' });
      renderPhotos(res.items||[]);
      renderPagination(res.page||1, res.has_more===true);
    }catch(err){
      console.error(err);
      Swal.fire('오류', String(err && err.message ? err.message : '사진 목록을 불러오지 못했습니다.'), 'error');
    }
  }

  function renderPagination(page, hasMore){
    const grid = document.getElementById(gridId);
    if(!grid) return;
    // 기존 페이지네이션 제거(중복 방지)
    const old = document.getElementById('photos-pagination');
    if(old && old.parentElement) old.parentElement.removeChild(old);
    // 아이템이 없고 더 볼 것도 없으면 표시하지 않음
    if((grid.childElementCount === 0 || (grid.childElementCount === 1 && grid.firstChild && grid.firstChild.textContent && grid.firstChild.textContent.indexOf('등록된 사진이 없습니다') >= 0)) && !hasMore && (!page || page <= 1)){
      return;
    }
    const nav = document.createElement('div');
    nav.id = 'photos-pagination';
    nav.className = 'flex items-center justify-center gap-2 mt-2';
    const prev = document.createElement('button');
    prev.className = 'px-3 py-1 border rounded';
    prev.textContent = '이전';
    prev.disabled = page <= 1;
    prev.addEventListener('click', async ()=>{ window.__photosPage = Math.max(1,(page-1)); await loadPhotos(); });
    const next = document.createElement('button');
    next.className = 'px-3 py-1 border rounded';
    next.textContent = '다음';
    next.disabled = !hasMore;
    next.addEventListener('click', async ()=>{ window.__photosPage = (page+1); await loadPhotos(); });
    const info = document.createElement('span');
    info.className = 'text-sm text-gray-500 ml-2';
    info.textContent = `페이지 ${page}`;
    nav.appendChild(prev);
    nav.appendChild(next);
    nav.appendChild(info);
    grid.parentElement.appendChild(nav);
  }

  async function deletePhoto(photoId){
    const siteId = getSelectedPhotosSiteId();
    if(!siteId) return;
    const ok = await Swal.fire({ title:'삭제', text:'이 사진을 삭제하시겠습니까?', icon:'warning', showCancelButton:true, confirmButtonText:'삭제' });
    if(!ok.isConfirmed) return;
    try{
      await apiRequest(`/sites/${siteId}/photos/${photoId}`, { method:'DELETE' });
      await loadPhotos();
    }catch(err){ Swal.fire('오류','삭제 중 오류가 발생했습니다.','error'); }
  }

  async function uploadFromInput(inputEl){
    const siteId = getSelectedPhotosSiteId();
    if(!siteId){ Swal.fire('안내','먼저 현장을 선택하세요.','info'); return; }
    if(!inputEl || !inputEl.files || !inputEl.files[0]) return;
    const file = inputEl.files[0];
    const title = (document.getElementById('photo-title')?.value || '').trim();
    // 클라이언트 사이즈 제한(8MB)
    const MAX = 8 * 1024 * 1024;
    if(file.size > MAX){
      Swal.fire('안내','파일이 너무 큽니다. 최대 8MB까지 업로드할 수 있습니다.','warning');
      return;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('title', title);

    try{
      await apiRequest(`/sites/${siteId}/photos`, { method:'POST', body: form, isFormData: true });
      // 제목은 유지하여 연속 업로드 시 편의 제공
      inputEl.value = '';
      await loadPhotos();
    }catch(err){
      console.error(err);
      Swal.fire('오류', String(err && err.message ? err.message : '사진 업로드 중 오류가 발생했습니다.'), 'error');
    }
  }

  async function init(){
    if(__photosInitDone){
      // 재진입 시 목록만 갱신
      await loadPhotos();
      return;
    }
    __photosInitDone = true;

    // 현장 선택 셀렉트 갱신 버튼
    const btnRefresh = document.getElementById('photos-refresh-sites');
    if(btnRefresh){ btnRefresh.addEventListener('click', (e)=>{ e.preventDefault(); if(window.loadSitesIntoSelect) window.loadSitesIntoSelect(); }); }
    const sel = document.getElementById('photos-site-select');
    if(sel){ sel.addEventListener('change', loadPhotos); }

    // 업로드 입력 핸들러
    const cam = document.getElementById('photo-camera');
    const gal = document.getElementById('photo-gallery');
    if(cam){ cam.addEventListener('change', ()=> uploadFromInput(cam)); }
    if(gal){ gal.addEventListener('change', ()=> uploadFromInput(gal)); }

    // 사이트 목록 로드 후 사진 목록 로드
    if(window.loadSitesIntoSelect){ await window.loadSitesIntoSelect(); }
    await loadPhotos();
  }

  window.initPhotosPage = init;
})();

