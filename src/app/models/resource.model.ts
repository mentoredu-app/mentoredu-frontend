export type ResourceType = 'EXAMEN_COMPLETO' | 'EXAMEN_SECCION' | 'GUIA' | 'APUNTES' | 'PRACTICA' | 'OTRO';

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  EXAMEN_COMPLETO:  'Examen completo',
  EXAMEN_SECCION:   'Examen por sección',
  GUIA:             'Guía',
  APUNTES:          'Apuntes',
  PRACTICA:         'Práctica',
  OTRO:             'Otro',
};

export const TYPES_REQUIRING_COURSE: ResourceType[] = ['EXAMEN_SECCION', 'PRACTICA', 'OTRO'];

export interface ResourceFileResponse {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface SubmissionStatus {
  id: string;
  status: 'SUBMITTED' | 'REVIEWED';
  submittedAt: string;
}

export interface ResourceResponse {
  id: string;
  title: string;
  resourceType: ResourceType;
  resourceYear?: number | null;
  description?: string;
  universityId: string;
  areaId: string;
  careerId?: string;
  courseId?: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  aceptaResoluciones: boolean;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  createdAt: string;
  mySubmission?: SubmissionStatus | null;
}

export interface PublishResourceRequest {
  title: string;
  resourceType: ResourceType;
  resourceYear?: number | null;
  universityId: string;
  areaId: string;
  careerId?: string;
  courseId?: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  aceptaResoluciones?: boolean;
}

export interface UpdateResourceSettingsRequest {
  aceptaResoluciones: boolean;
}

export interface DownloadResponse {
  resourceId: string;
  title: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface SearchResourceParams {
  q?: string;
  type?: ResourceType;
  universityId?: string;
  areaId?: string;
  careerId?: string;
  courseId?: string;
  authorId?: string;
  resourceYear?: number;
  page?: number;
  size?: number;
}
