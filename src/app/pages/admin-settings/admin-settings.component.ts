import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';
import { take } from 'rxjs/operators';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-admin-settings',
  templateUrl: './admin-settings.component.html',
  styleUrls: ['./admin-settings.component.css']
})
export class AdminSettingsComponent implements OnInit, OnDestroy {
  currentUser: any;
  profileForm: FormGroup;
  passwordForm: FormGroup;
  isEditingEmail: boolean = false;
  isEditingPhone: boolean = false;
  isSidebarCollapsed: boolean = false;
  showCurrentPassword: boolean = false;
  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;
  verificationCode: string = '';
  enteredCode: string = '';
  isCodeSent: boolean = false;
  isVerifying: boolean = false;
  verificationMessage: string = '';
  showVerificationError: boolean = false;
  showVerificationSuccess: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';
  showSuccess: boolean = false;
  showError: boolean = false;
  isChangingPassword: boolean = false;
  
  // New properties for email verification
  newEmailValue: string = '';
  isCheckingEmail: boolean = false;
  showEmailError: boolean = false;
  emailErrorMessage: string = '';
  countdownActive: boolean = false;
  countdownMinutes: number = 5;
  countdownSeconds: number = 0;
  countdownSubscription?: Subscription;

  // New properties for contact verification
  newContactValue: string = '';
  isCheckingContact: boolean = false;
  showContactError: boolean = false;
  contactErrorMessage: string = '';
  contactVerificationCode: string = '';
  contactEnteredCode: string = '';
  isContactCodeSent: boolean = false;
  isContactVerifying: boolean = false;
  contactVerificationMessage: string = '';
  showContactVerificationError: boolean = false;
  contactCountdownActive: boolean = false;
  contactCountdownMinutes: number = 5;
  contactCountdownSeconds: number = 0;
  contactCountdownSubscription?: Subscription;

  // Password strength
  passwordStrength = {
    percentage: 0,
    text: 'Very Weak',
    class: 'very-weak'
  };

  // Missing password requirements
  passwordMissingRequirements: string[] = [];

