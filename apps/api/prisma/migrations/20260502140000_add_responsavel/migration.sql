-- CreateTable
CREATE TABLE "responsavel" (
    "id" TEXT NOT NULL,
    "attendeeId" TEXT NOT NULL,
    "cpfHash" TEXT NOT NULL,
    "cpfLast3" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "responsavel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "responsavel_attendeeId_key" ON "responsavel"("attendeeId");

-- AddForeignKey
ALTER TABLE "responsavel" ADD CONSTRAINT "responsavel_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "attendees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
