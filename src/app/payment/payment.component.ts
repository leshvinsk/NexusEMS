import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-payment',
  standalone: false,
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.css']
})
export class PaymentComponent implements OnInit {
  paymentForm!: FormGroup;
  submitted = false;
  processing = false;
  
  // Booking data
  bookingId: string = '';
  eventId: string = '';
  bookingData: any = null;
  
  // API URL
  private API_URL = 'http://localhost:5001/api';

  // Error messages
  validationMessages = {
    fullName: [
      { type: 'required', message: 'Full name is required' },
      { type: 'minlength', message: 'Name must be at least 3 characters long' }
    ],
    email: [
      { type: 'required', message: 'Email is required' },
      { type: 'email', message: 'Please enter a valid email address' }
    ],
    cardNumber: [
      { type: 'required', message: 'Card number is required' },
      { type: 'pattern', message: 'Please enter a valid 16-digit card number' },
      { type: 'minlength', message: 'Card number must be 16 digits' },
      { type: 'maxlength', message: 'Card number must be 16 digits' }
    ],
    expiryDate: [
      { type: 'required', message: 'Expiry date is required' },
      { type: 'pattern', message: 'Please use MM/YY format (e.g., 12/25)' },
      { type: 'pastDate', message: 'Card expiration date cannot be in the past' }
    ],
    cvv: [
      { type: 'required', message: 'CVV is required' },
      { type: 'pattern', message: 'CVV must be 3 or 4 digits' }
    ]
  };

  constructor(
    private router: Router, 
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private http: HttpClient
  ) {
    this.createForm();
  }
  
  ngOnInit(): void {
    // Get booking ID and event ID from URL parameters
    this.route.queryParams.subscribe(params => {
      this.bookingId = params['booking_id'];
      this.eventId = params['event_id'];
      
      console.log('Booking ID:', this.bookingId);
      console.log('Event ID:', this.eventId);
      
      if (this.bookingId) {
        this.loadBookingData();
      } else {
        // Try to get booking data from localStorage
        const tempBooking = localStorage.getItem('tempBooking');
        if (tempBooking) {
          this.bookingData = JSON.parse(tempBooking);
          console.log('Loaded booking data from localStorage:', this.bookingData);
        }
      }
    });
  }
  
  // Load booking data from the server
  loadBookingData(): void {
    this.http.get(`${this.API_URL}/bookings/${this.bookingId}`).subscribe({
      next: (response: any) => {
        if (response.success && response.booking) {
          this.bookingData = response.booking;
          console.log('Loaded booking data from server:', this.bookingData);
        }
      },
      error: (error) => {
        console.error('Error loading booking data:', error);
        // Try to get booking data from localStorage
        const tempBooking = localStorage.getItem('tempBooking');
        if (tempBooking) {
          this.bookingData = JSON.parse(tempBooking);
          console.log('Loaded booking data from localStorage:', this.bookingData);
        }
      }
    });
  }

  // Custom validator for expiry date
  expiryDateValidator(): any {
    return (control: any) => {
      if (!control.value) {
        return null;
      }

      // Check if the format is valid
      if (!control.value.match(/^(0[1-9]|1[0-2])\/([0-9]{2})$/)) {
        return null; // Let the pattern validator handle format errors
      }

      const [month, year] = control.value.split('/');
      const expiryDate = new Date(2000 + parseInt(year), parseInt(month) - 1, 1);
      const today = new Date();

      // Set both dates to the first of the month to compare only month and year
      today.setDate(1);

      if (expiryDate < today) {
        return { 'pastDate': true };
      }

      return null;
    };
  }

  createForm() {
    this.paymentForm = this.formBuilder.group({
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      cardNumber: ['', [
        Validators.required,
        Validators.minLength(16),
        Validators.maxLength(16),
        Validators.pattern('^[0-9]{16}$')
      ]],
      expiryDate: ['', [
        Validators.required,
        Validators.pattern('^(0[1-9]|1[0-2])\\/([0-9]{2})$'),
        this.expiryDateValidator()
      ]],
      cvv: ['', [
        Validators.required,
        Validators.pattern('^[0-9]{3,4}$')
      ]]
    });
  }

  // Convenience getter for easy access to form fields
  get f() { return this.paymentForm.controls; }

