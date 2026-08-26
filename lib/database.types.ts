import type { Database } from './database.generated'

export type { Database }

/**
 * Re-export Database with a stable alias used by our SSR client factories.
 *
 * The original Database type includes `__InternalSupabase: { PostgrestVersion: "14.15" }`.
 * That field is required: SupabaseClient uses it to resolve ClientOptions, which in turn
 * allows Schema to be inferred as `Database['public']` rather than deferred to `never`.
 * Without it, all `.insert()` / `.update()` call sites collapse to `never` parameter types.
 *
 * Always pass `Database` (not Omit<Database, '__InternalSupabase'>) to createBrowserClient /
 * createServerClient / createClient from @supabase/ssr and @supabase/supabase-js.
 */
export type CleanDatabase = Database

export type Profile          = Database['public']['Tables']['profiles']['Row']
export type Organization     = Database['public']['Tables']['organizations']['Row']
export type Invitation       = Database['public']['Tables']['invitations']['Row']
export type JobRole          = Database['public']['Tables']['job_roles']['Row']
export type TaskTemplate     = Database['public']['Tables']['task_templates']['Row']
export type Task             = Database['public']['Tables']['tasks']['Row']
export type Quiz             = Database['public']['Tables']['quizzes']['Row']
export type QuizQuestion     = Database['public']['Tables']['quiz_questions']['Row']
export type QuizAssignment   = Database['public']['Tables']['quiz_assignments']['Row']
export type QuizAnswer       = Database['public']['Tables']['quiz_answers']['Row']
export type JobRoleQuiz      = Database['public']['Tables']['job_role_quizzes']['Row']
export type UserQuestion     = Database['public']['Tables']['user_questions']['Row']
export type UserQuestionInsert = Database['public']['Tables']['user_questions']['Insert']

export type ProfileInsert         = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate         = Database['public']['Tables']['profiles']['Update']
export type OrganizationInsert    = Database['public']['Tables']['organizations']['Insert']
export type InvitationInsert      = Database['public']['Tables']['invitations']['Insert']
export type JobRoleInsert         = Database['public']['Tables']['job_roles']['Insert']
export type TaskTemplateInsert    = Database['public']['Tables']['task_templates']['Insert']
export type TaskInsert            = Database['public']['Tables']['tasks']['Insert']
export type TaskUpdate            = Database['public']['Tables']['tasks']['Update']
export type QuizInsert            = Database['public']['Tables']['quizzes']['Insert']
export type QuizUpdate            = Database['public']['Tables']['quizzes']['Update']
export type QuizQuestionInsert    = Database['public']['Tables']['quiz_questions']['Insert']
export type QuizQuestionUpdate    = Database['public']['Tables']['quiz_questions']['Update']
export type QuizAssignmentInsert  = Database['public']['Tables']['quiz_assignments']['Insert']
export type QuizAssignmentUpdate  = Database['public']['Tables']['quiz_assignments']['Update']
export type QuizAnswerInsert      = Database['public']['Tables']['quiz_answers']['Insert']
export type QuizAnswerUpdate      = Database['public']['Tables']['quiz_answers']['Update']
export type JobRoleQuizInsert     = Database['public']['Tables']['job_role_quizzes']['Insert']
