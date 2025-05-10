import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AppEvent } from '../app-event.model';

interface Seat {
  id: string;
  row: string;
  number: number;
  type: string;
  price: number;
  status: 'available' | 'booked' | 'selected';
  section: string; // Added section property to track which section the seat belongs to
  ticket_id?: string; // Database ticket ID
}

interface BookingSummary {
  selectedSeats: Seat[];
  subtotal: number;
  discount: number;
  total: number;
}

interface TicketType {
  id: string;
  name: string;
  price: number;
  description: string;
  color: string;
}

interface LayoutSection {
  id: string;
  name: string;
  description: string;
}

interface Discount {
  discount_id: string;
  name: string;
  percentage: number;
  ticketTypeIds: string[];
  expiry_date: Date;
  event_id: string;
}

@Component({
  selector: 'app-seat-selection',
  standalone: false,
  templateUrl: './seat-selection.component.html',
  styleUrl: './seat-selection.component.css'
})
export class SeatSelectionComponent implements OnInit {
  // Timer properties
  timeLeft: number = 600; // 10 minutes in seconds
  timerInterval: any;

  // Event properties
  eventId: string = '';
  event: AppEvent | null = null;

  // Seat data
  seatRows: { [key: string]: Seat[] } = {};

  // Store all seats across all sections
  allSeats: { [key: string]: { [key: string]: Seat[] } } = {};

  // Booking summary
  bookingSummary: BookingSummary = {
    selectedSeats: [],
    subtotal: 0,
    discount: 0,
    total: 0
  };

  // Promo code
  promoCode: string = '';
  promoApplied: boolean = false;
  promoError: string = '';
  availableDiscounts: Discount[] = [];

  // Seat types and prices (default values, will be updated from database)
  seatTypes: { [key: string]: { name: string; price: number; color: string; description: string } } = {
    regular: { name: 'Regular', price: 100, color: '#808080', description: 'Standard seating with good visibility of the stage and comfortable accommodations.' }
  };

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

  // Loading state
  isLoading: boolean = false;
  loadingError: string = '';

  // Ticket types array for display
  ticketTypesArray: TicketType[] = [];

  // API URL
  private readonly API_URL = 'http://localhost:5001/api';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    // Get the event ID from the route parameters
    this.route.params.subscribe(params => {
      console.log('Route params:', params);
      this.eventId = params['id'];
      console.log('Event ID from route:', this.eventId);

      if (this.eventId) {
        console.log('Loading event data for ID:', this.eventId);
        this.loadEventData();
      } else {
        // For backward compatibility, if no event ID is provided, use default data
        console.warn('No event ID provided, using default data');
        this.loadTicketTypes();
        this.generateAllSeats();
      }
    });