  // Format card number as user types (add spaces every 4 digits)
  formatCardNumber(event: any) {
    // Get current cursor position before formatting
    const input = event.target;
    const cursorPosition = input.selectionStart;
    const inputValue = input.value;

    // Count spaces before the cursor to adjust position later
    const spacesBeforeCursor = (inputValue.substring(0, cursorPosition).match(/ /g) || []).length;

    // Remove all non-digit characters
    let trimmed = inputValue.replace(/\D/g, '');

    // Limit to 16 digits
    if (trimmed.length > 16) {
      trimmed = trimmed.substring(0, 16);
    }

    // Add spaces every 4 characters
    let formatted = '';
    for (let i = 0; i < trimmed.length; i++) {
      if (i > 0 && i % 4 === 0) {
        formatted += ' ';
      }
      formatted += trimmed[i];
    }

    // Calculate new cursor position
    // Count spaces that will be added before the cursor after formatting
    const newSpacesBeforeCursor = Math.floor(Math.min(cursorPosition, trimmed.length) / 4);
    let newCursorPosition = cursorPosition + (newSpacesBeforeCursor - spacesBeforeCursor);

    // If we're at a position where a space was just added, move cursor one position forward
    if (newCursorPosition > 0 && formatted.charAt(newCursorPosition - 1) === ' ') {
      newCursorPosition++;
    }

    // Update the form control value (raw, without spaces)
    this.paymentForm.get('cardNumber')?.setValue(trimmed, { emitEvent: false });

    // Set the formatted value to the input
    input.value = formatted;

    // Restore cursor position
    setTimeout(() => {
      input.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);

    // Trigger validation
    this.paymentForm.get('cardNumber')?.updateValueAndValidity();
  }

  // Format expiry date as user types (add / after 2 digits)
  formatExpiryDate(event: any) {
    const input = event.target;
    const cursorPosition = input.selectionStart;

    // Remove all non-digit characters
    let value = input.value.replace(/\D/g, '');

    // Limit to 4 digits (MM/YY)
    if (value.length > 4) {
      value = value.substring(0, 4);
    }

    let newCursorPosition = cursorPosition;
    let formatted = value;

    // Format as MM/YY
    if (value.length > 2) {
      // If month > 12, set it to 12
      let month = parseInt(value.substring(0, 2));
      if (month > 12) {
        month = 12;
        value = month.toString().padStart(2, '0') + value.substring(2);
      }

      formatted = value.substring(0, 2) + '/' + value.substring(2);

      // Adjust cursor position if we're after the month part
      if (cursorPosition > 2) {
        // If the slash wasn't there before but will be added now
        if (input.value.charAt(2) !== '/' && formatted.charAt(2) === '/') {
          newCursorPosition++;
        }
      }
    }

    // Set the formatted value
    input.value = formatted;

    // Store the formatted value in the form control
    this.paymentForm.get('expiryDate')?.setValue(formatted, { emitEvent: false });

    // Restore cursor position
    setTimeout(() => {
      input.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);

    // Trigger validation
    this.paymentForm.get('expiryDate')?.updateValueAndValidity();
  }

  onSubmit() {
    this.submitted = true;

    // Stop if form is invalid
    if (this.paymentForm.invalid) {
      return;
    }

    this.processing = true;

    // Get the card number input field
    const cardNumberInput = document.getElementById('cardNumber') as HTMLInputElement;
    const cardNumberValue = cardNumberInput ? cardNumberInput.value : '';
    console.log('Card number input value:', cardNumberValue);

    // Get form values
    const customerName = this.paymentForm.get('fullName')?.value;
    const customerEmail = this.paymentForm.get('email')?.value;
    
    // Update booking with customer information
    if (this.bookingId) {
      this.http.put(`${this.API_URL}/bookings/${this.bookingId}/customer`, {
        customer_name: customerName,
        customer_email: customerEmail
      }).subscribe({
        next: (response: any) => {
          console.log('Customer information updated:', response);
          this.processPayment(cardNumberValue);
        },
        error: (error) => {
          console.error('Error updating customer information:', error);
          // Continue with payment processing anyway
          this.processPayment(cardNumberValue);
        }
      });
    } else {
      // No booking ID, just process payment
      this.processPayment(cardNumberValue);
    }
  }
  
  // Process payment
  processPayment(cardNumberValue: string): void {
    // Generate a random payment ID
    const paymentId = 'PAY-' + Date.now().toString();
    
    // Simulate payment processing
    setTimeout(() => {
      // Perform payment processing logic here
      this.processing = false;

      // For demonstration purposes, we'll simulate a payment failure
      // if the card number ends with '0000'
      if (cardNumberValue && cardNumberValue.endsWith('0000')) {
        console.log('Payment failed, redirecting to booking-failed');
        // Redirect to Booking Failed page
        this.router.navigate(['/booking-failed']).then(
          success => console.log('Navigation success:', success),
          error => console.error('Navigation error:', error)
        );
      } else {
        console.log('Payment successful, updating booking status');
        
        // Update booking with payment information
        if (this.bookingId) {
          this.http.put(`${this.API_URL}/bookings/${this.bookingId}/payment`, {
            payment_method: 'Credit Card',
            payment_id: paymentId
          }).subscribe({
            next: (response: any) => {
              console.log('Payment information updated:', response);
              // Redirect to Booking Confirmation page
              this.router.navigate(['/booking-confirmation'], {
                queryParams: { booking_id: this.bookingId }
              }).then(
                success => console.log('Navigation success:', success),
                error => console.error('Navigation error:', error)
              );
            },
            error: (error) => {
              console.error('Error updating payment information:', error);
              // Still redirect to confirmation page
              this.router.navigate(['/booking-confirmation'], {
                queryParams: { booking_id: this.bookingId }
              }).then(
                success => console.log('Navigation success:', success),
                error => console.error('Navigation error:', error)
              );
            }
          });
        } else {
          // No booking ID, just redirect to confirmation page with data from localStorage
          const tempBooking = localStorage.getItem('tempBooking');
          if (tempBooking) {
            try {
              const bookingData = JSON.parse(tempBooking);
              console.log('Using booking data from localStorage:', bookingData);
              
              // Redirect to confirmation page with the booking ID from localStorage
              this.router.navigate(['/booking-confirmation'], {
                queryParams: { 
                  booking_id: bookingData.booking_id,
                  event_id: bookingData.event_id
                }
              }).then(
                success => console.log('Navigation success:', success),
                error => console.error('Navigation error:', error)
              );
            } catch (e) {
              console.error('Error parsing booking data from localStorage:', e);
              this.router.navigate(['/booking-confirmation']).then(
                success => console.log('Navigation success:', success),
                error => console.error('Navigation error:', error)
              );
            }
          } else {
            // No booking data in localStorage either
            this.router.navigate(['/booking-confirmation']).then(
              success => console.log('Navigation success:', success),
              error => console.error('Navigation error:', error)
            );
          }
        }
      }
    }, 1500);
  }
}
