import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class OrganizerService {
  private apiUrl = 'http://localhost:5001/api/organizers';
  
  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }
  
  // Get auth headers with token
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'x-auth-token': token || ''
    });
  }
  
  // Register a new organizer
  registerOrganizer(organizer: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, organizer, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(error => {
          console.error('Organizer registration error:', error);
          return throwError(() => error);
        })
      );
  }
  
  // Get all organizers
  getOrganizers(): Observable<any> {
    return this.http.get<any>(this.apiUrl, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(error => {
          console.error('Error getting organizers:', error);
          return throwError(() => error);
        })
      );
  }

  // Delete an organizer
  deleteOrganizer(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(error => {
          console.error('Error deleting organizer:', error);
          return throwError(() => error);
        })
      );
  }
} 