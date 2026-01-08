(function(){
  let __photosInitDone = false;
  const gridId = 'photos-grid';

  // ============================================
  // 이미지 압축 함수 (핵심!)
  // 모든 이미지를 2MB 이하로 압축합니다
  // ============================================
  async function compressImage(file){
    const TARGET_SIZE = 2 * 1024 * 1024;  // 목표: 2MB 이하
    const MAX_DIMENSION = 1920;  // 최대 해상도: 1920px (Full HD)
    
    try {
      // 이미지 파일인지 확인
      if(!(file && file.type && file.type.startsWith('image/'))) {
        console.log('[압축] 이미지 파일이 아님, 원본 반환');
        return file;
      }

      console.log(`[압축] 시작 - 원본: ${(file.size/1024/1024).toFixed(2)}MB`);

      // 이미 충분히 작으면 그대로 반환 (500KB 이하)
      if(file.size <= 500 * 1024) {
        console.log('[압축] 이미 충분히 작음, 원본 반환');
        return file;
      }

      // 이미지를 Canvas에 로드
      const url = URL.createObjectURL(file);
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('이미지 로드 실패'));
        image.src = url;
      });
      URL.revokeObjectURL(url);

      // 원본 크기
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      console.log(`[압축] 원본 해상도: ${width}x${height}`);

      // 최대 해상도 제한 (비율 유지)
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round(height * (MAX_DIMENSION / width));
          width = MAX_DIMENSION;
        } else {
          width = Math.round(width * (MAX_DIMENSION / height));
          height = MAX_DIMENSION;
        }
      }
      console.log(`[압축] 리사이즈 후: ${width}x${height}`);

      // Canvas 생성
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      
      // 흰색 배경 (투명 PNG 대응)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      
      // 이미지 그리기
      ctx.drawImage(img, 0, 0, width, height);

      // 품질을 낮춰가며 목표 크기 달성
      const qualities = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
      
      for (const quality of qualities) {
        const blob = await new Promise(resolve => 
          canvas.toBlob(resolve, 'image/jpeg', quality)
        );
        
        if (blob && blob.size <= TARGET_SIZE) {
          const compressedFile = new File(
            [blob], 
            file.name.replace(/\.[^.]+$/, '.jpg'), 
            { type: 'image/jpeg' }
          );
          console.log(`[압축] 성공! 품질: ${quality}, 크기: ${(blob.size/1024/1024).toFixed(2)}MB`);
          return compressedFile;
        }
        console.log(`[압축] 품질 ${quality}: ${(blob.size/1024/1024).toFixed(2)}MB (목표 초과, 재시도)`);
      }

      // 품질만으로 안 되면 해상도도 줄임
      let scale = 0.8;
      for (let attempt = 0; attempt < 5; attempt++) {
        const newWidth = Math.round(width * scale);
        const newHeight = Math.round(height * scale);
        
        canvas.width = newWidth;
        canvas.height = newHeight;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, newWidth, newHeight);
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        
        const blob = await new Promise(resolve => 
          canvas.toBlob(resolve, 'image/jpeg', 0.6)
        );
        
        if (blob && blob.size <= TARGET_SIZE) {
          const compressedFile = new File(
            [blob], 
            file.name.replace(/\.[^.]+$/, '.jpg'), 
            { type: 'image/jpeg' }
          );
          console.log(`[압축] 성공! 해상도: ${newWidth}x${newHeight}, 크기: ${(blob.size/1024/1024).toFixed(2)}MB`);
          return compressedFile;
        }
        
        scale *= 0.7;  // 더 줄임
      }

      // 최후의 수단: 최소 품질로 반환
      const finalBlob = await new Promise(resolve => 
        canvas.toBlob(resolve, 'image/jpeg', 0.3)
      );
      if (finalBlob) {
        console.log(`[압축] 최종 결과: ${(finalBlob.size/1024/1024).toFixed(2)}MB`);
        return new File(
          [finalBlob], 
          file.name.replace(/\.[^.]+$/, '.jpg'), 
          { type: 'image/jpeg' }
        );
      }

      console.log('[압축] 실패, 원본 반환');
      return file;

    } catch (error) {
      console.error('[압축] 오류:', error);
      return file;
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

  // ============================================
  // 사진 업로드 함수 (핵심!)
  // ============================================
  async function uploadFromInput(inputEl){
    const siteId = getSelectedPhotosSiteId();
    if(!siteId){ 
      Swal.fire('안내','먼저 현장을 선택하세요.','info'); 
      return; 
    }
    if(!inputEl || !inputEl.files || !inputEl.files[0]) return;
    
    let file = inputEl.files[0];
    const title = (document.getElementById('photo-title')?.value || '').trim();
    
    // 원본 파일 정보 출력
    console.log('='.repeat(50));
    console.log(`[업로드] 원본 파일: ${file.name}`);
    console.log(`[업로드] 원본 크기: ${(file.size/1024/1024).toFixed(2)}MB`);
    console.log(`[업로드] 타입: ${file.type}`);

    // ★★★ 핵심: 모든 이미지를 무조건 압축! ★★★
    // 500KB 초과 시 압축 (작은 파일은 그대로)
    if(file.size > 500 * 1024) {
      // 로딩 표시
      Swal.fire({
        title: '이미지 처리 중...',
        html: '사진을 최적화하고 있습니다.<br>잠시만 기다려주세요.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
      });
      
      try {
        file = await compressImage(file);
        Swal.close();
      } catch (e) {
        Swal.close();
        console.error('[업로드] 압축 실패:', e);
      }
    }
    
    console.log(`[업로드] 최종 파일: ${file.name}`);
    console.log(`[업로드] 최종 크기: ${(file.size/1024/1024).toFixed(2)}MB`);

    // 최종 크기 체크 (3MB 초과 시 경고)
    if(file.size > 3 * 1024 * 1024) {
      Swal.fire({
        icon: 'warning',
        title: '파일이 너무 큽니다',
        text: `파일 크기: ${(file.size/1024/1024).toFixed(1)}MB. 3MB 이하의 이미지를 사용해주세요.`,
      });
      return;
    }

    // FormData 생성
    const form = new FormData();
    form.append('file', file);
    form.append('title', title);

    // 업로드 시작
    try {
      Swal.fire({
        title: '업로드 중...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
      });

      await apiRequest(`/sites/${siteId}/photos`, { method:'POST', body: form, isFormData: true });
      
      Swal.fire({
        icon: 'success',
        title: '업로드 완료!',
        text: '사진이 저장되었습니다.',
        timer: 1500,
        showConfirmButton: false
      });

      // 입력 초기화 및 목록 새로고침
      inputEl.value = '';
      await loadPhotos();
      
    } catch(err) {
      console.error('[업로드] 오류:', err);
      Swal.fire({
        icon: 'error',
        title: '업로드 실패',
        text: err && err.message ? err.message : '사진 업로드 중 오류가 발생했습니다.'
      });
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
