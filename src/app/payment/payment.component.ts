import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { loadStripe, Stripe, StripeElements, StripeCardElement, StripeCardElementChangeEvent } from '@stripe/stripe-js';

@Component({
  selector: 'app-payment',
  standalone: false,
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.css']
})
export class PaymentComponent implements OnInit, OnDestroy {
  paymentForm!: FormGroup;
  submitted = false;
  processing = false;
  
  // Booking data
  bookingId: string = '';
  eventId: string = '';
  bookingData: any = null;
  
  // API URL
  private API_URL = 'http://localhost:5001/api';
  
  // Stripe variables
  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private card: StripeCardElement | null = null;
  cardError: string = '';
  
  // Stripe publishable key - replace with your actual key
  private stripePublishableKey = 'pk_test_51RRFm04SIpmnAm7tI8NPjEOmmTu7M7SffNd8uoR5BZFn9DxtDeoYaVbHul1IkzaZa3QUrM8QymLys3Y7B2SKsaLN00Pf1Jm9Ew';

  // Error messages
  validationMessages = {
    fullName: [
      { type: 'required', message: 'Full name is required' },
      { type: 'minlength', message: 'Name must be at least 3 characters long' }
    ],
    email: [
      { type: 'required', message: 'Email is required' },
      { type: 'email', message: 'Please enter a valid email address' }
    ]
  };

  @ViewChild('cardElement') cardElement!: ElementRef;

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
    
    // Initialize Stripe
    this.initStripe();
  }
  
  ngOnDestroy(): void {
    // Clean up Stripe elements if needed
    if (this.card) {
      this.card.destroy();
    }
  }
  
  // Initialize Stripe
  async initStripe(): Promise<void> {
    try {
      this.stripe = await loadStripe(this.stripePublishableKey);
      
      if (!this.stripe) {
        console.error('Failed to load Stripe');
        return;
      }
      
      // Wait for the DOM to be ready
      setTimeout(() => {
        if (this.cardElement && this.cardElement.nativeElement) {
          this.setupStripeElements();
        } else {
          console.error('Card element not found in the DOM');
        }
      }, 100);
    } catch (error) {
      console.error('Error initializing Stripe:', error);
    }
  }
  
  // Setup Stripe Elements
  setupStripeElements(): void {
    if (!this.stripe) {
      console.error('Stripe not initialized');
      return;
    }
    
    this.elements = this.stripe.elements();
    
    // Create card element
    const cardElementOptions = {
      style: {
        base: {
          color: '#32325d',
          fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
          fontSmoothing: 'antialiased',
          fontSize: '16px',
          '::placeholder': {
            color: '#aab7c4'
          }
        },
        invalid: {
          color: '#fa755a',
          iconColor: '#fa755a'
        }
      }
    };
    
    this.card = this.elements.create('card', cardElementOptions);
    this.card.mount(this.cardElement.nativeElement);
    
    // Add event listener for changes
    this.card.on('change', (event: StripeCardElementChangeEvent) => {
      this.cardError = event.error ? event.error.message : '';
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

  createForm() {
    this.paymentForm = this.formBuilder.group({
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]]
    });
  }

  // Convenience getter for easy access to form fields
  get f() { return this.paymentForm.controls; }

  onSubmit() {
    this.submitted = true;

    // Stop if form is invalid
    if (this.paymentForm.invalid) {
      return;
    }

    this.processing = true;

    // Get form values
    const customerName = this.paymentForm.get('fullName')?.value;
    const customerEmail = this.paymentForm.get('email')?.value;
    
    // First update customer information
    if (this.bookingId) {
      this.http.put(`${this.API_URL}/bookings/${this.bookingId}/customer`, {
        customer_name: customerName,
        customer_email: customerEmail
      }).subscribe({
        next: (response: any) => {
          console.log('Customer information updated:', response);
          this.createPaymentIntent();
        },
        error: (error) => {
          console.error('Error updating customer information:', error);
          // Continue with payment processing anyway
          this.createPaymentIntent();
        }
      });
    } else {
      // No booking ID, just process payment
      this.createPaymentIntent();
    }
  }
  
  // Create a payment intent on the server
  createPaymentIntent(): void {
    const amount = this.bookingData?.total || 0;
    
    this.http.post(`${this.API_URL}/payments/create-payment-intent`, {
      amount: amount * 100, // Convert to cents for Stripe
      currency: 'usd',
      booking_id: this.bookingId
    }).subscribe({
      next: (response: any) => {
        if (response.clientSecret) {
          this.confirmCardPayment(response.clientSecret);
        } else {
          this.handlePaymentError('Failed to create payment intent');
        }
      },
      error: (error) => {
        console.error('Error creating payment intent:', error);
        this.handlePaymentError('Failed to create payment intent');
      }
    });
  }
  
  // Confirm card payment with Stripe
  async confirmCardPayment(clientSecret: string): Promise<void> {
    if (!this.stripe || !this.card) {
      this.handlePaymentError('Stripe not initialized');
      return;
    }
    
    try {
      const result = await this.stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: this.card,
          billing_details: {
            name: this.paymentForm.get('fullName')?.value,
            email: this.paymentForm.get('email')?.value
          }
        }
      });
      
      if (result.error) {
        // Show error to customer
        this.handlePaymentError(result.error.message || 'Payment failed');
      } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        // Payment succeeded
        this.handlePaymentSuccess(result.paymentIntent.id);
      } else {
        this.handlePaymentError('Payment status unknown');
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      this.handlePaymentError('An unexpected error occurred');
    }
  }
  
  // Handle payment error
  handlePaymentError(errorMessage: string): void {
    console.error('Payment error:', errorMessage);
    this.processing = false;
    this.cardError = errorMessage;
    
    // For demo purposes, you can simulate a payment failure with a specific email
    if (this.paymentForm.get('email')?.value.includes('fail')) {
      this.router.navigate(['/booking-failed']).then(
        success => console.log('Navigation success:', success),
        error => console.error('Navigation error:', error)
      );
    }
  }
  
  // Handle successful payment
  handlePaymentSuccess(paymentId: string): void {
    console.log('Payment successful, updating booking status');
    this.processing = false;
    
    // Update booking with payment information
    if (this.bookingId) {
      this.http.put(`${this.API_URL}/bookings/${this.bookingId}/payment`, {
        payment_method: 'Stripe',
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
}
