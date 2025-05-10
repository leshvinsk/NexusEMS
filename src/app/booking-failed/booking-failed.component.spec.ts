import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BookingFailedComponent } from './booking-failed.component';

describe('BookingFailedComponent', () => {
  let component: BookingFailedComponent;
  let fixture: ComponentFixture<BookingFailedComponent>;
  let routerSpy = { navigate: jasmine.createSpy('navigate') };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BookingFailedComponent],
      providers: [
        { provide: Router, useValue: routerSpy }
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BookingFailedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default error properties', () => {
    expect(component.errorCode).toBeDefined();
    expect(component.errorMessage).toBeDefined();
    expect(component.eventName).toBeDefined();
    expect(component.eventDate).toBeDefined();
    expect(component.eventTime).toBeDefined();
  });

  it('should add failed-page class to body on init', () => {
    component.ngOnInit();
    expect(document.body.classList.contains('failed-page')).toBeTrue();
  });

  it('should navigate to payment page on retry', () => {
    component.retry();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/payment']);
  });

  it('should remove failed-page class from body on retry', () => {
    document.body.classList.add('failed-page');
    component.retry();
    expect(document.body.classList.contains('failed-page')).toBeFalse();
  });

  it('should create and show toast notification', () => {
    const message = 'Test message';
    component.showToast(message);
    
    // Check if toast element was created
    const toast = document.querySelector('.toast-notification');
    expect(toast).toBeTruthy();
    expect(toast?.textContent).toBe(message);
    
    // Clean up
    if (toast) {
      document.body.removeChild(toast);
    }
  });

  it('should animate error icon', () => {
    // Create mock error icon
    const errorIcon = document.createElement('div');
    errorIcon.className = 'error-icon';
    document.body.appendChild(errorIcon);
    
    component.animateErrorIcon();
    
    // Use setTimeout to wait for the animation to be applied
    setTimeout(() => {
      expect(errorIcon.classList.contains('shake')).toBeTrue();
      
      // Clean up
      document.body.removeChild(errorIcon);
    }, 600);
  });

  afterEach(() => {
    // Clean up any classes added to body
    document.body.classList.remove('failed-page');
    
    // Remove any toast notifications that might be left
    const toasts = document.querySelectorAll('.toast-notification');
    toasts.forEach(toast => {
      document.body.removeChild(toast);
    });
  });
});