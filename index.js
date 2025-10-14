const http = require('http');
const url = require('url');
const mysql = require('mysql2');

// Configuração da conexão com o MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'coffe'
});

// Criar servidor HTTP
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const method = req.method;
  const path = parsedUrl.pathname;

  res.setHeader("Access-Control-Allow-Origin", "*"); // ou colocar o domínio específico
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  res.setHeader('Content-Type', 'application/json');
  console.log("Nova requisição", method, path);

  if (req.method === "OPTIONS") {
    res.writeHead(204); // sem conteúdo
    res.end();
    return;
  }

  // =========================
  // CREATE (POST /produtos)
  // =========================
  if (method === 'POST' && path === '/produtos') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body);
      const { nome, descricao, valor } = data;

      connection.query(
        'INSERT INTO produtos (nome, descricao, valor) VALUES (?, ?, ?)',
        [nome, descricao, valor],
        (err, result) => {
          if (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
          res.end(JSON.stringify({ message: 'Produto criado!', id: result.insertId }));
        }
      );
    });
  }

  // =========================
  // READ (GET /produtos) 
  // =========================
  else if (method === 'GET' && path === '/produtos') {
    connection.query('SELECT * FROM produtos', (err, results) => {
      if (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      res.end(JSON.stringify(results));
    });
  }

  // =========================
  // READ by ID (GET /produtos/:id)
  // =========================
  else if (method === 'GET' && path.startsWith('/produtos/')) {
    const id = path.split('/')[2]; // pega o ID da URL

    connection.query(
      'SELECT * FROM produtos WHERE id = ?',
      [id],
      (err, results) => {
        if (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.message }));
          return;
        }

        if (results.length === 0) {
          res.writeHead(404);
          res.end(JSON.stringify({ message: 'Produto não encontrado' }));
        } else {
          res.end(JSON.stringify(results[0])); // retorna apenas o objeto do produto
        }
      }
    );
  }


  // =========================
  // UPDATE (PUT /produtos/:id)
  // =========================
  else if (method === 'PUT' && path.startsWith('/produtos/')) {
    const id = path.split('/')[2];
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body);
      const { nome, descricao, valor } = data;

      connection.query(
        'UPDATE produtos SET nome = ?, descricao = ?, valor = ? WHERE id = ?',
        [nome, descricao, valor, id],
        (err, result) => {
          if (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
          res.end(JSON.stringify({ message: 'Produto atualizado!' }));
        }
      );
    });
  }

  // =========================
  // DELETE (DELETE /produtos/:id)
  // =========================
  else if (method === 'DELETE' && path.startsWith('/produtos/')) {
    const id = path.split('/')[2];

    connection.query(
      'DELETE FROM produtos WHERE id = ?',
      [id],
      (err, result) => {
        if (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.message }));
          return;
        }
        res.end(JSON.stringify({ message: 'Produto deletado!' }));
      }
    );
  }

  // =========================
  // Rota não encontrada
  // =========================
  else {
    res.writeHead(404);
    res.end(JSON.stringify({ message: 'Rota não encontrada' }));
  }
});

// Inicia servidor
server.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000');
});


