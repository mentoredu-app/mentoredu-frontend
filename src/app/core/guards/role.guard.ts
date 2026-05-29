import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { Role } from '../../models/auth.model';
import { AuthStateService } from '../services/auth-state.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authState = inject(AuthStateService);
  const router = inject(Router);
  const allowedRoles: Role[] = route.data['roles'] ?? [];

  if (allowedRoles.length === 0 || allowedRoles.includes(authState.role()!)) {
    return true;
  }
  return router.createUrlTree(['/']);
};