  constructor(
    private authService: AuthService,
    public router: Router,
    private fb: FormBuilder,
    private http: HttpClient,
    private toast: ToastService
  ) {
    this.profileForm = this.fb.group({
      username: [{ value: '', disabled: true }],
      email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
      contact_no: [{ value: '', disabled: true }, [Validators.required]]
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validator: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.loadUserData();
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
    }
    if (this.contactCountdownSubscription) {
      this.contactCountdownSubscription.unsubscribe();
    }
  }

  loadUserData(): void {
    this.currentUser = this.authService.getCurrentUser();
    console.log('User data loaded:', this.currentUser);
    console.log('User contact_no:', this.currentUser?.contact_no);
    console.log('User data keys:', this.currentUser ? Object.keys(this.currentUser) : 'No user data');
    console.log('Full user object:', JSON.stringify(this.currentUser));
    
    if (this.currentUser) {
      this.profileForm.patchValue({
        username: this.currentUser.username || '',
        email: this.currentUser.email || '',
        contact_no: this.currentUser.contact_no || ''
      });
      console.log('Form values after patch:', this.profileForm.value);
      console.log('contact_no form control:', this.profileForm.get('contact_no')?.value);
    } else {
      // If no user data, redirect to login
      this.router.navigate(['/login']);
    }
  }

  toggleEditEmail(): void {
    this.isEditingEmail = !this.isEditingEmail;
    if (this.isEditingEmail) {
      // Initialize new email value with current email to make it easier for minor changes
      this.newEmailValue = '';
      // Reset error states
      this.showEmailError = false;
      this.emailErrorMessage = '';
    } else {
      this.cancelEmailUpdate();
    }
  }

  cancelEmailUpdate(): void {
    // Reset all email verification states
    this.isEditingEmail = false;
    this.isCodeSent = false;
    this.isCheckingEmail = false;
    this.showEmailError = false;
    this.emailErrorMessage = '';
    this.newEmailValue = '';
    this.enteredCode = '';
    this.showVerificationError = false;
    this.showVerificationSuccess = false;
    
    // Stop countdown timer if active
    if (this.countdownActive) {
      this.stopCountdown();
    }
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  checkEmailAndSendCode(): void {
    if (!this.newEmailValue || !this.isValidEmail(this.newEmailValue)) {
      this.showEmailError = true;
      this.emailErrorMessage = 'Please enter a valid email address.';
      return;
    }

    // If the new email is the same as the current one, show error
    if (this.newEmailValue === this.currentUser.email) {
      this.showEmailError = true;
      this.emailErrorMessage = 'Please enter a different email address than your current one.';
      return;
    }

    this.isCheckingEmail = true;
    this.showEmailError = false;
    
    // Reset verification code input field
    this.enteredCode = '';
    
    // First validate the email is unique before showing verification UI
    this.http.post('http://localhost:5001/api/auth/check-email', {
      email: this.newEmailValue,
      userId: this.currentUser._id,
      userType: 'Administrator'
    }).subscribe({
      next: (response: any) => {
        console.log('Email check response:', response);
        this.isCheckingEmail = false;
        
        // Generate code only after email is validated as unique
        this.verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Now show verification code UI since email is valid
        this.isCodeSent = true;
        this.startCountdown();
        
        // Send verification code
        this.sendVerificationCodeToServer();
        
        // Show success notification
        this.showSuccessNotification('A verification code has been sent to your registered email address. It will expire in 5 minutes.');
      },
      error: (error) => {
        console.error('Email check error:', error);
        this.isCheckingEmail = false;
        
        // If there's an error, keep on email entry UI
        this.isCodeSent = false;
        
        this.showEmailError = true;
        if (error.status === 409) {
          this.emailErrorMessage = 'This email address is already registered in our system. Please use a different email address.';
        } else {
          this.emailErrorMessage = 'We encountered an error checking this email address. Please try again.';
        }
      }
    });
  }

  // Separate method to send verification code to server
  sendVerificationCodeToServer(): void {
    // Send the verification code to the registered email (current email, not the new one)
    this.http.post('http://localhost:5001/api/auth/send-verification', {
      email: this.currentUser.email,
      code: this.verificationCode,
      newEmail: this.newEmailValue
    }).subscribe({
      next: (response: any) => {
        console.log('Verification code sent successfully');
      },
      error: (error) => {
        console.error('Error sending verification code:', error);
        this.showErrorNotification('We were unable to send the verification code. Please try again.');
        this.isCodeSent = false;
        this.stopCountdown();
      }
    });
  }

  startCountdown(): void {
    // Clear any existing verification code input
    this.enteredCode = '';
    
    // Reset error states
    this.showVerificationError = false;
    this.verificationMessage = '';
    
    // Set initial countdown values
    this.countdownMinutes = 5;
    this.countdownSeconds = 0;
    this.countdownActive = true;
    
    // Unsubscribe from any existing subscription
    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
    }
    
    // Start the countdown
    this.countdownSubscription = interval(1000).subscribe(() => {
      if (this.countdownSeconds > 0) {
        this.countdownSeconds--;
      } else if (this.countdownMinutes > 0) {
        this.countdownMinutes--;
        this.countdownSeconds = 59;
      } else {
        // Time's up
        this.countdownActive = false;
        this.countdownSubscription?.unsubscribe();
        this.showVerificationError = true;
        this.verificationMessage = 'The verification code has expired. Please request a new one.';
      }
    });
  }

  stopCountdown(): void {
    this.countdownActive = false;
    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
    }
  }

  verifyCode(): void {
    if (!this.countdownActive) {
      this.showVerificationError = true;
      this.verificationMessage = 'Verification code has expired. Please request a new code.';
      return;
    }

    // Reset previous error states
    this.showVerificationError = false;
    this.isVerifying = true;
    
    // Simple verification (in a real app, this would be done on the server)
    if (this.enteredCode === this.verificationCode) {
      // Don't show success message, proceed directly to update
      this.stopCountdown();
      this.updateEmail(this.newEmailValue);
    } else {
      this.showVerificationError = true;
      this.verificationMessage = 'The verification code you entered is incorrect. Please try again.';
      this.isVerifying = false;
      // Don't clear the entered code to allow the user to correct it
    }
  }

