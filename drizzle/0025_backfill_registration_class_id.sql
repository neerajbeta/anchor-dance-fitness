-- Link class bookings made before registrations.class_id existed to their class.
-- They were stored as "<class name> · HH:MM–HH:MM"; only an unambiguous match is used.
UPDATE "registrations" AS r
SET "class_id" = c."id"
FROM "classes" AS c
WHERE r."type" = 'class'
  AND r."class_id" IS NULL
  AND r."detail" = c."name" || ' · ' || to_char(c."start_time", 'HH24:MI') || '–' || to_char(c."end_time", 'HH24:MI')
  AND NOT EXISTS (
    SELECT 1 FROM "classes" AS c2
    WHERE c2."id" <> c."id"
      AND c2."name" = c."name"
      AND c2."start_time" = c."start_time"
      AND c2."end_time" = c."end_time"
  );
