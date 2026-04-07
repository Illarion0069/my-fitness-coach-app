
-- Fix Anna's package: revert premature deduction
UPDATE client_packages 
SET used_sessions = 6, is_active = true
WHERE id = 'a7bf99ec-1c95-4053-8a26-3485d1cc6437';

-- Remove the premature trainer_book ledger entry
DELETE FROM session_ledger 
WHERE idempotency_key = 'trainer_book_8cb46826-a88d-45e5-b09b-63825d9f3705';
