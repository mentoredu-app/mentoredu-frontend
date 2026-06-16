export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type VerificationEntityType = 'TEACHER' | 'ACADEMY';
export type VerificationAction = 'APPROVED' | 'REJECTED';

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  PENDING:  'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  DNI:                'DNI',
  PASAPORTE:          'Pasaporte',
  TITULO_PROFESIONAL: 'Título profesional',
  CONSTANCIA_TRABAJO: 'Constancia de trabajo',
  RUC:                'RUC',
};

export const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS);

export interface VerificationDocument {
  id?: string;
  documentType: string;
  fileUrl: string;
  uploadedAt?: string;
}

export interface CreateVerificationRequest {
  entityType: VerificationEntityType;
  universityId?: string;
  documents: VerificationDocument[];
}

export interface ReviewVerificationRequest {
  action: VerificationAction;
  notes?: string;
}

export interface VerificationResponse {
  id: string;
  userId: string;          // UUID del solicitante (sin nombre)
  entityType: VerificationEntityType;
  universityId?: string;
  documents: VerificationDocument[];
  status: VerificationStatus;
  notes: string | null;
  submittedAt: string;     // backend usa submittedAt, NO createdAt
  reviewedAt: string | null;
}
