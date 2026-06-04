export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type VerificationEntityType = 'TEACHER' | 'ACADEMY';
export type VerificationAction = 'APPROVED' | 'REJECTED';

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  PENDING:  'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  DNI:                  'DNI',
  PASAPORTE:            'Pasaporte',
  TITULO_PROFESIONAL:   'Título profesional',
  CONSTANCIA_TRABAJO:   'Constancia de trabajo',
  CARNET_UNIVERSITARIO: 'Carnet universitario',
  RUC:                  'RUC',
};

export const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS);

export interface VerificationDocument {
  documentType: string;
  fileUrl: string;
}

export interface CreateVerificationRequest {
  entityType: VerificationEntityType;
  documents: VerificationDocument[];
}

export interface ReviewVerificationRequest {
  action: VerificationAction;
  notes?: string;
}

export interface VerificationResponse {
  id: string;
  userId?: string;
  userName?: string;
  entityType: VerificationEntityType;
  documents: VerificationDocument[];
  status: VerificationStatus;
  notes: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}
