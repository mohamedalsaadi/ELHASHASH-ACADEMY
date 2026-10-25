-- Country codes become owner-managed text, not an enum. The seven current
-- values are valid text, so no row rewrite is needed beyond the type change.
ALTER TABLE "Country" ALTER COLUMN "code" TYPE TEXT USING "code"::text;
DROP TYPE "CountryCode";

-- Owner-controlled visibility and per-country time zone.
ALTER TABLE "Country" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'Asia/Dubai',
                     ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Grade" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
                   ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subject" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- Stages are now data, editable by the owner.
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "fromLevel" INTEGER NOT NULL,
    "toLevel" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Stage_countryId_fromLevel_key" ON "Stage"("countryId", "fromLevel");
CREATE INDEX "Stage_countryId_order_idx" ON "Stage"("countryId", "order");

ALTER TABLE "Stage" ADD CONSTRAINT "Stage_countryId_fkey"
  FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill the values the app used before this migration.
UPDATE "Country" SET "timeZone" = CASE "code"
  WHEN 'EG' THEN 'Africa/Cairo'
  WHEN 'SA' THEN 'Asia/Riyadh'
  WHEN 'AE' THEN 'Asia/Dubai'
  WHEN 'KW' THEN 'Asia/Kuwait'
  WHEN 'QA' THEN 'Asia/Qatar'
  WHEN 'BH' THEN 'Asia/Bahrain'
  WHEN 'OM' THEN 'Asia/Muscat'
  ELSE 'Asia/Dubai'
END;

UPDATE "Grade" SET "order" = "level";

INSERT INTO "Stage" ("id", "countryId", "nameAr", "nameEn", "fromLevel", "toLevel", "order")
SELECT gen_random_uuid()::text, c."id", v.name_ar, v.name_en, v.from_level, v.to_level, v.ord
FROM "Country" c
JOIN (VALUES
  ('EG', 'المرحلة الابتدائية', 'Primary',       1,  6, 0),
  ('EG', 'المرحلة الإعدادية',  'Preparatory',   7,  9, 1),
  ('EG', 'المرحلة الثانوية',   'Secondary',    10, 12, 2),
  ('SA', 'المرحلة الابتدائية', 'Primary',       1,  6, 0),
  ('SA', 'المرحلة المتوسطة',   'Intermediate',  7,  9, 1),
  ('SA', 'المرحلة الثانوية',   'Secondary',    10, 12, 2),
  ('BH', 'المرحلة الابتدائية', 'Primary',       1,  6, 0),
  ('BH', 'المرحلة الإعدادية',  'Intermediate',  7,  9, 1),
  ('BH', 'المرحلة الثانوية',   'Secondary',    10, 12, 2),
  ('QA', 'المرحلة الابتدائية', 'Primary',       1,  6, 0),
  ('QA', 'المرحلة الإعدادية',  'Preparatory',   7,  9, 1),
  ('QA', 'المرحلة الثانوية',   'Secondary',    10, 12, 2),
  ('KW', 'المرحلة الابتدائية', 'Primary',       1,  5, 0),
  ('KW', 'المرحلة المتوسطة',   'Intermediate',  6,  9, 1),
  ('KW', 'المرحلة الثانوية',   'Secondary',    10, 12, 2),
  ('AE', 'الحلقة الأولى',      'Cycle 1',       1,  4, 0),
  ('AE', 'الحلقة الثانية',     'Cycle 2',       5,  8, 1),
  ('AE', 'الحلقة الثالثة',     'Cycle 3',       9, 12, 2),
  ('OM', 'الحلقة الأولى',      'Cycle 1',       1,  4, 0),
  ('OM', 'الحلقة الثانية',     'Cycle 2',       5, 10, 1),
  ('OM', 'ما بعد الأساسي',     'Post-basic',   11, 12, 2)
) AS v(code, name_ar, name_en, from_level, to_level, ord) ON v.code = c."code"
ON CONFLICT ("countryId", "fromLevel") DO NOTHING;
