const API_BASE = 'http://127.0.0.1:3000';

async function isLoggedIn() {
    try {
        const res = await fetch(`${API_BASE}/api/me`, {
            method: 'GET',
            credentials: 'include',      // envia/recebe o cookie HttpOnly
            cache: 'no-store',           // evita cache do navegador/proxy
        });
        return res.ok;                 // 200 = true, 401 = false
    } catch (e) {
        // em caso de erro de rede, trate como não logado
        return false;
    }
}

// Use em páginas protegidas
async function requireAuth() {
    const ok = await isLoggedIn();
    if (!ok) location.href = '/login.html';
}

// Use na página de login (evita mostrar login pra quem já está logado)
async function requireGuest() {
    const ok = await isLoggedIn();
    if (ok) location.href = '/index.html';
}

// Helper de logout (ex: botão “Sair”)
async function logoutAndRedirect() {
    await fetch(`${API_BASE}/api/logout`, { method: 'POST', credentials: 'include' });
    location.href = '/login.html';
}

// Exponha globais se quiser chamar no HTML
window.requireAuth = requireAuth;
window.requireGuest = requireGuest;
window.logoutAndRedirect = logoutAndRedirect;