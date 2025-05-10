import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';

interface Waitlist {
  waitlist_id: string;
  event_id: string;
  name: string;
  email: string;
  contact: string;
  created_at: Date;
  status: 'waiting' | 'notified' | 'registered';
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
  selector: 'app-waitlist-management',
  templateUrl: './waitlist-management.component.html',
  styleUrls: ['./waitlist-management.component.css']
})
export class WaitlistManagementComponent implements OnInit {
  waitlistEntries: Waitlist[] = [];
  events: Event[] = [];
  selectedEventId: string = '';
  isLoading: boolean = false;
  isNotifying: boolean = false;
  errorMessage: string = '';
  isSidebarCollapsed: boolean = false;
  currentUser: User | null = null;
  activeDropdown: number | null = null;
  notificationResult: any = null;
  
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
        
        // Load waitlist entries for the selected event
        if (this.selectedEventId) {
          this.loadWaitlistEntries();
        }
      },
      error: (error) => {
        console.error('Error loading events:', error);
        this.errorMessage = 'Failed to load events. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  loadWaitlistEntries(): void {
    if (!this.selectedEventId) return;
    
    this.isLoading = true;
    this.waitlistEntries = [];
    this.errorMessage = '';
    
    this.http.get<any>(`${this.API_URL}/waitlist/event/${this.selectedEventId}`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.waitlistEntries = response.data;
        } else {
          this.waitlistEntries = [];
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading waitlist entries:', error);
        this.errorMessage = 'Failed to load waitlist entries. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  onEventChange(): void {
    this.loadWaitlistEntries();
    
    // Update URL to reflect selected event
    if (this.selectedEventId) {
      this.router.navigate(['/waitlist-management', this.selectedEventId]);
    } else {
      this.router.navigate(['/waitlist-management']);
    }
  }

  updateStatus(entry: Waitlist, newStatus: 'waiting' | 'notified' | 'registered'): void {
    this.isLoading = true;
    this.activeDropdown = null; // Close dropdown after action
    
    this.http.patch(`${this.API_URL}/waitlist/${entry.waitlist_id}`, { status: newStatus }).subscribe({
      next: (response: any) => {
        if (response.success) {
          // Update the entry in the local array
          entry.status = newStatus;
          this.snackBar.open('Status updated successfully', 'Close', { duration: 3000 });
        } else {
          this.snackBar.open('Failed to update status', 'Close', { duration: 3000 });
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error updating status:', error);
        this.snackBar.open('Error updating status', 'Close', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  removeFromWaitlist(entry: Waitlist): void {
    if (confirm(`Are you sure you want to remove ${entry.name} from the waitlist?`)) {
      this.isLoading = true;
      this.activeDropdown = null; // Close dropdown after action
      
      this.http.delete(`${this.API_URL}/waitlist/${entry.waitlist_id}`).subscribe({
        next: (response: any) => {
          if (response.success) {
            // Remove the entry from the local array
            this.waitlistEntries = this.waitlistEntries.filter(e => e.waitlist_id !== entry.waitlist_id);
            this.snackBar.open('Removed from waitlist successfully', 'Close', { duration: 3000 });
          } else {
            this.snackBar.open('Failed to remove from waitlist', 'Close', { duration: 3000 });
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error removing from waitlist:', error);
          this.snackBar.open('Error removing from waitlist', 'Close', { duration: 3000 });
          this.isLoading = false;
        }
      });
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'waiting': return 'status-waiting';
      case 'notified': return 'status-notified';
      case 'registered': return 'status-registered';
      default: return '';
    }
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleString();
  }
  
  /**
   * Notify waitlisted users about available tickets
   */
  notifyWaitlistedUsers(): void {
    if (!this.selectedEventId) return;
    
    this.isNotifying = true;
    this.notificationResult = null;
    
    this.http.post<any>(`${this.API_URL}/waitlist/notify/${this.selectedEventId}`, {}).subscribe({
      next: (response) => {
        this.notificationResult = response;
        this.isNotifying = false;
        
        // If notification was successful, refresh the waitlist to show updated statuses
        if (response.success) {
          this.loadWaitlistEntries();
          this.snackBar.open('Notification process completed successfully', 'Close', { duration: 3000 });
        } else {
          this.snackBar.open('Notification process failed: ' + response.message, 'Close', { duration: 5000 });
        }
      },
      error: (error) => {
        console.error('Error notifying waitlisted users:', error);
        this.isNotifying = false;
        this.notificationResult = {
          success: false,
          message: error.error?.message || 'Failed to process notifications. Please try again later.'
        };
        this.snackBar.open('Error notifying waitlisted users', 'Close', { duration: 3000 });
      }
    });
  }
}