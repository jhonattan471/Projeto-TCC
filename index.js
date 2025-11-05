const http = require('http');
const url = require('url');
const mysql = require('mysql2');
const querystring = require('querystring');
const bcrypt = require('bcrypt'); // npm i bcrypt

// ===================
// CONFIG
// ===================
// Se vai usar cookie com credenciais do front, defina o origin exato (não pode ser "*")
const ALLOW_ORIGIN = 'http://127.0.0.1:5500'; // ajuste p/ seu front (ex: http://localhost:4200)
const COOKIE_NAME = 'session';
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8h em segundos
const IN_PROD = false; // true em produção (HTTPS), para ativar cookie Secure

// Sessões em memória (troque por Redis depois se quiser)
const SESSIONS = new Map();

// Conexão MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Shukaki1234',
  database: 'coffe'
});

// ===================
// HELPERS
// ===================
function setCors(req, res) {
  const allow = new Set([
    'http://localhost:5500',
    'http://127.0.0.1:5500',
  ]);
  const origin = req.headers.origin;
  if (allow.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function setJson(res, status = 200, body = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const [k, v] = part.split('=');
    if (!k) return acc;
    acc[k.trim()] = decodeURIComponent((v || '').trim());
    return acc;
  }, {});
}

function setCookie(res, name, value, { maxAge, path = '/', httpOnly = true, secure = IN_PROD, sameSite = 'Lax' } = {}) {
  let cookie = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;
  if (httpOnly) cookie += '; HttpOnly';
  if (secure) cookie += '; Secure';
  if (typeof maxAge === 'number') cookie += `; Max-Age=${maxAge}`;
  res.setHeader('Set-Cookie', cookie);
}

function deleteCookie(res, name) {
  setCookie(res, name, '', { maxAge: 0 });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', () => {
      if (!raw) return resolve({});
      const ct = (req.headers['content-type'] || '').toLowerCase();
      try {
        if (ct.includes('application/json')) {
          resolve(JSON.parse(raw));
        } else if (ct.includes('application/x-www-form-urlencoded')) {
          resolve(querystring.parse(raw));
        } else {
          // fallback: tenta JSON, se falhar manda texto
          try { resolve(JSON.parse(raw)); } catch { resolve({ _raw: raw }); }
        }
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function getSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return SESSIONS.get(token) || null;
}

// ===================
// SERVIDOR
// ===================
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const method = req.method;
  const path = parsedUrl.pathname;

  setCors(req, res);
  console.log('Nova requisição', method, path);

  // =====================================================================================================
  // PUBLIC
  // =====================================================================================================
  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // =========================
  // AUTH: POST /api/login
  // Body: { email, password }
  // =========================
  if (method === 'POST' && path === '/api/login') {
    try {
      const body = await readBody(req);
      const { email, password } = body;
      if (!email || !password) return setJson(res, 400, { message: 'Email e senha são obrigatórios' });

      // Exemplo: tabela "usuarios" com colunas (id, email, senha_hash)
      const [rows] = await connection.promise().execute(
        'SELECT id, email, senha_hash FROM usuarios WHERE email = ? LIMIT 1',
        [email]
      );
      if (rows.length === 0) return setJson(res, 401, { message: 'Credenciais inválidas' });

      const user = rows[0];
      const ok = await bcrypt.compare(String(password), user.senha_hash);
      if (!ok) return setJson(res, 401, { message: 'Credenciais inválidas' });

      // cria sessão
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      SESSIONS.set(token, { id: user.id, email: user.email });

      // seta cookie HttpOnly
      setCookie(res, COOKIE_NAME, token, { maxAge: COOKIE_MAX_AGE, sameSite: 'Lax' /* 'Strict' se preferir */ });

      // 204 sem corpo está ok; front só verifica status
      res.statusCode = 204;
      res.end();
    } catch (e) {
      console.error(e);
      setJson(res, 500, { message: 'Erro ao autenticar' });
    }
    return;
  }

  // =====================================================================================================
  // PRIVATE
  // =====================================================================================================
  const sess = await getSession(req);
  if (!sess) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Não autenticado' }));
    return;
  }
  req.user = sess;

  // =========================
  // AUTH: GET /api/me (protegid0)
  // =========================
  if (method === 'GET' && path === '/api/me') {
    const sess = await getSession(req);
    if (!sess) return setJson(res, 401, { message: 'Não autenticado' });
    return setJson(res, 200, { id: sess.id, email: sess.email });
  }

  // =========================
  // AUTH: POST /api/logout
  // =========================
  if (method === 'POST' && path === '/api/logout') {
    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    if (token) SESSIONS.delete(token);
    deleteCookie(res, COOKIE_NAME);
    res.statusCode = 204;
    res.end();
    return;
  }

  // =========================
  // CRUD PRODUTOS (exemplo público; pode proteger c/ requireAuth se quiser)
  // =========================
  if (method === 'POST' && path === '/produtos') {
    try {
      const data = await readBody(req);
      const { nome, descricao, valor } = data;

      connection.query(
        'INSERT INTO produtos (nome, descricao, valor) VALUES (?, ?, ?)',
        [nome, descricao, valor],
        (err, result) => {
          if (err) return setJson(res, 500, { error: err.message });
          setJson(res, 200, { message: 'Produto criado!', id: result.insertId });
        }
      );
    } catch (e) {
      return setJson(res, 400, { message: 'Body inválido' });
    }
    return;
  }

  else if (method === 'GET' && path === '/produtos') {
    connection.query('SELECT * FROM produtos', (err, results) => {
      if (err) return setJson(res, 500, { error: err.message });
      setJson(res, 200, results);
    });
    return;
  }

  else if (method === 'GET' && path.startsWith('/produtos/')) {
    const id = path.split('/')[2];
    connection.query(
      'SELECT * FROM produtos WHERE id = ?',
      [id],
      (err, results) => {
        if (err) return setJson(res, 500, { error: err.message });
        if (results.length === 0) return setJson(res, 404, { message: 'Produto não encontrado' });
        setJson(res, 200, results[0]);
      }
    );
    return;
  }

  else if (method === 'PUT' && path.startsWith('/produtos/')) {
    const id = path.split('/')[2];
    try {
      const data = await readBody(req);
      const { nome, descricao, valor } = data;
      connection.query(
        'UPDATE produtos SET nome = ?, descricao = ?, valor = ? WHERE id = ?',
        [nome, descricao, valor, id],
        (err) => {
          if (err) return setJson(res, 500, { error: err.message });
          setJson(res, 200, { message: 'Produto atualizado!' });
        }
      );
    } catch (e) {
      return setJson(res, 400, { message: 'Body inválido' });
    }
    return;
  }

  else if (method === 'DELETE' && path.startsWith('/produtos/')) {
    const id = path.split('/')[2];
    connection.query(
      'DELETE FROM produtos WHERE id = ?',
      [id],
      (err) => {
        if (err) return setJson(res, 500, { error: err.message });
        setJson(res, 200, { message: 'Produto deletado!' });
      }
    );
    return;
  }

  // 404
  setJson(res, 404, { message: 'Rota não encontrada' });
});

// Start
server.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000');
});
