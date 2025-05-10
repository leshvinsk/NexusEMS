import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:5001/api/auth';
  private token: string | null = null;
  
  // Encryption key - in a real application, this should be more securely managed
  private encryptionKey = 'NexusEMS2024SecureKey';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.token = localStorage.getItem('token');
    
    // Immediately secure any existing user data
    this.secureExistingData();
  }
  
  // Get auth token from local storage
  getToken(): string | null {
    return localStorage.getItem('token');
  }
  
  // Check if user is logged in
  isLoggedIn(): boolean {
    return !!this.getToken();
  }
  
  // Encrypt data before storing in localStorage
  private encryptData(data: any): string {
    try {
      // Convert data to string
      const jsonString = JSON.stringify(data);
      
      // Simple XOR encryption - this is a basic implementation
      // For production, use a proper encryption library
      let encrypted = '';
      for (let i = 0; i < jsonString.length; i++) {
        const charCode = jsonString.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
        encrypted += String.fromCharCode(charCode);
      }
      
      // Convert to base64 for storage
      return btoa(encrypted);
    } catch (e) {
      console.error('Encryption error:', e);
      return '';
    }
  }

  // Decrypt data from localStorage
  private decryptData(encryptedData: string | null): any {
    try {
      if (!encryptedData) return null;
      
      // First check if this is already JSON (not encrypted)
      if (encryptedData.startsWith('{') || encryptedData.startsWith('[')) {
        console.warn('Data is not encrypted, encrypting now...');
        const parsedData = JSON.parse(encryptedData);
        // Re-encrypt it immediately
        setTimeout(() => this.secureExistingData(), 0);
        return parsedData;
      }
      
      // Try to decode from base64
      try {
        const encrypted = atob(encryptedData);
        
        // Reverse the XOR encryption
        let decrypted = '';
        for (let i = 0; i < encrypted.length; i++) {
          const charCode = encrypted.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
          decrypted += String.fromCharCode(charCode);
        }
        
        // Parse back to object
        return JSON.parse(decrypted);
      } catch (decryptError) {
        console.error('Failed to decrypt. Data might not be in expected format:', decryptError);
        return null;
      }
    } catch (e) {
      console.error('Decryption error:', e);
      return null;
    }
  }

  // Immediately secure existing data in localStorage
  public secureExistingData(): void {
    try {
      // Check if we have user data that needs securing
      const rawUserData = localStorage.getItem('loggedUser');
      if (rawUserData && (rawUserData.startsWith('{') || rawUserData.startsWith('['))) {
        console.log('Securing existing user data...');
        // Parse the current data
        const userData = JSON.parse(rawUserData);
        // Get the role
        const userRole = localStorage.getItem('userRole') || userData.role || '';
        // Encrypt and store it properly
        this.storeUserData(userData, userRole);
        console.log('User data secured.');
      }
    } catch (e) {
      console.error('Error securing existing data:', e);
    }
  }

  // Store user data securely
  private storeUserData(userData: any, role: string): void {
    // Store encrypted user data
    localStorage.setItem('loggedUser', this.encryptData(userData));
    // Role can be stored as-is for easier access
    localStorage.setItem('userRole', role);
  }

  // Update user data - public method that can be called from components
  public updateUserData(userData: any, role: string): void {
    console.log('Updating user data:', userData);
    
    // Ensure ID fields are preserved
    if (userData.id && !userData._id) {
      userData._id = userData.id;
    } else if (userData._id && !userData.id) {
      userData.id = userData._id;
    }
    
    console.log('User data after ID normalization:', userData);
    this.storeUserData(userData, role);
  }

  // Get current user data
  getCurrentUser(): any {
    const encryptedUserData = localStorage.getItem('loggedUser');
    console.log('Encrypted user data exists:', !!encryptedUserData);
    const userData = this.decryptData(encryptedUserData);
    console.log('Decrypted user data keys:', userData ? Object.keys(userData) : 'No user data');
    
    // Debug contact_no specifically
    if (userData) {
      console.log('contact_no in user data:', userData.contact_no);
    }
    
    return userData;
  }
  
  // Get auth headers with token
  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    
    // Debug token for authorization issues
    if (token) {
      try {
        // Decode token to check expiration
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        const payload = JSON.parse(jsonPayload);
        const expirationDate = new Date(payload.exp * 1000);
        const now = new Date();
        
        if (expirationDate < now) {
          console.error('Token expired at', expirationDate);
          console.error('Current time is', now);
          console.error('Token expired - clearing token and redirecting to login');
          this.logout();
          return new HttpHeaders();
        }
      } catch (e) {
        console.error('Error checking token expiration:', e);
      }
    } else {
      console.error('No token found in local storage');
    }
    
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'x-auth-token': token || ''
    });
  }

  // User login - checks both admin and organizer collections
  login(credentials: any): Observable<any> {
    console.log('Attempting login with credentials for:', credentials.username);
    
    return this.http.post<any>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap(response => {
          console.log('Login response received');
          console.log('Full login response:', JSON.stringify(response));
          
          if (response && response.token) {
            // Store token
            localStorage.setItem('token', response.token);
            this.token = response.token;
            
            // Make sure we have the contact_no in the user data
            if (response.user) {
              console.log('User data from login response:', response.user);
              
              // Ensure all admin fields are included
              if (response.user.role === 'Administrator' || response.isAdmin) {
                // We need to ensure contact_no is included in the stored data
                const adminData = {
                  ...response.user,
                  contact_no: response.user.contact_no  // This might be undefined
                };
                
                // Store user info securely with all fields
                this.storeUserData(adminData, 'Administrator');
                console.log('Admin data stored with fields:', Object.keys(adminData));
              } else {
                // Store user info securely
                this.storeUserData(response.user, response.user.role);
                console.log('User authenticated as:', response.user.role);
              }
            }
          }
        }),
        catchError(error => {
          console.error('Login error:', error);
          return throwError(() => error);
        })
      );
  }

  // User logout
  logout(): void {
    // Clear all sensitive data from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('loggedUser');
    localStorage.removeItem('userRole');
    this.token = null;
    this.router.navigate(['/login']);
  }

  // Get authenticated user data
  getAuthUser(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/user`, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(error => {
          console.error('Error getting auth user:', error);
          return throwError(() => error);
        })
      );
  }

  // Reset password with email
  resetPassword(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reset-password`, { email })
      .pipe(
        catchError(error => {
          console.error('Password reset error:', error);
          return throwError(() => error);
        })
      );
  }

  register(user: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, user);
  }

  checkCommunity(communityName: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/check-community`, { communityName });
  }

  // Change password
  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    // Log token for debugging
    const token = this.getToken();
    console.log('Token exists:', !!token);
    console.log('Token length:', token?.length);
    console.log('First 10 chars of token:', token?.substring(0, 10));
    console.log('Auth headers:', this.getAuthHeaders());
    
    return this.http.post<any>(`${this.apiUrl}/change-password`, 
      { currentPassword, newPassword },
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Password change error:', error);
        
        // Enhance error messages based on common server responses
        if (error.status === 400) {
          if (error.error && error.error.error === 'Current password is incorrect') {
            return throwError(() => ({
              ...error,
              error: { message: 'The current password you entered does not match your registered current password' }
            }));
          } 
        } else if (error.status === 401) {
          console.error('Authentication error - token may be invalid or expired');
          // Clear token and redirect to login
          localStorage.removeItem('token');
          this.router.navigate(['/login']);
          return throwError(() => ({
            ...error,
            error: { message: 'Your session has expired. Please log in again.' }
          }));
        } else if (error.status === 404) {
          return throwError(() => ({
            ...error,
            error: { message: 'Account not found. Please log in again.' }
          }));
        }
        
        return throwError(() => error);
      })
    );
  }

  // Universal login - tries both admin and organizer authentication
  universalLogin(credentials: any): Observable<any> {
    console.log('Attempting universal login with credentials:', credentials);
    // First try the original login method which might still be working
    return this.http.post<any>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap(response => {
          console.log('Universal login response:', response);
          if (response && response.token) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('loggedUser', JSON.stringify(response.user));
            this.token = response.token;
            
            // Store role based on user ID prefix
            if (response.user.admin_id && response.user.admin_id.startsWith('A')) {
              localStorage.setItem('userRole', 'Administrator');
            } else if (response.user.organizer_id && response.user.organizer_id.startsWith('E')) {
              localStorage.setItem('userRole', 'Organizer');
            }
          }
        }),
        catchError(error => {
          console.error('Universal login error:', error);
          return throwError(() => error);
        })
      );
  }

  // Organizer login
  loginOrganizer(credentials: any): Observable<any> {
    console.log('Attempting organizer login for:', credentials.username);
    // Modify the credentials to include a hint for the backend
    const orgCredentials = {
      ...credentials,
      loginType: 'organizer' // Add a hint that this is an organizer login attempt
    };
    
    return this.http.post<any>(`${this.apiUrl}/login`, orgCredentials)
      .pipe(
        tap(response => {
          console.log('Organizer login response:', response);
          if (response && response.token) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('loggedUser', JSON.stringify(response.organizer || response.user));
            localStorage.setItem('userRole', 'Organizer');
            this.token = response.token;
          }
        }),
        catchError(error => {
          console.error('Organizer login error:', error);
          return throwError(() => error);
        })
      );
  }

  // Admin login
  loginAdmin(credentials: any): Observable<any> {
    console.log('Attempting admin login for:', credentials.username);
    // Modify the credentials to include a hint for the backend
    const adminCredentials = {
      ...credentials,
      loginType: 'admin' // Add a hint that this is an admin login attempt
    };
    
    return this.http.post<any>(`${this.apiUrl}/login`, adminCredentials)
      .pipe(
        tap(response => {
          console.log('Admin login response:', response);
          if (response && response.token) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('loggedUser', JSON.stringify(response.admin || response.user));
            localStorage.setItem('userRole', 'Administrator');
            this.token = response.token;
          }
        }),
        catchError(error => {
          console.error('Admin login error:', error);
          return throwError(() => error);
        })
      );
  }
} 