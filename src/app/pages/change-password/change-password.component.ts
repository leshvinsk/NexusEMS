import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { trigger, state, style, animate, transition } from '@angular/animations';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.css'],
  animations: [
    trigger('swipeAnimation', [
      state('void', style({ 
        left: '-100%' 
      })),
      state('left', style({ 
        left: '0' 
      })),
      state('right', style({ 
        left: '100%' 
      })),
      transition('void => left', animate('600ms ease-out')),
      transition('left => right', animate('600ms ease-in'))
    ])
  ]
})
export class ChangePasswordComponent implements OnInit {
  passwordData = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  isLoginSuccessLoading: boolean = false;
  loginTransitionFinished: boolean = false;
  loadingComplete: boolean = false;
  loadingProgress: number = 0;
  swipeState: string = 'void';

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit() {
    // Check if user needs to change password
    const user = this.authService.getCurrentUser();
    if (!user || !user.isTemporaryPassword) {
      // Redirect based on user role
      this.redirectBasedOnRole();
    }
    
    // Initialize animation state
    this.swipeState = 'void';
  }

  // New method to redirect based on user role with loading animation
  redirectBasedOnRole() {
    const user = this.authService.getCurrentUser();
    const userRole = localStorage.getItem('userRole');
    
    // For direct redirects without animation (like on initial load)
    if (!this.isLoginSuccessLoading) {
      if (userRole === 'Administrator') {
        this.router.navigate(['/administrator']);
      } else if (userRole === 'Organizer') {
        this.router.navigate(['/organizer']);
      } else {
        // Fallback to login if role not recognized
        this.router.navigate(['/login']);
      }
      return;
    }
    
    // For redirects with animation (after password change)
    if (userRole === 'Administrator') {
      console.log('Redirecting to administrator page');
      this.router.navigateByUrl('/administrator');
    } else if (userRole === 'Organizer') {
      console.log('Redirecting to organizer page');
      this.router.navigateByUrl('/organizer');
    } else {
      console.warn('Unknown user role after login:', userRole);
      alert('Login successful but role not recognized.');
      this.resetLoginState();
    }
  }
  
  // Reset loading state
  private resetLoginState() {
    this.isLoginSuccessLoading = false;
    this.loginTransitionFinished = false;
    this.loadingComplete = false;
    this.swipeState = 'void';
  }

  togglePasswordVisibility(field: string) {
    switch (field) {
      case 'current':
        this.showCurrentPassword = !this.showCurrentPassword;
        break;
      case 'new':
        this.showNewPassword = !this.showNewPassword;
        break;
      case 'confirm':
        this.showConfirmPassword = !this.showConfirmPassword;
        break;
    }
  }

  onSubmit(form: NgForm) {
    if (!form.valid) {
      alert('Please fill in all required fields.');
      return;
    }

    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      alert('New password and confirm password do not match.');
      return;
    }

    if (this.passwordData.newPassword.length < 8) {
      alert('New password must be at least 8 characters long.');
      return;
    }

    this.authService.changePassword(this.passwordData.currentPassword, this.passwordData.newPassword)
      .subscribe(
        response => {
          alert(response.message);
          // Update user in localStorage to reflect password is no longer temporary
          const user = this.authService.getCurrentUser();
          if (user) {
            user.isTemporaryPassword = false;
            // Update the user data through the auth service
            // This will ensure it's stored encrypted
            const userRole = localStorage.getItem('userRole') || '';
            this.authService.updateUserData(user, userRole);
          }
          
          // Show loading animation
          this.isLoginSuccessLoading = true;
          this.loginTransitionFinished = false;
          this.loadingProgress = 0;
          
          // Animate the progress bar with improved timing
          const progressInterval = setInterval(() => {
            if (this.loadingProgress < 70) {
              this.loadingProgress += 3; // Steady progress to 70%
            } else if (this.loadingProgress < 90) {
              this.loadingProgress += 1; // Slower from 70-90%
            } else if (this.loadingProgress < 100) {
              this.loadingProgress += 0.5; // Even slower for last 10%
            }
            
            if (this.loadingProgress >= 100) {
              clearInterval(progressInterval);
              
              // Mark loading as complete and change text
              this.loadingComplete = true;
              
              // Short delay before starting the transition animation
              setTimeout(() => {
                // Start by showing swipe animation
                this.swipeState = 'left';
                
                // After swipe completes, start fade out
                setTimeout(() => {
                  this.swipeState = 'right';
                  this.loginTransitionFinished = true;
                  
                  // Redirect after transition completes
                  setTimeout(() => {
                    this.redirectBasedOnRole();
                  }, 300); // Reduced from 800ms
                }, 300); // Reduced from 600ms
              }, 100); // Reduced from 200ms
            }
          }, 30);
        },
        error => {
          alert(error.error?.error || 'Failed to change password. Please try again.');
        }
      );
  }
} 