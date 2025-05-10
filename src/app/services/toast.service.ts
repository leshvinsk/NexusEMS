import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  constructor() {}

  success(message: string, duration: number = 3000): void {
    this.showNotification(message, 'success', duration);
  }

  error(message: string, duration: number = 5000): void {
    this.showNotification(message, 'error', duration);
  }

  info(message: string, duration: number = 3000): void {
    this.showNotification(message, 'info', duration);
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info', duration: number): void {
    // Look for existing notification container
    let container = document.querySelector('.toast-container') as HTMLDivElement | null;
    
    // Create container if it doesn't exist
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.style.position = 'fixed';
      container.style.top = '20px';
      container.style.right = '20px';
      container.style.zIndex = '9999';
      document.body.appendChild(container);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Apply styles
    toast.style.padding = '12px 20px';
    toast.style.marginBottom = '10px';
    toast.style.borderRadius = '4px';
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toast.style.display = 'flex';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease-in-out';
    
    // Apply type-specific styles
    if (type === 'success') {
      toast.style.backgroundColor = '#4CAF50';
      toast.style.color = 'white';
    } else if (type === 'error') {
      toast.style.backgroundColor = '#f44336';
      toast.style.color = 'white';
    } else {
      toast.style.backgroundColor = '#2196F3';
      toast.style.color = 'white';
    }
    
    // Add to container
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);
    
    // Remove after duration
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        // Ensure container still exists and contains toast
        if (container && container.contains(toast)) {
          container.removeChild(toast);
        }
        
        // Clean up container if empty
        if (container && container.children.length === 0 && document.body.contains(container)) {
          document.body.removeChild(container);
        }
      }, 300);
    }, duration);
  }
} 