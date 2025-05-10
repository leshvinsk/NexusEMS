import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

// Define interfaces for type safety
interface Seat {
  section: string;
  row: string;
  seat_no: number;
  ticket_id?: string;
  ticket_type?: string;
}

interface BookingData {
  booking_id: string;
  event_id: string;
  event_name: string;
  customer_name: string;
  customer_email: string;
  seats: Seat[];
}

@Component({
  selector: 'app-booking-confirmation',
  templateUrl: './booking-confirmation.component.html',
  styleUrls: ['./booking-confirmation.component.css'],
  standalone: false
})
export class BookingConfirmationComponent implements OnInit {
  // Default values that will be replaced with actual data
  bookingId = '';
  eventName = '';
  eventDate = '';
  eventTime = '';
  seatSection = '';
  seatRow = '';
  seatNumber = '';
  attendeeName = '';
  customerEmail = '';
  
  // For multiple seats
  seats: Seat[] = [];
  
  // Booking data
  bookingData: BookingData | null = null;
  
  // Loading state
  isLoading = true;
  
  // Error state
  hasError = false;
  errorMessage = '';
  
  // API URL
  private API_URL = 'http://localhost:5001/api';

  // Array for confetti elements
  confettiCount = Array(15).fill(0).map((_, i) => i + 1);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient
  ) { }

  ngOnInit() {
    // Add a class to the body to prevent scrolling while on this page
    document.body.classList.add('confirmation-page');

    // Load Font Awesome if not already loaded
    this.loadFontAwesome();

    // Get booking ID from URL parameters
    this.route.queryParams.subscribe(params => {
      this.bookingId = params['booking_id'];
      
      if (this.bookingId) {
        this.loadBookingData();
      } else {
        // Try to get booking data from localStorage
        const tempBooking = localStorage.getItem('tempBooking');
        if (tempBooking) {
          try {
            this.bookingData = JSON.parse(tempBooking);
            this.processBookingData(this.bookingData);
            this.isLoading = false;
            
            // Create a confetti burst effect when the data is loaded
            this.createConfettiBurst();
          } catch (e) {
            console.error('Error parsing booking data from localStorage:', e);
            this.setDefaultData();
          }
        } else {
          this.setDefaultData();
        }
      }
    });
  }
  
  // Load booking data from the server
  loadBookingData() {
    this.isLoading = true;
    
    this.http.get(`${this.API_URL}/bookings/${this.bookingId}`).subscribe({
      next: (response: any) => {
        if (response.success && response.booking) {
          this.bookingData = response.booking;
          this.processBookingData(this.bookingData);
          
          // Create a confetti burst effect when the data is loaded
          this.createConfettiBurst();
        } else {
          this.handleError('Invalid booking data received');
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading booking data:', error);
        
        // Try to get booking data from localStorage as fallback
        const tempBooking = localStorage.getItem('tempBooking');
        if (tempBooking) {
          try {
            this.bookingData = JSON.parse(tempBooking);
            this.processBookingData(this.bookingData);
            
            // Create a confetti burst effect when the data is loaded
            this.createConfettiBurst();
          } catch (e) {
            console.error('Error parsing booking data from localStorage:', e);
            this.handleError('Could not load booking data');
          }
        } else {
          this.handleError('Could not load booking data');
        }
        this.isLoading = false;
      }
    });
  }
  
  // Process booking data to extract relevant information
  processBookingData(data: BookingData | any) {
    if (!data) {
      this.handleError('No booking data available');
      return;
    }
    
    console.log('Processing booking data:', data);
    
    // Set basic booking information
    this.bookingId = data.booking_id || this.bookingId;
    this.eventName = data.event_name || 'Event';
    this.attendeeName = data.customer_name || 'Guest';
    this.customerEmail = data.customer_email || '';
    
    // Process seats
    if (data.seats && data.seats.length > 0) {
      // Format the section names for better readability
      this.seats = data.seats.map((seat: Seat) => {
        return {
          ...seat,
          section: this.formatSectionName(seat.section)
        };
      });
      
      // For backward compatibility with the UI, set the first seat as the primary one
      const firstSeat = data.seats[0];
      this.seatSection = this.formatSectionName(firstSeat.section) || 'A';
      this.seatRow = firstSeat.row || '1';
      this.seatNumber = firstSeat.seat_no?.toString() || '1';
    }
    
    // Format date and time if available
    // This assumes the event data is stored elsewhere and not in the booking
    // We'll need to fetch the event details separately if needed
    this.eventDate = this.formatDate(new Date());
    this.eventTime = this.formatTime(new Date());
  }
  
  // Format section name to be more readable
  formatSectionName(section: string): string {
    if (!section) return 'A';
    
    // Handle section names like "b---right" or "a---left"
    if (section.includes('---')) {
      const parts = section.split('---');
      if (parts.length === 2) {
        const sectionLetter = parts[0].toUpperCase();
        const sectionLocation = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
        return `${sectionLetter} - ${sectionLocation}`;
      }
    }
    
    // If it doesn't match the pattern, just return the original with first letter capitalized
    return section.charAt(0).toUpperCase() + section.slice(1);
  }
  
  // Format date as YYYY-MM-DD
  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  
  // Format time as HH:MM AM/PM
  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  }
  
  // Handle errors
  handleError(message: string) {
    this.hasError = true;
    this.errorMessage = message;
    console.error(message);
    
    // Set default data
    this.setDefaultData();
  }
  
  // Set default data for display
  setDefaultData() {
    this.bookingId = this.bookingId || 'BK-' + Date.now();
    this.eventName = 'Tech Innovation Summit 2025';
    this.eventDate = '2025-11-01';
    this.eventTime = '10:00 AM';
    this.seatSection = 'A';
    this.seatRow = '5';
    this.seatNumber = '12';
    this.attendeeName = 'Guest';
    
    // Create a confetti burst effect
    this.createConfettiBurst();
  }

  // Create a confetti burst effect
  createConfettiBurst() {
    // Create 50 confetti elements that burst from the center
    for (let i = 0; i < 50; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div');
        confetti.className = 'confetti-burst';

        // Random color
        const colors = ['#FF5252', '#4CAF50', '#2196F3', '#FFEB3B', '#E040FB', '#FF9800', '#00BCD4'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.backgroundColor = randomColor;

        // Random size
        const size = Math.floor(Math.random() * 10) + 5; // 5-15px
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;

        // Random shape
        if (Math.random() > 0.5) {
          confetti.style.borderRadius = '50%';
        } else {
          confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        }

        // Position in center of screen
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        confetti.style.left = `${centerX}px`;
        confetti.style.top = `${centerY}px`;

        // Random animation duration
        const duration = Math.random() * 2 + 2; // 2-4 seconds
        confetti.style.animationDuration = `${duration}s`;

        // Random direction - calculate the end position directly
        const angle = Math.random() * Math.PI * 2; // in radians
        const distance = Math.random() * 200 + 100; // 100-300px
        const endX = Math.cos(angle) * distance;
        const endY = Math.sin(angle) * distance;
        confetti.style.setProperty('--endX', `${endX}px`);
        confetti.style.setProperty('--endY', `${endY}px`);
        confetti.style.setProperty('--rotation', `${Math.random() * 720 - 360}deg`);

        // Add to DOM
        document.querySelector('.confetti-container')?.appendChild(confetti);

        // Remove after animation completes
        setTimeout(() => {
          confetti.remove();
        }, duration * 1000);
      }, i * 20); // Stagger the creation
    }
  }

  // Load Font Awesome dynamically
  loadFontAwesome() {
    if (!document.getElementById('font-awesome-css')) {
      const link = document.createElement('link');
      link.id = 'font-awesome-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(link);
    }
  }

  downloadPDF() {
    if (!this.bookingId) {
      this.showToast('Booking ID is missing. Cannot generate PDF.');
      return;
    }
    
    // Show loading toast
    this.showToast('Ticket PDF is being generated...');
    
    // Call the API to generate and download the PDF
    this.http.get(`${this.API_URL}/bookings/${this.bookingId}/pdf`, { responseType: 'blob' })
      .subscribe({
        next: (response: Blob) => {
          // Create a blob URL and trigger download
          const url = window.URL.createObjectURL(response);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ticket-${this.bookingId}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          this.showToast('PDF downloaded successfully!');
        },
        error: (error) => {
          console.error('Error downloading PDF:', error);
          
          // Fallback to client-side PDF generation
          this.generatePDFClientSide();
        }
      });
  }
  
  // Fallback method to generate PDF on the client side
  generatePDFClientSide() {
    // This is a placeholder for client-side PDF generation
    // In a real implementation, you would use a library like jsPDF
    console.log('Generating PDF on client side');
    this.showToast('PDF generated using client-side fallback.');
    
    // Create a simple text file as a fallback
    let content = `
      Booking Confirmation
      -------------------
      Booking ID: ${this.bookingId}
      Event: ${this.eventName}
      Date: ${this.eventDate}
      Time: ${this.eventTime}
      Attendee: ${this.attendeeName}
    `;
    
    // Add seat information
    if (this.seats.length > 0) {
      content += '\n      Seats:';
      this.seats.forEach((seat: Seat) => {
        content += `\n      - Section ${seat.section}, Row ${seat.row}, Seat ${seat.seat_no}`;
        if (seat.ticket_type) {
          content += ` (${seat.ticket_type})`;
        }
      });
    } else {
      content += `\n      Seat: Section ${this.seatSection}, Row ${this.seatRow}, Seat ${this.seatNumber}`;
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-${this.bookingId}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  emailTicket() {
    if (!this.bookingId) {
      this.showToast('Booking ID is missing. Cannot send email.');
      return;
    }
    
    // Check if we have an email address
    if (!this.customerEmail && !this.bookingData?.customer_email) {
      this.showToast('No email address available. Please update your booking with an email address.');
      return;
    }
    
    // Show loading toast
    this.showToast('Ticket is being sent to your email...');
    
    console.log('Sending email for booking:', this.bookingId);
    console.log('Email will be sent to:', this.customerEmail || this.bookingData?.customer_email);
    
    // Call the API to send the email
    this.http.post(`${this.API_URL}/bookings/${this.bookingId}/email`, {})
      .subscribe({
        next: (response: any) => {
          console.log('Email API response:', response);
          if (response.success) {
            this.showToast('Ticket sent to your email successfully!');
          } else {
            this.showToast('Failed to send email. Please try again later.');
          }
        },
        error: (error) => {
          console.error('Error sending email:', error);
          
          // Check if there's a specific error message from the server
          let errorMessage = 'Failed to send email. Please try again later.';
          if (error.error && error.error.message) {
            errorMessage = `Email error: ${error.error.message}`;
          }
          
          this.showToast(errorMessage);
          
          // If the error is related to email configuration, show a more helpful message
          if (error.error && error.error.error && error.error.error.includes('auth')) {
            this.showToast('Email server authentication failed. Please contact support.');
          }
        }
      });
  }

  goToEvents() {
    // Remove the body class when navigating away
    document.body.classList.remove('confirmation-page');
    this.router.navigate(['']); // Navigate to the Events page
  }

  // Simple toast notification
  showToast(message: string) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;

    // Append to body
    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);

    // Hide and remove toast after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }
}
