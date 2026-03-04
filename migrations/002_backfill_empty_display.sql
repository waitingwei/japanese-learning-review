-- Optional: backfill placeholder text for rows where main content is empty.
-- Run in Neon SQL Editor if you have old rows with missing word/reading/meaning etc.
-- After running, use the app's Edit on each item to replace placeholders with real content.

-- Grammar: set title so the row shows something in the list
UPDATE grammar
SET title = '(Untitled)'
WHERE trim(title) = '';

-- Vocab: set word so the row shows something (app shows "No word" anyway, this keeps DB consistent)
UPDATE vocab
SET word = '?'
WHERE trim(word) = '';

-- Sentences: set japanese_text so the row shows something
UPDATE sentences
SET japanese_text = '(No text)'
WHERE trim(japanese_text) = '';
