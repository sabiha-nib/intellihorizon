# Regenerates migrations/0009_checked_passages.sql from data/checked-passages.json. Run from app/: python3 tests/gen-checked-passages.py
# 0009 is applied in production: add corrections in a new migration rather than editing this one.
import json, hashlib, unicodedata

BOOKS = {"soptoborna": "dc63304a-e153-5105-af5a-6a2ffff229a5", "anandapath": "bfbd8358-41b3-5dda-b2c5-af3e9c96813d",
         "math": "95402820-a31b-54ab-83e6-55a0dabe844b", "science": "41f978e8-eeda-5506-b1ea-dc96ca7fec47"}
OFFSET = 5  # PDF page = printed page + 5 for all nine Class 7 books
q = lambda s: "'" + s.replace("'", "''") + "'"
out = [
    "-- Textbook passages checked against the page image. GENERATED from data/checked-passages.json (see tests/gen-checked-passages.py). Additive only.",
    "-- Each passage was read by OCR, then compared word by word with the printed page and corrected (Claude, for the IntelliHorizon build).",
    "-- They are marked review_status = 'checked' so the tutor can quote them before the whole book is approved; no teacher has reviewed them yet.",
    "-- Passages imported from the OCR text pack keep review_status NULL and stay hidden until an admin approves their book.",
    "ALTER TABLE passages ADD COLUMN review_status TEXT;",
    "ALTER TABLE passages ADD COLUMN review_note TEXT;",
]
seen = {}
for p in json.load(open("data/checked-passages.json")):
    page = p["printed"] + OFFSET
    seen[(p["book"], page)] = seen.get((p["book"], page), 0) + 1
    text = unicodedata.normalize("NFC", p["text"])
    note = f"Printed page {p['printed']}; OCR confidence {p['conf']}%; checked against the page image and corrected; not yet reviewed by a teacher"
    out.append(f"INSERT OR IGNORE INTO passages (textbook_id, page, seq, text, content_hash, review_status, review_note) VALUES ({q(BOOKS[p['book']])}, {page}, {900 + seen[(p['book'], page)]}, {q(text)}, '{hashlib.sha256(text.encode()).hexdigest()}', 'checked', {q(note)});")
open("migrations/0009_checked_passages.sql", "w").write("\n".join(out) + "\n")
