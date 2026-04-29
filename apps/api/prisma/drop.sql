-- =============================================================================
-- Facial — drop completo (PostgreSQL)
-- ⚠ APAGA TUDO. Não tem volta. Use só em dev / antes de recriar do zero.
-- =============================================================================

-- Dropa as tabelas em ordem (respeitando foreign keys com CASCADE).
DROP TABLE IF EXISTS "checkins"        CASCADE;
DROP TABLE IF EXISTS "audit_log"       CASCADE;
DROP TABLE IF EXISTS "photos"          CASCADE;
DROP TABLE IF EXISTS "totens"          CASCADE;
DROP TABLE IF EXISTS "attendees"       CASCADE;
DROP TABLE IF EXISTS "events"          CASCADE;
DROP TABLE IF EXISTS "admin_users"     CASCADE;

-- Tabela do Prisma (histórico de migrations) — só se quiser recomeçar do zero.
DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;

-- Enums (precisam ser dropados depois das tabelas que os usam).
DROP TYPE IF EXISTS "AttendeeStatus";
DROP TYPE IF EXISTS "CheckinTipo";

-- Verificação
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- Esperado: nenhuma linha (ou só as que NÃO são da app).
