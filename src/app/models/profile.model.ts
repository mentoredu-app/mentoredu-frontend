import { Role } from './auth.model';

// GET /profiles/me
export interface ProfileMeResponse {
  id: string | null;   // null for system users (ADMIN/MOD) without a profile record
  userId: string;
  displayName: string;
  avatarUrl?: string;
  city?: string;
  bio?: string;
  profileType: 'STUDENT' | 'TEACHER' | 'ACADEMY' | 'ADMIN' | 'MODERATOR' | null;
  profileComplete: boolean;
  createdAt: string;
}

// GET /profiles/{userId} + PATCH /profiles/me response
export interface ProfileResponse {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  city?: string;
  bio?: string;
  profileType: 'STUDENT' | 'TEACHER' | 'ACADEMY' | 'MODERATOR' | 'ADMIN';
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  hasStudentProfile: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

// PATCH /profiles/me request
export interface UpdateBaseProfileRequest {
  displayName: string;
  avatarUrl?: string;
  city?: string;
  bio?: string;
}

// Student — POST /profiles/student
export interface CreateStudentProfileRequest {
  gradeLevel: string;       // requerido, max 20
  schoolName?: string;      // max 120
  studyShift?: string;      // max 30
  targetUniversityId?: string;
  targetAreaId?: string;
  targetCareerId?: string;
}

// Student — PATCH /profiles/student/me
export interface UpdateStudentProfileRequest {
  gradeLevel?: string;
  schoolName?: string;
  studyShift?: string;
  targetUniversityId?: string;
  targetAreaId?: string;
  targetCareerId?: string;
}

export interface StudentProfileResponse {
  profileId: string;
  gradeLevel: string;
  schoolName?: string;
  studyShift?: string;
  targetUniversityId?: string;
  targetAreaId?: string;
  targetCareerId?: string;
}

// Teacher — POST /profiles/teacher | PATCH /profiles/teacher/me
export interface TeacherProfileRequest {
  bioProfessional?: string; // max 2000
}

export interface TeacherProfileResponse {
  profileId: string;
  bioProfessional?: string;
}

// Academy — POST /profiles/academy
export interface CreateAcademyProfileRequest {
  academyName: string;      // requerido, unique, max 120
  ruc?: string;             // unique si se proporciona, max 20
  website?: string;         // max 255
  contactEmail?: string;    // max 120
}

// Academy — PATCH /profiles/academy/me
export interface UpdateAcademyProfileRequest {
  academyName?: string;     // min 2, max 120, unique
  website?: string;
  contactEmail?: string;    // formato email
}

export interface AcademyProfileResponse {
  profileId: string;
  academyName: string;
  ruc?: string;
  website?: string;
  contactEmail?: string;
}
