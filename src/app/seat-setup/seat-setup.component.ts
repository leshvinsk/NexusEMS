import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { AppEvent } from '../app-event.model';
import { EventService } from '../services/event.service';

interface Seat {
  id: string;
  row: string;
  number: number;
  type: string;
  price: number;
  status: 'available' | 'booked' | 'selected';
}

interface TicketType {
  id: string;
  name: string;
  price: number;
  description: string;
  color?: string;
}

interface Discount {
  id: string;
  name: string;
  percentage: number;
  ticketTypeIds?: string[];
  expiry_date?: Date;
}

interface LayoutSection {
  id: string;
  name: string;
  description: string;
}

interface SeatData {
  layout: string;
  row: string;
  seat_no: number;
}

interface SeatConfig {
  row: string;
  seatNo: number;
  ticketType: string;
  ticketTypeName: string;
  price: number;
}

interface SavedLayout {
  layout: string;
  ticketType: string;
  ticketTypeName: string;
  seats: SeatConfig[];
}

@Component({
  selector: 'app-seat-setup',
  standalone: false,
  templateUrl: './seat-setup.component.html',
  styleUrl: './seat-setup.component.css'
})
export class SeatSetupComponent implements OnInit {
  // Organizer dashboard properties
  currentUser: any;
  isSidebarCollapsed: boolean = false;

  // Toggle sidebar
  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  // UI state properties
  showLayoutConfiguredMessage: boolean = true;
  showSuccessMessage: boolean = false;
  successMessage: string = '';
  showErrorMessage: boolean = false;
  errorMessage: string = '';
  
  // Ticket status tracking
  layoutsWithBookedTickets: string[] = [];
  hasBookedTickets: boolean = false;

  // Custom alert dialog properties
  showAlertDialog: boolean = false;
  alertDialogTitle: string = '';
  alertDialogMessage: string = '';
  alertDialogCallback: ((result: boolean) => void) | null = null;
  showCancelButton: boolean = true;

  // Seat data
  seatRows: { [key: string]: Seat[] } = {};

  // Selected seats
  selectedSeats: Seat[] = [];

  // Event properties
  eventId: string = '';

  // Ticket type selection
  selectedTicketType: string = '';
  ticketTypes: TicketType[] = [
    { id: 'regular', name: 'Regular', price: 100, description: 'Standard seating', color: '#808080' }
  ];

  // Discounts from ticket setup (for reference only, not saved from this component)
  discounts: Discount[] = [];

  // Event data from ticket setup
  eventData: AppEvent | null = null;

  // Seat types and prices with default colors
  seatTypes: { [key: string]: { name: string; price: number; color: string } } = {
    regular: { name: 'Available', price: 0, color: '#808080' }  // Default grey color
  };

  // Layout-specific colors for ticket types
  layoutColors: { [key: string]: { [ticketType: string]: string } } = {
    'lf-left': { },
    'lf-center': { },
    'lf-right': { },
    'b-left': { },
    'b-center': { },
    'b-right': { }
  };

  // Current color for the selected ticket type in the UI
  currentTicketTypeColor: string = '#808080'; // Default grey color

  // Error message for color validation
  colorError: string = '';

  // Layout section properties
  layoutSections: LayoutSection[] = [
    { id: 'lf-left', name: 'LF - Left', description: 'Left section of the Lower Foyer' },
    { id: 'lf-center', name: 'LF - Center', description: 'Center section of the Lower Foyer' },
    { id: 'lf-right', name: 'LF - Right', description: 'Right section of the Lower Foyer' },
    { id: 'b-left', name: 'B - Left', description: 'Left section of the Balcony' },
    { id: 'b-center', name: 'B - Center', description: 'Center section of the Balcony' },
    { id: 'b-right', name: 'B - Right', description: 'Right section of the Balcony' }
  ];
  selectedLayout: string = '';
  
  // Saved layouts with ticket types
  savedLayouts: SavedLayout[] = [];

  private readonly API_URL = 'http://localhost:5001/api';

  constructor(
    private router: Router,
    private authService: AuthService,
    private http: HttpClient,
    private eventService: EventService
  ) {
    // Get data from router state
    const navigation = this.router.getCurrentNavigation();
    if (navigation && navigation.extras && navigation.extras.state) {
      this.eventData = navigation.extras.state['eventData'];
      const receivedTicketTypes = navigation.extras.state['ticketTypes'];
      const receivedDiscounts = navigation.extras.state['discounts'];

      console.log('Received event data:', this.eventData);
      console.log('Received ticket types:', receivedTicketTypes);
      console.log('Received discounts:', receivedDiscounts);

      if (receivedTicketTypes && receivedTicketTypes.length > 0) {
        this.ticketTypes = receivedTicketTypes;
        this.initializeSeatTypes();
      }

      // Store received discounts for reference only (not saved from this component)
      if (receivedDiscounts && receivedDiscounts.length > 0) {
        this.discounts = receivedDiscounts;
        console.log('Received discounts for reference (will not be saved from seat setup)');
      }
    } else {
      console.log('No data received from ticket setup');
    }
  }

  async ngOnInit(): Promise<void> {
    this.currentUser = this.authService.getCurrentUser();
    console.log('Current user in ngOnInit:', this.currentUser);

    // If no user is found, create a default one for testing
    if (!this.currentUser) {
      console.warn('No user found in localStorage, creating a default user for testing');
      this.currentUser = {
        id: 'default-organizer',
        organizer_id: 'default-organizer',
        username: 'default-user',
        role: 'Organizer'
      };
    }

    // Check for booked tickets first and wait for it to complete
    await this.checkForBookedTickets();
    console.log('Ticket check completed, layouts with booked tickets:', this.layoutsWithBookedTickets);
    
    // Then load seats
    this.loadSeats();
  }
  
  // Check if there are any booked tickets for the event
  checkForBookedTickets(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.eventData || !this.eventData.pk_event_id) {
        console.log('No event data available, skipping ticket check');
        resolve();
        return;
      }
      
      console.log('Checking for booked tickets for event:', this.eventData.pk_event_id);
      
