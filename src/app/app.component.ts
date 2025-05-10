import { Component, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'NexusEMS';

  constructor(private authService: AuthService) {}

  ngOnInit() {
    console.log('App initialized, checking token...');
    const token = localStorage.getItem('token');
    console.log('Token exists:', !!token);
    if (token) {
      console.log('Token length:', token.length);
      console.log('First few chars:', token.substring(0, 10) + '...');
      
      try {
        // Decode token (just the payload part)
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        console.log('Token payload:', jsonPayload);
        
        // Check token expiration
        const payload = JSON.parse(jsonPayload);
        const expirationDate = new Date(payload.exp * 1000);
        const now = new Date();
        console.log('Token expires:', expirationDate);
        console.log('Token expired:', expirationDate < now);
      } catch(e) {
        console.error('Error decoding token:', e);
      }
    }
    
    // Check user role
    console.log('User role:', localStorage.getItem('userRole'));
    console.log('Logged user data exists:', !!localStorage.getItem('loggedUser'));

    // Ensure existing data is secured
    this.authService.secureExistingData();
  }
}
