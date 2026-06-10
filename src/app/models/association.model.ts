export type AssociationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface AssociatedMemberResponse {
  profileId: string;
  userId:    string;
  displayName: string;
  avatarUrl?: string;
  profileType: string;
  isVerified: boolean;
}

export const ASSOCIATION_STATUS_LABELS: Record<AssociationStatus, string> = {
  PENDING:  'Pendiente',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
};

// Campos exactos del backend AssociationResponse
export interface AssociationResponse {
  id: string;
  teacherProfileId: string;  // profileId del docente (no userId)
  academyProfileId: string;  // profileId de la academia
  status: AssociationStatus;
  requestedAt: string;       // backend usa requestedAt, NO createdAt
  resolvedAt: string | null;
}
