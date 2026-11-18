-- Every existing student moves to the UAE catalog: the grade at the same school year in the UAE (MOE, general track).
-- A student's country is the country of their grade, so this is the whole change. Students with no grade get grade 12 below. Any
-- level the UAE has no active grade for is left as it is. Safe to run twice: UAE students no longer match.
UPDATE "User" AS u
SET "gradeId" = ae."id"
FROM "Grade" AS g
JOIN "Country" AS c ON c."id" = g."countryId" AND c."code" <> 'AE'
JOIN "Country" AS aec ON aec."code" = 'AE'
JOIN "Grade" AS ae ON ae."countryId" = aec."id" AND ae."curriculum" = 'MOE' AND ae."track" = 'GENERAL' AND ae."level" = g."level" AND ae."active" = true
WHERE u."role" = 'STUDENT' AND u."gradeId" = g."id" AND u."deletedAt" IS NULL;

-- Students who never chose a grade get UAE grade 12 (owner decision, 2026-11-19).
UPDATE "User" AS u
SET "gradeId" = ae."id"
FROM "Country" AS aec
JOIN "Grade" AS ae ON ae."countryId" = aec."id" AND ae."curriculum" = 'MOE' AND ae."track" = 'GENERAL' AND ae."level" = 12 AND ae."active" = true
WHERE aec."code" = 'AE' AND u."role" = 'STUDENT' AND u."gradeId" IS NULL AND u."deletedAt" IS NULL;
