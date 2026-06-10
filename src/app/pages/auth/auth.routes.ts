import { Routes } from '@angular/router';
import { ForgotPassword } from './forgot-password/forgot-password';
import { Login } from './login/login';
import { Register } from './register/register';
import { ResetPassword } from './reset-password/reset-password';

export const AUTH_ROUTES: Routes = [
  { path: 'login',            component: Login },
  { path: 'register',         component: Register },
  { path: 'forgot-password',  component: ForgotPassword },
  { path: 'reset-password',   component: ResetPassword },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
