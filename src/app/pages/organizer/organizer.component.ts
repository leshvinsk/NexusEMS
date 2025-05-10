import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { EventService } from '../../services/event.service';
import { AppEvent } from '../../app-event.model'; 

interface UploadedImage {
  filename: string;
  data: ArrayBuffer;
  contentType: string;
}

@Component({
  selector: 'app-organizer',
  templateUrl: './organizer.component.html',
  styleUrls: ['./organizer.component.css'],
  standalone: false
})
export class OrganizerComponent implements OnInit {
  isSidebarCollapsed = false;
  currentUser: any = null;
  isLoading = false;
  errorMessage = '';
  showError = false;
  successMessage = '';
  showSuccess = false;
  selectedFiles: UploadedImage[] = [];
  readonly MAX_FILES = 5;
  readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
  
  // Confirmation Dialog
  showConfirmDialog = false;
  confirmDialogTitle = '';
  confirmDialogMessage = '';
  confirmDialogCallback: (() => void) | null = null;
  
  // Ticket Type Dialog
  showTicketDialog = false;
  editingEvent: AppEvent | null = null;
  newTicketType = {
    name: '',
    price: 0,
    color: '#808080' // Default grey color
  };
  
  // Events
  events: AppEvent[] = [];
  
  // New Event Form
  newEvent = {
    event_name: '',
    event_description: '',
    event_date: '',
    start_time: '',
    end_time: ''
  };

  // Track existing event dates
  existingEventDates: Set<string> = new Set();

  constructor(
    private router: Router,
    private authService: AuthService,
    private http: HttpClient,
    private eventService: EventService
  ) { }

  ngOnInit(): void {
    // Get the current user from the auth service
    this.currentUser = this.authService.getCurrentUser();
    console.log('Current organizer user:', this.currentUser);
    
    // Load events from database
    this.loadEvents();
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  loadEvents() {
    this.isLoading = true;
    console.log('Loading events for organizer:', this.currentUser.id);
    
    // Use the new method to get only events for this organizer
    this.eventService.getEventsByOrganizerId(this.currentUser.id).subscribe(
      (data: AppEvent[]) => {
        this.events = data;
        console.log('Loaded events:', this.events.length);
        
        // Update existing event dates
        this.existingEventDates.clear();
        this.events.forEach(event => {
          const eventDate = this.extractDate(event.start_date_time);
          this.existingEventDates.add(eventDate);
          
          if (event.files && event.files.length > 0) {
            const file = event.files[0];
            console.log('File data before conversion:', file.data);
            file.data = this.bufferToArrayBuffer(file.data);
            console.log('File data after conversion:', file.data);
            // Only keep the first file
            event.files = [file];
          }
        });
        this.isLoading = false;
      },
      (error) => {
        console.error('Error fetching events for organizer', error);
        this.isLoading = false;
        this.showErrorMessage('Failed to load your events. Please try again later.');
      }
    );
  }

  bufferToArrayBuffer(buffer: any): ArrayBuffer {
    if (buffer.data) {
      buffer = buffer.data;
    }
    const arrayBuffer = new ArrayBuffer(buffer.length);
    const view = new Uint8Array(arrayBuffer);
    for (let i = 0; i < buffer.length; ++i) {
      view[i] = buffer[i];
    }
    return arrayBuffer;
  }

  // Extract date from Date object
  extractDate(dateTime: Date): string {
    return new Date(dateTime).toISOString().split('T')[0];
  }

  // Extract time from Date object
  extractTime(dateTime: Date): string {
    return new Date(dateTime).toISOString().split('T')[1].substring(0, 5);
  }

  // Show error message with a popup
  showErrorMessage(message: string) {
    this.errorMessage = message;
    this.showError = true;
    setTimeout(() => {
      this.showError = false;
    }, 5000); // Hide after 5 seconds
  }

  // Show success message with a popup
  showSuccessMessage(message: string) {
    this.successMessage = message;
    this.showSuccess = true;
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

  // Delete event with confirmation
  deleteEvent(event: AppEvent) {
    if (!event.pk_event_id) {
      this.showErrorMessage('Cannot delete event. Invalid ID.');
      return;
    }

    this.showConfirmationDialog(
      'Delete Event',
      `Are you sure you want to delete event "${event.event_name}"? This action cannot be undone.`,
      () => {
        this.isLoading = true;
        
        // Call the event service to delete the event
        this.eventService.deleteEvent(event.pk_event_id.toString()).subscribe(
          () => {
            // Remove the event from the local array
            this.events = this.events.filter(e => e.pk_event_id !== event.pk_event_id);
            this.isLoading = false;
            this.showSuccessMessage(`Event "${event.event_name}" has been successfully deleted.`);
          },
          (error) => {
            console.error('Error deleting event', error);
            this.isLoading = false;
            this.showErrorMessage(`Failed to delete event: ${error.message || 'Unknown error'}`);
          }
        );
      }
    );
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const remainingSlots = this.MAX_FILES - this.selectedFiles.length;
      const files = Array.from(input.files).slice(0, remainingSlots);

      files.forEach(file => {
        // Check file size
        if (file.size > this.MAX_FILE_SIZE) {
          alert(`File ${file.name} is too large. Maximum size is 5MB.`);
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            const buffer = e.target.result as ArrayBuffer;
            console.log('File read:', file.name, 'ArrayBuffer length:', buffer.byteLength);
            this.selectedFiles.push({
              filename: file.name,
              data: buffer,
              contentType: file.type
            });
          }
        };
        reader.readAsArrayBuffer(file);
      });

      // Clear input to allow uploading the same file again
      input.value = '';
    }
  }

