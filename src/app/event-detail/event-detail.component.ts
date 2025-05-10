import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';
import { EventService } from '../services/event.service';
import { AppEvent } from '../app-event.model';
import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
// Ensure the correct path to WaitlistFormComponent
import { WaitlistFormComponent } from '../waitlist-form/waitlist-form.component';

interface UploadedImage {
  filename: string;
  data: ArrayBuffer;
  contentType: string;
}

@Component({
  selector: 'app-event-detail',
  templateUrl: './event-detail.component.html',
  styleUrls: ['./event-detail.component.css'],
  standalone: false
})
export class EventDetailComponent implements OnInit {
  event: AppEvent | null = null;
  loading: boolean = true;
  error: string | null = null;
  loadingMessage: string = 'Loading event details...';
  loadingFinished: boolean = false;
  showScrollButton: boolean = false;
  isSoldOut: boolean = false;
  
  // API URL
  private readonly API_URL = 'http://localhost:5001/api';

  // Array for ticket data
  ticketTypes: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private eventService: EventService,
    private http: HttpClient,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      const eventId = params['id'];
      this.fetchEventDetails(eventId);
      this.fetchTicketTypes(eventId);
    });
  }
  
  // Fetch ticket types for the event
  fetchTicketTypes(eventId: string): void {
    this.http.get<any[]>(`${this.API_URL}/tickets/event/${eventId}`).subscribe({
      next: (tickets) => {
        if (tickets && tickets.length > 0) {
          // Group tickets by ticket_type
          const ticketTypeMap = new Map();
          
          tickets.forEach(ticket => {
            if (!ticketTypeMap.has(ticket.ticket_type)) {
              ticketTypeMap.set(ticket.ticket_type, {
                type: ticket.ticket_type,
                price: `$${ticket.price}`,
                total: 0,
                available: 0
              });
            }
            
            const typeData = ticketTypeMap.get(ticket.ticket_type);
            typeData.total++;
            
            if (ticket.status === 'available') {
              typeData.available++;
            }
          });
          
          // Convert map to array
          this.ticketTypes = Array.from(ticketTypeMap.values());
          
          console.log('Ticket types:', this.ticketTypes);
        } else {
          console.log('No tickets found for event:', eventId);
          this.ticketTypes = [];
        }
      },
      error: (error) => {
        console.error('Error fetching ticket types:', error);
        this.ticketTypes = [];
      }
    });
  }

  // Detect scroll position to show/hide the scroll button
  @HostListener('window:scroll', [])
  onWindowScroll() {
    // Show button when user scrolls down 300px or more
    this.showScrollButton = (window.scrollY > 300);
  }

  // Function to scroll to top
  scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  // Fetch event details using the provided ID
  private fetchEventDetails(eventId: string) {
    this.loading = true;
    this.loadingFinished = false;
    this.loadingMessage = 'Loading event details...';
    
    // Set a maximum duration for showing the loader (200ms)
    const maxLoadingTime = 200;
    const loadStartTime = Date.now();
    
    this.eventService.getEventById(eventId).subscribe(
      (data) => {
        // Process data
        this.event = data;
        if (this.event && this.event.files) {
          this.event.files.forEach(file => {
            file.data = this.bufferToArrayBuffer(file.data);
          });
        }
        
        // Check if the event is sold out
        this.checkEventAvailability(eventId);
        
        // Calculate time elapsed since loading started
        const elapsedTime = Date.now() - loadStartTime;
        
        // If loading was faster than our minimum display time, wait for the remainder
        // Otherwise hide immediately
        if (elapsedTime < maxLoadingTime) {
          setTimeout(() => {
            this.loadingFinished = true;
            this.loading = false;
          }, 0);
        } else {
          // Hide immediately if we've already shown loader long enough
          this.loadingFinished = true;
          this.loading = false;
        }
      },
      (error) => {
        console.error('Error fetching event details:', error);
        this.error = 'Failed to load event details. Please try again later.';
        this.loadingFinished = true;
        this.loading = false;
      }
    );
  }
  
  
  // Check if the event is sold out by checking available tickets
  checkEventAvailability(eventId: string): void {
    // Uncomment the real implementation and remove the testing code
    this.http.get<any[]>(`${this.API_URL}/tickets/event/${eventId}`).subscribe({
      next: (tickets) => {
        if (tickets && tickets.length > 0) {
          // Check if all tickets are booked
          const availableTickets = tickets.filter(ticket => ticket.status === 'available');
          this.isSoldOut = availableTickets.length === 0;
          console.log(`Event ${eventId} has ${availableTickets.length} available tickets`);
          console.log(`Event ${eventId} is ${this.isSoldOut ? 'sold out' : 'available'}`);
        } else {
          // If no tickets found, consider it sold out
          this.isSoldOut = true;
          console.log(`No tickets found for event ${eventId}, considering it sold out`);
        }
      },
      error: (error) => {
        console.error('Error checking event availability:', error);
        // Default to not sold out in case of error
        this.isSoldOut = false;
      }
    });
  }
  
  // Open the waitlist form dialog
  openWaitlistForm(): void {
    console.log('openWaitlistForm called');
    if (!this.event) {
      console.log('No event found');
      return;
    }
    
    try {
      console.log('Opening dialog with event:', this.event.pk_event_id, this.event.event_name);
      const dialogRef = this.dialog.open(WaitlistFormComponent, {
        width: '500px',
        data: {
          eventId: this.event.pk_event_id,
          eventName: this.event.event_name
        }
      });
     
      dialogRef.afterClosed().subscribe(result => {
        console.log('Dialog closed with result:', result);
        if (result) {
          console.log('User joined the waitlist');
        }
      });
    } catch (error) {
      console.error('Error opening dialog:', error);
    }
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

  // Extract date from ISO date-time string
  extractDate(dateTime: Date): string {
    return new Date(dateTime).toISOString().split('T')[0];
  }

  // Extract time from ISO date-time string
  extractTime(dateTime: Date): string {
    return new Date(dateTime).toISOString().split('T')[1].substring(0, 5);
  }
}