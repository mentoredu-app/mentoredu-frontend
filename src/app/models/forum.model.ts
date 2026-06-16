import { PagedResponse } from './common.model';

export type ThreadStatus = 'OPEN' | 'CLOSED';

export interface ThreadResponse {
  id: string;
  title: string;
  body: string;
  status: ThreadStatus;
  anonymous: boolean;
  authorId: string | null;   // null when anonymous
  authorDisplay: string;
  authorAvatarUrl?: string | null;
  universityId?: string;
  areaId?: string;
  careerId?: string;
  courseId?: string;
  likeCount: number;
  dislikeCount: number;
  myReaction: ReactionType | null;
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
  authorId?: string;
  status?: ThreadStatus;
  page?: number;
  size?: number;
}

export type ThreadContextMode = 'course' | 'university' | 'career';

export interface AnswerResponse {
  id: string;
  threadId: string;
  body: string;
  accepted: boolean;
  authorId: string;
  authorDisplay: string;
  authorAvatarUrl?: string | null;
  likeCount: number;
  dislikeCount: number;
  myReaction: ReactionType | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateAnswerRequest {
  body: string;
}

export interface CommentResponse {
  id: string;
  answerId: string;
  threadId: string;
  body: string;
  authorId: string;
  authorDisplay: string;
  authorAvatarUrl?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateCommentRequest {
  body: string;
}

export type ReactionType = 'LIKE' | 'DISLIKE';

export interface ReactionResponse {
  id: string;
  targetType: string;
  targetId: string;
  reactionType: ReactionType;
  userId: string;
  createdAt: string;
}
