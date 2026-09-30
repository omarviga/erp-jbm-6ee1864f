-- Update calibre_limon enum with new values that combine color + size
-- First, drop the old enum and create new one with all values

-- Since we can't easily modify enums, we need to:
-- 1. Create a new enum type
-- 2. Update the column to use text temporarily
-- 3. Drop the old enum
-- 4. Create the new enum
-- 5. Update the column back to the new enum

-- Step 1: Alter column to text temporarily
ALTER TABLE produccion ALTER COLUMN calibre TYPE text;

-- Step 2: Drop old enum
DROP TYPE IF EXISTS calibre_limon;

-- Step 3: Create new enum with combined color+calibre values
CREATE TYPE calibre_limon AS ENUM (
  'V-4', 'V-5', 'V-X', 'V-XX', 'V-XXX', 'V-EXT',
  'AL-4', 'AL-5', 'AL-X', 'AL-XX', 'AL-XXX', 'AL-EXT',
  'AM-X', 'AM-XX', 'AM-XXX', 'AM-EXT'
);

-- Step 4: Convert column back to enum (existing data will need manual mapping or will fail)
-- First update any existing values to match new format
UPDATE produccion SET calibre = 
  CASE 
    WHEN calibre = '4' AND color = 'verde' THEN 'V-4'
    WHEN calibre = 'X' AND color = 'verde' THEN 'V-X'
    WHEN calibre = 'XX' AND color = 'verde' THEN 'V-XX'
    WHEN calibre = 'XXX' AND color = 'verde' THEN 'V-XXX'
    WHEN calibre = 'EXTRA' AND color = 'verde' THEN 'V-EXT'
    WHEN calibre = 'SUPER' AND color = 'verde' THEN 'V-EXT'
    WHEN calibre = '4' AND color = 'alimonado' THEN 'AL-4'
    WHEN calibre = 'X' AND color = 'alimonado' THEN 'AL-X'
    WHEN calibre = 'XX' AND color = 'alimonado' THEN 'AL-XX'
    WHEN calibre = 'XXX' AND color = 'alimonado' THEN 'AL-XXX'
    WHEN calibre = 'EXTRA' AND color = 'alimonado' THEN 'AL-EXT'
    WHEN calibre = 'SUPER' AND color = 'alimonado' THEN 'AL-EXT'
    WHEN calibre = 'X' AND color = 'amarillo' THEN 'AM-X'
    WHEN calibre = 'XX' AND color = 'amarillo' THEN 'AM-XX'
    WHEN calibre = 'XXX' AND color = 'amarillo' THEN 'AM-XXX'
    WHEN calibre = 'EXTRA' AND color = 'amarillo' THEN 'AM-EXT'
    WHEN calibre = 'SUPER' AND color = 'amarillo' THEN 'AM-EXT'
    ELSE 'V-X' -- Default fallback
  END
WHERE calibre IS NOT NULL;

-- Step 5: Alter column back to enum
ALTER TABLE produccion ALTER COLUMN calibre TYPE calibre_limon USING calibre::calibre_limon;