-- The source spreadsheet now keeps four ideas in four columns where the app had
-- one: 狀態 (what the book is for), 新舊 (how new the copy is), 書況 (its marks)
-- and 備註. 共讀方式 is new as well.
ALTER TABLE books ADD COLUMN reading_mode TEXT NOT NULL DEFAULT '';
ALTER TABLE books ADD COLUMN status TEXT NOT NULL DEFAULT '';
ALTER TABLE books ADD COLUMN wear TEXT NOT NULL DEFAULT '';
ALTER TABLE books ADD COLUMN notes TEXT NOT NULL DEFAULT '';

-- Until now `condition` held whichever of 狀態 / 書況 the imported sheet filled
-- in, and in practice that was the status. Those values move to `status`; a
-- value that names a real book condition stays where it is.
UPDATE books
SET status = condition,
    condition = ''
WHERE condition <> ''
  AND (
    condition LIKE '%收藏%'
    OR condition LIKE '%典藏%'
    OR condition LIKE '%共讀%'
    OR condition LIKE '%待售%'
    OR condition LIKE '%出售%'
    OR condition LIKE '%販售%'
    OR condition LIKE '%已售%'
    OR condition LIKE '%售出%'
    OR condition LIKE '%絕版%'
    OR condition LIKE '%交換%'
    OR condition LIKE '%轉讓%'
    OR condition LIKE '%待讀%'
    OR condition LIKE '%未讀%'
  );