  updateEmail(newEmail: string): void {
    // Log the current user for debugging
    console.log('Current user object:', JSON.stringify(this.currentUser));
    
    // Check all possible ID properties
    const userId = this.currentUser._id || this.currentUser.id || this.currentUser.user_id;
    console.log('Selected user ID:', userId);
    
    if (!userId) {
      this.showErrorNotification('User ID not found. Please log out and log in again.');
      this.isVerifying = false;
      return;
    }

    this.http.post('http://localhost:5001/api/auth/update-email', {
      userId: userId,
      newEmail: newEmail
    }).subscribe({
      next: (response: any) => {
        console.log('Email update response:', response);
        // Update the user data locally
        this.currentUser.email = newEmail;
        this.authService.updateUserData(this.currentUser, 'Administrator');
        
        // Update the form value
        this.profileForm.patchValue({
          email: newEmail
        });
        
        this.isEditingEmail = false;
        this.isCodeSent = false;
        this.isVerifying = false;
        this.showSuccessNotification('Email updated successfully.');
      },
      error: (error) => {
        console.error('Error updating email:', error);
        console.error('Error status:', error.status);
        console.error('Error details:', error.error);
        
        this.isVerifying = false;
        
        // Show more detailed error message
        let errorMsg = 'Failed to update email. Please try again.';
        
        if (error.error && error.error.error) {
          errorMsg = error.error.error;
        } else if (error.error && error.error.message) {
          errorMsg = error.error.message;
        } else if (error.status === 404) {
          errorMsg = 'User not found. Please try logging out and back in.';
        } else if (error.status === 0) {
          errorMsg = 'Cannot connect to server. Please check your internet connection.';
        }
        
        this.showErrorNotification(errorMsg);
      }
    });
  }

  toggleEditPhone(): void {
    this.isEditingPhone = !this.isEditingPhone;
    if (this.isEditingPhone) {
      // Initialize new contact value to make it easier for minor changes
      this.newContactValue = '';
      // Reset error states
      this.showContactError = false;
      this.contactErrorMessage = '';
    } else {
      this.cancelContactUpdate();
    }
  }

  cancelContactUpdate(): void {
    // Reset all contact verification states
    this.isEditingPhone = false;
    this.isContactCodeSent = false;
    this.isCheckingContact = false;
    this.showContactError = false;
    this.contactErrorMessage = '';
    this.newContactValue = '';
    this.contactEnteredCode = '';
    this.showContactVerificationError = false;
    
    // Stop countdown timer if active
    if (this.contactCountdownActive) {
      this.stopContactCountdown();
    }
    
    // Disable the form control
    const contactControl = this.profileForm.get('contact_no');
    if (contactControl) {
      contactControl.disable();
    }
  }

  isValidContact(contact: string): boolean {
    const contactRegex = /^[0-9]{10,11}$/; // For 10-11 digit phone numbers
    return contactRegex.test(contact);
  }

  checkContactAndSendCode(): void {
    this.displayDebugInfo();
    console.log('Starting contact verification process');
    
    if (!this.newContactValue || !this.isValidContact(this.newContactValue)) {
      this.showContactError = true;
      this.contactErrorMessage = 'Please enter a valid contact number (10-11 digits).';
      return;
    }

    // If the new contact is the same as the current one, show error
    if (this.newContactValue === this.currentUser.contact_no) {
      this.showContactError = true;
      this.contactErrorMessage = 'Please enter a different contact number than your current one.';
      return;
    }

    this.isCheckingContact = true;
    this.showContactError = false;
    
    // Reset verification code input field
    this.contactEnteredCode = '';
    
    // First validate the contact is unique before showing verification UI
    this.http.post('http://localhost:5001/api/auth/check-contact', {
      contactNo: this.newContactValue,
      userId: this.currentUser._id,
      userType: 'Administrator'
    }).subscribe({
      next: (response: any) => {
        console.log('Contact check response:', response);
        this.isCheckingContact = false;
        
        // Generate code only after contact is validated as unique
        this.contactVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Now show verification code UI since contact is valid
        this.isContactCodeSent = true;
        this.startContactCountdown();
        
        // Send verification code to email
        this.sendContactVerificationCodeToServer();
        
        // Show success notification
        this.showSuccessNotification('A verification code has been sent to your registered email address. It will expire in 5 minutes.');
      },
      error: (error) => {
        console.error('Contact check error:', error);
        this.isCheckingContact = false;
        
        // If there's an error, keep on contact entry UI
        this.isContactCodeSent = false;
        
        this.showContactError = true;
        if (error.status === 409) {
          this.contactErrorMessage = 'This contact number is already registered in our system. Please use a different contact number.';
        } else {
          this.contactErrorMessage = 'We encountered an error checking this contact number. Please try again.';
        }
      }
    });
  }

