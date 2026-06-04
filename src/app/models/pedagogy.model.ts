export type SolutionStatus = 'SUBMITTED' | 'REVIEWED';

export interface MySolutionSummaryResponse {
  id: string;
  resourceId: string;
  resourceTitle: string;
  resourceType: string;
  status: SolutionStatus;
  submittedAt: string;
  feedbackScore: number | null;
  feedbackBody: string | null;
  feedbackAt: string | null;
}

export interface ReceivedSolutionResponse {
  id: string;
  resourceId: string;
  resourceTitle: string;
  resourceType: string;
  studentId: string;
  studentName: string;
  status: SolutionStatus;
  submittedAt: string;
  hasFeedback: boolean;
  feedbackScore: number | null;
}

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
  authorUserId: string;
  authorName: string;
  authorRole: string;
  body: string;
  score?: number;
  createdAt: string;
}

export interface CreateFeedbackRequest {
  body: string;
  score?: number;
}
