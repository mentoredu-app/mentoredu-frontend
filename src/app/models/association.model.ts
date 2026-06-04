export type AssociationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export const ASSOCIATION_STATUS_LABELS: Record<AssociationStatus, string> = {
  PENDING:  'Pendiente',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
};

export interface AssociationResponse {
  id: string;
  teacherId?: string;
  teacherName?: string;
  academyProfileId?: string;
  academyName?: string;
  status: AssociationStatus;
  createdAt: string;
  updatedAt?: string;
}