  // Send verification code for contact update to the server
  sendContactVerificationCodeToServer(): void {
    // Send the verification code to the registered email
    this.http.post('http://localhost:5001/api/auth/send-contact-verification', {
      email: this.currentUser.email,
      code: this.contactVerificationCode,
      newContactNo: this.newContactValue
    }).subscribe({
      next: (response: any) => {
        console.log('Contact verification code sent successfully');
      },
      error: (error) => {
        console.error('Error sending contact verification code:', error);
        this.showErrorNotification('We were unable to send the verification code. Please try again.');
        this.isContactCodeSent = false;
        this.stopContactCountdown();
      }
    });
  }

  startContactCountdown(): void {
    console.log('Starting contact countdown');
    
    // Clear any existing verification code input
    this.contactEnteredCode = '';
    
    // Reset error states
    this.showContactVerificationError = false;
    this.contactVerificationMessage = '';
    
    // Set initial countdown values
    this.contactCountdownMinutes = 5;
    this.contactCountdownSeconds = 0;
    this.contactCountdownActive = true;
    
    // Unsubscribe from any existing subscription
    if (this.contactCountdownSubscription) {
      this.contactCountdownSubscription.unsubscribe();
    }
    
    console.log('Countdown initialized:', {
      minutes: this.contactCountdownMinutes,
      seconds: this.contactCountdownSeconds,
      active: this.contactCountdownActive
    });
    
    // Start the countdown
    this.contactCountdownSubscription = interval(1000).subscribe(() => {
      if (this.contactCountdownSeconds > 0) {
        this.contactCountdownSeconds--;
      } else if (this.contactCountdownMinutes > 0) {
        this.contactCountdownMinutes--;
        this.contactCountdownSeconds = 59;
      } else {
        // Time's up
        console.log('Contact countdown expired');
        this.contactCountdownActive = false;
        this.contactCountdownSubscription?.unsubscribe();
        this.showContactVerificationError = true;
        this.contactVerificationMessage = 'The verification code has expired. Please request a new one.';
      }
    });
  }

  stopContactCountdown(): void {
    this.contactCountdownActive = false;
    if (this.contactCountdownSubscription) {
      this.contactCountdownSubscription.unsubscribe();
    }
  }

  verifyContactCode(): void {
    console.log('verifyContactCode called');
    this.displayDebugInfo();

    if (!this.contactCountdownActive) {
      this.showContactVerificationError = true;
      this.contactVerificationMessage = 'Verification code has expired. Please request a new code.';
      return;
    }

    // Reset previous error states
    this.showContactVerificationError = false;
    this.isContactVerifying = true;
    
    // Make sure both codes are strings and trim any whitespace
    const enteredCode = String(this.contactEnteredCode).trim();
    const verificationCode = String(this.contactVerificationCode).trim();
    
    console.log('Comparing codes:', { 
      enteredCode, 
      verificationCode, 
      match: enteredCode === verificationCode 
    });
    
    // Simple verification
    if (enteredCode === verificationCode) {
      console.log('Code verified successfully, proceeding with update');
      this.stopContactCountdown();
      
      // Call the update function directly
      this.updateContactNumber();
    } else {
      console.log('Verification failed');
      this.isContactVerifying = false; // Important: Reset verification state
      this.showContactVerificationError = true;
      this.contactVerificationMessage = 'The verification code you entered is incorrect. Please try again.';
    }
  }

