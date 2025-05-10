import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppEvent } from '../app-event.model';

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private apiUrl = 'http://localhost:5001/api/events';

  constructor(private http: HttpClient) { }

  getEvents(): Observable<AppEvent[]> {
    return this.http.get<AppEvent[]>(this.apiUrl);
  }

  getEventsByOrganizerId(organizerId: string): Observable<AppEvent[]> {
    const params = new HttpParams().set('organizer_id', organizerId);
    return this.http.get<AppEvent[]>(this.apiUrl, { params });
  }

  getEventById(id: string): Observable<AppEvent> {
    return this.http.get<AppEvent>(`${this.apiUrl}/${id}`);
  }
  
  createEvent(formData: FormData): Observable<any> {
    return this.http.post(this.apiUrl, formData);
  }
  
  updateEvent(event: AppEvent): Observable<any> {
    // Create FormData to handle file uploads properly
    const formData = new FormData();
    
    // Add event basic info
    formData.append('event_name', event.event_name?.toString() || '');
    formData.append('description', event.description?.toString() || '');
    
    // Format dates as ISO strings
    const startDate = event.start_date_time instanceof Date
      ? event.start_date_time.toISOString()
      : new Date(event.start_date_time || '').toISOString();
      
    const endDate = event.end_date_time instanceof Date
      ? event.end_date_time.toISOString()
      : new Date(event.end_date_time || '').toISOString();
      
    formData.append('start_date_time', startDate);
    formData.append('end_date_time', endDate);
    formData.append('organizer_id', event.organizer_id?.toString() || '');
    
    // Add ticket types and discounts as JSON strings
    if (event.ticketTypes) {
      formData.append('ticketTypes', JSON.stringify(event.ticketTypes));
    }
    
    if (event.discounts) {
      formData.append('discounts', JSON.stringify(event.discounts));
    }
    
    // If there are files, add them
    if (event.files && event.files.length > 0) {
      event.files.forEach((file, index) => {
        if (file && file.data) {
          const blob = new Blob([file.data], { type: file.contentType || 'application/octet-stream' });
          formData.append('files', blob, file.filename || `file${index}.bin`);
        }
      });
    }
    
    return this.http.put(`${this.apiUrl}/${event.pk_event_id}`, formData);
  }
  
  deleteEvent(eventId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${eventId}`);
  }
}