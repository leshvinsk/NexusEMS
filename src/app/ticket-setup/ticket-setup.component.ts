import { Component, OnInit, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { AppEvent } from '../app-event.model';
import { EventService } from '../services/event.service';

interface TicketType {
  id: string;
  name: string;
  price: number;
  description: string;
  color?: string;
}

interface Discount {
  id: string; // Format: "D-001"
  name: string;
  percentage: number;
  ticketTypeIds?: string[]; // Array of ticket type IDs
  expiry_date?: Date;
}

@Component({
  selector: 'app-ticket-setup',
  templateUrl: './ticket-setup.component.html',
  styleUrls: ['./ticket-setup.component.css']
})
export class TicketSetupComponent implements OnInit {
  currentUser: any;
  
  // Notification message properties
  errorMessage: string = '';
  showError: boolean = false;
  successMessage: string = '';
  showSuccess: boolean = false;
  isSidebarCollapsed: boolean = false;
  ticketTypes: TicketType[] = [];
  discounts: Discount[] = [];

  // Event data received from organizer page
  eventData: AppEvent | null = null;

  // Default color for tickets (will be properly set in seat-setup)
  defaultTicketColor: string = '#808080'; // Grey

  newTicket: TicketType = {
    id: '',
    name: '',
    price: 0,
    description: '',
    color: this.defaultTicketColor
  };

  newDiscount: Discount = {
    id: '',
    name: '',
    percentage: 0,
    ticketTypeIds: [],
    expiry_date: new Date()
  };

  // For multi-select dropdown
  selectedTicketTypes: string[] = [];
  isDropdownOpen: boolean = false;

  readonly MAX_TOTAL_TICKETS = 500;
  MAX_TICKET_TYPES = 6;
  private readonly API_URL = 'http://localhost:5001/api';

  constructor(
    private router: Router,
    private authService: AuthService,
    private http: HttpClient,
    private eventService: EventService
  ) {
    // Get event data from router state
    const navigation = this.router.getCurrentNavigation();
    if (navigation && navigation.extras && navigation.extras.state) {
      this.eventData = navigation.extras.state['eventData'];
      console.log('Received event data:', this.eventData);

      // Log specific event details for debugging
      if (this.eventData) {
        console.log('Event ID:', this.eventData.pk_event_id);
        console.log('Event Name:', this.eventData.event_name);
        console.log('Organizer ID:', this.eventData.organizer_id);
        console.log('Start Date:', this.eventData.start_date_time);
        console.log('End Date:', this.eventData.end_date_time);
        console.log('Ticket Types:', this.eventData.ticketTypes || 'None');
        console.log('Discounts:', this.eventData.discounts || 'None');
      }
    } else {
      console.log('No event data received in router state');
    }
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    // If no event data was passed, try to load ticket types from API
    if (!this.eventData) {
      console.log('No event data received, loading ticket types from API');
      this.loadTicketTypes();
    } else {
      console.log('Using event data from organizer page');
      // If event data has ticket types, use them
      if (this.eventData.ticketTypes && this.eventData.ticketTypes.length > 0) {
        this.ticketTypes = this.eventData.ticketTypes.map(tt => ({
          id: tt.type,
          name: tt.name,
          price: tt.price,
          description: `${tt.name} ticket`,
          color: tt.color
        }));
      }
    }
  }

  loadTicketTypes(): void {
    this.http.get<TicketType[]>(`${this.API_URL}/tickets/types`).subscribe({
      next: (tickets) => {
        this.ticketTypes = tickets;
      },
      error: (error) => {
        console.error('Error loading ticket types:', error);
      }
    });
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  logout(): void {
    // Implement logout logic
    this.router.navigate(['/login']);
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

  addTicketType(): void {
    if (this.ticketTypes.length >= this.MAX_TICKET_TYPES) {
      this.showErrorMessage(`Maximum number of ticket types (${this.MAX_TICKET_TYPES}) reached`);
      return;
    }

    if (!this.newTicket.name || this.newTicket.price === undefined || this.newTicket.price === null) {
      this.showErrorMessage('Please fill in all required fields for the ticket type');
      return;
    }

    // Check for negative price values
    if (this.newTicket.price < 0) {
      this.showErrorMessage('Ticket price cannot be negative');
      return;
    }

    // Generate a unique ID for the new ticket
    const ticketId = `TKT-${Date.now()}`;
    const ticketToAdd: TicketType = {
      id: ticketId,
      name: this.newTicket.name,
      price: this.newTicket.price,
      description: `Standard ${this.newTicket.name} ticket`,
      color: this.defaultTicketColor
    };

    // If we have event data, add the ticket type to it and save to database
    if (this.eventData && this.eventData.pk_event_id) {
      if (!this.eventData.ticketTypes) {
        this.eventData.ticketTypes = [];
      }

      const ticketTypeForEvent = {
        type: ticketId,
        name: this.newTicket.name,
        price: this.newTicket.price,
        color: this.defaultTicketColor
      };

      // Add to local arrays first for UI responsiveness
      this.eventData.ticketTypes.push(ticketTypeForEvent);
      this.ticketTypes.push(ticketToAdd);

      // Prepare data for API - send the entire updated ticketTypes array
      const updateData = {
        ticketTypes: this.ticketTypes
      };

      console.log('Updating event with ticket types:', updateData);

      // Update the event with the new ticket type
      this.http.put(`${this.API_URL}/events/${this.eventData.pk_event_id}/ticket-types`, updateData).subscribe({
        next: (response: any) => {
          console.log('Event updated with new ticket type:', response);
          this.showSuccessMessage('Ticket type added successfully and saved to database.');
          this.resetNewTicket();
        },
        error: (error) => {
          console.error('Error updating event with ticket type:', error);
          this.showErrorMessage('Failed to save ticket type to database. The UI has been updated but changes may not persist.');
          this.resetNewTicket();
        }
      });
    } else {
      // If no event data, just add to local array
      this.ticketTypes.push(ticketToAdd);
      this.resetNewTicket();
      this.showSuccessMessage('Ticket type added successfully to local storage.');
      console.warn('No event data available. Ticket type only saved locally.');
    }
  }

  resetNewTicket(): void {
    this.newTicket = {
      id: '',
      name: '',
      price: 0,
      description: '',
      color: this.defaultTicketColor
    };
  }

  removeTicketType(ticketId: string): void {
    // Get the ticket name for a more specific confirmation message
    const ticketToRemove = this.ticketTypes.find(t => t.id === ticketId);
    const ticketName = ticketToRemove ? ticketToRemove.name : 'this ticket type';
    
    if (confirm(`Are you sure you want to remove ${ticketName}? This will also affect any discounts applied to this ticket type.`)) {
      // Remove from local arrays first for UI responsiveness
      this.ticketTypes = this.ticketTypes.filter(t => t.id !== ticketId);
      
      // Also remove from event data if it exists
      if (this.eventData && this.eventData.ticketTypes) {
        this.eventData.ticketTypes = this.eventData.ticketTypes.filter(t => t.type !== ticketId);
      }
      
      // Remove any discounts that were specifically for this ticket type
      this.discounts.forEach(discount => {
        if (discount.ticketTypeIds && discount.ticketTypeIds.includes(ticketId)) {
          // Remove this ticket type from the discount's ticketTypeIds
          discount.ticketTypeIds = discount.ticketTypeIds.filter(id => id !== ticketId);
        }
      });
      
      // If we have event data, update the event in the database
      if (this.eventData && this.eventData.pk_event_id) {
        // Prepare data for API - send the entire updated ticketTypes array
        const updateData = {
          ticketTypes: this.ticketTypes
        };
        
        console.log('Updating event after removing ticket type:', updateData);
        
        // Update the event with the modified ticket types array
        this.http.put(`${this.API_URL}/events/${this.eventData.pk_event_id}/ticket-types`, updateData).subscribe({
          next: (response: any) => {
            console.log('Event updated after removing ticket type:', response);
            this.showSuccessMessage(`Ticket type "${ticketName}" removed successfully.`);
            
            // Update discounts that referenced this ticket type
            this.discounts.forEach(discount => {
              if (discount.ticketTypeIds && discount.ticketTypeIds.includes(ticketId)) {
                // If this was the only ticket type for this discount, update the discount in the database
                if (discount.ticketTypeIds.length === 0) {
                  this.http.put(`${this.API_URL}/discounts/${discount.id}`, {
                    ticketTypeIds: []
                  }).subscribe({
                    next: () => console.log(`Updated discount ${discount.id} to apply to all tickets`),
                    error: (err) => console.error(`Error updating discount ${discount.id}:`, err)
                  });
                }
              }
            });
          },
          error: (error) => {
            console.error('Error updating event after removing ticket type:', error);
            this.showErrorMessage(`Failed to save changes to database. The UI has been updated but changes may not persist.`);
          }
        });
      } else {
        // If no event data, just show success message
        this.showSuccessMessage(`Ticket type "${ticketName}" removed from local storage.`);
        console.warn('No event data available. Ticket type only removed locally.');
      }
    }
  }

  addDiscount(): void {
    // Validate that there are ticket types before adding a discount
    if (this.ticketTypes.length === 0) {
      this.showErrorMessage('You must add at least one ticket type before creating discounts.');
      return;
    }

    if (!this.newDiscount.name || this.newDiscount.percentage <= 0) {
      this.showErrorMessage('Please enter a valid discount name and percentage.');
      return;
    }

    // Validate expiry date is after today
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    const expiryDate = new Date(this.newDiscount.expiry_date || new Date());

    if (expiryDate <= today) {
      this.showErrorMessage('Discount expiry date must be after today.');
      return;
    }

    // Validate expiry date is before event start date
    if (this.eventData && this.eventData.start_date_time) {
      const eventStartDate = new Date(this.eventData.start_date_time);

      // Set event start date to beginning of the day
      const eventStartDay = new Date(eventStartDate);
      eventStartDay.setHours(0, 0, 0, 0);

      // Check if expiry date is at least one day before event start
      if (expiryDate >= eventStartDay) {
        this.showErrorMessage('Discount expiry date must be at least one day before the event starts.');
        return;
      }
    }

    // We'll use a temporary client-side ID and let the server generate the proper ID
    // This avoids conflicts with server-generated IDs
    const tempClientId = `temp-${Date.now()}`;

    // Get the selected ticket types (could be empty array for "All Tickets")
    const selectedTicketTypes = [...this.selectedTicketTypes];

    console.log('Selected ticket types:', selectedTicketTypes);

    const discount: Discount = {
      id: tempClientId, // Use temporary ID for client-side tracking
      name: this.newDiscount.name,
      percentage: this.newDiscount.percentage,
      ticketTypeIds: selectedTicketTypes,
      expiry_date: this.newDiscount.expiry_date
    };

    console.log('Creating new discount:', discount);

    // If we have event data, save the discount to the database immediately
    if (this.eventData && this.eventData.pk_event_id) {
      if (!this.eventData.discounts) {
        this.eventData.discounts = [];
      }

      const discountData = {
        // Don't provide discount_id, let the server generate it in the proper format
        name: this.newDiscount.name,
        percentage: this.newDiscount.percentage,
        ticketTypeIds: selectedTicketTypes, // Array of selected ticket type IDs
        expiry_date: this.newDiscount.expiry_date,
        event_id: this.eventData.pk_event_id
      };

      console.log('Saving discount to database with data:', discountData);

      this.http.post(`${this.API_URL}/discounts`, discountData).subscribe({
        next: (response: any) => {
          console.log('Discount saved to database:', response);

          // Update with the server-generated ID
          if (response && response.discount_id) {
            discount.id = response.discount_id;
            
            // Add to local arrays
            this.discounts.push(discount);
            this.eventData?.discounts?.push(response.discount_id);
            
            // Now update the event with the new discount ID
            if (this.eventData && this.eventData.pk_event_id) {
              const updateData = {
                discounts: this.eventData.discounts
              };
              
              console.log('Updating event with new discount:', updateData);
              
              this.http.put(`${this.API_URL}/events/${this.eventData.pk_event_id}/discounts`, updateData).subscribe({
                next: (eventResponse: any) => {
                  console.log('Event updated with new discount:', eventResponse);
                  this.showSuccessMessage('Discount added successfully and saved to database.');
                  this.resetNewDiscount();
                },
                error: (eventError) => {
                  console.error('Error updating event with discount:', eventError);
                  this.showErrorMessage('Discount created but failed to link to event. The UI has been updated but changes may not persist.');
                  this.resetNewDiscount();
                }
              });
            } else {
              this.showSuccessMessage('Discount added successfully and saved to database.');
              this.resetNewDiscount();
            }
          } else {
            // If no ID was returned, still use our temporary ID
            this.discounts.push(discount);
            this.eventData?.discounts?.push(tempClientId);
            
            this.showSuccessMessage('Discount added successfully but may not be properly saved to database.');
            this.resetNewDiscount();
          }
        },
        error: (error) => {
          console.error('Error saving discount to database:', error);
          this.showErrorMessage('Failed to save discount to database. Please try again.');
          
          // Still add to local arrays for UI consistency
          this.discounts.push(discount);
          this.eventData?.discounts?.push(tempClientId);
          this.resetNewDiscount();
        }
      });
    } else {
      // If no event data, just add to local array
      this.discounts.push(discount);
      this.resetNewDiscount();
      this.showSuccessMessage('Discount added to local data only. It will be saved when you proceed.');
    }
  }

  resetNewDiscount(): void {
    // Set default expiry date to tomorrow
    let defaultExpiryDate = this.getMinExpiryDate();

    // If event date is available and one day before event is earlier than the calculated min date,
    // use the one day before event as the max possible date
    if (this.eventData && this.eventData.start_date_time) {
      const oneDayBeforeEvent = this.getOneDayBeforeEvent();

      // If one day before event is earlier than tomorrow, use tomorrow as default
      if (oneDayBeforeEvent < defaultExpiryDate) {
        // In this case, we'll still use tomorrow but we should warn the user
        console.warn('Event starts too soon to set valid discount expiry dates');
      }
    }

    this.newDiscount = {
      id: '',
      name: '',
      percentage: 0,
      ticketTypeIds: [],
      expiry_date: defaultExpiryDate
    };

    // Reset the selected ticket types
    this.selectedTicketTypes = [];
  }

  removeDiscount(id: string): void {
    // Get the discount name for a more specific confirmation message
    const discountToRemove = this.discounts.find(d => d.id === id);
    const discountName = discountToRemove ? discountToRemove.name : 'this discount';
    const discountPercentage = discountToRemove ? `${discountToRemove.percentage}%` : '';
    
    if (confirm(`Are you sure you want to remove ${discountName} (${discountPercentage})?`)) {
      // First, update the event to remove the discount reference
      if (this.eventData && this.eventData.pk_event_id && this.eventData.discounts) {
        // Remove from event's discounts array
        this.eventData.discounts = this.eventData.discounts.filter(discountId => discountId !== id);
        
        const updateData = {
          discounts: this.eventData.discounts || []
        };
        
        console.log('Updating event to remove discount reference:', updateData);
        
        // Update the event first to maintain referential integrity
        this.http.put(`${this.API_URL}/events/${this.eventData.pk_event_id}/discounts`, updateData).subscribe({
          next: (response: any) => {
            console.log('Event updated to remove discount reference:', response);
            
            // Now remove the discount from the database
            this.http.delete(`${this.API_URL}/discounts/${id}`).subscribe({
              next: () => {
                console.log(`Discount ${id} removed from database`);
                
                // Remove from local array
                this.discounts = this.discounts.filter(discount => discount.id !== id);
                
                this.showSuccessMessage(`Discount "${discountName}" removed successfully.`);
              },
              error: (error) => {
                console.error(`Error removing discount ${id} from database:`, error);
                this.showErrorMessage(`Failed to remove discount "${discountName}" from database. The event has been updated but the discount still exists.`);
                
                // Still remove from local array for UI consistency
                this.discounts = this.discounts.filter(discount => discount.id !== id);
              }
            });
          },
          error: (eventError) => {
            console.error('Error updating event to remove discount reference:', eventError);
            this.showErrorMessage(`Failed to update event. Please try again.`);
          }
        });
      } else {
        // If no event data, just remove the discount from the database
        this.http.delete(`${this.API_URL}/discounts/${id}`).subscribe({
          next: () => {
            console.log(`Discount ${id} removed from database`);
            
            // Remove from local array
            this.discounts = this.discounts.filter(discount => discount.id !== id);
            
            this.showSuccessMessage(`Discount "${discountName}" removed successfully.`);
          },
          error: (error) => {
            console.error(`Error removing discount ${id} from database:`, error);
            this.showErrorMessage(`Failed to remove discount "${discountName}" from database. Please try again.`);
            
            // Still remove from local array for UI consistency
            this.discounts = this.discounts.filter(discount => discount.id !== id);
          }
        });
      }
    }
  }

  getTicketTypeName(id: string | undefined): string {
    if (!id) return 'All Tickets';
    const ticket = this.ticketTypes.find(t => t.id === id);
    return ticket ? ticket.name : 'All Tickets';
  }

  // Check if a ticket is selected
  isTicketSelected(ticketId: string): boolean {
    return this.selectedTicketTypes.includes(ticketId);
  }

  // Toggle ticket selection
  toggleTicketSelection(ticketId: string): void {
    const index = this.selectedTicketTypes.indexOf(ticketId);
    if (index === -1) {
      // Add to selected tickets
      this.selectedTicketTypes.push(ticketId);
    } else {
      // Remove from selected tickets
      this.selectedTicketTypes.splice(index, 1);
    }
    console.log('Updated selected ticket types:', this.selectedTicketTypes);
  }

  // Toggle dropdown visibility
  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const dropdownElement = (event.target as HTMLElement).closest('.dropdown-select');
    if (!dropdownElement) {
      this.isDropdownOpen = false;
    }
  }

  // Select all ticket types
  selectAllTickets(): void {
    this.selectedTicketTypes = this.ticketTypes.map(ticket => ticket.id);
    console.log('Selected all tickets:', this.selectedTicketTypes);
  }

  // Clear all selected ticket types
  clearTicketSelection(): void {
    this.selectedTicketTypes = [];
    console.log('Cleared ticket selection');
  }

  getDiscountsForTicket(ticketId: string): Discount[] {
    return this.discounts.filter(discount => {
      // Check if the discount is active
      const isActive = discount.expiry_date ? new Date(discount.expiry_date) >= new Date() : true;

      if (!isActive) return false;

      // Include discounts that either:
      // 1. Apply to all tickets (empty ticketTypeIds array)
      // 2. Apply specifically to this ticket (ticketTypeIds includes this ticket ID)

      // If ticketTypeIds is empty or undefined, the discount applies to all tickets
      if (!discount.ticketTypeIds || discount.ticketTypeIds.length === 0) {
        return true;
      }

      // Otherwise, check if this ticket ID is in the ticketTypeIds array
      return discount.ticketTypeIds.includes(ticketId);
    });
  }

  // Helper method to get the date that is one day before the event starts
  getOneDayBeforeEvent(): Date {
    if (!this.eventData || !this.eventData.start_date_time) {
      return new Date();
    }

    const eventStartDate = new Date(this.eventData.start_date_time);
    const oneDayBefore = new Date(eventStartDate);
    oneDayBefore.setDate(eventStartDate.getDate() - 1);
    oneDayBefore.setHours(23, 59, 59, 999); // Set to end of the day

    return oneDayBefore;
  }

  // Helper method to get the minimum allowed date for expiry (tomorrow)
  getMinExpiryDate(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Start of the day
    return tomorrow;
  }

  // Update event with ticket types and discounts, then navigate to seat setup
  proceedToSeatSetup(): void {
    // Update the event data with ticket types and discounts
    if (this.eventData) {
      // Format ticket types to match the AppEvent model
      this.eventData.ticketTypes = this.ticketTypes.map(ticket => ({
        type: ticket.id,
        name: ticket.name,
        price: ticket.price,
        color: ticket.color || '#808080'
      }));

      // Format discounts to match the AppEvent model
      this.eventData.discounts = this.discounts.map(discount => discount.id);

      // First, update the ticket types
      const ticketTypesData = {
        ticketTypes: this.ticketTypes
      };
      
      console.log('Updating event with final ticket types before proceeding:', ticketTypesData);
      
      // Add null check to ensure eventData is not null before accessing pk_event_id
      if (this.eventData && this.eventData.pk_event_id) {
        this.http.put(`${this.API_URL}/events/${this.eventData.pk_event_id}/ticket-types`, ticketTypesData).subscribe({
          next: (ticketResponse: any) => {
            console.log('Event updated with final ticket types:', ticketResponse);
            
            // Then, update the discounts
            const discountsData = {
              discounts: this.eventData?.discounts || []
            };
            
            console.log('Updating event with final discounts before proceeding:', discountsData);
            
            // Add null check to ensure eventData is not null before accessing pk_event_id
            if (this.eventData && this.eventData.pk_event_id) {
              this.http.put(`${this.API_URL}/events/${this.eventData.pk_event_id}/discounts`, discountsData).subscribe({
                next: (discountResponse: any) => {
                  console.log('Event updated with final discounts:', discountResponse);
                
                  // Finally, save the complete updated event to the database
                  // Add null check to ensure eventData is not null before passing to updateEvent
                  if (this.eventData) {
                    this.eventService.updateEvent(this.eventData).subscribe(
                      (response) => {
                        console.log('Event fully updated before proceeding to seat setup:', response);
                        
                        // Navigate to seat setup page with event data
                        this.router.navigate(['/seat-setup'], {
                          state: {
                            eventData: this.eventData,
                            ticketTypes: this.ticketTypes,
                            discounts: this.discounts
                          }
                        });
                      },
                      (error) => {
                        console.error('Error updating event:', error);
                        this.showErrorMessage('Failed to fully update event. Proceeding with local data.');
                        
                        // Still navigate to seat setup page with the local data
                        this.router.navigate(['/seat-setup'], {
                          state: {
                            eventData: this.eventData,
                            ticketTypes: this.ticketTypes,
                            discounts: this.discounts
                          }
                        });
                      }
                    );
                  } else {
                    // If eventData is null, navigate to seat setup with local data
                    this.router.navigate(['/seat-setup'], {
                      state: {
                        eventData: this.eventData,
                        ticketTypes: this.ticketTypes,
                        discounts: this.discounts
                      }
                    });
                  }
                },
                error: (discountError) => {
                  console.error('Error updating event with final discounts:', discountError);
                  this.showErrorMessage('Failed to update discounts. Proceeding with local data.');
                  
                  // Still navigate to seat setup page with the local data
                  this.router.navigate(['/seat-setup'], {
                    state: {
                      eventData: this.eventData,
                      ticketTypes: this.ticketTypes,
                      discounts: this.discounts
                    }
                  });
                }
              });
            } else {
              // Handle case where eventData or pk_event_id is null
              console.warn('Cannot update discounts: Event data or event ID is missing');
              // Still navigate to seat setup page with the local data
              this.router.navigate(['/seat-setup'], {
                state: {
                  eventData: this.eventData,
                  ticketTypes: this.ticketTypes,
                  discounts: this.discounts
                }
              });
            }
          },
          error: (ticketError) => {
            console.error('Error updating event with final ticket types:', ticketError);
            this.showErrorMessage('Failed to update ticket types. Proceeding with local data.');
            
            // Still navigate to seat setup page with the local data
            this.router.navigate(['/seat-setup'], {
              state: {
                eventData: this.eventData,
                ticketTypes: this.ticketTypes,
                discounts: this.discounts
              }
            });
          }
        });
      } else {
        // If no event data, just navigate to seat setup page with the local data
        this.router.navigate(['/seat-setup'], {
          state: {
            eventData: this.eventData,
            ticketTypes: this.ticketTypes,
            discounts: this.discounts
          }
        });
      }
    } else {
      // If no event data, just navigate to seat setup page with the local data
      this.router.navigate(['/seat-setup'], {
        state: {
          eventData: this.eventData,
          ticketTypes: this.ticketTypes,
          discounts: this.discounts
        }
      });
    }
  }
}