  // Separate method to handle the actual update call
  updateContactNumber(): void {
    console.log('Updating contact number to:', this.newContactValue);
    
    // Check all possible ID properties
    const userId = this.currentUser._id || this.currentUser.id;
    console.log('User ID for update:', userId);
    
    if (!userId) {
      this.showErrorNotification('User ID not found. Please log out and log in again.');
      this.isContactVerifying = false;
      return;
    }

    // Direct API call
    this.http.post('http://localhost:5001/api/auth/update-contact-no', {
      userId: userId,
      newContactNo: this.newContactValue
    }).subscribe({
      next: (response: any) => {
        console.log('Contact update response:', response);
        
        // Update the user data locally
        this.currentUser.contact_no = this.newContactValue;
        this.authService.updateUserData(this.currentUser, 'Administrator');
        
        // Update the form value
        this.profileForm.patchValue({
          contact_no: this.newContactValue
        });
        
        // Reset all verification states
        this.isEditingPhone = false;
        this.isContactCodeSent = false;
        this.isContactVerifying = false;
        this.showSuccessNotification('Contact number updated successfully.');
        
        // Make sure the contact number field is disabled again
        this.profileForm.get('contact_no')?.disable();
      },
      error: (error) => {
        console.error('Error updating contact number:', error);
        
        // IMPORTANT: Reset verification state on error
        this.isContactVerifying = false;
        
        let errorMsg = 'Failed to update contact number. Please try again.';
        
        if (error.error?.error) {
          errorMsg = error.error.error;
        } else if (error.status === 404) {
          errorMsg = 'User not found. Please try logging out and back in.';
        } else if (error.status === 0) {
          errorMsg = 'Cannot connect to server. Please check your internet connection.';
        }
        
        this.showErrorNotification(errorMsg);
      }
    });
  }

  changePassword(): void {
    this.isChangingPassword = true;
    
    // Check password strength first
    const currentPassword = this.passwordForm.get('currentPassword')?.value;
    const newPassword = this.passwordForm.get('newPassword')?.value;
    
    // Ensure password is at least medium strength
    if (this.passwordStrength.percentage < 60) {
      let errorMessage = 'Password is too weak. ';
      
      // If we have specific missing requirements, show them
      if (this.passwordMissingRequirements && this.passwordMissingRequirements.length > 0) {
        errorMessage += 'Your password needs: ' + this.passwordMissingRequirements.join(', ');
      } else {
        errorMessage += 'Please use a stronger password with a mix of letters, numbers, and special characters.';
      }
      
      this.showErrorNotification(errorMessage);
      this.isChangingPassword = false;
      return;
    }
    
    // Check if the form is valid
    if (!this.passwordForm.valid) {
      // Form validation errors with specific messages
      if (this.passwordForm.get('currentPassword')?.errors?.['required']) {
        this.showErrorNotification('Please enter your current password');
      } else if (this.passwordForm.get('newPassword')?.errors?.['required']) {
        this.showErrorNotification('Please enter a new password');
      } else if (this.passwordForm.get('newPassword')?.errors?.['minlength']) {
        this.showErrorNotification('New password must be at least 8 characters long');
      } else if (this.passwordForm.get('confirmPassword')?.errors?.['required']) {
        this.showErrorNotification('Please confirm your new password');
      } else if (this.passwordForm.get('confirmPassword')?.value !== this.passwordForm.get('newPassword')?.value) {
        this.showErrorNotification('New passwords do not match each other');
      }
      this.isChangingPassword = false;
      return;
    }

    // Add token check for debugging
    console.log('About to change password - checking authentication status:');
    console.log('User is logged in:', this.authService.isLoggedIn());
    console.log('Current user role:', localStorage.getItem('userRole'));
    console.log('Current user:', this.authService.getCurrentUser());

    this.authService.changePassword(currentPassword, newPassword).subscribe({
      next: (response) => {
        this.showSuccessNotification('Password changed successfully');
        this.passwordForm.reset();
        this.isChangingPassword = false;
        // Reset password strength
        this.passwordStrength = { percentage: 0, text: 'Very Weak', class: 'very-weak' };
        this.passwordMissingRequirements = [];
      },
      error: (error) => {
        // Enhanced error handling with more specific messages
        this.isChangingPassword = false;
        
        if (error.error && error.error.message) {
          // Use server message directly
          this.showErrorNotification(error.error.message);
        } else if (error.error && error.error.error) {
          // For servers returning error in the error field
          this.showErrorNotification(error.error.error);
        } else if (error.status === 400) {
          // Common 400 errors for password change
          if (error.error && typeof error.error === 'string' && error.error.includes('current password')) {
            this.showErrorNotification('Current password is incorrect');
          } else {
            this.showErrorNotification('Password validation failed. Please check your inputs.');
          }
        } else if (error.status === 401) {
          this.showErrorNotification('Your session has expired. Please login again.');
          this.authService.logout();
        } else {
          this.showErrorNotification('Unable to change password. Please try again later.');
        }
        
        console.error('Password change error:', error);
      }
    });
  }

