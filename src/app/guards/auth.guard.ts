import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const user = this.authService.getCurrentUser();
    const isLoggedIn = this.authService.isLoggedIn();

    // If not logged in, redirect to login
    if (!isLoggedIn || !user) {
      this.router.navigate(['/login']);
      return false;
    }

    // If user has temporary password and isn't already on change-password page
    if (user.isTemporaryPassword && state.url !== '/change-password') {
      this.router.navigate(['/change-password']);
      return false;
    }

    // If trying to access change-password page without temporary password
    if (state.url === '/change-password' && !user.isTemporaryPassword) {
      this.router.navigate(['/administrator']);
      return false;
    }

    // Check for required role if specified
    const requiredRole = route.data['requiredRole'];
    if (requiredRole && user.role !== requiredRole) {
      this.router.navigate(['/login']);
      return false;
    }

    return true;
  }
} 