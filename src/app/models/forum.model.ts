import { PagedResponse } from './common.model';

export type ThreadStatus = 'OPEN' | 'CLOSED';

export interface ThreadResponse {
  id: string;
  title: string;
  body: string;
  status: ThreadStatus;
  anonymous: boolean;
  authorDisplay: string;
  universityId?: string;
  areaId?: string;
  careerId?: string;
  courseId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateThreadRequest {
  title: string;
  body: string;
  isAnonymous: boolean;
  universityId?: string;
  areaId?: string;
  careerId?: string;
  courseId?: string;
}

export interface SearchThreadParams {
  universityId?: string;
  courseId?: string;
  careerId?: string;
  status?: ThreadStatus;
  page?: number;
  size?: number;
}

export type ThreadContextMode = 'course' | 'university' | 'career';
