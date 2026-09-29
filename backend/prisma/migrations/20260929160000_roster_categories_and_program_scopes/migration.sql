BEGIN;

ALTER TABLE "students" ADD COLUMN "gender" TEXT;
ALTER TABLE "attendance_reasons" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'OUTSIDE';

CREATE TABLE "user_program_scopes" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_program_scopes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_program_scopes_userId_programId_key" ON "user_program_scopes"("userId", "programId");
ALTER TABLE "user_program_scopes" ADD CONSTRAINT "user_program_scopes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_program_scopes" ADD CONSTRAINT "user_program_scopes_programId_fkey" FOREIGN KEY ("programId") REFERENCES "educational_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Transfer old direction-wide permissions to each existing program in that direction.
INSERT INTO "user_program_scopes" ("id", "userId", "programId", "createdAt")
SELECT 'legacy-program-scope-' || md5(uds."userId" || ':' || ep."id"), uds."userId", ep."id", uds."createdAt"
FROM "user_direction_scopes" uds
JOIN "educational_programs" ep ON ep."directionId" = uds."directionId"
ON CONFLICT ("userId", "programId") DO NOTHING;

-- Some old groups have no program link yet. Keep their explicit group access unchanged.
COMMIT;
