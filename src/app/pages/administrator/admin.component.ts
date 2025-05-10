import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { OrganizerService } from '../../services/organizer.service';
import { HttpClient } from '@angular/common/http';

interface Organiser {
  username: string;
  email: string;
  phone: string;
  organization: string;
  organizerName: string;
  organizer_id?: string;
  _id?: string; // MongoDB ID
}

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css'],
  standalone: false
})
export class AdminComponent implements OnInit {
  isSidebarCollapsed = false;
  currentUser: any = null;
  isLoading = false;
  errorMessage = '';
  showError = false;
  successMessage = '';
  showSuccess = false;
  
  // Confirmation Dialog
  showConfirmDialog = false;
  confirmDialogTitle = '';
  confirmDialogMessage = '';
  confirmDialogCallback: (() => void) | null = null;
  
  newOrganiser = {
    username: '',
    email: '',
    phone: '',
    organization: '',
    organizerName: ''
  };

  organisers: Organiser[] = [];

  phoneErrorMessage = '';
  isPhoneValid = true;
  isCheckingPhone = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private organizerService: OrganizerService,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    // Get the current user from the auth service
    this.currentUser = this.authService.getCurrentUser();
    console.log('Current user:', this.currentUser);
    
    // Load organizers from database
    this.loadOrganizers();
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  loadOrganizers() {
    this.isLoading = true;
    this.organizerService.getOrganizers().subscribe({
      next: (data) => {
        this.organisers = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading organizers:', error);
        this.isLoading = false;
        this.showErrorMessage('Failed to load organizers. Please try again later.');
      }
    });
  }

