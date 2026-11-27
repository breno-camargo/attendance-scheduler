BEGIN;

ALTER TABLE "InternalContact" ADD COLUMN "supervisorId" TEXT;

ALTER TABLE "InternalContact"
  ADD CONSTRAINT "InternalContact_supervisorId_fkey"
  FOREIGN KEY ("supervisorId") REFERENCES "InternalContact"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "InternalContact_supervisorId_idx" ON "InternalContact"("supervisorId");

COMMIT;

-- Para reverter após retirar o código dependente do vínculo:
-- ALTER TABLE "InternalContact" DROP COLUMN "supervisorId";