    this.startTimer();
  }

  // Load event data from the database
  loadEventData(): void {
    this.isLoading = true;
    this.loadingError = '';

    const url = `${this.API_URL}/events/${this.eventId}`;
    console.log('Loading event data from URL:', url);

    this.http.get<AppEvent>(url).subscribe({
      next: (event) => {
        this.event = event;
        console.log('Event data loaded:', event);

        // Load ticket types from the event
        if (event.ticketTypes && event.ticketTypes.length > 0) {
          console.log('Loading ticket types from event');
          this.loadTicketTypesFromEvent(event);
        } else {
          console.log('No ticket types in event, loading defaults');
          // If no ticket types in event, load defaults
          this.loadTicketTypes();
        }

        // Load available discounts for this event
        console.log('Loading discounts for event ID:', this.eventId);
        this.loadDiscounts();

        // Load seats from the database
        console.log('Loading seats for event ID:', this.eventId);
        this.loadSeatsFromDatabase();
      },
      error: (error) => {
        console.error('Error loading event data:', error);
        this.loadingError = 'Failed to load event data. Please try again later.';
        this.isLoading = false;

        // Load default data as fallback
        console.log('Loading default data as fallback');
        this.loadTicketTypes();
        this.generateAllSeats();
      }
    });
  }

  // Load ticket types from the event data
  loadTicketTypesFromEvent(event: AppEvent): void {
    this.ticketTypesArray = [];
    this.seatTypes = {};

    if (event.ticketTypes && event.ticketTypes.length > 0) {
      // Create a Set to track unique ticket type IDs
      const processedTypeIds = new Set<string>();

      event.ticketTypes.forEach(type => {
        // Skip if we've already processed this ticket type
        if (processedTypeIds.has(type.type)) {
          return;
        }

        processedTypeIds.add(type.type);

        const ticketType: TicketType = {
          id: type.type,
          name: type.name,
          price: type.price,
          description: `${type.name} seating for ${event.event_name}`,
          color: type.color || this.getRandomColor()
        };

        this.ticketTypesArray.push(ticketType);

        // Update seatTypes object for easy lookup
        this.seatTypes[ticketType.id] = {
          name: ticketType.name,
          price: ticketType.price,
          color: ticketType.color,
          description: ticketType.description
        };
      });

      console.log('Loaded ticket types:', this.ticketTypesArray);
    } else {
      // If no ticket types, use defaults
      this.loadTicketTypes();
    }
  }

  // Generate a random color for ticket types that don't have one
  getRandomColor(): string {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  // Load available discounts for this event
  loadDiscounts(): void {
    console.log(`Loading discounts for event ID: ${this.eventId}`);

    // First get the event details to access the discount IDs array
    this.http.get<any>(`${this.API_URL}/events/${this.eventId}`).subscribe({
      next: (event) => {
        console.log('Event data received:', event);

        if (event && event.discounts && event.discounts.length > 0) {
          console.log('Discount IDs found in event:', event.discounts);


          // Create an array to store all discount details
          const discountPromises = event.discounts.map((discountId: string) => {
            return this.http.get<Discount>(`${this.API_URL}/discounts/${discountId}`).toPromise();
          });

          // Wait for all discount details to be fetched
          Promise.all(discountPromises)
            .then((discountDetails) => {
              // Filter out any null/undefined values (failed requests)
              this.availableDiscounts = discountDetails.filter(d => d) as Discount[];
              console.log('Available discounts loaded from IDs:', this.availableDiscounts);
            })
            .catch(error => {
              console.error('Error fetching discount details:', error);
              // Try the old methods as fallback
              this.tryAlternativeDiscountLoading();
            });
        } else {
          console.log('No discount IDs found in event, trying alternative methods');
          this.tryAlternativeDiscountLoading();
        }
      },
      error: (error) => {
        console.error('Error fetching event details:', error);
        this.tryAlternativeDiscountLoading();
      }
    });
  }

  // Try alternative methods to load discounts
  tryAlternativeDiscountLoading(): void {
    // Try the /event/:eventId endpoint
    this.http.get<Discount[]>(`${this.API_URL}/discounts/event/${this.eventId}`).subscribe({
      next: (discounts) => {
        if (discounts && discounts.length > 0) {
          // Process the discounts to ensure proper data types
          this.availableDiscounts = discounts.map(discount => {
            // Ensure ticketTypeIds is an array
            if (!discount.ticketTypeIds) {
              discount.ticketTypeIds = [];
            } else if (!Array.isArray(discount.ticketTypeIds)) {
              // If it's not an array, convert it to an array
              discount.ticketTypeIds = [discount.ticketTypeIds];
            }
            
            // Ensure expiry_date is a Date object
            if (discount.expiry_date && typeof discount.expiry_date === 'string') {
              discount.expiry_date = new Date(discount.expiry_date);
            }
            
            return discount;
          });
          
          console.log('Available discounts from event endpoint (processed):', this.availableDiscounts);
        } else {
          // If no discounts found, try the main endpoint with query parameter
          console.log('No discounts found with event endpoint, trying query parameter');
          this.http.get<Discount[]>(`${this.API_URL}/discounts?event_id=${this.eventId}`).subscribe({
            next: (queryDiscounts) => {
              // Process the discounts to ensure proper data types
              this.availableDiscounts = queryDiscounts.map(discount => {
                // Ensure ticketTypeIds is an array
                if (!discount.ticketTypeIds) {
                  discount.ticketTypeIds = [];
                } else if (!Array.isArray(discount.ticketTypeIds)) {
                  // If it's not an array, convert it to an array
                  discount.ticketTypeIds = [discount.ticketTypeIds];
                }
                
                // Ensure expiry_date is a Date object
                if (discount.expiry_date && typeof discount.expiry_date === 'string') {
                  discount.expiry_date = new Date(discount.expiry_date);
                }
                
                return discount;
              });
              
              console.log('Available discounts from query parameter (processed):', this.availableDiscounts);
            },
            error: (queryError) => {
              console.error('Error loading discounts with query parameter:', queryError);
              this.loadHardcodedDiscounts();
            }
          });
        }
      },
      error: (error) => {
        console.error('Error loading discounts from event endpoint:', error);
        this.loadHardcodedDiscounts();
      }
    });
  }

  // Load hardcoded discounts as fallback
  loadHardcodedDiscounts(): void {
    console.log('Loading hardcoded discounts as fallback');
    this.availableDiscounts = [
      {
        discount_id: 'D-001',
        name: 'STUDENT',
        percentage: 50,
        ticketTypeIds: [],
        expiry_date: new Date('2025-12-31'),
        event_id: this.eventId
      },
      {
        discount_id: 'D-002',
        name: 'NEXUS10',
        percentage: 10,
        ticketTypeIds: [],
        expiry_date: new Date('2025-12-31'),
        event_id: this.eventId
      }
    ];
    console.log('Loaded hardcoded discounts:', this.availableDiscounts);
  }

  // Load seats from the database
  loadSeatsFromDatabase(): void {
    this.isLoading = true;

    this.http.get<any[]>(`${this.API_URL}/tickets/event/${this.eventId}`).subscribe({
      next: (tickets) => {
        console.log('Tickets loaded from database:', tickets);
        this.processTicketsFromDatabase(tickets);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading tickets:', error);
        this.loadingError = 'Failed to load seats. Using generated data instead.';
        this.isLoading = false;

        // Generate seats as fallback
        this.generateAllSeats();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  // Process tickets from the database and convert them to our Seat format
  processTicketsFromDatabase(tickets: any[]): void {
    // Reset all seats
    this.allSeats = {};

    // Reset layout sections to only include those with actual tickets
    this.layoutSections = [];

    // Group tickets by layout section
    const ticketsBySection: { [key: string]: any[] } = {};

    tickets.forEach(ticket => {
      // Convert layout name to section ID format (e.g., "LF - Center" to "lf-center")
      const sectionName = ticket.layout.toLowerCase().replace(/\s+/g, '-');
      console.log(`Mapping layout "${ticket.layout}" to section ID "${sectionName}"`);

      if (!ticketsBySection[sectionName]) {
        ticketsBySection[sectionName] = [];
      }
      ticketsBySection[sectionName].push(ticket);
    });

    // Process each section
    Object.keys(ticketsBySection).forEach(sectionId => {
      const sectionTickets = ticketsBySection[sectionId];

      // Add this section to layoutSections
      if (!this.layoutSections.some(section => section.id === sectionId)) {
        console.log(`Adding section: ${sectionId}`);

        // Format the section name nicely
        const sectionName = sectionId.split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        this.layoutSections.push({
          id: sectionId,
          name: sectionName,
          description: `Section ${sectionName}`
        });
      }

      this.allSeats[sectionId] = {};

      // Group tickets by row
      sectionTickets.forEach(ticket => {
        const row = ticket.row;
        if (!this.allSeats[sectionId][row]) {
          this.allSeats[sectionId][row] = [];
        }

        // Convert database ticket to our Seat format
        const seat: Seat = {
          id: `${sectionId}-${row}${ticket.seat_no}`,
          row: row,
          number: ticket.seat_no,
          type: ticket.ticket_type,
          price: ticket.price,
          status: ticket.status === 'booked' ? 'booked' : 'available',
          section: sectionId,
          ticket_id: ticket.ticket_id
        };

        this.allSeats[sectionId][row].push(seat);
      });

      // Sort seats by number within each row
      Object.keys(this.allSeats[sectionId]).forEach(row => {
        this.allSeats[sectionId][row].sort((a, b) => a.number - b.number);
      });
    });

    console.log('Processed seats:', this.allSeats);

    // If no layout is selected yet, select the first one
    if (!this.selectedLayout && Object.keys(this.allSeats).length > 0) {
      this.selectedLayout = Object.keys(this.allSeats)[0];
      this.onLayoutChange();
    }
  }

  // Load ticket types from database (fallback if not in event data)
  loadTicketTypes(): void {
    // In a real implementation, this would fetch from the database
    this.ticketTypesArray = [
      { id: 'vip', name: 'VIP', price: 150, description: 'Premium seating with the best view of the stage. Includes complimentary refreshments and exclusive event merchandise.', color: '#808080' },
      { id: 'regular', name: 'Regular', price: 100, description: 'Standard seating with good visibility of the stage and comfortable accommodations.', color: '#808080' },
      { id: 'restricted', name: 'Restricted View', price: 75, description: 'Budget-friendly option with partial view of the stage. May have obstructed views due to pillars or angles.', color: '#808080' }
    ];

    // Update seatTypes object for easy lookup
    this.ticketTypesArray.forEach(type => {
      this.seatTypes[type.id] = {
        name: type.name,
        price: type.price,
        color: type.color,
        description: type.description
      };
    });
  }

  // Generate all seats for all sections in advance
  generateAllSeats(): void {
    this.layoutSections.forEach(section => {
      this.allSeats[section.id] = {};
      const tempSeats = this.generateSeatsForSection(section.id);
      this.allSeats[section.id] = tempSeats;
    });
  }

  // Handle layout section selection
  onLayoutChange(): void {
    // Don't clear selected seats anymore, just update the view
    this.promoApplied = false;
    this.promoCode = '';
    this.promoError = '';
    this.updateBookingSummary();

    // Update current layout section
    // Calculate available and total seats
    this.calculateSeatCounts();

    // Load the seats for the selected section
    if (this.selectedLayout && this.allSeats[this.selectedLayout]) {
      this.seatRows = this.allSeats[this.selectedLayout];
      console.log(`Loaded ${Object.keys(this.seatRows).length} rows for section ${this.selectedLayout}`);
    } else {
      this.seatRows = {};
      console.warn(`No seats found for section ${this.selectedLayout}`);
    }
  }

  // Calculate available and total seats
  calculateSeatCounts(): void {
    if (!this.selectedLayout || !this.allSeats[this.selectedLayout]) {
      return;
    }

    let available = 0;
    let total = 0;

    // Count seats in the current section
    Object.values(this.allSeats[this.selectedLayout]).forEach(row => {
      row.forEach(seat => {
        total++;
        if (seat.status === 'available') {
          available++;
        }
      });
    });
  }

  // Generate seat layout for a specific section
  generateSeatsForSection(sectionId: string): { [key: string]: Seat[] } {
    const sectionRows: { [key: string]: Seat[] } = {};

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

    // Generate seats based on section configuration
    if (sectionConfigs[sectionId]) {
      // In a real implementation, we would fetch seat data from the database
      // For now, we'll simulate with random seat types and some booked seats
      const ticketTypeIds = this.ticketTypesArray.map(t => t.id);

      sectionConfigs[sectionId].forEach(config => {
        sectionRows[config.row] = [];
        for (let i = 0; i < config.seats.number; i++) {
          // Randomly assign a ticket type for demonstration
          const randomTypeIndex = Math.floor(Math.random() * ticketTypeIds.length);
          const seatType = ticketTypeIds[randomTypeIndex];

          // Randomly mark some seats as booked (for demo purposes)
          const status = Math.random() < 0.2 ? 'booked' : 'available';

          const seatId = `${sectionId}-${config.row}${config.seats.startFrom - i}`;

          // Check if this seat is already in the booking summary (selected)
          const existingSelectedSeat = this.bookingSummary.selectedSeats.find(s => s.id === seatId);
          const finalStatus = existingSelectedSeat ? 'selected' : status;

          sectionRows[config.row].push({
            id: seatId,
            row: config.row,
            number: config.seats.startFrom - i,
            type: seatType,
            price: this.seatTypes[seatType].price,
            status: finalStatus,
            section: sectionId
          });
        }
      });
    }

    return sectionRows;
  }

  // Handle seat selection
  toggleSeatSelection(seat: Seat): void {
    let discountPercentage = 0;
    if (seat.status === 'booked') {
      return; // Cannot select booked seats
    }

    if (seat.status === 'selected') {
      // Deselect the seat
      seat.status = 'available';
      this.bookingSummary.selectedSeats = this.bookingSummary.selectedSeats.filter(s => s.id !== seat.id);
    } else {
      // Select the seat
      seat.status = 'selected';
      this.bookingSummary.selectedSeats.push({ ...seat });
    }

    // Update booking summary
    this.updateBookingSummary();
  }

  // Remove seat from booking summary
  removeSeat(seat: Seat): void {
    // Find the seat in the current view if it's from the current section
    if (seat.section === this.selectedLayout) {
      const rowSeats = this.seatRows[seat.row];
      if (rowSeats) {
        const seatInRow = rowSeats.find(s => s.id === seat.id);
        if (seatInRow) {
          seatInRow.status = 'available';
        }
      }
    } else {
      // If the seat is from a different section, update it in the allSeats collection
      const sectionSeats = this.allSeats[seat.section];
      if (sectionSeats && sectionSeats[seat.row]) {
        const seatInSection = sectionSeats[seat.row].find(s => s.id === seat.id);
        if (seatInSection) {
          seatInSection.status = 'available';
        }
      }
    }

    // Remove from booking summary
    this.bookingSummary.selectedSeats = this.bookingSummary.selectedSeats.filter(s => s.id !== seat.id);

    // Update booking summary
    this.updateBookingSummary();
  }

  // Update booking summary calculations
  updateBookingSummary(discountPercentage: number = 10): void {
    // Calculate subtotal from all selected seats
    this.bookingSummary.subtotal = this.bookingSummary.selectedSeats.reduce((sum, seat) => sum + seat.price, 0);

    // Apply discount if promo code is applied
    if (this.promoApplied) {
      console.log(`Applying discount of ${discountPercentage}% to subtotal of $${this.bookingSummary.subtotal}`);
      this.bookingSummary.discount = this.bookingSummary.subtotal * (discountPercentage / 100);
      console.log(`Calculated discount: $${this.bookingSummary.discount}`);
    } else {
      this.bookingSummary.discount = 0;
    }

    // Calculate total
    this.bookingSummary.total = this.bookingSummary.subtotal - this.bookingSummary.discount;
    console.log(`Updated booking summary: Subtotal: $${this.bookingSummary.subtotal}, Discount: $${this.bookingSummary.discount}, Total: $${this.bookingSummary.total}`);
  }

  // Apply promo code
  applyPromoCode(): void {
    // Reset error message
    this.promoError = '';
    console.log('Applying promo code:', this.promoCode);
    console.log('Available discounts:', this.availableDiscounts);

    if (!this.promoCode.trim()) {
      this.promoError = 'Please enter a promo code';
      return;
    }

    // Check if we have discounts loaded from the database
    if (this.availableDiscounts && this.availableDiscounts.length > 0) {
      console.log('Checking against', this.availableDiscounts.length, 'available discounts');

      // Find the discount with the matching name (case insensitive)
      const discount = this.availableDiscounts.find(
        d => d.name && d.name.toUpperCase() === this.promoCode.toUpperCase()
      );

      console.log('Found discount:', discount);

      if (discount) {
        // Check if the discount is expired
        try {
          const expiryDate = new Date(discount.expiry_date);
          console.log('Expiry date:', expiryDate);

          if (expiryDate < new Date()) {
            this.promoError = 'This promo code has expired';
            this.promoApplied = false;
            this.updateBookingSummary();
            return;
          }
        } catch (error) {
          console.error('Error parsing expiry date:', error);
        }

        // Check if the discount applies to the selected seats
        if (discount.ticketTypeIds && discount.ticketTypeIds.length > 0) {
          console.log('Checking ticket types:', discount.ticketTypeIds);
          console.log('Selected seat types:', this.bookingSummary.selectedSeats.map(s => s.type));
          console.log('Selected seat ticket_ids:', this.bookingSummary.selectedSeats.map(s => s.ticket_id));

          // Debug: Log all the relevant information
          this.bookingSummary.selectedSeats.forEach((seat, index) => {
            console.log(`Seat ${index + 1}:`, {
              id: seat.id,
              type: seat.type,
              ticket_id: seat.ticket_id
            });
          });

          // Check if any of the selected seats have a ticket type that matches the discount
          // We need to check both the seat.type and seat.ticket_id against the discount.ticketTypeIds
          const hasMatchingTicketType = this.bookingSummary.selectedSeats.some(seat => {
            // Check if the seat type matches any of the discount ticket types
            const typeMatches = discount.ticketTypeIds.some(id => id === seat.type);
            
            // Check if the seat ticket_id matches any of the discount ticket types
            const ticketIdMatches = seat.ticket_id && discount.ticketTypeIds.some(id => id === seat.ticket_id);
            
            // Log the comparison for debugging
            console.log(`Seat ${seat.id} comparison:`, {
              type: seat.type,
              ticket_id: seat.ticket_id,
              typeMatches,
              ticketIdMatches
            });
            
            // Return true if either the type or ticket_id matches
            return typeMatches || ticketIdMatches;
          });

          console.log('Has matching ticket type:', hasMatchingTicketType);

          if (!hasMatchingTicketType) {
            this.promoError = 'This promo code does not apply to your selected seats';
            this.promoApplied = false;
            this.updateBookingSummary();
            return;
          }
        } else {
          // If no ticket type restrictions, the discount applies to all seats
          console.log('No ticket type restrictions, discount applies to all seats');
        }

        // Apply the discount
        this.promoApplied = true;
        console.log('Applying discount percentage:', discount.percentage);
        this.updateBookingSummary(discount.percentage);
      } else {
        this.promoError = 'Invalid promo code';
        this.promoApplied = false;
        this.updateBookingSummary();
      }
    } else {
      console.log('No discounts available, using fallback');
      // Fallback to hardcoded promo code if no discounts from database
      if (this.promoCode.toUpperCase() === 'NEXUS10') {
        this.promoApplied = true;
        this.updateBookingSummary(10); // 10% discount
      } else if (this.promoCode.toUpperCase() === 'STUDENT') {
        this.promoApplied = true;
        this.updateBookingSummary(50); // 50% student discount
      } else {
        this.promoError = 'Invalid promo code';
        this.promoApplied = false;
        this.updateBookingSummary();
      }
    }
  }

// Timer functionality
startTimer(): void {
  this.timerInterval = setInterval(() => {
    if (this.timeLeft > 0) {
      this.timeLeft--;
    } else {
      // Time's up - display a message and refresh the page
      clearInterval(this.timerInterval);
      alert('Your session has timed out. The page will refresh now! \n Kindly select your seats again.');
      location.reload(); // Refresh the page
    }
  }, 1000);
}

// Format time for display (MM:SS)
formatTime(): string {
  const minutes = Math.floor(this.timeLeft / 60);
  const seconds = this.timeLeft % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Continue to checkout
continueToCheckout(): void {
  console.log('Proceeding to checkout with seats:', this.bookingSummary.selectedSeats);

  if(this.bookingSummary.selectedSeats.length === 0) {
  alert('Please select at least one seat before proceeding to checkout.');
  return;
}

// Create booking data with all required fields
const bookingData = {
  booking_id: 'BK-' + Date.now(), // Generate a temporary booking ID
  event_id: this.eventId || 'E-001', // Use default if no event ID
  event_name: this.event?.event_name || 'Default Event Name', // Ensure event_name is always provided
  seats: this.bookingSummary.selectedSeats.map(seat => ({
    ticket_id: seat.ticket_id,
    seat_id: seat.id,
    ticket_type: seat.type,
    price: seat.price,
    section: seat.section,
    row: seat.row,
    seat_no: seat.number
  })),
  subtotal: this.bookingSummary.subtotal || 0, // Ensure subtotal is always provided
  total: this.bookingSummary.total || 0,
  discount: this.bookingSummary.discount || 0,
  promo_code: this.promoApplied ? this.promoCode : null,
  status: 'pending',
  customer_name: '',
  customer_email: ''
};

console.log('Booking data to be sent:', bookingData);

// Save booking to database
this.isLoading = true;

// Store booking data in localStorage as a fallback
const tempBookingId = bookingData.booking_id;
localStorage.setItem('tempBooking', JSON.stringify(bookingData));

// Try to save to database
this.http.post(`${this.API_URL}/bookings`, bookingData).subscribe({
  next: (response: any) => {
    console.log('Booking created:', response);

    // Update ticket status in database
    const ticketIds = this.bookingSummary.selectedSeats
      .filter(seat => seat.ticket_id)
      .map(seat => seat.ticket_id);

    if (ticketIds.length > 0) {
      this.http.post(`${this.API_URL}/tickets/update-status`, {
        ticket_ids: ticketIds,
        status: 'booked'
      }).subscribe({
        next: (updateResponse) => {
          console.log('Tickets updated:', updateResponse);
          this.isLoading = false;
          // Navigate to payment with booking ID
          this.router.navigate(['/payment'], {
            queryParams: {
              booking_id: response.booking_id || tempBookingId,
              event_id: this.eventId || 'E-001'
            }
          });
        },
        error: (updateError) => {
          console.error('Error updating tickets:', updateError);
          this.isLoading = false;
          // Still navigate to payment even if update fails
          this.router.navigate(['/payment'], {
            queryParams: {
              booking_id: response.booking_id || tempBookingId,
              event_id: this.eventId || 'E-001'
            }
          });
        }
      });
    } else {
      this.isLoading = false;
      // Navigate to payment with booking ID
      this.router.navigate(['/payment'], {
        queryParams: {
          booking_id: response.booking_id || tempBookingId,
          event_id: this.eventId || 'E-001'
        }
      });
    }
  },
  error: (error) => {
    console.error('Error creating booking:', error);
    this.isLoading = false;

    // If API endpoint doesn't exist yet, just navigate to payment with temp booking ID
    console.log('Using fallback navigation with temp booking ID');
    this.router.navigate(['/payment'], {
      queryParams: {
        booking_id: tempBookingId,
        event_id: this.eventId || 'E-001'
      }
    });
  }
});
  }

// Get seat color based on status and type
getSeatColor(seat: Seat): string {
  if (seat.status === 'booked') {
    return '#FF0000'; // Red for booked seats
  } else if (seat.status === 'selected') {
    return '#32CD32'; // Green for selected seats
  } else {
    // Check if the seat type exists in seatTypes
    if (this.seatTypes[seat.type]) {
      return this.seatTypes[seat.type].color;
    } else {
      console.warn(`Unknown seat type: ${seat.type}. Using default color.`);
      // Add the unknown type to seatTypes with a random color
      const randomColor = this.getRandomColor();
      this.seatTypes[seat.type] = {
        name: seat.type,
        price: seat.price,
        color: randomColor,
        description: `${seat.type} seating`
      };

      // Also add it to ticketTypesArray for the legend
      this.ticketTypesArray.push({
        id: seat.type,
        name: seat.type,
        price: seat.price,
        description: `${seat.type} seating`,
        color: randomColor
      });

      return randomColor;
    }
  }
}

// Get section name from section ID
getSectionName(sectionId: string): string {
  const section = this.layoutSections.find(s => s.id === sectionId);
  return section ? section.name : sectionId;
}

// Get seat title for tooltip
getSeatTitle(seat: Seat): string {
  if (seat.status === 'booked') {
    return 'This seat is already booked';
  }

  let typeName = seat.type;
  if (this.seatTypes[seat.type]) {
    typeName = this.seatTypes[seat.type].name;
  }

  return `${seat.row}${seat.number} - ${typeName} - $${seat.price}`;
}

// Check if continue button should be enabled
canContinue(): boolean {
  return this.bookingSummary.selectedSeats.length > 0;
}

  // Get current layout section
  get currentLayoutSection(): LayoutSection | undefined {
  return this.layoutSections.find(s => s.id === this.selectedLayout);
}

  // Get available seats count
  get availableSeatsCount(): number {
  let count = 0;
  Object.values(this.seatRows).forEach(row => {
    row.forEach(seat => {
      if (seat.status !== 'booked') {
        count++;
      }
    });
  });
  return count;
}

  get totalSeatsCount(): number {
  let count = 0;
  Object.values(this.seatRows).forEach(row => {
    count += row.length;
  });
  return count;
}
}
