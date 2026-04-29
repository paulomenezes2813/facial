-- =============================================================================
-- Histórico de check-ins (1 linha por passagem pelo totem).
-- Migra os check-ins legados de attendees.check_in_em → checkins.
-- =============================================================================

-- 1. Enum
CREATE TYPE "CheckinTipo" AS ENUM ('AUTO', 'MANUAL');

-- 2. Tabela
CREATE TABLE "checkins" (
    "id" TEXT NOT NULL,
    "attendeeId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "totemId" TEXT,
    "tipo" "CheckinTipo" NOT NULL DEFAULT 'AUTO',
    "similarity" DOUBLE PRECISION,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkins_pkey" PRIMARY KEY ("id")
);

-- 3. Índices
CREATE INDEX "checkins_eventId_registradoEm_idx" ON "checkins"("eventId", "registradoEm");
CREATE INDEX "checkins_attendeeId_idx" ON "checkins"("attendeeId");
CREATE INDEX "checkins_eventId_attendeeId_idx" ON "checkins"("eventId", "attendeeId");

-- 4. FKs
ALTER TABLE "checkins"
  ADD CONSTRAINT "checkins_attendeeId_fkey"
  FOREIGN KEY ("attendeeId") REFERENCES "attendees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checkins"
  ADD CONSTRAINT "checkins_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checkins"
  ADD CONSTRAINT "checkins_totemId_fkey"
  FOREIGN KEY ("totemId") REFERENCES "totens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Migração de dados — qualquer attendee com check_in_em ganha 1 registro AUTO.
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
WHERE a."checkInEm" IS NOT NULL;
