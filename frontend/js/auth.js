// API 기본 URL - 상대 경로 사용
const API_BASE_URL = '';

// 토큰 관리
const TokenManager = {
    set(token) {
        localStorage.setItem('auth_token', token);
    },
    
    get() {
        return localStorage.getItem('auth_token');
    },
    
    remove() {
        localStorage.removeItem('auth_token');
    },
    
    isValid() {
        const token = this.get();
        if (!token) return false;
        
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp > Date.now() / 1000;
        } catch (error) {
            return false;
        }
    }
};

// API 요청 헬퍼
async function apiRequest(endpoint, options = {}) {
    const token = TokenManager.get();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    // body가 있을 때 JSON.stringify 적용
    if (options.body && typeof options.body === 'object') {
        options.body = JSON.stringify(options.body);
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });
        
        if (!response.ok) {
            let errorMessage = '요청 처리 중 오류가 발생했습니다.';
            try {
                const error = await response.json();
                // 서버가 내려준 상세 사유를 최대한 노출
                const parts = [];
                if (error.error) parts.push(error.error);
                if (error.message) parts.push(error.message);
                if (error.error_detail) parts.push(error.error_detail);
                errorMessage = parts.length ? parts.join(' | ') : errorMessage;
            } catch (e) {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        return response.json();
    } catch (error) {
        console.error('API 요청 오류:', error);
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
        }
        throw error;
    }
}// 로그인 처리
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await apiRequest('/auth/login', {
            method: 'POST',
            body: { email, password }
        });
        
        TokenManager.set(response.token);
        updateUserInfo(response.user);
        showMainDashboard();
        try{ document.dispatchEvent(new CustomEvent('auth:ready')); }catch(e){}
        
        Swal.fire({
            icon: 'success',
            title: '로그인 성공',
            text: `${response.user.name}님, 환영합니다!`,
            timer: 2000,
            showConfirmButton: false
        });
        
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: '로그인 실패',
            text: error.message
        });
    }
}

// 회원가입 처리
async function handleRegister(event) {
    event.preventDefault();
    
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;
    const password = document.getElementById('reg-password').value;
    const user_role = document.getElementById('reg-user-role').value;
    
    try {
        await apiRequest('/auth/register', {
            method: 'POST',
            body: { name, email, phone, password, user_role }
        });
        
        Swal.fire({
            icon: 'success',
            title: '회원가입 성공',
            text: '로그인 페이지로 이동합니다.',
            timer: 2000,
            showConfirmButton: false
        });
        
        toggleAuthMode();
        document.getElementById('register-form').reset();
        
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: '회원가입 실패',
            text: error.message
        });
    }
}// 로그아웃 처리
function handleLogout() {
    TokenManager.remove();
    showAuthPage();
    
    Swal.fire({
        icon: 'info',
        title: '로그아웃',
        text: '성공적으로 로그아웃되었습니다.',
        timer: 2000,
        showConfirmButton: false
    });
}

// 사용자 정보 업데이트
function updateUserInfo(user) {
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-role').textContent = user.user_role === 'admin' ? '관리자' : '일반사용자';
    document.getElementById('user-info').classList.remove('hidden');
}

// 로그인/회원가입 모드 토글
function toggleAuthMode() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authTitle = document.getElementById('auth-title');
    const toggleBtn = document.getElementById('toggle-auth');
    
    if (loginForm.classList.contains('hidden')) {
        // 회원가입 → 로그인
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        authTitle.textContent = '로그인';
        toggleBtn.textContent = '회원가입하기';
    } else {
        // 로그인 → 회원가입
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        authTitle.textContent = '회원가입';
        toggleBtn.textContent = '로그인하기';
    }
}

// 페이지 초기화 시 토큰 확인
async function checkAuthStatus() {
    if (TokenManager.isValid()) {
        try {
            const response = await apiRequest('/auth/profile');
            updateUserInfo(response.user);
            showMainDashboard();
            try{ document.dispatchEvent(new CustomEvent('auth:ready')); }catch(e){}
        } catch (error) {
            TokenManager.remove();
            showAuthPage();
        }
    } else {
        showAuthPage();
    }
}

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('toggle-auth').addEventListener('click', toggleAuthMode);
    
    checkAuthStatus();
});