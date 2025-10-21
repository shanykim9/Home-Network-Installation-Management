(function(){
  let __photosInitDone = false;
  const gridId = 'photos-grid';

  // 이미지 자동 압축/리사이즈: 8MB 이하 목표, JPEG로 인코딩
  async function compressImageIfNeeded(file){
    const MAX = 8 * 1024 * 1024;
    try{
      if(!(file && file.type && file.type.startsWith('image/'))) return file;
      if(file.size <= MAX) return file;

      // 이미지 로드
      const url = URL.createObjectURL(file);
      let bmp;
      try{
        if('createImageBitmap' in window){
          // EXIF 방향 자동 반영 가능 브라우저는 옵션 사용
          try{ bmp = await createImageBitmap(await fetch(url).then(r=>r.blob()), { imageOrientation: 'from-image' }); }
          catch(_){ bmp = await createImageBitmap(await fetch(url).then(r=>r.blob())); }
        }
      }catch(_){ bmp = null; }
      let imgW, imgH, draw;
      if(bmp){
        imgW = bmp.width; imgH = bmp.height; draw = (ctx, w, h)=>{ ctx.drawImage(bmp, 0, 0, w, h); };
      }else{
        const img = await new Promise((resolve, reject)=>{ const i=new Image(); i.onload=()=>resolve(i); i.onerror=reject; i.src=url; });
        imgW = img.naturalWidth || img.width; imgH = img.naturalHeight || img.height; draw = (ctx, w, h)=>{ ctx.drawImage(img, 0, 0, w, h); };
      }
      URL.revokeObjectURL(url);

      // 초기 스케일: 최대 변 3000px로 제한
      const maxSide = 3000;
      const baseScale = Math.min(1, maxSide / Math.max(imgW, imgH));

      let scale = baseScale;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false });

      async function tryEncode(q){
        const w = Math.max(1, Math.round(imgW * scale));
        const h = Math.max(1, Math.round(imgH * scale));
        canvas.width = w; canvas.height = h;
        ctx.clearRect(0,0,w,h);
        draw(ctx, w, h);
        const blob = await new Promise(res=> canvas.toBlob(res, 'image/jpeg', q));
        return blob;
      }

      // 반복적으로 품질/크기를 줄여 목표 크기 도달
      const qualities = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35];
      for(let step=0; step<3; step++){
        for(const q of qualities){
          const blob = await tryEncode(q);
          if(blob && blob.size <= MAX){
            const name = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
            return new File([blob], name, { type: 'image/jpeg' });
          }
        }
        // 품질을 낮춰도 안 되면 크기 자체를 더 줄임
        scale *= 0.85;
        if(scale < 0.2) break; // 과도한 축소 방지
      }

      // 마지막 결과 반환(최소 품질)
      const lastBlob = await new Promise(res=> canvas.toBlob(res, 'image/jpeg', 0.3));
      if(lastBlob && lastBlob.size < file.size){
        const name = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
        return new File([lastBlob], name, { type: 'image/jpeg' });
      }
      return file; // 압축 실패 시 원본 유지
    }catch(_){
      return file; // 오류 시 원본 전송, 서버에서 한 번 더 제한
    }
  }

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
    let file = inputEl.files[0];
    const title = (document.getElementById('photo-title')?.value || '').trim();
    // 8MB 초과 시 자동 압축/리사이즈 시도
    const MAX = 8 * 1024 * 1024;
    if(file.size > MAX){
      try{ Swal.showLoading(); }catch(_){ }
      file = await compressImageIfNeeded(file);
      try{ Swal.close(); }catch(_){ }
      if(file.size > MAX){
        Swal.fire('안내','파일을 8MB 이하로 줄일 수 없습니다. 더 작은 이미지를 선택해주세요.','warning');
        return;
      }
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

