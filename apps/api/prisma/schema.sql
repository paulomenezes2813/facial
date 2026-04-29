-- =============================================================================
-- Facial — schema completo (PostgreSQL 14+)
-- Cole isso no DBeaver e execute (idempotente: pode rodar de novo sem quebrar).
-- Banco alvo: facial  · usuário: facial
-- =============================================================================

-- Extensão usada por gen_random_uuid (vem por padrão no Postgres 13+,
-- mas garantimos o cofre):
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- ENUMS
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE "AttendeeStatus" AS ENUM ('PENDING_PHOTOS', 'PRE_REGISTERED', 'CHECKED_IN', 'DELETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CheckinTipo" AS ENUM ('AUTO', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- TABELAS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "events" (
  "id"            TEXT          NOT NULL,
  "nome"          TEXT          NOT NULL,
  "inicio"        TIMESTAMP(3)  NOT NULL,
  "fim"           TIMESTAMP(3)  NOT NULL,
  "local"         TEXT,
  "retencaoDias"  INTEGER       NOT NULL DEFAULT 10,
  "criadoEm"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"  TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- attendees
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "attendees" (
  "id"                  TEXT             NOT NULL,
  "protocolo"           TEXT             NOT NULL,
  "eventId"             TEXT             NOT NULL,
  "nome"                TEXT             NOT NULL,
  "sobrenome"           TEXT             NOT NULL,
  "cpfHash"             TEXT             NOT NULL,
  "cpfLast3"            TEXT             NOT NULL,
  "dataNascimento"      DATE             NOT NULL,
  "cargo"               TEXT,
  "email"               TEXT             NOT NULL,
  "celular"             TEXT             NOT NULL,
  "municipio"           TEXT             NOT NULL,
  "consentimentoLgpd"   BOOLEAN          NOT NULL,
  "consentimentoIp"     TEXT,
  "consentimentoEm"     TIMESTAMP(3),
  "status"              "AttendeeStatus" NOT NULL DEFAULT 'PENDING_PHOTOS',
  "embeddingId"         TEXT,
  "checkInEm"           TIMESTAMP(3),
  "checkInTotemId"      TEXT,
  "criadoEm"            TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"        TIMESTAMP(3)     NOT NULL,
  CONSTRAINT "attendees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "attendees_protocolo_key" ON "attendees"("protocolo");
CREATE UNIQUE INDEX IF NOT EXISTS "attendees_cpfHash_key"   ON "attendees"("cpfHash");
CREATE        INDEX IF NOT EXISTS "attendees_eventId_status_idx" ON "attendees"("eventId", "status");

-- ---------------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "photos" (
  "id"           TEXT           NOT NULL,
  "attendeeId"   TEXT           NOT NULL,
  "storageKey"   TEXT           NOT NULL,
  "ordem"        INTEGER        NOT NULL,
  "qualityScore" DOUBLE PRECISION,
  "larguraPx"    INTEGER,
  "alturaPx"     INTEGER,
  "criadoEm"     TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "photos_attendeeId_ordem_key" ON "photos"("attendeeId", "ordem");

-- ---------------------------------------------------------------------------
-- totens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "totens" (
  "id"         TEXT          NOT NULL,
  "nome"       TEXT          NOT NULL,
  "eventId"    TEXT          NOT NULL,
  "apiKey"     TEXT          NOT NULL,
  "ultimoSync" TIMESTAMP(3),
  "criadoEm"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "totens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "totens_apiKey_key" ON "totens"("apiKey");

-- ---------------------------------------------------------------------------
-- checkins (histórico — uma linha por passagem pelo totem)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "checkins" (
  "id"           TEXT             NOT NULL,
  "attendeeId"   TEXT             NOT NULL,
  "eventId"      TEXT             NOT NULL,
  "totemId"      TEXT,
  "tipo"         "CheckinTipo"    NOT NULL DEFAULT 'AUTO',
  "similarity"   DOUBLE PRECISION,
  "registradoEm" TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checkins_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "checkins_eventId_registradoEm_idx" ON "checkins"("eventId", "registradoEm");
CREATE INDEX IF NOT EXISTS "checkins_attendeeId_idx"           ON "checkins"("attendeeId");
CREATE INDEX IF NOT EXISTS "checkins_eventId_attendeeId_idx"   ON "checkins"("eventId", "attendeeId");

-- ---------------------------------------------------------------------------
-- admin_users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "admin_users" (
  "id"        TEXT          NOT NULL,
  "email"     TEXT          NOT NULL,
  "nome"      TEXT          NOT NULL,
  "senhaHash" TEXT          NOT NULL,
  "ativo"     BOOLEAN       NOT NULL DEFAULT TRUE,
  "criadoEm"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_email_key" ON "admin_users"("email");

-- ---------------------------------------------------------------------------
-- audit_log (LGPD Art. 11)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id"          TEXT          NOT NULL,
  "attendeeId"  TEXT,
  "acao"        TEXT          NOT NULL,
  "ator"        TEXT          NOT NULL,
  "ip"          TEXT,
  "detalhes"    JSONB,
  "criadoEm"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_log_attendeeId_idx" ON "audit_log"("attendeeId");
CREATE INDEX IF NOT EXISTS "audit_log_criadoEm_idx"   ON "audit_log"("criadoEm");

-- =============================================================================
-- FOREIGN KEYS (criadas separadamente para serem idempotentes)
-- =============================================================================

-- attendees → events
DO $$ BEGIN
  ALTER TABLE "attendees"
    ADD CONSTRAINT "attendees_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- photos → attendees
DO $$ BEGIN
  ALTER TABLE "photos"
    ADD CONSTRAINT "photos_attendeeId_fkey"
    FOREIGN KEY ("attendeeId") REFERENCES "attendees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- totens → events
DO $$ BEGIN
  ALTER TABLE "totens"
    ADD CONSTRAINT "totens_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- checkins → attendees / events / totens
DO $$ BEGIN
  ALTER TABLE "checkins"
    ADD CONSTRAINT "checkins_attendeeId_fkey"
    FOREIGN KEY ("attendeeId") REFERENCES "attendees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "checkins"
    ADD CONSTRAINT "checkins_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "checkins"
    ADD CONSTRAINT "checkins_totemId_fkey"
    FOREIGN KEY ("totemId") REFERENCES "totens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- audit_log → attendees (nullable)
DO $$ BEGIN
  ALTER TABLE "audit_log"
    ADD CONSTRAINT "audit_log_attendeeId_fkey"
    FOREIGN KEY ("attendeeId") REFERENCES "attendees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- Migração opcional: se você JÁ tinha attendees com checkInEm preenchido
-- antes da tabela checkins existir, isso copia para o histórico.
-- Roda só uma vez (idempotente: só insere se não tiver checkin pra aquele
-- attendee no mesmo timestamp).
-- =============================================================================
INSERT INTO "checkins" ("id", "attendeeId", "eventId", "totemId", "tipo", "similarity", "registradoEm")
SELECT
  gen_random_uuid()::text,
  a."id",
  a."eventId",
  a."checkInTotemId",
  'AUTO'::"CheckinTipo",
  NULL,
  a."checkInEm"
FROM "attendees" a
WHERE a."checkInEm" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "checkins" c
     WHERE c."attendeeId" = a."id"
       AND c."registradoEm" = a."checkInEm"
  );

-- =============================================================================
-- Verificação rápida
-- =============================================================================
SELECT
  (SELECT COUNT(*) FROM events)      AS total_events,
  (SELECT COUNT(*) FROM attendees)   AS total_attendees,
  (SELECT COUNT(*) FROM photos)      AS total_photos,
  (SELECT COUNT(*) FROM totens)      AS total_totens,
  (SELECT COUNT(*) FROM checkins)    AS total_checkins,
  (SELECT COUNT(*) FROM admin_users) AS total_admins,
  (SELECT COUNT(*) FROM audit_log)   AS total_audits;