  getBase64Image(file: UploadedImage): string {
    console.log('File:', file);

    if (!file.data || file.data.byteLength === 0) {
      console.error('file data is empty');
      return '';
    }

    // Convert ArrayBuffer to Uint8Array
    const uint8Array = new Uint8Array(file.data);
    console.log('Uint8Array length:', uint8Array.length);

    // Convert Uint8Array to binary string
    const binary = uint8Array.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
    console.log('Binary string length:', binary.length);
    
    const base64String = btoa(binary);
    console.log('Base64:', base64String);
    
    return `data:${file.contentType};base64,${base64String}`;
  }

  removeImage(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get minimum allowed date (7 days from today)
  getMinDate(): string {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 7);
    return minDate.toISOString().split('T')[0];
  }

  // Check if a date already has events
  isDateTaken(date: string): boolean {
    if (!date) return false;
    return this.existingEventDates.has(date);
  }

  // Validate event date
  validateEventDate(date: string): { isValid: boolean; message: string } {
    if (!date) {
      return { isValid: false, message: 'Please select a date' };
    }

    const selectedDate = new Date(date);
    const today = new Date();
    const minAllowedDate = new Date();
    minAllowedDate.setDate(minAllowedDate.getDate() + 7);

    // Reset time part for comparison
    selectedDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    minAllowedDate.setHours(0, 0, 0, 0);

    if (selectedDate < minAllowedDate) {
      return { isValid: false, message: 'Event date must be at least 7 days from today' };
    }

    if (this.isDateTaken(date)) {
      return { isValid: false, message: 'This date already has events scheduled' };
    }

    return { isValid: true, message: '' };
  }