  // Show error message with a popup and scroll to it
  showErrorMessage(message: string) {
    this.errorMessage = message;
    this.showError = true;
    
    // Give time for the DOM to update before scrolling
    setTimeout(() => {
      const notificationElement = document.getElementById('notification-error');
      if (notificationElement) {
        notificationElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    
    setTimeout(() => {
      this.showError = false;
    }, 5000); // Hide after 5 seconds
  }

  // Show success message with a popup and scroll to it
  showSuccessMessage(message: string) {
    this.successMessage = message;
    this.showSuccess = true;
    
    // Give time for the DOM to update before scrolling
    setTimeout(() => {
      const notificationElement = document.getElementById('notification-success');
      if (notificationElement) {
        notificationElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    
    setTimeout(() => {
      this.showSuccess = false;
    }, 5000); // Hide after 5 seconds
  }

  // Show confirmation dialog
  showConfirmationDialog(title: string, message: string, callback: () => void) {
    this.confirmDialogTitle = title;
    this.confirmDialogMessage = message;
    this.confirmDialogCallback = callback;
    this.showConfirmDialog = true;
  }

  // Handle confirm dialog response
  onConfirmDialogResponse(confirmed: boolean) {
    this.showConfirmDialog = false;
    if (confirmed && this.confirmDialogCallback) {
      this.confirmDialogCallback();
    }
    this.confirmDialogCallback = null;
  }

  // Delete organizer with confirmation
  deleteOrganizer(organizer: Organiser) {
    if (!organizer._id) {
      this.showErrorMessage('Cannot delete organizer. Invalid ID.');
      return;
    }

    this.showConfirmationDialog(
      'Delete Organizer',
      `Are you sure you want to delete organizer ${organizer.username}? This action cannot be undone. An email notification will be sent to the organizer.`,
      () => {
        this.isLoading = true;
        this.organizerService.deleteOrganizer(organizer._id!).subscribe({
          next: (response) => {
            this.isLoading = false;
            this.showSuccessMessage(`Organizer ${organizer.username} has been successfully deleted.`);
            // Refresh organizers list
            this.loadOrganizers();
          },
          error: (error) => {
            this.isLoading = false;
            this.showErrorMessage(error.error?.error || 'Failed to delete organizer. Please try again.');
            console.error('Error deleting organizer:', error);
          }
        });
      }
    );
  }

  // Validate phone number on input
  validatePhoneNumber(phoneNumber: string): boolean {
    // Check if phone is in valid format (10-11 digits)
    const phoneRegex = /^[0-9]{10,11}$/;
    return phoneRegex.test(phoneNumber);
  }

  // Check if phone number is already registered
  checkPhoneNumberExists(phoneNumber: string): void {
    if (!this.validatePhoneNumber(phoneNumber)) {
      this.isPhoneValid = false;
      this.phoneErrorMessage = 'Please enter a valid phone number (10-11 digits)';
      return;
    }

    this.isCheckingPhone = true;
    this.isPhoneValid = true;
    this.phoneErrorMessage = '';

    // Call the API to check if the phone number is already registered
    this.http.post('http://localhost:5001/api/auth/check-contact', {
      contactNo: phoneNumber,
      userId: null, // We don't have a user ID for new registration
      userType: 'Organizer'
    }).subscribe({
      next: (response: any) => {
        this.isCheckingPhone = false;
        this.isPhoneValid = true;
        this.phoneErrorMessage = '';
      },
      error: (error) => {
        this.isCheckingPhone = false;
        this.isPhoneValid = false;
        
        if (error.status === 409) {
          this.phoneErrorMessage = 'This phone number is already registered in our system';
        } else {
          this.phoneErrorMessage = 'Error checking phone number. Please try again.';
        }
      }
    });
  }

  onSubmit() {
    // Validate form
    if (!this.newOrganiser.username || !this.newOrganiser.email || 
        !this.newOrganiser.phone || !this.newOrganiser.organization ||
        !this.newOrganiser.organizerName) {
      this.showErrorMessage('Please fill in all fields');
      return;
    }

    // Validate phone number format
    if (!this.validatePhoneNumber(this.newOrganiser.phone)) {
      this.showErrorMessage('Please enter a valid phone number (10-11 digits)');
      return;
    }

    // If phone number check is still in progress or phone is invalid, don't submit
    if (this.isCheckingPhone || !this.isPhoneValid) {
      if (!this.isPhoneValid) {
        this.showErrorMessage(this.phoneErrorMessage);
      } else {
        this.showErrorMessage('Please wait while we validate the phone number');
      }
      return;
    }

    // Set loading state
    this.isLoading = true;

    // Create new organiser object
    const newOrganiser = {
      username: this.newOrganiser.username,
      email: this.newOrganiser.email,
      phone: this.newOrganiser.phone,
      organization: this.newOrganiser.organization,
      organizerName: this.newOrganiser.organizerName
    };

    // Call the organizer service to register the new organizer
    this.organizerService.registerOrganizer(newOrganiser).subscribe({
      next: (response) => {
        // Add to list
        this.organisers.push(response.organizer);
        
        // Reset form
        this.newOrganiser = {
          username: '',
          email: '',
          phone: '',
          organization: '',
          organizerName: ''
        };

        // Show success message
        this.isLoading = false;
        this.showSuccessMessage('Organiser account created successfully. Welcome email has been sent.');
      },
      error: (error) => {
        this.isLoading = false;
        
        // Handle specific error cases
        if (error.status === 400) {
          this.showErrorMessage(error.error.error || 'Organizer registration failed due to validation errors.');
        } else {
          this.showErrorMessage('An error occurred while creating the organizer account. Please try again.');
        }
        
        console.error('Error registering organizer:', error);
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  navigateToSettings(): void {
    console.log('Navigate to settings clicked');
    
    // Try multiple navigation approaches
    try {
      // First, try Angular Router navigation
      this.router.navigate(['/admin-settings'])
        .then(success => {
          console.log('Navigation result:', success);
          if (!success) {
            // If router navigation returns false (navigation prevented), try direct browser navigation
            console.log('Router navigation unsuccessful, trying direct URL change');
            window.location.href = '/admin-settings';
          }
        })
        .catch(error => {
          console.error('Navigation error:', error);
          // Fallback to direct browser navigation
          window.location.href = '/admin-settings';
        });
    } catch (error) {
      console.error('Navigation exception:', error);
      // Ultimate fallback
      window.location.href = '/admin-settings';
    }
  }
}
