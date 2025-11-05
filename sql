CREATE DATABASE IF NOT EXISTS coffe
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE coffe;

-- 02_usuarios.sql
USE coffe;

CREATE TABLE IF NOT EXISTS usuarios (
  id         VARCHAR(36)  NOT NULL,
  email      VARCHAR(255) NOT NULL,
  senha_hash VARCHAR(100) NOT NULL,            -- bcrypt hash (≈60 chars)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_usuarios_email (email)
);

-- 03_produtos.sql
USE coffe;

CREATE TABLE IF NOT EXISTS produtos (
  id          INT NOT NULL AUTO_INCREMENT,
  nome        VARCHAR(255) NOT NULL,
  descricao   TEXT NULL,
  valor       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX ix_produtos_nome (nome),
  CONSTRAINT ck_produtos_valor_nao_negativo CHECK (valor >= 0)
);
-- 04_seed_admin.sql
USE coffe;

-- senha: minhasenha
INSERT INTO usuarios (id, email, senha_hash)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin@example.com', '$2b$10$0DVPjpE7US0Gt5iLxN3Oee89g0pesnMiGXk3Jc8oQLpJEsvrP3Gae'); 


INSERT INTO produtos (nome, descricao, valor) VALUES
('Café Expresso', 'Shot simples de expresso 30ml', 6.00),
('Cappuccino', 'Expresso + leite vaporizado + espuma', 12.00),
('Latte', 'Expresso com leite cremoso', 11.00);