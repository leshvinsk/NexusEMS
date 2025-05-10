import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';

interface Attendee {
  booking_id: string;
  user_id: string;
  event_id: string;
  booking_date: Date;
  payment_status: string;
  user_name: string;
  user_email: string;
  ticket_type: string;
  ticket_price: number;
  seat_number?: string;
}

interface Event {
  pk_event_id: string;
  event_name: string;
}

interface User {
  username: string;
  role: string;
}

@Component({
  selector: 'app-attendee-list',
  templateUrl: './attendee-list.component.html',
  styleUrls: ['./attendee-list.component.css']
})
export class AttendeeListComponent implements OnInit {
  attendees: Attendee[] = [];
  events: Event[] = [];
  selectedEventId: string = '';
  isLoading: boolean = false;
  isCancelling: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  isSidebarCollapsed: boolean = false;
  currentUser: User | null = null;
  activeDropdown: number | null = null;
  showConfirmDialog: boolean = false;
  confirmDialogTitle: string = '';
  confirmDialogMessage: string = '';
  attendeeToCancel: Attendee | null = null;
  
  private readonly API_URL = 'http://localhost:5001/api';

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    // Get current user from auth service (handles decryption)
    const userData = this.authService.getCurrentUser();
    if (userData && userData.username) {
      this.currentUser = {
        username: userData.username,
        role: localStorage.getItem('userRole') || 'organizer'
      };
      console.log('Current user loaded from auth service:', this.currentUser);
    } else {
      // Fallback to localStorage checks
      const encryptedUserData = localStorage.getItem('loggedUser');
      if (encryptedUserData) {
        try {
          // First attempt to parse directly if not encrypted
          if (encryptedUserData.startsWith('{')) {
            const parsedData = JSON.parse(encryptedUserData);
            if (parsedData && parsedData.username) {
              this.currentUser = {
                username: parsedData.username,
                role: localStorage.getItem('userRole') || 'organizer'
              };
              console.log('Current user loaded from direct parsing:', this.currentUser);
            }
          } else {
            // It might be encrypted, but we already tried the authService
            console.log('Data appears to be encrypted, but auth service could not decrypt it');
            this.currentUser = { username: 'User', role: 'organizer' };
          }
        } catch (e) {
          console.error('Error parsing user data from localStorage:', e);
          this.currentUser = { username: 'User', role: 'organizer' };
        }
      } else {
        console.log('No user data found in localStorage');
        this.currentUser = { username: 'User', role: 'organizer' };
      }
    }
    
    // Check if event ID is provided in the route
    this.route.paramMap.subscribe(params => {
      const eventId = params.get('id');
      if (eventId) {
        this.selectedEventId = eventId;
      }
      
      this.loadEvents();
    });
    
