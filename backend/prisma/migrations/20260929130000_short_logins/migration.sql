-- Keep existing accounts and password hashes; replace legacy email-shaped logins.
DO $$
DECLARE account RECORD;
DECLARE candidate TEXT;
DECLARE suffix INTEGER;
BEGIN
  FOR account IN
    SELECT "id", split_part("email", '@', 1) AS base
    FROM "users"
    WHERE "email" IS NOT NULL AND "login" = "email" AND position('@' IN "email") > 1
    ORDER BY "id"
  LOOP
    candidate := account.base;
    suffix := 1;
    WHILE EXISTS (SELECT 1 FROM "users" WHERE lower("login") = lower(candidate) AND "id" <> account.id) LOOP
      candidate := account.base || '-' || suffix::text;
      suffix := suffix + 1;
    END LOOP;
    UPDATE "users" SET "login" = candidate WHERE "id" = account.id;
  END LOOP;
END $$;
