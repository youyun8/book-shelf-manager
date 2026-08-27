-- Book images were dropped from the shelf, and nothing has written or read
-- this column since. The values left in it were only ever cover URLs copied
-- from the source spreadsheet, which the importer now ignores outright.
ALTER TABLE books DROP COLUMN cover_url;