    // Get sidebar state from localStorage
    const sidebarState = localStorage.getItem('sidebarCollapsed');
    if (sidebarState) {
      this.isSidebarCollapsed = sidebarState === 'true';
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
      if (!(event.target as HTMLElement).closest('.dropdown')) {
        this.activeDropdown = null;
      }
    });
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    localStorage.setItem('sidebarCollapsed', this.isSidebarCollapsed.toString());
  }

  logout(): void {
    // Use AuthService for a standardized logout process
    this.authService.logout();
  }

  toggleDropdown(index: number): void {
    if (this.activeDropdown === index) {
      this.activeDropdown = null;
    } else {
      this.activeDropdown = index;
    }
  }

  loadEvents(): void {
    this.isLoading = true;
    this.http.get<any>(`${this.API_URL}/events`).subscribe({
      next: (response) => {
        // Handle different response formats
        if (Array.isArray(response)) {
          this.events = response;
        } else if (response.data && Array.isArray(response.data)) {
          this.events = response.data;
        } else {
          this.events = [];
          console.error('Unexpected response format:', response);
        }
        
        this.isLoading = false;
        
        // If there are events and no event is selected, select the first one by default
        if (this.events.length > 0 && !this.selectedEventId) {
          this.selectedEventId = this.events[0].pk_event_id;
        }
        
        // Load attendees for the selected event
        if (this.selectedEventId) {
          this.loadAttendees();
        }
      },
      error: (error) => {
        console.error('Error loading events:', error);
        this.errorMessage = 'Failed to load events. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  loadAttendees(): void {
    if (!this.selectedEventId) return;
    
    this.isLoading = true;
    this.attendees = [];
    this.errorMessage = '';
    
    this.http.get<any>(`${this.API_URL}/bookings/event/${this.selectedEventId}`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.attendees = response.data;
        } else {
          this.attendees = [];
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading attendees:', error);
        this.errorMessage = 'Failed to load attendees. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  onEventChange(): void {
    this.loadAttendees();
    
    // Update URL to reflect selected event
    if (this.selectedEventId) {
      this.router.navigate(['/attendee-list', this.selectedEventId]);
    } else {
      this.router.navigate(['/attendee-list']);
    }
  }

  showCancelConfirmation(attendee: Attendee): void {
    this.attendeeToCancel = attendee;
    this.confirmDialogTitle = 'Cancel Booking';
    this.confirmDialogMessage = `Are you sure you want to cancel the booking for ${attendee.user_name}? This will free up the ticket and seat for waitlisted users.`;
    this.showConfirmDialog = true;
    this.activeDropdown = null; // Close dropdown
  }

  onConfirmDialogResponse(confirmed: boolean): void {
    this.showConfirmDialog = false;
    
    if (confirmed && this.attendeeToCancel) {
      this.cancelBooking(this.attendeeToCancel);
    }
    
    this.attendeeToCancel = null;
  }

  cancelBooking(attendee: Attendee): void {
    this.isCancelling = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    this.http.delete<any>(`${this.API_URL}/bookings/${attendee.booking_id}`).subscribe({
      next: (response) => {
        if (response.success) {
          // Remove the attendee from the local array
          this.attendees = this.attendees.filter(a => a.booking_id !== attendee.booking_id);
          
          this.successMessage = `Booking for ${attendee.user_name} has been cancelled successfully.`;
          this.snackBar.open('Booking cancelled successfully', 'Close', { duration: 3000 });
          
          // Notify waitlisted users if there are any
          this.notifyWaitlistedUsers();
        } else {
          this.errorMessage = response.message || 'Failed to cancel booking.';
          this.snackBar.open('Failed to cancel booking', 'Close', { duration: 3000 });
        }
        this.isCancelling = false;
      },
      error: (error) => {
        console.error('Error cancelling booking:', error);
        this.errorMessage = error.error?.message || 'An error occurred while cancelling the booking.';
        this.snackBar.open('Error cancelling booking', 'Close', { duration: 3000 });
        this.isCancelling = false;
      }
    });
  }

  notifyWaitlistedUsers(): void {
    if (!this.selectedEventId) return;
    
    console.log(`Checking for waitlisted users to notify for event ${this.selectedEventId}`);
    
    this.http.post<any>(`${this.API_URL}/waitlist/notify/${this.selectedEventId}`, {}).subscribe({
      next: (response) => {
        console.log('Waitlist notification response:', response);
        
        if (response.success) {
          if (response.notifiedUsers && response.notifiedUsers.length > 0) {
            this.snackBar.open(`${response.notifiedUsers.length} waitlisted users have been notified of available tickets`, 'Close', { duration: 5000 });
          } else if (response.message) {
            console.log(response.message);
          }
        }
      },
      error: (error) => {
        console.error('Error notifying waitlisted users:', error);
      }
    });
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleString();
  }

  getPaymentStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'paid': return 'status-paid';
      case 'pending': return 'status-pending';
      case 'failed': return 'status-failed';
      default: return '';
    }
  }
}