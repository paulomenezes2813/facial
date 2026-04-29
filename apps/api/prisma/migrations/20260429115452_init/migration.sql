-- CreateEnum
CREATE TYPE "AttendeeStatus" AS ENUM ('PENDING_PHOTOS', 'PRE_REGISTERED', 'CHECKED_IN', 'DELETED');

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "local" TEXT,
    "retencaoDias" INTEGER NOT NULL DEFAULT 10,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendees" (
    "id" TEXT NOT NULL,
    "protocolo" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sobrenome" TEXT NOT NULL,
    "cpfHash" TEXT NOT NULL,
    "cpfLast3" TEXT NOT NULL,
    "dataNascimento" DATE NOT NULL,
    "cargo" TEXT,
    "email" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "consentimentoLgpd" BOOLEAN NOT NULL,
    "consentimentoIp" TEXT,
    "consentimentoEm" TIMESTAMP(3),
    "status" "AttendeeStatus" NOT NULL DEFAULT 'PENDING_PHOTOS',
    "embeddingId" TEXT,
    "checkInEm" TIMESTAMP(3),
    "checkInTotemId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "attendeeId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "qualityScore" DOUBLE PRECISION,
    "larguraPx" INTEGER,
    "alturaPx" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "totens" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "ultimoSync" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "totens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "attendeeId" TEXT,
    "acao" TEXT NOT NULL,
    "ator" TEXT NOT NULL,
    "ip" TEXT,
    "detalhes" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendees_protocolo_key" ON "attendees"("protocolo");

-- CreateIndex
CREATE UNIQUE INDEX "attendees_cpfHash_key" ON "attendees"("cpfHash");

-- CreateIndex
CREATE INDEX "attendees_eventId_status_idx" ON "attendees"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "photos_attendeeId_ordem_key" ON "photos"("attendeeId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "totens_apiKey_key" ON "totens"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "audit_log_attendeeId_idx" ON "audit_log"("attendeeId");

-- CreateIndex
CREATE INDEX "audit_log_criadoEm_idx" ON "audit_log"("criadoEm");

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "attendees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "totens" ADD CONSTRAINT "totens_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "attendees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
