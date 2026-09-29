BEGIN;
ALTER TABLE "users" ADD COLUMN "login" TEXT;
-- Preserve every existing account and its password. Its former email becomes its login.
UPDATE "users" SET "login" = "email";
ALTER TABLE "users" ALTER COLUMN "login" SET NOT NULL;
CREATE UNIQUE INDEX "users_login_key" ON "users"("login");
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "academic_years" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "educational_programs" ALTER COLUMN "directionId" DROP NOT NULL,
 ALTER COLUMN "durationYears" DROP NOT NULL, ALTER COLUMN "maxCourse" DROP NOT NULL,
 ADD COLUMN "educationForm" TEXT, ADD COLUMN "specialization" TEXT, ADD COLUMN "sourceUrl" TEXT;
-- Directions without an unambiguous program are preserved as legacy programs, without invented duration.
INSERT INTO "educational_programs" ("id","organizationId","directionId","code","name","shortName","isActive","updatedAt")
SELECT 'legacy-direction-' || d."id", d."organizationId", d."id", 'legacy-direction-' || d."id", d."name", d."shortName", d."isActive", NOW()
FROM "directions" d WHERE NOT EXISTS (SELECT 1 FROM "educational_programs" p WHERE p."directionId"=d."id");
UPDATE "groups" g SET "programId"=(SELECT p."id" FROM "educational_programs" p WHERE p."directionId"=g."directionId" LIMIT 1)
WHERE g."programId" IS NULL AND (SELECT COUNT(*) FROM "educational_programs" p WHERE p."directionId"=g."directionId")=1;
ALTER TABLE "student_statuses" ADD COLUMN "countsInAttendance" BOOLEAN NOT NULL DEFAULT true;
UPDATE "student_statuses" SET "countsInAttendance"=false WHERE "isTerminal" OR "code"='ACADEMIC_LEAVE';
UPDATE "roles" SET "displayName"='Сотрудник УСП' WHERE "name"='foreman';
UPDATE "roles" SET "displayName"='Оперативный дежурный' WHERE "name"='manager';
INSERT INTO "permissions" ("id","code","displayName","module") VALUES
 ('revision-review','ATTENDANCE_REVIEW','Проверка и возврат табелей','attendance'),
 ('revision-correct','ATTENDANCE_CORRECT','Исправление проверенных табелей','attendance') ON CONFLICT ("code") DO NOTHING;
INSERT INTO "role_permissions" ("roleId","permissionId") SELECT r."id",p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE (r."name"='manager' AND p."code" IN ('ATTENDANCE_REVIEW','ATTENDANCE_CLOSE')) OR (r."name"='admin' AND p."code" IN ('ATTENDANCE_REVIEW','ATTENDANCE_CORRECT')) ON CONFLICT DO NOTHING;
-- Existing histories remain authoritative. Only missing histories receive a baseline.
INSERT INTO "student_group_histories" ("id","studentId","groupId","joinDate","reason")
SELECT 'baseline-group-'||s."id",s."id",s."currentGroupId",COALESCE(s."enrollmentDate",s."createdAt"),'Исходное состояние при обновлении'
FROM "students" s WHERE s."currentGroupId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "student_group_histories" h WHERE h."studentId"=s."id");
INSERT INTO "student_status_histories" ("id","studentId","statusId","changeDate","reason")
SELECT 'baseline-status-'||s."id",s."id",s."statusId",COALESCE(s."enrollmentDate",s."createdAt"),'Исходное состояние; более ранняя история отсутствует'
FROM "students" s WHERE NOT EXISTS(SELECT 1 FROM "student_status_histories" h WHERE h."studentId"=s."id");
ALTER TABLE "attendance_sheets" ADD COLUMN "courseSnapshot" INTEGER, ADD COLUMN "programSnapshotId" TEXT,
 ADD COLUMN "academicYearSnapshotId" TEXT, ADD COLUMN "returnComment" TEXT, ADD COLUMN "createdBy" TEXT;
ALTER TABLE "attendance_records" ALTER COLUMN "isPresent" DROP NOT NULL,
 ADD COLUMN "courseSnapshot" INTEGER, ADD COLUMN "statusSnapshotId" TEXT, ADD COLUMN "programSnapshotId" TEXT;
-- Recover historical course from the last transition, or first known fromCourse; never substitute today's course for old dates.
UPDATE "attendance_records" r SET
 "courseSnapshot"=COALESCE((SELECT h."toCourse" FROM "student_course_histories" h WHERE h."studentId"=r."studentId" AND h."transitionDate"::date<=a."date"::date ORDER BY h."transitionDate" DESC LIMIT 1),
 (SELECT h."fromCourse" FROM "student_course_histories" h WHERE h."studentId"=r."studentId" AND h."transitionDate"::date>a."date"::date ORDER BY h."transitionDate" LIMIT 1),
 CASE WHEN NOT EXISTS(SELECT 1 FROM "student_course_histories" h WHERE h."studentId"=r."studentId") AND a."date">=s."createdAt"::date THEN s."currentCourse" END),
 "statusSnapshotId"=(SELECT h."statusId" FROM "student_status_histories" h WHERE h."studentId"=r."studentId" AND h."changeDate"::date<=a."date"::date ORDER BY h."changeDate" DESC LIMIT 1),
 "programSnapshotId"=g."programId"
FROM "attendance_sheets" a,"students" s,"groups" g WHERE a."id"=r."sheetId" AND s."id"=r."studentId" AND g."id"=a."groupId";
UPDATE "attendance_sheets" a SET "academicYearSnapshotId"=g."academicYearId", "programSnapshotId"=g."programId",
 "courseSnapshot"=(SELECT MIN(r."courseSnapshot") FROM "attendance_records" r WHERE r."sheetId"=a."id" HAVING COUNT(DISTINCT r."courseSnapshot")=1)
FROM "groups" g WHERE g."id"=a."groupId";
CREATE INDEX "attendance_sheets_date_status_idx" ON "attendance_sheets"("date","status");
CREATE INDEX "attendance_sheets_academicYearSnapshotId_courseSnapshot_date_idx" ON "attendance_sheets"("academicYearSnapshotId","courseSnapshot","date");
CREATE INDEX "student_group_histories_groupId_joinDate_leaveDate_idx" ON "student_group_histories"("groupId","joinDate","leaveDate");
COMMIT;
