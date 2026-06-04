export type ReportTargetType = 'THREAD' | 'ANSWER' | 'COMMENT' | 'RESOURCE';
// Backend usa 'OPEN' y 'RESOLVED' (NO 'PENDING')
export type ReportStatus = 'OPEN' | 'RESOLVED';

export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  THREAD:   'Hilo',
  ANSWER:   'Respuesta',
  COMMENT:  'Comentario',
  RESOURCE: 'Recurso',
};

export interface CreateReportRequest {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
}

export interface ResolveReportRequest {
  resolutionNote: string;
}

// Campos exactos del backend ReportResponse
export interface ReportResponse {
  id: string;
  reporterId: string;        // UUID del reportante (sin nombre)
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: ReportStatus;      // 'OPEN' | 'RESOLVED'
  createdAt: string;
  resolvedById: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
}
