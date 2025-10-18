// 페이지 전환 함수들
function showAuthPage() {
    document.getElementById('auth-page').classList.remove('hidden');
    document.getElementById('main-dashboard').classList.add('hidden');
    document.getElementById('site-registration-page').classList.add('hidden');
    document.getElementById('user-info').classList.add('hidden');
}

function showMainDashboard() {
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('main-dashboard').classList.remove('hidden');
    document.getElementById('site-registration-page').classList.add('hidden');
}

function showPage(pageName) {
    // 모든 페이지 숨기기
    document.getElementById('main-dashboard').classList.add('hidden');
    document.getElementById('site-registration-page').classList.add('hidden');
    const workPage = document.getElementById('site-work-page');
    if (workPage) workPage.classList.add('hidden');
    const photosPage = document.getElementById('site-photos-page');
    if (photosPage) photosPage.classList.add('hidden');
    
    // 요청된 페이지 보이기
    switch(pageName) {
        case 'dashboard':
            showMainDashboard();
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

// 주의: 현장 등록/수정 처리는 이제 site-basic.js에서 단일 책임으로 처리합니다.
// 과거의 이중 등록 문제를 방지하기 위해 아래 코드를 비활성화합니다.

// 이벤트 리스너 등록(페이지 전환만 담당)
document.addEventListener('DOMContentLoaded', function() {
    // 이 파일에서는 사이트 폼 submit을 다루지 않습니다.
});