      this.http.get<any[]>(`${this.API_URL}/tickets/event/${this.eventData.pk_event_id}`).subscribe({
        next: (tickets) => {
          console.log('Tickets found for event:', tickets);
          
          // Reset the layouts with booked tickets
          this.layoutsWithBookedTickets = [];
          
          // Check if any tickets have a status other than "available"
          const bookedTickets = tickets.filter(ticket => ticket.status !== 'available');
          
          if (bookedTickets.length > 0) {
            console.log('Found booked tickets:', bookedTickets);
            this.hasBookedTickets = true;
            
            // Group booked tickets by layout
            bookedTickets.forEach(ticket => {
              if (ticket.layout && !this.layoutsWithBookedTickets.includes(ticket.layout)) {
                console.log('Adding booked ticket layout to list:', ticket.layout);
                this.layoutsWithBookedTickets.push(ticket.layout);
                
                // Also check if this is a layout name and find the corresponding ID
                const layoutSection = this.layoutSections.find(section => section.name === ticket.layout);
                if (layoutSection && !this.layoutsWithBookedTickets.includes(layoutSection.id)) {
                  console.log('Also adding layout ID to list:', layoutSection.id);
                  this.layoutsWithBookedTickets.push(layoutSection.id);
                }
              }
            });
            
            console.log('Layouts with booked tickets:', this.layoutsWithBookedTickets);
          } else {
            console.log('No booked tickets found');
            this.hasBookedTickets = false;
          }
          
          resolve();
        },
        error: (error) => {
          console.error('Error checking for booked tickets:', error);
          resolve(); // Resolve even on error to continue the flow
        }
      });
    });
  }

  // Initialize seat types based on received ticket types
  initializeSeatTypes(): void {
    // Clear existing seat types
    this.seatTypes = {};

    // Add each ticket type to seatTypes with its color
    this.ticketTypes.forEach(ticket => {
      this.seatTypes[ticket.id] = {
        name: ticket.name,
        price: ticket.price,
        color: ticket.color || '#808080' // Use provided color or default to grey
      };
      
      // Also update the ticket type's color if not set
      if (!ticket.color) {
        ticket.color = '#808080'; // Set default grey color
      }
    });

    console.log('Initialized seat types:', this.seatTypes);
  }

  // Organizer dashboard methods
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // Handle ticket type selection
  onTicketTypeChange(): void {
    console.log('Ticket type changed to:', this.selectedTicketType);
    
    // Check if this layout has booked tickets
    if (this.isTicketTypeDropdownDisabled()) {
      console.log('Cannot change ticket type for layout with booked tickets');
      return;
    }
    
    // Clear any previous color error
    this.colorError = '';

    if (this.selectedTicketType && this.selectedLayout) {
      // Make sure the layout exists in layoutColors
      if (!this.layoutColors[this.selectedLayout]) {
        this.layoutColors[this.selectedLayout] = {};
      }

      // Get the ticket type's color from the ticketTypes array
      const ticketType = this.ticketTypes.find(t => t.id === this.selectedTicketType);
      if (ticketType && ticketType.color) {
        // Use the ticket type's color
        this.currentTicketTypeColor = ticketType.color;
        console.log('Using ticket type color:', this.currentTicketTypeColor);
        
        // Validate the color
        if (this.isGreenColor(this.currentTicketTypeColor)) {
          console.log('Green color detected in ticket type, using default color instead');
          this.colorError = 'Green colors are not allowed. Using default color instead.';
          this.currentTicketTypeColor = '#808080'; // Default to grey
          
          // Update the ticket type's color
          ticketType.color = this.currentTicketTypeColor;
        } else if (this.isRedColor(this.currentTicketTypeColor)) {
          console.log('Red color detected in ticket type, using default color instead');
          this.colorError = 'Red colors are not allowed. Using default color instead.';
          this.currentTicketTypeColor = '#808080'; // Default to grey
          
          // Update the ticket type's color
          ticketType.color = this.currentTicketTypeColor;
        }
        
        // Store it in the current layout
        this.layoutColors[this.selectedLayout][this.selectedTicketType] = this.currentTicketTypeColor;
      } else {
        // If no color is defined for the ticket type, use default grey
        this.currentTicketTypeColor = '#808080'; // Default grey color
        console.log('Using default grey color for ticket type without color');
        
        // Store it in the current layout
        this.layoutColors[this.selectedLayout][this.selectedTicketType] = this.currentTicketTypeColor;
        
        // Also update the ticket type's color
        if (ticketType) {
          ticketType.color = this.currentTicketTypeColor;
        }
      }

      // Update all seats to match the selected ticket type
      Object.values(this.seatRows).forEach(row => {
        row.forEach(seat => {
          if (seat.status !== 'booked') {
            seat.type = this.selectedTicketType;
            seat.price = this.ticketTypes.find(t => t.id === this.selectedTicketType)?.price || 0;
          }
        });
      });
      
      // Debug the current state
      this.debugState();
    }
  }

  // Update the color for the selected ticket type
  updateSeatColor(): void {
    console.log('Updating seat color to:', this.currentTicketTypeColor);
    
    // Clear any previous error
    this.colorError = '';

    if (!this.selectedTicketType || !this.selectedLayout) {
      console.log('No ticket type or layout selected');
      return;
    }

    // Check if the color is in the green range
    const isGreenColor = this.isGreenColor(this.currentTicketTypeColor);
    if (isGreenColor) {
      console.log('Green color detected, showing error');
      this.colorError = 'Green colors are not allowed. Please select a different color.';
      // Revert to the previous color
      this.revertToOriginalColor();
      return;
    }
    
    // Check if the color is in the red range
    const isRedColor = this.isRedColor(this.currentTicketTypeColor);
    if (isRedColor) {
      console.log('Red color detected, showing error');
      this.colorError = 'Red colors are not allowed. Please select a different color.';
      // Revert to the previous color
      this.revertToOriginalColor();
      return;
    }

    console.log('Updating color for ticket type:', this.selectedTicketType);

    // Update the color in the ticketTypes array first
    const ticketTypeIndex = this.ticketTypes.findIndex(t => t.id === this.selectedTicketType);
    if (ticketTypeIndex !== -1) {
      this.ticketTypes[ticketTypeIndex].color = this.currentTicketTypeColor;
      console.log('Updated ticket type color in ticketTypes array:', this.ticketTypes[ticketTypeIndex]);
      
      // Also update in seatTypes for consistency
      if (this.seatTypes[this.selectedTicketType]) {
        this.seatTypes[this.selectedTicketType].color = this.currentTicketTypeColor;
      }
    }
    
    // Update the color in ALL layouts where this ticket type is used
    Object.keys(this.layoutColors).forEach(layoutId => {
      if (this.layoutColors[layoutId][this.selectedTicketType]) {
        this.layoutColors[layoutId][this.selectedTicketType] = this.currentTicketTypeColor;
        console.log(`Updated color for ticket type ${this.selectedTicketType} in layout ${layoutId}`);
      }
    });
    
    // If the color isn't set in the current layout yet, set it
    if (!this.layoutColors[this.selectedLayout][this.selectedTicketType]) {
      this.layoutColors[this.selectedLayout][this.selectedTicketType] = this.currentTicketTypeColor;
    }
    
    // Update all seats with the new color in the current layout
    Object.values(this.seatRows).forEach(row => {
      row.forEach(seat => {
        if (seat.status !== 'booked' && seat.type === this.selectedTicketType) {
          // No need to update the seat color here as it's derived from the type and layout
        }
      });
    });

    // Trigger a change detection by updating the UI
    this.seatRows = {...this.seatRows};
    
    console.log('Updated colors for ticket type across all layouts:', this.selectedTicketType);
    console.log('Current layout colors:', this.layoutColors);
    console.log('Updated ticket types:', this.ticketTypes);
  }

  // Helper method to get existing color for a ticket type in the current layout only
  getExistingColorForTicketType(ticketTypeId: string): string | null {
    // First check if the ticket type has a color in the current layout
    if (this.selectedLayout && 
        this.layoutColors[this.selectedLayout] && 
        this.layoutColors[this.selectedLayout][ticketTypeId]) {
      return this.layoutColors[this.selectedLayout][ticketTypeId];
    }
    
    // If no color is found in the current layout, check the ticket type's default color
    const ticketType = this.ticketTypes.find(t => t.id === ticketTypeId);
    if (ticketType && ticketType.color) {
      return ticketType.color;
    }
    
    // Default to grey if no color is found
    return '#808080';
  }

  // Helper method to revert to the original color
  revertToOriginalColor(): void {
    // First try to get the color from the current layout
    if (this.layoutColors[this.selectedLayout] && 
        this.layoutColors[this.selectedLayout][this.selectedTicketType]) {
      this.currentTicketTypeColor = this.layoutColors[this.selectedLayout][this.selectedTicketType];
      return;
    }
    
    // Then try to get it from the ticket types
    const ticketType = this.ticketTypes.find(t => t.id === this.selectedTicketType);
    if (ticketType && ticketType.color) {
      this.currentTicketTypeColor = ticketType.color;
      return;
    }
    
    // Finally, use the default color
    this.currentTicketTypeColor = '#808080';
  }
  
  // Helper method to check if a color is in the green range
  isGreenColor(hexColor: string): boolean {
    // Convert hex to RGB
    const r = parseInt(hexColor.substring(1, 3), 16);
    const g = parseInt(hexColor.substring(3, 5), 16);
    const b = parseInt(hexColor.substring(5, 7), 16);
    
    // Check if green is the dominant component and above a threshold
    // This is a simple check that considers a color "green" if:
    // 1. Green component is higher than both red and blue
    // 2. Green component is above a minimum threshold (100)
    // 3. The difference between green and the next highest component is significant
    return g > r && g > b && g > 100 && (g - Math.max(r, b)) > 30;
  }
  
  // Helper method to check if a color is in the red range
  isRedColor(hexColor: string): boolean {
    // Convert hex to RGB
    const r = parseInt(hexColor.substring(1, 3), 16);
    const g = parseInt(hexColor.substring(3, 5), 16);
    const b = parseInt(hexColor.substring(5, 7), 16);
    
    // Check if red is the dominant component and above a threshold
    // This is a simple check that considers a color "red" if:
    // 1. Red component is higher than both green and blue
    // 2. Red component is above a minimum threshold (150)
    // 3. The difference between red and the next highest component is significant
    return r > g && r > b && r > 150 && (r - Math.max(g, b)) > 40;
  }

  // Load seats from database
  loadSeats(): void {
    console.log('Checking if seats exist in database...');
    this.http.get<any[]>(`${this.API_URL}/seats`, { responseType: 'json' }).subscribe({
        next: (response) => {
            console.log('Response received:', response);
            if (Array.isArray(response)) {
                console.log(`Found ${response.length} seats in database`);
                if (response.length === 0) {
                    console.log('No seats found, creating initial seats...');
                    this.createInitialSeats();
                }
                // Always generate seats for display
                this.generateSeats();
            } else {
                console.error('Invalid response format:', response);
                this.generateSeats();
            }
        },
        error: (error) => {
            console.error('Error checking seats:', error);
            if (error.status === 0) {
                console.error('Server is not responding. Please check if the server is running.');
            } else {
                console.error(`Server returned error: ${error.status} - ${error.message}`);
            }
            // If database fails, use local generation
            console.log('Falling back to local seat generation...');
            this.generateSeats();
        }
    });
  }

  // Create initial seats if none exist
  createInitialSeats(): void {
    // Define section-specific configurations with custom seat numbers
    const sectionConfigs: { [key: string]: { row: string; seats: { number: number; startFrom: number } }[] } = {
      'lf-left': [
        { row: 'A', seats: { number: 8, startFrom: 43 } },
        { row: 'B', seats: { number: 10, startFrom: 45 } },
        { row: 'C', seats: { number: 11, startFrom: 46 } },
        { row: 'D', seats: { number: 12, startFrom: 47 } },
        { row: 'E', seats: { number: 12, startFrom: 47 } },
        { row: 'F', seats: { number: 12, startFrom: 47 } },
        { row: 'G', seats: { number: 12, startFrom: 47 } },
        { row: 'H', seats: { number: 11, startFrom: 46 } },
        { row: 'J', seats: { number: 10, startFrom: 45 } },
        { row: 'K', seats: { number: 8, startFrom: 43 } },
        { row: 'L', seats: { number: 5, startFrom: 40 } }
      ],
      'lf-center': [
        { row: 'A', seats: { number: 19, startFrom: 33 } },
        { row: 'B', seats: { number: 20, startFrom: 34 } },
        { row: 'C', seats: { number: 19, startFrom: 33 } },
        { row: 'D', seats: { number: 20, startFrom: 34 } },
        { row: 'E', seats: { number: 17, startFrom: 31 } },
        { row: 'F', seats: { number: 18, startFrom: 32 } },
        { row: 'G', seats: { number: 17, startFrom: 31 } },
        { row: 'H', seats: { number: 18, startFrom: 32 } },
        { row: 'J', seats: { number: 15, startFrom: 29 } },
        { row: 'K', seats: { number: 16, startFrom: 30 } }
      ],
      'lf-right': [
        { row: 'A', seats: { number: 8, startFrom: 8 } },
        { row: 'B', seats: { number: 9, startFrom: 9 } },
        { row: 'C', seats: { number: 10, startFrom: 10 } },
        { row: 'D', seats: { number: 12, startFrom: 12 } },
        { row: 'E', seats: { number: 12, startFrom: 12 } },
        { row: 'F', seats: { number: 12, startFrom: 12 } },
        { row: 'G', seats: { number: 12, startFrom: 12 } },
        { row: 'H', seats: { number: 11, startFrom: 11 } },
        { row: 'J', seats: { number: 11, startFrom: 11 } },
        { row: 'K', seats: { number: 8, startFrom: 8 } },
        { row: 'L', seats: { number: 5, startFrom: 5 } }
      ],
      'b-left': [
        { row: 'AA', seats: { number: 14, startFrom: 50 } },
        { row: 'BB', seats: { number: 14, startFrom: 50 } },
        { row: 'CC', seats: { number: 14, startFrom: 50 } },
        { row: 'DD', seats: { number: 13, startFrom: 49 } },
        { row: 'EE', seats: { number: 12, startFrom: 48 } }
      ],
      'b-center': [
        { row: 'AA', seats: { number: 22, startFrom: 36 } },
        { row: 'BB', seats: { number: 22, startFrom: 36 } },
        { row: 'CC', seats: { number: 22, startFrom: 36 } },
        { row: 'DD', seats: { number: 21, startFrom: 35 } }
      ],
      'b-right': [
        { row: 'AA', seats: { number: 13, startFrom: 13 } },
        { row: 'BB', seats: { number: 13, startFrom: 13 } },
        { row: 'CC', seats: { number: 13, startFrom: 13 } },
        { row: 'DD', seats: { number: 13, startFrom: 13 } },
        { row: 'EE', seats: { number: 12, startFrom: 12 } }
      ]
    };

    // Create seats for each layout
    Object.entries(sectionConfigs).forEach(([layoutId, config]) => {
      const layoutName = this.layoutSections.find(s => s.id === layoutId)?.name;
      if (!layoutName) return;

      const seats: SeatData[] = [];
      config.forEach(rowConfig => {
        for (let i = 0; i < rowConfig.seats.number; i++) {
          seats.push({
            layout: layoutName,
            row: rowConfig.row,
            seat_no: rowConfig.seats.startFrom - i
          });
        }
      });

      // Store seats in database
      console.log(`Creating seats for layout ${layoutName}:`, seats);
      this.http.post(`${this.API_URL}/seats/create`, {
        layout: layoutName,
        seats: seats
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      }).subscribe({
        next: (response) => {
          console.log(`Successfully created seats for ${layoutName}:`, response);
          // After creating seats, load them to display
          this.loadSeats();
        },
        error: (error) => {
          console.error(`Error creating seats for ${layoutName}:`, error);
          if (error.error) {
            console.error('Server error details:', error.error);
            if (error.error.message) {
              alert(`Error: ${error.error.message}`);
            }
          }
          // Show error to user
          alert(`Failed to create seats for ${layoutName}. Please try again.`);
        }
      });
    });
  }

  // Process seats from database
  processSeats(seats: any[]): void {
    // This method is no longer needed since we're always using generateSeats
    this.generateSeats();
  }

  // Generate seat layout
  generateSeats(): void {
    // Define section-specific configurations with custom seat numbers
    const sectionConfigs: { [key: string]: { row: string; seats: { number: number; startFrom: number } }[] } = {
      'lf-left': [
        { row: 'A', seats: { number: 8, startFrom: 43 } },
        { row: 'B', seats: { number: 10, startFrom: 45 } },
        { row: 'C', seats: { number: 11, startFrom: 46 } },
        { row: 'D', seats: { number: 12, startFrom: 47 } },
        { row: 'E', seats: { number: 12, startFrom: 47 } },
        { row: 'F', seats: { number: 12, startFrom: 47 } },
        { row: 'G', seats: { number: 12, startFrom: 47 } },
        { row: 'H', seats: { number: 11, startFrom: 46 } },
        { row: 'J', seats: { number: 10, startFrom: 45 } },
        { row: 'K', seats: { number: 8, startFrom: 43 } },
        { row: 'L', seats: { number: 5, startFrom: 40 } }
      ],
      'lf-center': [
        { row: 'A', seats: { number: 19, startFrom: 33 } },
        { row: 'B', seats: { number: 20, startFrom: 34 } },
        { row: 'C', seats: { number: 19, startFrom: 33 } },
        { row: 'D', seats: { number: 20, startFrom: 34 } },
        { row: 'E', seats: { number: 17, startFrom: 31 } },
        { row: 'F', seats: { number: 18, startFrom: 32 } },
        { row: 'G', seats: { number: 17, startFrom: 31 } },
        { row: 'H', seats: { number: 18, startFrom: 32 } },
        { row: 'J', seats: { number: 15, startFrom: 29 } },
        { row: 'K', seats: { number: 16, startFrom: 30 } }
      ],
      'lf-right': [
        { row: 'A', seats: { number: 8, startFrom: 8 } },
        { row: 'B', seats: { number: 9, startFrom: 9 } },
        { row: 'C', seats: { number: 10, startFrom: 10 } },
        { row: 'D', seats: { number: 12, startFrom: 12 } },
        { row: 'E', seats: { number: 12, startFrom: 12 } },
        { row: 'F', seats: { number: 12, startFrom: 12 } },
        { row: 'G', seats: { number: 12, startFrom: 12 } },
        { row: 'H', seats: { number: 11, startFrom: 11 } },
        { row: 'J', seats: { number: 11, startFrom: 11 } },
        { row: 'K', seats: { number: 8, startFrom: 8 } },
        { row: 'L', seats: { number: 5, startFrom: 5 } }
      ],
      'b-left': [
        { row: 'AA', seats: { number: 14, startFrom: 50 } },
        { row: 'BB', seats: { number: 14, startFrom: 50 } },
        { row: 'CC', seats: { number: 14, startFrom: 50 } },
        { row: 'DD', seats: { number: 13, startFrom: 49 } },
        { row: 'EE', seats: { number: 12, startFrom: 48 } }
      ],
      'b-center': [
        { row: 'AA', seats: { number: 22, startFrom: 36 } },
        { row: 'BB', seats: { number: 22, startFrom: 36 } },
        { row: 'CC', seats: { number: 22, startFrom: 36 } },
        { row: 'DD', seats: { number: 21, startFrom: 35 } }
      ],
      'b-right': [
        { row: 'AA', seats: { number: 13, startFrom: 13 } },
        { row: 'BB', seats: { number: 13, startFrom: 13 } },
        { row: 'CC', seats: { number: 13, startFrom: 13 } },
        { row: 'DD', seats: { number: 13, startFrom: 13 } },
        { row: 'EE', seats: { number: 12, startFrom: 12 } }
      ]
    };

    // Clear existing seats
    this.seatRows = {};

    // Generate seats based on selected section configuration
    if (this.selectedLayout && sectionConfigs[this.selectedLayout]) {
      // Reset the color picker to the default color when changing layouts
      // Make sure 'regular' exists in seatTypes before setting its color
      if (!this.seatTypes['regular']) {
        this.seatTypes['regular'] = { name: 'Available', price: 0, color: '#808080' };
      } else {
        this.seatTypes['regular'].color = '#808080';
      }
      
      // Set default grey color for all ticket types if not already set
      this.ticketTypes.forEach(ticket => {
        if (!ticket.color) {
          ticket.color = '#808080'; // Default grey color
        }
        if (this.seatTypes[ticket.id] && !this.seatTypes[ticket.id].color) {
          this.seatTypes[ticket.id].color = '#808080'; // Default grey color
        }
      });

      sectionConfigs[this.selectedLayout].forEach(config => {
        this.seatRows[config.row] = [];
        for (let i = 0; i < config.seats.number; i++) {
          // Use the first ticket type as default if available, otherwise use 'regular'
          const defaultTicketType = this.ticketTypes.length > 0 ? this.ticketTypes[0].id : 'regular';
          const defaultPrice = this.ticketTypes.length > 0 ? this.ticketTypes[0].price : 0;
          
          // Make sure the default ticket type has a color set to grey
          const defaultTicket = this.ticketTypes.find(t => t.id === defaultTicketType);
          if (defaultTicket && !defaultTicket.color) {
            defaultTicket.color = '#808080';
          }

          this.seatRows[config.row].push({
            id: `${config.row}${config.seats.startFrom - i}`,
            row: config.row,
            number: config.seats.startFrom - i,
            type: defaultTicketType,
            price: defaultPrice,
            status: 'available'
          });
        }
      });
    }
  }

  // Handle seat selection
  toggleSeatSelection(seat: Seat): void {
    if (!this.selectedTicketType) {
      return; // Cannot select seats without choosing a ticket type
    }

    if (seat.status === 'booked') {
      return; // Cannot select booked seats
    }

    if (seat.status === 'selected') {
      // Deselect the seat
      seat.status = 'available';
      this.selectedSeats = this.selectedSeats.filter(s => s.id !== seat.id);
    } else {
      // Select the seat with the current ticket type
      seat.status = 'selected';
      seat.type = this.selectedTicketType;

      // Get the price from the selected ticket type
      const selectedTicket = this.ticketTypes.find(t => t.id === this.selectedTicketType);
      seat.price = selectedTicket ? selectedTicket.price : 0;

      this.selectedSeats.push(seat);
    }
  }







  // Get seat color based on status, type, and layout
  getSeatColor(seat: Seat): string {
    if (!seat) return '#808080'; // Default if seat is undefined

    if (seat.status === 'booked') {
      return '#FF0000'; // Red for booked seats
    } else if (seat.status === 'selected') {
      return '#32CD32'; // Green for selected seats
    } else if (seat.type && this.selectedLayout &&
        this.layoutColors[this.selectedLayout] &&
        this.layoutColors[this.selectedLayout][seat.type]) {
      // If the seat has a type and there's a layout-specific color for that type, use it
      return this.layoutColors[this.selectedLayout][seat.type];
    } else {
      // Default color for available seats (grey)
      return '#808080';
    }
  }

  // Saved layouts with ticket types - moved to class property declaration

  // Save layout
  saveLayout(): void {
    if (!this.selectedLayout || !this.selectedTicketType) {
      this.errorMessage = 'Please select a layout and ticket type before saving.';
      this.showErrorMessage = true;

      // Auto-hide the error message after 5 seconds
      setTimeout(() => {
        this.showErrorMessage = false;
      }, 5000);
      return;
    }
    
    // Check if this layout has booked tickets
    if (this.isTicketTypeDropdownDisabled()) {
      this.errorMessage = 'Cannot save layout with booked tickets. The configuration is locked.';
      this.showErrorMessage = true;

      // Auto-hide the error message after 5 seconds
      setTimeout(() => {
        this.showErrorMessage = false;
      }, 5000);
      return;
    }

    console.log('Saving layout with consistent colors across all layouts');
    
    // Update the color in the ticketTypes array
    const ticketTypeIndex = this.ticketTypes.findIndex(t => t.id === this.selectedTicketType);
    if (ticketTypeIndex !== -1) {
      // Update the color of the ticket type with the current color
      this.ticketTypes[ticketTypeIndex].color = this.currentTicketTypeColor;

      // Also update the color in the seatTypes object for consistency
      if (this.seatTypes[this.selectedTicketType]) {
        this.seatTypes[this.selectedTicketType].color = this.currentTicketTypeColor;
      }
      
      // Update this color in all layouts where this ticket type is used
      Object.keys(this.layoutColors).forEach(layoutId => {
        if (!this.layoutColors[layoutId]) {
          this.layoutColors[layoutId] = {};
        }
        // Always set the color for this ticket type in all layouts
        this.layoutColors[layoutId][this.selectedTicketType] = this.currentTicketTypeColor;
      });

      console.log('Updated ticket type color across all layouts:', this.ticketTypes[ticketTypeIndex]);
    }

    // Collect all seats in the current layout
    const layoutSeats: {
      row: string;
      seatNo: number;
      ticketType: string;
      ticketTypeName: string;
      price: number;
    }[] = [];

    // Get the ticket type name from the ID
    const ticketTypeObj = this.ticketTypes.find(t => t.id === this.selectedTicketType);
    const ticketTypeName = ticketTypeObj ? ticketTypeObj.name : 'Regular';

    // Go through all rows and seats in the current layout
    Object.entries(this.seatRows).forEach(([row, seats]) => {
      seats.forEach(seat => {
        if (seat.type === this.selectedTicketType) {
          // For seats with the selected ticket type
          layoutSeats.push({
            row: seat.row,
            seatNo: seat.number,
            ticketType: seat.type,
            ticketTypeName: ticketTypeName, // Add the ticket type name
            price: seat.price
          });
        } else {
          // For seats without the selected ticket type, use 'regular' as default
          layoutSeats.push({
            row: seat.row,
            seatNo: seat.number,
            ticketType: 'regular',
            ticketTypeName: 'Regular',
            price: 0
          });
        }
      });
    });

    // Check if we have any seats for this layout
    if (layoutSeats.length === 0) {
      this.errorMessage = 'No seats found for this layout section. Please try again.';
      this.showErrorMessage = true;
      setTimeout(() => {
        this.showErrorMessage = false;
      }, 5000);
      return;
    }

    // Create a layout entry
    const layoutEntry: SavedLayout = {
      layout: this.selectedLayout,
      ticketType: this.selectedTicketType,
      ticketTypeName: ticketTypeName, // Add the ticket type name
      seats: layoutSeats
    };

    // Remove any existing entries for this layout (to ensure only one ticket type per layout)
    this.savedLayouts = this.savedLayouts.filter(l => l.layout !== this.selectedLayout);

    // Add the new entry
    this.savedLayouts.push(layoutEntry);
    
    // Log the updated savedLayouts array
    console.log(`Layout ${this.selectedLayout} saved with ticket type ${this.selectedTicketType}`);
    console.log(`Total configured layouts: ${this.savedLayouts.length}`);

    console.log('Saved layouts:', this.savedLayouts);
    console.log('Updated ticket types:', this.ticketTypes);
    console.log('Event data:', this.eventData);
    console.log('Discounts:', this.discounts);

    // Discounts will be saved when creating the event
    console.log('Discounts will be saved when creating the event');

    // Here you would typically save the layout to your backend
    // Show success notification instead of alert
    this.successMessage = 'Layout saved successfully! This layout section now has only one ticket type assigned.';
    this.showSuccessMessage = true;

    // Auto-hide the message after 5 seconds
    setTimeout(() => {
      this.showSuccessMessage = false;
    }, 5000);
  }

  // Discounts are now handled entirely in the ticket setup page
  // This method is kept as a placeholder but returns an empty array
  formatDiscountsForSaving(): any[] {
    console.log('Discounts are now handled in ticket setup page, not saving from seat setup');
    return [];
  }

  // This function has been merged with the first updateSeatColor implementation

  // Handle layout section selection
  async onLayoutChange(): Promise<void> {
    // Clear previous selections when changing layout
    this.selectedSeats = [];

    // Reset UI state when changing layouts
    this.showLayoutConfiguredMessage = true;
    this.showSuccessMessage = false;
    this.showErrorMessage = false;

    // Check for booked tickets again to ensure we have the latest data
    await this.checkForBookedTickets();
    
    // Check if this layout has booked tickets
    const hasBookedTickets = this.layoutHasBookedTickets(this.selectedLayout);
    console.log(`Layout ${this.selectedLayout} has booked tickets: ${hasBookedTickets}`);
    
    // Check if this layout already has a ticket type assigned
    const existingTicketType = this.getLayoutTicketType(this.selectedLayout);

    if (hasBookedTickets) {
      console.log(`Layout ${this.selectedLayout} has booked tickets, disabling ticket type selection`);
      // If the layout has booked tickets, we should not allow changing the ticket type
      // but we should still show the existing ticket type if it exists
      if (existingTicketType) {
        this.selectedTicketType = existingTicketType;
        
        // Set the color picker to the color of this ticket type from the ticketTypes array
        const ticketType = this.ticketTypes.find(t => t.id === existingTicketType);
        if (ticketType && ticketType.color) {
          this.currentTicketTypeColor = ticketType.color;
          
          // Make sure the layout colors are updated with the ticket type's color
          if (!this.layoutColors[this.selectedLayout]) {
            this.layoutColors[this.selectedLayout] = {};
          }
          this.layoutColors[this.selectedLayout][existingTicketType] = ticketType.color;
        } else {
          this.currentTicketTypeColor = '#808080'; // Default color
        }
      } else {
        // If no ticket type is assigned but there are booked tickets, this is an error state
        // We should not allow this, but handle it gracefully
        this.selectedTicketType = '';
        this.currentTicketTypeColor = '#808080'; // Default color
        console.error(`Layout ${this.selectedLayout} has booked tickets but no ticket type assigned`);
      }
    } else if (existingTicketType) {
      // If the layout already has a ticket type and no booked tickets, select it
      this.selectedTicketType = existingTicketType;

      // Set the color picker to the color of this ticket type from the ticketTypes array
      const ticketType = this.ticketTypes.find(t => t.id === existingTicketType);
      if (ticketType && ticketType.color) {
        this.currentTicketTypeColor = ticketType.color;
        
        // Make sure the layout colors are updated with the ticket type's color
        if (!this.layoutColors[this.selectedLayout]) {
          this.layoutColors[this.selectedLayout] = {};
        }
        this.layoutColors[this.selectedLayout][existingTicketType] = ticketType.color;
      } else {
        this.currentTicketTypeColor = '#808080'; // Default color
      }
    } else {
      // If no ticket type is assigned and no booked tickets, reset selection
      this.selectedTicketType = '';
      this.currentTicketTypeColor = '#808080'; // Default color
    }

    this.loadSeats(); // Regenerate seats for the new layout
    
    // Debug the current state
    this.debugState();
  }
  
  // Check if a layout has booked tickets
  layoutHasBookedTickets(layoutId: string): boolean {
    if (!layoutId) return false;
    
    console.log('Checking if layout has booked tickets:', layoutId);
    console.log('Layouts with booked tickets:', this.layoutsWithBookedTickets);
    
    // First check if the layout ID is directly in the list
    if (this.layoutsWithBookedTickets.includes(layoutId)) {
      return true;
    }
    
    // If not found by ID, check if the layout name is in the list
    const layoutSection = this.layoutSections.find(section => section.id === layoutId);
    if (layoutSection && this.layoutsWithBookedTickets.includes(layoutSection.name)) {
      console.log(`Found layout by name: ${layoutSection.name}`);
      return true;
    }
    
    return false;
  }
  
  // Check if ticket type dropdown should be disabled
  isTicketTypeDropdownDisabled(): boolean {
    const result = this.layoutHasBookedTickets(this.selectedLayout);
    console.log(`Ticket type dropdown disabled for layout ${this.selectedLayout}: ${result}`);
    return result;
  }
  
  // Debug method to log the current state
  debugState(): void {
    console.log('Current state:');
    console.log('Selected layout:', this.selectedLayout);
    console.log('Selected ticket type:', this.selectedTicketType);
    console.log('Layouts with booked tickets:', this.layoutsWithBookedTickets);
    console.log('Has booked tickets:', this.hasBookedTickets);
    console.log('Is ticket type dropdown disabled:', this.isTicketTypeDropdownDisabled());
    
    // Print out all layout sections for debugging
    console.log('Layout sections:');
    this.layoutSections.forEach(section => {
      console.log(`ID: ${section.id}, Name: ${section.name}`);
      console.log(`Has booked tickets: ${this.layoutHasBookedTickets(section.id)}`);
    });
  }
  
  // Refresh ticket status
  async refreshTicketStatus(): Promise<void> {
    // Show a loading message
    this.successMessage = 'Refreshing ticket status...';
    this.showSuccessMessage = true;
    
    // Check for booked tickets
    await this.checkForBookedTickets();
    
    // Update the UI
    if (this.selectedLayout) {
      // If a layout is selected, check if it has booked tickets
      const hasBookedTickets = this.layoutHasBookedTickets(this.selectedLayout);
      console.log(`Layout ${this.selectedLayout} has booked tickets: ${hasBookedTickets}`);
      
      // If it has booked tickets, update the ticket type dropdown
      if (hasBookedTickets) {
        // Get the existing ticket type
        const existingTicketType = this.getLayoutTicketType(this.selectedLayout);
        if (existingTicketType) {
          this.selectedTicketType = existingTicketType;
        }
      }
    }
    
    // Show a success message
    this.successMessage = 'Ticket status refreshed successfully!';
    this.showSuccessMessage = true;
    
    // Hide the success message after 2 seconds
    setTimeout(() => {
      this.showSuccessMessage = false;
    }, 2000);
    
    // Debug the current state
    this.debugState();
  }

  // Get current layout section
  get currentLayoutSection(): LayoutSection | undefined {
    return this.layoutSections.find(s => s.id === this.selectedLayout);
  }

  // Get selected ticket type
  get selectedTicketTypeInfo(): TicketType | undefined {
    return this.ticketTypes.find(type => type.id === this.selectedTicketType);
  }

  // Get total available seats
  get totalAvailableSeats(): number {
    let total = 0;
    Object.values(this.seatRows).forEach(row => {
      total += row.filter(seat => seat.status !== 'booked').length;
    });
    return total;
  }

  // Get event name from event data
  get eventName(): string {
    return this.eventData?.event_name?.toString() || 'New Event';
  }

  // Check if a layout has been saved for a specific ticket type
  isLayoutSaved(layout: string, ticketType: string): boolean {
    return this.savedLayouts.some(l => l.layout === layout && l.ticketType === ticketType);
  }

  // Check if a layout already has any ticket type assigned
  isLayoutConfigured(layout: string): boolean {
    return this.savedLayouts.some(l => l.layout === layout);
  }

  // Get the ticket type assigned to a layout (if any)
  getLayoutTicketType(layout: string): string | null {
    const savedLayout = this.savedLayouts.find(l => l.layout === layout);
    return savedLayout ? savedLayout.ticketType : null;
  }

  // Get all saved ticket types for the current layout
  get savedTicketTypesForCurrentLayout(): string[] {
    if (!this.selectedLayout) return [];
    return this.savedLayouts
      .filter(l => l.layout === this.selectedLayout)
      .map(l => l.ticketType);
  }

  // Get the count of seats for a specific layout and ticket type
  getSeatCount(layout: string, ticketType: string): number {
    const savedLayout = this.savedLayouts.find(
      l => l.layout === layout && l.ticketType === ticketType
    );
    return savedLayout ? savedLayout.seats.length : 0;
  }

  // Helper method to get ticket type name by ID
  getTicketTypeName(typeId: string): string {
    if (!typeId) return 'All Tickets';
    const ticketType = this.ticketTypes.find(t => t.id === typeId);
    return ticketType ? ticketType.name : 'All Tickets';
  }

  // Helper method to get ticket type color by ID
  getTicketTypeColor(typeId: string): string {
    const ticketType = this.ticketTypes.find(t => t.id === typeId);
    return ticketType && ticketType.color ? ticketType.color : '#808080';
  }

  // Helper method to get ticket type price by ID
  getTicketTypePrice(typeId: string): number {
    const ticketType = this.ticketTypes.find(t => t.id === typeId);
    return ticketType ? ticketType.price : 0;
  }

  // Get event description from event data
  get eventDescription(): string {
    return this.eventData?.description?.toString() || '';
  }

  // Show custom alert dialog
  showAlert(title: string, message: string, showCancelButton: boolean = true): Promise<boolean> {
    return new Promise((resolve) => {
      this.alertDialogTitle = title;
      this.alertDialogMessage = message;
      this.showAlertDialog = true;
      this.showCancelButton = showCancelButton; // Track whether to show the Cancel button
      this.alertDialogCallback = (result: boolean) => {
        this.showAlertDialog = false;
        resolve(result);
      };
    });
  }

  // Show confirmation message with only OK button
  showConfirmation(title: string, message: string): Promise<void> {
    return new Promise((resolve) => {
      this.alertDialogTitle = title;
      this.alertDialogMessage = message;
      this.showAlertDialog = true;
      this.showCancelButton = false; // Hide the Cancel button
      this.alertDialogCallback = () => {
        this.showAlertDialog = false;
        resolve();
      };
    });
  }

  // Handle alert dialog response
  onAlertDialogResponse(result: boolean): void {
    if (this.alertDialogCallback) {
      this.alertDialogCallback(result);
      this.alertDialogCallback = null;
    }
  }

  // Get event date information
  get eventDateInfo(): string {
    if (!this.eventData || !this.eventData.start_date_time) {
      return '';
    }

    const startDate = new Date(this.eventData.start_date_time);
    const endDate = new Date(this.eventData.end_date_time || startDate); // Fallback to startDate if endDate is undefined

    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };

    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
  }

  // Helper method to get section configuration for a layout ID
  getSectionConfig(layoutId: string): { [key: string]: { seats: { number: number; startFrom: number } } } | null {
    // Define section-specific configurations with custom seat numbers
    const sectionConfigs: { [key: string]: { [key: string]: { seats: { number: number; startFrom: number } } } } = {
      'lf-left': {
        'A': { seats: { number: 8, startFrom: 43 } },
        'B': { seats: { number: 10, startFrom: 45 } },
        'C': { seats: { number: 11, startFrom: 46 } },
        'D': { seats: { number: 12, startFrom: 47 } },
        'E': { seats: { number: 12, startFrom: 47 } },
        'F': { seats: { number: 12, startFrom: 47 } },
        'G': { seats: { number: 12, startFrom: 47 } },
        'H': { seats: { number: 11, startFrom: 46 } },
        'J': { seats: { number: 10, startFrom: 45 } },
        'K': { seats: { number: 8, startFrom: 43 } },
        'L': { seats: { number: 5, startFrom: 40 } }
      },
      'lf-center': {
        'A': { seats: { number: 19, startFrom: 33 } },
        'B': { seats: { number: 20, startFrom: 34 } },
        'C': { seats: { number: 19, startFrom: 33 } },
        'D': { seats: { number: 20, startFrom: 34 } },
        'E': { seats: { number: 17, startFrom: 31 } },
        'F': { seats: { number: 18, startFrom: 32 } },
        'G': { seats: { number: 17, startFrom: 31 } },
        'H': { seats: { number: 18, startFrom: 32 } },
        'J': { seats: { number: 15, startFrom: 29 } },
        'K': { seats: { number: 16, startFrom: 30 } }
      },
      'lf-right': {
        'A': { seats: { number: 8, startFrom: 8 } },
        'B': { seats: { number: 9, startFrom: 9 } },
        'C': { seats: { number: 10, startFrom: 10 } },
        'D': { seats: { number: 12, startFrom: 12 } },
        'E': { seats: { number: 12, startFrom: 12 } },
        'F': { seats: { number: 12, startFrom: 12 } },
        'G': { seats: { number: 12, startFrom: 12 } },
        'H': { seats: { number: 11, startFrom: 11 } },
        'J': { seats: { number: 11, startFrom: 11 } },
        'K': { seats: { number: 8, startFrom: 8 } },
        'L': { seats: { number: 5, startFrom: 5 } }
      },
      'b-left': {
        'AA': { seats: { number: 14, startFrom: 50 } },
        'BB': { seats: { number: 14, startFrom: 50 } },
        'CC': { seats: { number: 14, startFrom: 50 } },
        'DD': { seats: { number: 13, startFrom: 49 } },
        'EE': { seats: { number: 12, startFrom: 48 } }
      },
      'b-center': {
        'AA': { seats: { number: 22, startFrom: 36 } },
        'BB': { seats: { number: 22, startFrom: 36 } },
        'CC': { seats: { number: 22, startFrom: 36 } },
        'DD': { seats: { number: 21, startFrom: 35 } }
      },
      'b-right': {
        'AA': { seats: { number: 13, startFrom: 13 } },
        'BB': { seats: { number: 13, startFrom: 13 } },
        'CC': { seats: { number: 13, startFrom: 13 } },
        'DD': { seats: { number: 13, startFrom: 13 } },
        'EE': { seats: { number: 12, startFrom: 12 } }
      }
    };

    return sectionConfigs[layoutId] || null;
  }

  // Check if event can be created
  canCreateEvent(): boolean {
    // Require event data AND at least one configured layout section
    if (!this.eventData) {
      return false;
    }
    
    // Check if at least one layout section is configured
    return this.savedLayouts && this.savedLayouts.length > 0;
  }

  // Create event with tickets and discounts
  createEvent(): void {
    if (!this.eventData) {
      this.errorMessage = 'No event data available. Please go back to event creation.';
      this.showErrorMessage = true;
      setTimeout(() => {
        this.showErrorMessage = false;
      }, 5000);
      return;
    }

    // Check if at least one layout section is configured
    if (!this.savedLayouts || this.savedLayouts.length === 0) {
      this.errorMessage = 'You must assign a ticket type to at least one layout section before creating the event.';
      this.showErrorMessage = true;
      setTimeout(() => {
        this.showErrorMessage = false;
      }, 5000);
      return;
    }

    // Log the event data to see what we're working with
    console.log('Event data at start of createEvent():', JSON.stringify(this.eventData, null, 2));

    // Check for layout sections without ticket types
    const configuredLayoutIds = this.savedLayouts.map(layout => layout.layout);
    const unconfiguredLayouts = this.layoutSections.filter(section =>
      !configuredLayoutIds.includes(section.id)
    );

    // Prepare seat layouts data
    const seatLayouts = this.savedLayouts.map(layout => {
      // Get the ticket type name from the ID
      const ticketTypeObj = this.ticketTypes.find(t => t.id === layout.ticketType);
      const ticketTypeName = ticketTypeObj ? ticketTypeObj.name : 'Regular';

      return {
        layout: this.layoutSections.find(s => s.id === layout.layout)?.name || layout.layout,
        ticketType: layout.ticketType,
        ticketTypeName: ticketTypeName, // Add the ticket type name
        seats: layout.seats.map(seat => {
          // Get the ticket type name for this specific seat
          const seatTicketTypeObj = this.ticketTypes.find(t => t.id === seat.ticketType);
          const seatTicketTypeName = seatTicketTypeObj ? seatTicketTypeObj.name : ticketTypeName;

          return {
            row: seat.row,
            seatNo: seat.seatNo,
            ticketType: seat.ticketType,
            ticketTypeName: seatTicketTypeName, // Add the ticket type name
            price: seat.price
          };
        })
      };
    });

    // First, ask if user wants to generate tickets
    const ticketTitle = 'Generate Tickets';
    const ticketMessage = `Would you like to generate tickets for all seats (${this.getTotalSeatsCount()} tickets)?\n\nSelecting 'Cancel' will cancel the event creation process.`;

    this.showAlert(ticketTitle, ticketMessage).then(confirmed => {
      if (!confirmed) {
        // User doesn't want to generate tickets, so don't create the event
        this.successMessage = 'Event creation canceled.';
        this.showSuccessMessage = true;
        setTimeout(() => {
          this.showSuccessMessage = false;
          // Show confirmation but stay on the current page
          this.showConfirmation(
            'Event Canceled',
            'The event creation process has been canceled.\n\nYou can continue configuring your seat layout.'
          );
        }, 2000);
        return;
      }

      // User wants to generate tickets, continue with checking unconfigured layouts
      if (unconfiguredLayouts.length > 0) {
        const layoutNames = unconfiguredLayouts.map(l => l.name).join(', ');
        const confirmTitle: string = 'Unconfigured Sections';
        const confirmMessage = `The following layout sections don't have ticket types assigned: ${layoutNames}. \n\nThese sections will not be included in the event. Do you want to continue?`;

        // Use the custom alert dialog
        this.showAlert(confirmTitle, confirmMessage, true).then(confirmed => {
          if (!confirmed) {
            console.log('User cancelled event creation due to unconfigured layouts');
            this.showErrorMessage = false; // Hide any previous error messages
            return; // User cancelled, do not proceed with event creation
          }

          // Process unconfigured layouts (now just logs them)
          this.processUnconfiguredLayouts(unconfiguredLayouts);

          // Continue with event creation
          this.finalizeEventCreation(seatLayouts);
        });
        return; // Exit the method here, the callback will continue if confirmed
      }

      // Continue with event creation if no unconfigured layouts
      this.finalizeEventCreation(seatLayouts);
    });
  }

  // Process unconfigured layouts - no longer sets default ticket type
  processUnconfiguredLayouts(unconfiguredLayouts: LayoutSection[]): void {
    // This method is intentionally left empty as we no longer want to 
    // automatically assign a default ticket type to unconfigured layouts
    console.log('Skipping unconfigured layouts:', unconfiguredLayouts.map(l => l.name).join(', '));
  }

  // Finalize event creation
  finalizeEventCreation(seatLayouts: any[]): void {
    // Prepare event data
    // Make sure eventData exists and log its properties
    if (this.eventData) {
      // Log the entire event data object to see what properties it has
      console.log('Event data before submission:', JSON.stringify(this.eventData, null, 2));

      // Log the organizer_id specifically
      console.log('Original event data organizer_id:', this.eventData.organizer_id);

      // Only set organizer_id if it doesn't exist
      if (!this.eventData.organizer_id) {
        this.eventData.organizer_id = this.currentUser?.id ||
                                     this.currentUser?.organizer_id ||
                                     this.currentUser?._id ||
                                     'default-organizer';
        console.log('Had to set missing organizer_id to:', this.eventData.organizer_id);
      }
    }

    // Format ticket types to match server expectations
    const formattedTicketTypes = this.ticketTypes.map(ticket => ({
      type: ticket.id, // Server expects 'type' but client uses 'id'
      name: ticket.name || 'Regular',
      price: typeof ticket.price === 'number' ? ticket.price : 0,
      color: ticket.color || '#808080'
    }));

    console.log('Formatted ticket types:', formattedTicketTypes);

    // Create FormData to handle file uploads properly
    const formData = new FormData();

    // Add event basic info
    if (this.eventData) {
      // Log the current user for debugging
      console.log('Current user:', this.currentUser);

      // Get organizer_id from event data or current user
      let organizerId = this.eventData.organizer_id;

      // If organizer_id is missing or empty, try to get it from currentUser
      if (!organizerId) {
        organizerId = this.currentUser?.id ||
                     this.currentUser?.organizer_id ||
                     this.currentUser?._id ||
                     'default-organizer';
        console.log('Had to use fallback organizer_id:', organizerId);
      }

      console.log('Using organizer_id:', organizerId);

      // Append basic event info to form data
      formData.append('event_name', this.eventData.event_name?.toString() || '');
      formData.append('description', this.eventData.description?.toString() || '');

      // Format dates as ISO strings to ensure proper parsing on the server
      const startDate = this.eventData.start_date_time instanceof Date
        ? this.eventData.start_date_time.toISOString()
        : new Date(this.eventData.start_date_time || '').toISOString();

      const endDate = this.eventData.end_date_time instanceof Date
        ? this.eventData.end_date_time.toISOString()
        : new Date(this.eventData.end_date_time || '').toISOString();

      console.log('Formatted start date:', startDate);
      console.log('Formatted end date:', endDate);

      formData.append('start_date_time', startDate);
      formData.append('end_date_time', endDate);

      // Append organizer_id as a string, ensuring it's not undefined
      formData.append('organizer_id', organizerId?.toString() || 'default-organizer');

      // Also add it directly to the event data object
      this.eventData.organizer_id = organizerId || 'default-organizer';

      // Log what we're sending to the server
      console.log('Form data organizer_id:', organizerId);

      // For debugging, also log the entire form data
      const formDataEntries: { [key: string]: any } = {};
      formData.forEach((value, key) => {
        formDataEntries[key] = value;
      });
      console.log('Form data entries:', formDataEntries);
    } else {
      console.error('Event data is null or undefined');
      this.errorMessage = 'Error: Event data is missing. Please go back and create an event first.';
      this.showErrorMessage = true;
      return;
    }

    // Add ticket types and seat layouts as JSON strings
    formData.append('ticketTypes', JSON.stringify(formattedTicketTypes));
    
    // Discounts are now handled in the ticket setup page, not here
    console.log('Discounts are now handled in ticket setup page, not in seat setup');
    
    // Add seat layouts
    formData.append('seatLayouts', JSON.stringify(seatLayouts));

    // If there are files, add them
    if (this.eventData?.files && this.eventData.files.length > 0) {
      this.eventData.files.forEach((file, index) => {
        // Only add if it's a real file, not just metadata
        if (file && file.data) {
          const blob = new Blob([file.data], { type: file.contentType || 'application/octet-stream' });
          formData.append('files', blob, file.filename || `file${index}.bin`);
        }
      });
    }

    // Check if we're updating an existing event or creating a new one
    const isUpdating = this.eventData && this.eventData.pk_event_id;
    
    if (isUpdating) {
      console.log('Updating existing event with ID:', this.eventData.pk_event_id);
    } else {
      console.log('Creating new event with data:', formData);
    }

    // Log the API URL we're using
    const apiUrl = isUpdating 
      ? `${this.API_URL}/events/${this.eventData!.pk_event_id}` 
      : `${this.API_URL}/events`;
    console.log('Sending request to API URL:', apiUrl);

    // Log the final form data before sending
    console.log('Final form data to be sent:');
    formData.forEach((value, key) => {
      console.log(`${key}:`, value);
    });

    // Send request to create or update event with FormData
    const request = isUpdating
      ? this.http.put(apiUrl, formData)
      : this.http.post(apiUrl, formData);
    
    request.subscribe({
      next: (response: any) => {
        const actionText = isUpdating ? 'updated' : 'created';
        console.log(`Event ${actionText} successfully:`, response);

        // Store the event ID for ticket generation
        const eventId = isUpdating ? this.eventData!.pk_event_id : response.pk_event_id;

        if (!eventId) {
          console.error('No event ID returned from server');
          this.errorMessage = 'Event was created but no event ID was returned. Cannot generate tickets.';
          this.showErrorMessage = true;
          setTimeout(() => {
            this.showErrorMessage = false;
            // Show confirmation before redirecting
            this.showConfirmation(
              'Warning',
              'Event was created but no event ID was returned. Cannot generate tickets.\n\nClick OK to return to the organizer dashboard.'
            ).then(() => {
              this.router.navigate(['/organizer']);
            });
          }, 2000);
          return;
        }

        // Show success message
        this.successMessage = `Event ${actionText} successfully! Generating tickets...`;
        this.showSuccessMessage = true;

        // Directly generate tickets without asking again (since we already asked before creating/updating the event)
        // Use the event ID we already have if updating, otherwise use the one from the response
        this.generateTicketsForEvent(eventId, seatLayouts);

      },
      error: (error) => {
        console.error('Error creating event:', error);
        console.error('Error details:', error.error);

        let errorMessage = 'Unknown error occurred';

        if (error.error && typeof error.error === 'object') {
          // If the error contains a detailed message from the server
          if (error.error.message) {
            errorMessage = error.error.message;
            console.error('Server error message:', error.error.message);
          }

          // Check for validation errors
          if (error.error.errors) {
            console.error('Validation errors:', error.error.errors);
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

          // Check for name field which might indicate the type of error
          if (error.error.name) {
            console.error('Error type:', error.error.name);
            errorMessage = `${error.error.name}: ${errorMessage}`;
          }
        } else if (error.status === 0) {
          errorMessage = 'Server is not responding. Please check if the server is running.';
        } else if (error.status) {
          errorMessage = `Server error (${error.status}): ${error.statusText || error.message || 'Unknown error'}`;
        } else if (error.message) {
          errorMessage = error.message;
        }

        // Show a more detailed error notification
        const errorActionText = isUpdating ? 'updating' : 'creating';
        this.errorMessage = `Error ${errorActionText} event: ${errorMessage}`;
        this.showErrorMessage = true;
        setTimeout(() => {
          this.showErrorMessage = false;
          // Show error confirmation
          this.showConfirmation(
            'Error',
            `Error ${errorActionText} event: ${errorMessage}\n\nYou can try again or modify your configuration.`
          );
        }, 3000);
      }
    });
  }

  // Get section name from layout ID
  getSectionName(layoutId: string): string {
    const section = this.layoutSections.find(s => s.id === layoutId);
    return section ? section.name : layoutId;
  }

  // Get total number of seats across all layouts
  getTotalSeatsCount(): number {
    return this.savedLayouts.reduce((total, layout) => total + layout.seats.length, 0);
  }

  // Generate tickets for an event
  generateTicketsForEvent(eventId: string, seatLayouts: any[]): void {
    console.log(`Generating tickets for event ${eventId} with layouts:`, seatLayouts);

    // Show loading message
    this.successMessage = 'Generating tickets. This may take a moment...';
    this.showSuccessMessage = true;

    // Send request to generate tickets
    this.http.post(`${this.API_URL}/tickets/generate-from-layout`, {
      event_id: eventId,
      seatLayouts: seatLayouts
    }).subscribe({
      next: (response: any) => {
        console.log('Tickets generated successfully:', response);
        
        // Check if this was an update or a new creation
        const isUpdate = response.isUpdate;
        const actionText = isUpdate ? 'updated' : 'generated';
        
        // Create appropriate success message
        let successMsg = '';
        if (isUpdate) {
          successMsg = `Successfully ${actionText} ${response.count} tickets for the event! (${response.updatedCount} previous tickets were replaced)`;
        } else {
          successMsg = `Successfully ${actionText} ${response.count} tickets for the event!`;
        }
        
        this.successMessage = successMsg;
        this.showSuccessMessage = true;
        
        // Add a delay before redirecting to ensure the user sees the success message
        setTimeout(() => {
          this.showSuccessMessage = false;
          // Show confirmation and navigate back to organizer page
          this.showConfirmation(
            'Success',
            `${successMsg}\n\nRedirecting to organizer dashboard...`
          ).then(() => {
            console.log('Navigating back to organizer page...');
            // Navigate back to organizer page
            this.router.navigate(['/organizer']);
          });
        }, 2000);
      },
      error: (error) => {
        console.error('Error generating tickets:', error);

        let errorMessage = 'Unknown error occurred';

        if (error.error && error.error.message) {
          errorMessage = error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }

        this.showSuccessMessage = false;
        this.errorMessage = `Error generating tickets: ${errorMessage}`;
        this.showErrorMessage = true;
        setTimeout(() => {
          this.showErrorMessage = false;
          // Show error confirmation but stay on the current page
          this.showConfirmation(
            'Error',
            `Error generating tickets: ${errorMessage}\n\nYou can try again or modify your configuration.`
          );
        }, 3000);
      }
    });
  }
} 