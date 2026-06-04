export type ReportTargetType = 'THREAD' | 'ANSWER' | 'COMMENT' | 'RESOURCE';
export type ReportStatus = 'PENDING' | 'RESOLVED';

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

export interface ReportResponse {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: ReportStatus;
  resolutionNote: string | null;
  reporterName?: string;
  createdAt: string;
  resolvedAt?: string | null;
}