  togglePasswordVisibility(field: string): void {
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

  // Custom validator to check if passwords match
  passwordMatchValidator(group: FormGroup): any {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  showSuccessNotification(message: string): void {
    this.successMessage = message;
    this.showSuccess = true;
    
    // Scroll to the top of the main content area
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    
    setTimeout(() => {
      this.showSuccess = false;
    }, 5000);
  }

  showErrorNotification(message: string): void {
    this.errorMessage = message;
    this.showError = true;
    
    // Scroll to the top of the main content area
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    
    setTimeout(() => {
      this.showError = false;
    }, 5000);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // Method to clear email error when user clicks on the input
  clearEmailError(): void {
    if (this.showEmailError) {
      this.showEmailError = false;
      this.emailErrorMessage = '';
    }
  }

  // Method to clear verification error when user clicks on the input
  clearVerificationError(): void {
    if (this.showVerificationError) {
      this.showVerificationError = false;
      this.verificationMessage = '';
    }
  }

  // Method to handle email input changes and clear errors when empty
  onEmailValueChange(): void {
    // If field is empty or user is typing a new value, clear error
    if (!this.newEmailValue || this.newEmailValue.trim() === '') {
      this.showEmailError = false;
      this.emailErrorMessage = '';
    }
  }

  // Method to handle verification code input changes and clear errors
  onVerificationCodeChange(): void {
    // Clear error when user modifies the verification code
    if (this.showVerificationError) {
      this.showVerificationError = false;
      this.verificationMessage = '';
    }
  }

  // Method to clear contact error when user clicks on the input
  clearContactError(): void {
    if (this.showContactError) {
      this.showContactError = false;
      this.contactErrorMessage = '';
    }
  }

  // Method to clear contact verification error when user clicks on the input
  clearContactVerificationError(): void {
    if (this.showContactVerificationError) {
      this.showContactVerificationError = false;
      this.contactVerificationMessage = '';
    }
  }

  // Method to handle contact input changes and clear errors when empty
  onContactValueChange(): void {
    // If field is empty or user is typing a new value, clear error
    if (!this.newContactValue || this.newContactValue.trim() === '') {
      this.showContactError = false;
      this.contactErrorMessage = '';
    }
  }

  // Method to handle contact verification code input changes and clear errors
  onContactVerificationCodeChange(): void {
    console.log('Verification code changed:', {
      code: this.contactEnteredCode,
      length: this.contactEnteredCode?.length || 0,
      countdown: this.contactCountdownActive
    });
    
    // Clear error when user modifies the verification code
    if (this.showContactVerificationError) {
      this.showContactVerificationError = false;
      this.contactVerificationMessage = '';
    }
    
    // Force to only contain digits
    if (this.contactEnteredCode) {
      // Replace any non-digit characters
      const digitsOnly = this.contactEnteredCode.replace(/\D/g, '');
      if (digitsOnly !== this.contactEnteredCode) {
        this.contactEnteredCode = digitsOnly;
      }
    }
    
    // If we have 6 digits and countdown is active, enable the verify button
    const isComplete = this.contactEnteredCode?.length === 6 && this.contactCountdownActive;
    console.log('Verification status:', { 
      isComplete, 
      canVerify: isComplete && !this.isContactVerifying 
    });
  }

  // Add method to fetch current user data from server
  fetchCurrentUserData(): void {
    if (!this.currentUser || !this.currentUser._id) {
      this.showErrorNotification('User ID not found. Please log out and log in again.');
      return;
    }
    
    this.http.get(`http://localhost:5001/api/auth/user-data/${this.currentUser._id}`)
      .subscribe({
        next: (userData: any) => {
          console.log('Fetched user data from server:', userData);
          
          if (userData && userData.contact_no) {
            // Update current user in memory
            this.currentUser.contact_no = userData.contact_no;
            
            // Update the form
            this.profileForm.patchValue({
              contact_no: userData.contact_no
            });
            
            // Update user data in localStorage
            this.authService.updateUserData(this.currentUser, 'Administrator');
            
            this.showSuccessNotification('User data refreshed successfully.');
          } else {
            this.showErrorNotification('No contact number found for this user.');
          }
        },
        error: (error) => {
          console.error('Error fetching user data:', error);
          this.showErrorNotification('Failed to fetch user data. Please try again.');
        }
      });
  }

  // Add this method to reset verification state if needed
  resetContactVerification() {
    console.log('Manual reset of contact verification state');
    this.isContactVerifying = false;
    this.showContactVerificationError = false;
    this.contactVerificationMessage = '';
  }

  // Direct handler for verification button click
  handleVerifyClick(event: Event): void {
    event.preventDefault();
    console.log('Direct verify button click handler called');
    
    // Only proceed if the button shouldn't be disabled
    if (this.contactEnteredCode && 
        this.contactEnteredCode.length === 6 && 
        !this.isContactVerifying && 
        this.contactCountdownActive) {
      
      console.log('Verification conditions met, proceeding with verification');
      this.verifyContactCode();
    } else {
      console.log('Button should be disabled:', {
        noCode: !this.contactEnteredCode,
        codeIncomplete: this.contactEnteredCode?.length < 6,
        isVerifying: this.isContactVerifying,
        countdownInactive: !this.contactCountdownActive
      });
    }
  }

  // Add this debugging helper method
  displayDebugInfo() {
    const debugData = {
      currentUser: {
        id: this.currentUser?._id,
        username: this.currentUser?.username,
        contact_no: this.currentUser?.contact_no
      },
      formValue: this.profileForm.value,
      verificationStatus: {
        codeSent: this.isContactCodeSent,
        verifying: this.isContactVerifying, 
        countdown: this.contactCountdownActive,
        code: this.contactVerificationCode,
        enteredCode: this.contactEnteredCode
      }
    };
    
    console.table(debugData.currentUser);
    console.table(debugData.formValue);
    console.table(debugData.verificationStatus);
  }

  // Check password strength
  checkPasswordStrength(): void {
    const password = this.passwordForm.get('newPassword')?.value || '';
    
    if (!password) {
      this.passwordStrength = { percentage: 0, text: 'Very Weak', class: 'very-weak' };
      return;
    }
    
    // Calculate strength score (0-100)
    let score = 0;
    let missingRequirements = [];
    
    // Length check
    if (password.length >= 8) score += 20;
    else missingRequirements.push('at least 8 characters');
    
    if (password.length >= 10) score += 10;
    if (password.length >= 12) score += 10;
    
    // Complexity checks
    if (/[A-Z]/.test(password)) score += 15; // Has uppercase
    else missingRequirements.push('an uppercase letter');
    
    if (/[a-z]/.test(password)) score += 10; // Has lowercase
    else missingRequirements.push('a lowercase letter');
    
    if (/[0-9]/.test(password)) score += 15; // Has number
    else missingRequirements.push('a number');
    
    if (/[^A-Za-z0-9]/.test(password)) score += 20; // Has special character
    else missingRequirements.push('a special character');
    
    // Store the missing requirements for use in the form validation
    this.passwordMissingRequirements = missingRequirements;
    
    // Determine text and class based on score
    let strengthText: string;
    let strengthClass: string;
    
    if (score < 20) {
      strengthText = 'Very Weak';
      strengthClass = 'very-weak';
    } else if (score < 40) {
      strengthText = 'Weak';
      strengthClass = 'weak';
    } else if (score < 60) {
      strengthText = 'Medium';
      strengthClass = 'medium';
    } else if (score < 80) {
      strengthText = 'Strong';
      strengthClass = 'strong';
    } else {
      strengthText = 'Great!';
      strengthClass = 'great';
    }
    
    // Update password strength
    this.passwordStrength = {
      percentage: score,
      text: strengthText,
      class: strengthClass
    };
  }
}
