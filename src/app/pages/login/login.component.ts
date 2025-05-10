import { Component, AfterViewInit, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { trigger, state, style, animate, transition } from '@angular/animations';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: false,
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
export class LoginComponent implements AfterViewInit, OnInit {

  isSignDivVisiable: boolean = false;
  isForgetDivVisible: boolean = false;
  showPassword: boolean = false;
  isPasswordResetLoading: boolean = false;
  passwordResetFinished: boolean = false;
  isLoginSuccessLoading: boolean = false;
  loginTransitionFinished: boolean = false;
  loadingComplete: boolean = false;
  loadingProgress: number = 0;
  showSwipeAnimation: boolean = false;
  swipeState: string = 'void';
  loginObj: LoginModel = new LoginModel();
  forgotObj: ForgotModel = new ForgotModel();

  constructor(
    private router: Router, 
    private authService: AuthService,
    private http: HttpClient
  ) {
    console.log('LoginComponent initialized');
    
    // Secure any existing user data on component initialization
    this.authService.secureExistingData();
  }

  ngOnInit() {
    // Check if user is already logged in
    if (this.authService.isLoggedIn()) {
      console.log('User is already logged in, redirecting...');
      this.redirectLoggedInUser();
    }
    
    // Initialize animation state
    this.swipeState = 'void';
  }

  // Helper method to redirect already logged in users
  private redirectLoggedInUser() {
    // Get user role from localStorage
    const userRole = localStorage.getItem('userRole');
    
    // Redirect based on role
    if (userRole === 'Administrator') {
      console.log('Redirecting logged in administrator to dashboard');
      this.router.navigateByUrl('/administrator');
    } else if (userRole === 'Organizer') {
      console.log('Redirecting logged in organizer to dashboard');
      this.router.navigateByUrl('/organizer');
    } else {
      console.warn('User is logged in but role not recognized:', userRole);
      // If role is unknown but logged in, redirect to home as a fallback
      this.router.navigateByUrl('/home');
    }
  }

  ngAfterViewInit() {
    const videoElement = document.querySelector('video');
    if (videoElement) {
      videoElement.play().catch(error => {
        console.error('Error attempting to play video:', error);
      });
    }

    // Test connection to backend
    this.testBackendConnection();
  }

  // Test connection to backend server
  testBackendConnection() {
    this.http.get('http://localhost:5001/api/auth/test', { responseType: 'text' })
      .subscribe(
        response => {
          console.log('Backend connection successful:', response);
        },
        error => {
          console.error('Backend connection failed:', error);
          alert('Warning: Cannot connect to the authentication server. Please ensure MongoDB and the backend server are running.');
        }
      );
  }

  // Helper function to generate a random default password
  generateDefaultPassword(length: number) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // Helper function to generate a unique community ID
  generateCommunityID() {
    const idPrefix = 'C';
    const idSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return idPrefix + idSuffix;
  }

  // Helper function to generate a unique user ID
  generateUserID() {
    const userPrefix = 'U';
    const userSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return userPrefix + userSuffix;
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  // Handle user login
  onLogin() {
    // Check if the username and password fields are empty
    if (!this.loginObj.username || !this.loginObj.password) {
      alert('Please fill in all the required fields.');
      return;
    }

    console.log('Login attempt for:', this.loginObj.username);

    this.authService.login(this.loginObj).subscribe({
      next: (response) => {
        console.log('Login successful');
        
        // Get user data
        const userData = this.authService.getCurrentUser();
        const userRole = localStorage.getItem('userRole');
        
        // Check if this is a password change operation using userData.isTemporaryPassword flag
        if (userData && userData.isTemporaryPassword) {
          console.log('Temporary password detected, redirecting to change password page');
          this.router.navigateByUrl('/change-password');
          return;
        }
        
        // Only show loading animation for Administrator and Organizer redirections
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
                  this.redirectBasedOnRole(userRole);
                }, 800); // Match CSS transition time
              }, 600); // Match animation time of swipe
            }, 200);
          }
        }, 30);
      },
      error: (err) => {
        console.error('Login failed:', err);
        alert(err?.error?.message || 'Invalid credentials or server error.');
      }
    });
  }

  // Handle forgot password request
  onForgetPassword(forgetPasswordForm: NgForm) {
    if (forgetPasswordForm.invalid) {
      return;
    }

    console.log('Processing password reset for:', this.forgotObj.email);
    
    // Show loading animation
    this.isPasswordResetLoading = true;
    this.passwordResetFinished = false;

    this.authService.resetPassword(this.forgotObj.email).subscribe({
      next: (response: any) => {
        console.log('Password reset request successful');
        
        // Give a slight delay before starting the fade-out
        setTimeout(() => {
          this.passwordResetFinished = true;
          
          // Hide loading container after fade-out transition completes
          setTimeout(() => {
            this.isPasswordResetLoading = false;
            
            // Reset UI state after successful submission
            this.isForgetDivVisible = false;
            this.isSignDivVisiable = false;
            this.forgotObj = new ForgotModel();
            
            // Show success message
            alert('Password reset request sent successfully. Check your email for instructions.');
          }, 800); // Match CSS transition time
        }, 200);
      },
      error: (err: any) => {
        console.error('Password reset request failed:', err);
        
        // Same transition on error
        setTimeout(() => {
          this.passwordResetFinished = true;
          setTimeout(() => {
            this.isPasswordResetLoading = false;
            alert(err?.error?.message || 'Failed to process password reset. Please try again later.');
          }, 800);
        }, 200);
      }
    });
  }

  // Helper method to redirect users based on their role
  private redirectBasedOnRole(userRole: string | null) {
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

  // Helper method to reset login state
  private resetLoginState() {
    this.isLoginSuccessLoading = false;
    this.loginTransitionFinished = false;
    this.loadingComplete = false;
    this.swipeState = 'void';
  }

  forgotPassword() {
    this.isForgetDivVisible = true;   // Show the forgot password form
    this.isSignDivVisiable = true;    // Activate the container animation
  }

  // Method to force securing any existing user data
  private secureUserData(): void {
    this.authService.secureExistingData();
  }

  private handleLoadingComplete() {
    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'dissolve-overlay';
    document.body.appendChild(overlay);

    // Wait a brief moment to ensure loading is visually complete
    setTimeout(() => {
      overlay.classList.add('fade-out');
      
      // Remove overlay after animation completes
      setTimeout(() => {
        overlay.remove();
        // Navigate to the appropriate dashboard
        this.router.navigate(['/dashboard']); // Adjust route as needed
      }, 800); // Match the CSS transition duration
    }, 100);
  }
}

// Models

export class LoginModel {
  username: string;
  password: string;

  constructor() {
    this.username = '';
    this.password = '';
  }
}

export class ForgotModel {
  email: string = '';
}

