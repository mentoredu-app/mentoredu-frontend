export type NotificationType =
  | 'new_follower'
  | 'answer_received'
  | 'comment_received'
  | 'reaction_received'
  | 'solution_submitted'
  | 'feedback_received'
  | 'verification_processed'
  | 'association_resolved';

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  new_follower:             'Nuevo seguidor',
  answer_received:          'Nueva respuesta',
  comment_received:         'Nuevo comentario',
  reaction_received:        'Nueva reacción',
  solution_submitted:       'Resolución recibida',
  feedback_received:        'Feedback recibido',
  verification_processed:   'Verificación procesada',
  association_resolved:     'Solicitud de asociación resuelta',
};

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  message: string;
  readAt: string | null;
  createdAt: string;
  referenceId?: string;
}
