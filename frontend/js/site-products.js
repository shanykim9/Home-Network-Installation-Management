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
      const list = res.products || [];
      // 초기화
      fillItem('wallpad','',0);
      fillItem('doorphone','',0);
      fillItem('lobbyphone','',0);
      // 반영
      list.forEach(p=>{
        if(p.product_type==='wallpad') fillItem('wallpad', p.product_model, p.quantity);
        if(p.product_type==='doorphone') fillItem('doorphone', p.product_model, p.quantity);
        if(p.product_type==='lobbyphone') fillItem('lobbyphone', p.product_model, p.quantity);
      });
    }catch(err){
      console.error(err);
      Swal.fire('오류','제품수량을 불러오지 못했습니다.','error');
    }
  }

  async function saveProducts(e){
    e.preventDefault();
    const siteId = getSelectedSiteId();
    if(!siteId){
      Swal.fire('안내','먼저 상단의 "현장 선택"에서 현장을 선택하세요.','info');
      return;
    }
    const items = [
      { 
        product_type:'wallpad', 
        product_model: document.getElementById('wallpad_model').value || null, 
        quantity: parseInt(document.getElementById('wallpad_qty').value||'0',10),

        project_no: document.getElementById('products-project-no').value
      },
      { 
        product_type:'doorphone', 
        product_model: document.getElementById('doorphone_model').value || null, 
        quantity: parseInt(document.getElementById('doorphone_qty').value||'0',10),

        project_no: document.getElementById('products-project-no').value
      },
      { 
        product_type:'lobbyphone', 
        product_model: document.getElementById('lobbyphone_model').value || null, 
        quantity: parseInt(document.getElementById('lobbyphone_model').value||'0',10),

        project_no: document.getElementById('products-project-no').value
      }
    ];
    try{
      await apiRequest(`/sites/${siteId}/products`, { method: 'POST', body: JSON.stringify({ items }) });
      Swal.fire({icon:'success', title:'저장 완료', timer:1500, showConfirmButton:false});
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
})();