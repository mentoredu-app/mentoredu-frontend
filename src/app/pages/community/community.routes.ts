import { Routes } from '@angular/router';
import { VerificationRequest } from './verification-request/verification-request';
import { ModerationPanel } from './moderation-panel/moderation-panel';

export const COMMUNITY_ROUTES: Routes = [
  { path: 'verification', component: VerificationRequest },
  { path: 'moderation',   component: ModerationPanel },
];
