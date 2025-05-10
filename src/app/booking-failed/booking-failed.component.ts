import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-booking-failed',
  templateUrl: './booking-failed.component.html',
  styleUrls: ['./booking-failed.component.css'],
  standalone: false
})
export class BookingFailedComponent implements OnInit {
  errorCode = 'ERR-4032';
  errorMessage = 'Payment processing failed';
  eventName = 'Tech Innovation Summit 2025';
  eventDate = '2025-11-01';
  eventTime = '10:00 AM';
  
  constructor(private router: Router) { }

  ngOnInit() {
    // Add a class to the body to prevent scrolling while on this page
    document.body.classList.add('failed-page');
    
    // Load Font Awesome if not already loaded
    this.loadFontAwesome();
    
    // Animate the error icon
    this.animateErrorIcon();
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
  
  // Animate the error icon with a shake effect
  animateErrorIcon() {
    setTimeout(() => {
      const errorIcon = document.querySelector('.error-icon');
      if (errorIcon) {
        errorIcon.classList.add('shake');
      }
    }, 500);
  }

  retry() {
    // Remove the body class when navigating away
    document.body.classList.remove('failed-page');
    // Navigate back to the payment page
    this.router.navigate(['/payment']);
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