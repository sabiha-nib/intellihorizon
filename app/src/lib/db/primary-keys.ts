// Generated from supabase/schema-meta.json (primary keys per table), used to translate SQLite "INSERT OR REPLACE".
export const PRIMARY_KEYS: Record<string, string[]> = {
 "learners": [
  "id"
 ],
 "evidence": [
  "id"
 ],
 "users": [
  "id"
 ],
 "profiles": [
  "user_id"
 ],
 "sessions": [
  "id_hash"
 ],
 "email_tokens": [
  "token_hash"
 ],
 "rate_events": [],
 "curricula": [
  "id"
 ],
 "curriculum_versions": [
  "id"
 ],
 "subjects": [
  "id"
 ],
 "subject_offerings": [
  "grade",
  "medium",
  "subject_id"
 ],
 "textbooks": [
  "id"
 ],
 "chapters": [
  "id"
 ],
 "objectives": [
  "id"
 ],
 "source_pages": [
  "textbook_id",
  "page"
 ],
 "passages": [
  "id"
 ],
 "import_jobs": [
  "id"
 ],
 "tutor_threads": [
  "id"
 ],
 "tutor_messages": [
  "id"
 ],
 "saved_items": [
  "id"
 ],
 "questions": [
  "id"
 ],
 "attempts": [
  "id"
 ],
 "review_state": [
  "user_id",
  "question_id"
 ],
 "plan_tasks": [
  "id"
 ],
 "chapter_activity": [
  "user_id",
  "chapter_id"
 ],
 "app_settings": [
  "key"
 ],
 "admin_bootstrap": [
  "code_hash"
 ],
 "audit_log": [
  "id"
 ],
 "xp_events": [
  "id"
 ],
 "user_achievements": [
  "user_id",
  "achievement_id"
 ],
 "learning_sessions": [
  "id"
 ],
 "explanations": [
  "id"
 ],
 "passage_reviews": [
  "id"
 ],
 "ai_requests": [
  "id"
 ],
 "uploads": [
  "id"
 ],
 "quiz_sets": [
  "id"
 ],
 "quiz_responses": [
  "set_id",
  "question_id"
 ],
 "topics": [
  "id"
 ],
 "passage_embeddings": [
  "passage_id",
  "model"
 ],
 "cards": [
  "id"
 ],
 "card_reviews": [
  "id"
 ],
 "notes": [
  "id"
 ],
 "formulas": [
  "id"
 ],
 "concept_links": [
  "id"
 ],
 "reflections": [
  "id"
 ],
 "share_grants": [
  "id"
 ],
 "twin_feedback": [
  "id"
 ],
 "ai_cache": [
  "key"
 ],
 "ai_disputes": [
  "id"
 ],
 "demo_access": [
  "id"
 ],
 "ai_eval_runs": [
  "id"
 ],
 "ai_eval_results": [
  "id"
 ],
 "app_files": [
  "key"
 ]
};
