// controllers/usuarioController.js
const { v4: uuidv4 } = require('uuid');

module.exports = ({ connection, bcrypt, readBody, setJson }) => {
    const sanitizeUser = (u) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        role: u.role,
        ativo: !!u.ativo,
        assinante: !!u.assinante,
        created_at: u.created_at,
        updated_at: u.updated_at
    });

    // POST /usuarios  (público; força USER se não-admin)
    async function create(req, res, { actorRole = 'ANON' } = {}) {
        try {
            const body = await readBody(req);
            let { nome, email, senha, role = 'USER', ativo = 1, assinante = 0 } = body;

            if (!nome || !email || !senha) {
                return setJson(res, 400, { message: 'nome, email e senha são obrigatórios' });
            }

            // se não for ADMIN, força role=USER e ignora campos administrativos
            if (actorRole !== 'ADMIN') {
                role = 'USER';
                ativo = 1;
                assinante = 0; // ajuste se quiser permitir marcar
            }

            if (!['ADMIN', 'USER'].includes(role)) {
                return setJson(res, 400, { message: 'role inválido (ADMIN/USER)' });
            }

            const [dup] = await connection.promise().execute(
                'SELECT 1 FROM usuarios WHERE email = ? LIMIT 1',
                [email]
            );
            if (dup.length) return setJson(res, 409, { message: 'Email já cadastrado' });

            const id = uuidv4();
            const senha_hash = await bcrypt.hash(String(senha), 10);

            await connection.promise().execute(
                `INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo, assinante)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, nome, email, senha_hash, role, ativo ? 1 : 0, assinante ? 1 : 0]
            );

            return setJson(res, 201, { id, message: 'Usuário criado com sucesso' });
        } catch (e) {
            console.error(e);
            return setJson(res, 500, { message: 'Erro ao criar usuário' });
        }
    }

    // GET /usuarios (ADMIN)
    async function list(req, res) {
        try {
            const [rows] = await connection.promise().execute(
                `SELECT id, nome, email, role, ativo, assinante, created_at, updated_at
           FROM usuarios
          ORDER BY created_at DESC`
            );
            return setJson(res, 200, rows.map(sanitizeUser));
        } catch (e) {
            console.error(e);
            return setJson(res, 500, { message: 'Erro ao listar usuários' });
        }
    }

    // GET /usuarios/:id (ADMIN)
    async function getById(req, res, id) {
        try {
            const [rows] = await connection.promise().execute(
                `SELECT id, nome, email, role, ativo, assinante, created_at, updated_at
           FROM usuarios
          WHERE id = ? LIMIT 1`,
                [id]
            );
            if (!rows.length) return setJson(res, 404, { message: 'Usuário não encontrado' });
            return setJson(res, 200, sanitizeUser(rows[0]));
        } catch (e) {
            console.error(e);
            return setJson(res, 500, { message: 'Erro ao buscar usuário' });
        }
    }

    // PUT /usuarios/:id (ADMIN total; usuário comum só self: nome/email/senha)
    async function update(req, res, id, { actorId, actorRole }) {
        try {
            const body = await readBody(req);
            let { nome, email, senha, role, ativo, assinante } = body;

            const isAdmin = actorRole === 'ADMIN';
            const isSelf = actorId === id;

            if (!isAdmin && !isSelf) {
                return setJson(res, 403, { message: 'Proibido' });
            }

            const fields = [];
            const values = [];

            // campos que qualquer usuário pode alterar em si
            if (nome !== undefined) { fields.push('nome = ?'); values.push(nome); }
            if (email !== undefined) {
                const [dup] = await connection.promise().execute(
                    'SELECT 1 FROM usuarios WHERE email = ? AND id <> ? LIMIT 1',
                    [email, id]
                );
                if (dup.length) return setJson(res, 409, { message: 'Email já cadastrado' });
                fields.push('email = ?'); values.push(email);
            }
            if (senha !== undefined) {
                const senha_hash = await bcrypt.hash(String(senha), 10);
                fields.push('senha_hash = ?'); values.push(senha_hash);
            }

            // campos só ADMIN
            if (isAdmin) {
                if (role !== undefined) {
                    if (!['ADMIN', 'USER'].includes(role)) {
                        return setJson(res, 400, { message: 'role inválido (ADMIN/USER)' });
                    }
                    fields.push('role = ?'); values.push(role);
                }
                if (ativo !== undefined) { fields.push('ativo = ?'); values.push(ativo ? 1 : 0); }
                if (assinante !== undefined) { fields.push('assinante = ?'); values.push(assinante ? 1 : 0); }
            }

            if (!fields.length) return setJson(res, 400, { message: 'Nada para atualizar' });

            values.push(id);
            const [result] = await connection.promise().execute(
                `UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`,
                values
            );
            if (result.affectedRows === 0) return setJson(res, 404, { message: 'Usuário não encontrado' });
            return setJson(res, 200, { message: 'Usuário atualizado com sucesso' });
        } catch (e) {
            console.error(e);
            return setJson(res, 500, { message: 'Erro ao atualizar usuário' });
        }
    }

    // DELETE /usuarios/:id (ADMIN)
    async function remove(req, res, id, { actorId, actorRole }) {
        try {
            const isAdmin = actorRole === 'ADMIN';
            if (!isAdmin) return setJson(res, 403, { message: 'Proibido' });

            // (opcional) impedir apagar a si mesmo
            // if (actorId === id) return setJson(res, 400, { message: 'Não é permitido remover a si mesmo' });

            const [result] = await connection.promise().execute(
                'DELETE FROM usuarios WHERE id = ?',
                [id]
            );
            if (result.affectedRows === 0) return setJson(res, 404, { message: 'Usuário não encontrado' });
            return setJson(res, 200, { message: 'Usuário removido com sucesso' });
        } catch (e) {
            console.error(e);
            return setJson(res, 500, { message: 'Erro ao remover usuário' });
        }
    }

    return { create, list, getById, update, remove };
};
