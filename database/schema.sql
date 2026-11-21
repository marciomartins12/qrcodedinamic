-- ---------------------------------------------------------------------------
-- Estrutura do banco de dados - Plaquinhas QR
-- Rode com: mysql -u root -p < database/schema.sql
-- (ou simplesmente `npm run db:setup`, que cria o banco, as tabelas e o admin)
-- ---------------------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS `plaquinhas`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `plaquinhas`;

-- ---------------------------------------------------------------------------
-- Usuarios do painel administrativo
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(120) NOT NULL,
  `email`         VARCHAR(180) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `active`        TINYINT(1) NOT NULL DEFAULT 1,
  `last_login_at` DATETIME NULL DEFAULT NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- QR Codes (sem limite de quantidade)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `qrcodes` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code`          VARCHAR(16) NOT NULL,          -- codigo curto que vai na URL publica
  `type`          ENUM('link','pix') NOT NULL DEFAULT 'link', -- link redireciona; pix e o codigo de pagamento
  `title`         VARCHAR(150) NOT NULL,         -- identificacao da plaquinha
  `description`   VARCHAR(255) NULL DEFAULT NULL,
  `target_url`    VARCHAR(2048) NULL DEFAULT NULL, -- destino do redirecionamento (pode ser definido depois)
  `pix_key`       VARCHAR(77) NULL DEFAULT NULL,  -- chave Pix (CPF, CNPJ, e-mail, telefone ou aleatoria)
  `pix_key_kind`  VARCHAR(12) NULL DEFAULT NULL,  -- tipo da chave detectado
  `pix_name`      VARCHAR(25) NULL DEFAULT NULL,  -- nome do recebedor (limite do padrao EMV)
  `pix_city`      VARCHAR(15) NULL DEFAULT NULL,  -- cidade do recebedor (limite do padrao EMV)
  `pix_payload`   VARCHAR(512) NULL DEFAULT NULL, -- BR Code gerado (o que vai dentro do QR)
  `color`         CHAR(7) NOT NULL DEFAULT '#000000',
  `size_cm`       DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  `active`        TINYINT(1) NOT NULL DEFAULT 1,
  `clicks`        BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `last_click_at` DATETIME NULL DEFAULT NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_qrcodes_code` (`code`),
  KEY `idx_qrcodes_active` (`active`),
  KEY `idx_qrcodes_type` (`type`),
  KEY `idx_qrcodes_clicks` (`clicks`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Tabela `sessions` e criada automaticamente pelo express-mysql-session
-- na primeira inicializacao da aplicacao.
-- ---------------------------------------------------------------------------
