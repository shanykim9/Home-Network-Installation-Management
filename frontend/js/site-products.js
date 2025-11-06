// 제품수량 탭: 월패드/도어폰/로비폰 조회 및 저장
(function(){
  function getSelectedSiteId(){
    const select = document.getElementById('site-select');
    return select && select.value ? parseInt(select.value,10) : null;
  }

  function fillItem(ptype, model, qty){
    const m = document.getElementById(`${ptype}_model`);
    const q = document.getElementById(`${ptype}_qty`);
    if(m) m.value = model || '';
    if(q) q.value = (qty ?? 0);
  }

  async function loadProducts(){
    const siteId = getSelectedSiteId();
    if(!siteId) return;
    try{
      const res = await apiRequest(`/sites/${siteId}/products`, { method: 'GET' });
      // 백엔드가 단일 객체를 product로 반환하거나 products로 반환하는 경우 모두 대응
      const row = (res.product || res.products || null);
      // 초기화 후 단일 로우 반영
      fillItem('wallpad', row?.wallpad_model || '', row?.wallpad_qty ?? 0);
      fillItem('doorphone', row?.doorphone_model || '', row?.doorphone_qty ?? 0);
      fillItem('lobbyphone', row?.lobbyphone_model || '', row?.lobbyphone_qty ?? 0);
      fillItem('guardphone', row?.guardphone_model || '', row?.guardphone_qty ?? 0);
      // 추가 항목
      fillItem('magnet_sensor', row?.magnet_sensor_model || '', row?.magnet_sensor_qty ?? 0);
      fillItem('motion_sensor', row?.motion_sensor_model || '', row?.motion_sensor_qty ?? 0);
      fillItem('opener', row?.opener_model || '', row?.opener_qty ?? 0);
    }catch(err){
      console.error(err);
      Swal.fire('오류','제품수량을 불러오지 못했습니다.','error');
    }
  }

  async function saveProducts(e){
    e && e.preventDefault && e.preventDefault();
    const siteId = getSelectedSiteId();
    if(!siteId){
      Swal.fire('안내','먼저 상단의 "현장 선택"에서 현장을 선택하세요.','info');
      return;
    }
    const draft = {
      project_no: document.getElementById('products-project-no').value,
      wallpad_model: document.getElementById('wallpad_model').value,
      wallpad_qty: document.getElementById('wallpad_qty').value,
      doorphone_model: document.getElementById('doorphone_model').value,
      doorphone_qty: document.getElementById('doorphone_qty').value,
      lobbyphone_model: document.getElementById('lobbyphone_model').value,
      lobbyphone_qty: document.getElementById('lobbyphone_qty').value,
      guardphone_model: document.getElementById('guardphone_model')?.value,
      guardphone_qty: document.getElementById('guardphone_qty')?.value,
      magnet_sensor_model: document.getElementById('magnet_sensor_model')?.value,
      magnet_sensor_qty: document.getElementById('magnet_sensor_qty')?.value,
      motion_sensor_model: document.getElementById('motion_sensor_model')?.value,
      motion_sensor_qty: document.getElementById('motion_sensor_qty')?.value,
      opener_model: document.getElementById('opener_model')?.value,
      opener_qty: document.getElementById('opener_qty')?.value,
    };
    const payload = {
      project_no: draft.project_no,
      wallpad_model: draft.wallpad_model || null,
      wallpad_qty: parseInt(draft.wallpad_qty||'0',10),
      doorphone_model: draft.doorphone_model || null,
      doorphone_qty: parseInt(draft.doorphone_qty||'0',10),
      lobbyphone_model: draft.lobbyphone_model || null,
      lobbyphone_qty: parseInt(draft.lobbyphone_qty||'0',10),
      guardphone_model: (draft.guardphone_model||'') ? draft.guardphone_model : null,
      guardphone_qty: parseInt(draft.guardphone_qty||'0',10),
      magnet_sensor_model: (draft.magnet_sensor_model||'') ? draft.magnet_sensor_model : null,
      magnet_sensor_qty: parseInt(draft.magnet_sensor_qty||'0',10),
      motion_sensor_model: (draft.motion_sensor_model||'') ? draft.motion_sensor_model : null,
      motion_sensor_qty: parseInt(draft.motion_sensor_qty||'0',10),
      opener_model: (draft.opener_model||'') ? draft.opener_model : null,
      opener_qty: parseInt(draft.opener_qty||'0',10),
    };
    try{
      await apiRequest(`/sites/${siteId}/products`, { method: 'POST', body: payload });
      if(!window.__batchSaving){ Swal.fire({icon:'success', title:'저장 완료', timer:1500, showConfirmButton:false}); }
      loadProducts();
    }catch(err){
      console.error(err);
      Swal.fire('오류','제품수량 저장 중 오류가 발생했습니다.','error');
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const form = document.getElementById('products-form');
    if(form){ form.addEventListener('submit', saveProducts); }
    const select = document.getElementById('site-select');
    if(select){ select.addEventListener('change', loadProducts); }
  });

  // 전역에서 호출 가능하도록 노출(현장 선택 트리거 등에서 활용)
  window.loadProducts = loadProducts;
  // 최종 저장에서 직접 호출할 수 있도록 노출
  window.saveProducts = saveProducts;
})();