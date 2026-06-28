export type AiMode = 'assistant' | 'support';

export interface ChatMessage {
  from: 'user' | 'bot';
  text: string;
}

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  reply: string;
}

export interface IngestResult {
  chunksIngested: number;
}
