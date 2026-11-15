-- IntelliHorizon: what a finished Learning Session leaves behind. Additive only; no row is changed or deleted.
-- level:   the adaptive practice level the session was built at (foundation | developing | applied | challenging).
-- summary: JSON written once when the session is completed: questions attempted, right and wrong, misconceptions seen,
--          XP earned, minutes spent (only when it could be measured reliably) and the recommended next step.
ALTER TABLE learning_sessions ADD COLUMN level TEXT;
ALTER TABLE learning_sessions ADD COLUMN level_basis TEXT;
ALTER TABLE learning_sessions ADD COLUMN summary TEXT;