  // Validate event time
  validateEventTime(startTime: string, endTime: string): { isValid: boolean; message: string } {
    if (!startTime || !endTime) {
      return { isValid: false, message: 'Please select both start and end times' };
    }

    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    // Convert times to minutes for easier comparison
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;

    // Check if times are within business hours (9 AM to 9 PM)
    const businessStartMinutes = 9 * 60; // 9 AM
    const businessEndMinutes = 21 * 60; // 9 PM

    if (startTotalMinutes < businessStartMinutes) {
      return { isValid: false, message: 'Event cannot start before 9:00 AM' };
    }

    if (endTotalMinutes > businessEndMinutes) {
      return { isValid: false, message: 'Event cannot end after 9:00 PM' };
    }

    // Check if end time is after start time
    if (endTotalMinutes <= startTotalMinutes) {
      return { isValid: false, message: 'End time must be later than start time' };
    }

    // Calculate duration in minutes
    const duration = endTotalMinutes - startTotalMinutes;

    // Check if duration is at least 1 hour (60 minutes)
    if (duration < 60) {
      return { isValid: false, message: 'Event duration must be at least 1 hour' };
    }

    return { isValid: true, message: '' };
  }

  // Submit new event
  onSubmit(form: any) {
    // Validate form
    if (!form.valid) {
      this.showErrorMessage('Please fill in all fields');
      return;
    }

    // Validate event date
    const dateValidation = this.validateEventDate(form.value.event_date);
    if (!dateValidation.isValid) {
      this.showErrorMessage(dateValidation.message);
      return;
    }

    // Validate event time
    const timeValidation = this.validateEventTime(form.value.start_time, form.value.end_time);
    if (!timeValidation.isValid) {
      this.showErrorMessage(timeValidation.message);
      return;
    }

    // Set loading state
    this.isLoading = true;

    const today = new Date(form.value.event_date); // Get the event date from the form and create a Date object

    // Convert time values into valid ISO date-time format
    const startDateTime = new Date(`${today.toISOString().split('T')[0]}T${form.value.start_time}:00Z`); // Combine event date and start time into a single Date object
    const endDateTime = new Date(`${today.toISOString().split('T')[0]}T${form.value.end_time}:00Z`); // Combine event date and end time into a single Date object

    // Prepare form data for API submission
    const formData = new FormData();
    formData.append('event_name', form.value.event_name);
    formData.append('start_date_time', startDateTime.toISOString());
    formData.append('end_date_time', endDateTime.toISOString());
    formData.append('description', form.value.event_description);
    formData.append('organizer_id', this.currentUser.id);
    
    // Add empty ticket types and discounts arrays
    formData.append('ticketTypes', JSON.stringify([]));
    formData.append('discounts', JSON.stringify([]));
    formData.append('seatLayouts', JSON.stringify([]));

    // Add files to form data
    this.selectedFiles.forEach(file => {
      const blob = new Blob([file.data], { type: file.contentType });
      formData.append('files', blob, file.filename);
    });

    console.log('Creating event with data:', formData);
    console.log('Sending request to API URL:', 'http://localhost:5001/api/events');

    // Send a POST request to the server to create the event using the EventService
    this.eventService.createEvent(formData).subscribe(
      (response: any) => {
        console.log('Event created successfully', response);

        // Reset form
        this.newEvent = {
          event_name: '',
          event_description: '',
          event_date: '',
          start_time: '',
          end_time: ''
        };
        
        // Clear selected files
        this.selectedFiles = [];

        // Show success message
        this.showSuccessMessage('Event created successfully. You can now manage it from the list.');
        this.isLoading = false;

        // Load events from database to refresh the list
        this.loadEvents();
      },
      (error) => {
        console.error('Error creating event', error);
        
        let errorMessage = 'Unknown error occurred';
        
        if (error.error && typeof error.error === 'object') {
          // If the error contains a detailed message from the server
          if (error.error.message) {
            errorMessage = error.error.message;
          }
          
          // Check for validation errors
          if (error.error.errors) {
            try {
              // Handle mongoose validation errors
              const validationErrors = Object.values(error.error.errors)
                .map((err: any) => err.message || err.toString())
                .join(', ');
              errorMessage = `Validation errors: ${validationErrors}`;
            } catch (e) {
              console.error('Error processing validation errors:', e);
            }
          }
        } else if (error.status === 0) {
          errorMessage = 'Server is not responding. Please check if the server is running.';
        } else if (error.status) {
          errorMessage = `Server error (${error.status}): ${error.statusText || error.message || 'Unknown error'}`;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        this.showErrorMessage(`Error creating event: ${errorMessage}`);
        this.isLoading = false;
      }
    );
  }

  // Edit event - redirect to ticket setup page
  editEvent(event: AppEvent): void {
    console.log('Editing event:', event);
    
    // Navigate to ticket-setup page with event data
    this.router.navigate(['/ticket-setup'], {
      state: {
        eventData: event
      }
    });
  }
  
  // Add a new ticket type to the editing event
  addTicketType(): void {
    if (!this.editingEvent) return;
    
    // Validate input
    if (!this.newTicketType.name || this.newTicketType.price <= 0) {
      this.showErrorMessage('Please enter a valid ticket name and price');
      return;
    }
    
    // Generate a unique ID for the ticket type
    const ticketId = `T-${Date.now()}`;
    
    // Create the ticket type object
    const ticketType = {
      type: ticketId,
      name: this.newTicketType.name,
      price: this.newTicketType.price,
      color: this.newTicketType.color
    };
    
    // Add to the editing event's ticket types
    if (!this.editingEvent.ticketTypes) {
      this.editingEvent.ticketTypes = [];
    }
    
    this.editingEvent.ticketTypes.push(ticketType);
    
    // Reset the form
    this.newTicketType = {
      name: '',
      price: 0,
      color: '#808080'
    };
  }
  
  // Remove a ticket type from the editing event
  removeTicketType(index: number): void {
    if (!this.editingEvent || !this.editingEvent.ticketTypes) return;
    
    this.editingEvent.ticketTypes.splice(index, 1);
  }
  
  // Save ticket types to the event
  saveTicketTypes(): void {
    if (!this.editingEvent) return;
    
    this.isLoading = true;
    
    // Create a FormData object to send to the server
    const formData = new FormData();
    formData.append('event_id', this.editingEvent.pk_event_id.toString());
    
    // Add the ticket types as a JSON string
    if (this.editingEvent.ticketTypes) {
      formData.append('ticketTypes', JSON.stringify(this.editingEvent.ticketTypes));
    }
    
    // Update the event in the database using the EventService
    // Create a copy of the editing event to avoid modifying the original
    const eventToUpdate = { ...this.editingEvent };
    
    // Update the event in the database using the EventService
    this.eventService.updateEvent(eventToUpdate).subscribe(
      (response: any) => {
        console.log('Event updated successfully', response);
        
        // Update the event in the local array
        const index = this.events.findIndex(e => e.pk_event_id === this.editingEvent?.pk_event_id);
        if (index !== -1 && this.editingEvent) {
          this.events[index] = { ...this.editingEvent };
        }
        
        // Show success message
        this.showSuccessMessage('Ticket types updated successfully');
        this.isLoading = false;
        
        // Close the dialog
        this.showTicketDialog = false;
        this.editingEvent = null;
        
        // Reload events to get the updated data
        this.loadEvents();
      },
      (error) => {
        console.error('Error updating event', error);
        
        let errorMessage = 'Unknown error occurred';
        
        if (error.error && typeof error.error === 'object') {
          if (error.error.message) {
            errorMessage = error.error.message;
          }
        } else if (error.status === 0) {
          errorMessage = 'Server is not responding. Please check if the server is running.';
        } else if (error.status) {
          errorMessage = `Server error (${error.status}): ${error.statusText || error.message || 'Unknown error'}`;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        this.showErrorMessage(`Error updating ticket types: ${errorMessage}`);
        this.isLoading = false;
      }
    );
  }
  
  // Close ticket dialog
  closeTicketDialog(): void {
    this.showTicketDialog = false;
    this.editingEvent = null;
    this.resetNewTicketType();
  }
  
  // Reset new ticket type form
  resetNewTicketType(): void {
    this.newTicketType = {
      name: '',
      price: 0,
      color: '#808080' // Default grey color
    };
  }
  
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}