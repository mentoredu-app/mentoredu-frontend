export type SolutionStatus = 'SUBMITTED' | 'REVIEWED';

export interface SolutionResponse {
  id: string;
  resourceId: string;
  studentId: string;
  studentName?: string;
  status: SolutionStatus;
  fileUrl?: string;
  content?: string;
  submittedAt: string;
}

export interface MySolutionWithFeedbackResponse {
  solution: SolutionResponse;
  feedback: FeedbackResponse | null;
}

export interface FeedbackResponse {
  id: string;
  solutionId: string;
  authorId: string;
  authorName: string;
  body: string;
  score?: number;
  createdAt: string;
}

export interface CreateFeedbackRequest {
  body: string;
  score?: number;
}
