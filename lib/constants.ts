export const LEVELS = ['100', '200', '300', '400', '500', '600'] as const

/*
// ============================================================================
// [v1 CODE - DEPRECATED IN v2.0]
// In Version 1.0, faculties and departments were statically declared in constants.
// In Version 2.0, schools, faculties, and departments are dynamically loaded
// from the Supabase org tables (schools, faculties, departments).
// ============================================================================
export const FACULTIES = [
  'Faculty Of Natural and Applied Science',
  'Faculty of Basic Medical Science',
  'Faculty of Humanities and Social Sciences',
  'Faculty of Law',
  'Faculty of Administrative and Management Science',
]

export const DEPARTMENTS = [
  'Computer Science',
  'Accounting',
  'Software Engineering',
  'Cybersecurity',
  'Medical Laboratory Science',
  'Nursing Science',
  'Mass Communication',
  'Economics',
  'Business Administration',
  'Law',
]
*/

/** Colour palette used by Avatar to generate consistent initials colours from a name. */
export const PALETTE = [
  '#C41EBB', // primary
  '#FF9D66', // accent
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f97316', // orange
] as const

export const CURRENT_PRIVACY_VERSION = '1.0'
export const CURRENT_TERMS_VERSION = '1.0'

export const QR_ROTATION_INTERVAL_SECONDS = 30
export const CLAIM_TICKET_EXPIRY_SECONDS = 600 // 10 minutes

export const USER_ROLES = ['student', 'lecturer', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const LECTURER_STATUSES = ['pending', 'approved', 'rejected'] as const
export type LecturerStatus = (typeof LECTURER_STATUSES)[number]

/** Colour map for department badge chips. Keys are department names (case-sensitive). */
export const DEPT_COLORS: Record<string, string> = {
  'Computer Science': '#6366f1',
  'Engineering': '#f97316',
  'Mathematics': '#10b981',
  'Physics': '#3b82f6',
  'Chemistry': '#ef4444',
  'Biology': '#14b8a6',
  'Economics': '#f59e0b',
  'Law': '#8b5cf6',
  'Medicine': '#C41EBB',
  'Business': '#FF9D66',
}
