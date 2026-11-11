ALTER TABLE "product_types" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'RAW_MATERIAL';

UPDATE "product_types"
SET "kind" = 'SEMI_FINISHED'
WHERE "kind" = 'RAW_MATERIAL'
  AND (lower("name") LIKE '%semi%' OR lower("name") LIKE '%sub%');

UPDATE "product_types"
SET "kind" = 'FINISHED_GOOD'
WHERE "kind" = 'RAW_MATERIAL'
  AND lower("name") LIKE '%finish%';

UPDATE "product_types"
SET "kind" = 'PACKAGING'
WHERE "kind" = 'RAW_MATERIAL'
  AND lower("name") LIKE '%pack%';

UPDATE "product_types"
SET "kind" = 'CONSUMABLE'
WHERE "kind" = 'RAW_MATERIAL'
  AND (lower("name") LIKE '%consum%' OR lower("name") LIKE '%spare%');

UPDATE "product_types"
SET "kind" = 'SERVICE'
WHERE "kind" = 'RAW_MATERIAL'
  AND lower("name") LIKE '%service%';
