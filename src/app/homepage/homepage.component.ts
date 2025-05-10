import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';
import { AppEvent } from '../app-event.model';
import { EventService } from '../services/event.service';

/*
interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  category: string;
  location: string;
  availableTickets: number;
  categoryColor?: string;
}
*/

interface UploadedImage {
  filename: string;
  data: ArrayBuffer;
  contentType: string;
}

@Component({
  selector: 'app-homepage',
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.css'],
  standalone: false
})
export class HomepageComponent implements OnInit {

  isLoading = false;
  loadingMessage: string = 'Loading events...';
  loadingFinished = false; // This flag will control the fade-out animation

  // Events
  events: AppEvent[] = [];

  constructor(
    private eventService: EventService
  ) {}

  ngOnInit(): void {
    // Load events from database with minimal spinner display time
    this.loadEvents();
  }


  searchQuery: string = '';
  filteredEvents: AppEvent[] = [];

  /*
  featuredEvents = [
    {
      id: '1',
      image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=3174&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      category: 'Music',
      title: 'Summer Music Festival',
      date: '2025-06-21',
      location: 'Nexus Arena, HELP',
      price: 'From $59',
      categoryColor: 'blue'
    },
    {
      id: '2',
      image: 'https://images.unsplash.com/photo-1568650436496-a2a288c7be3f?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      category: 'Theater',
      title: 'Broadway Night',
      date: '2025-07-15',
      location: 'Nexus Arena, HELP',
      price: 'From $79',
      categoryColor: 'purple'
    },
    {
      id: '3',
      image: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      category: 'Sports',
      title: 'Championship Finals',
      date: '2025-08-10',
      location: 'Nexus Arena, HELP',
      price: 'From $99',
      categoryColor: 'green'
    },
    {
      id: '4',
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      category: 'Tech Conference',
      title: 'Tech Innovation Summit',
      date: '2025-09-11',
      location: 'Nexus Arena, HELP',
      price: 'From $893',
      categoryColor: 'teal'
    }
  ];
  
  */

  /*
  filterEvents() {
    return this.events.filter(event => {
      const matchesCategory = this.selectedCategory ? event.category === this.selectedCategory : true;
      const matchesSearch = this.searchQuery ? event.title.toLowerCase().includes(this.searchQuery.toLowerCase()) : true;
      return matchesCategory && matchesSearch;
    });
  }
  */

  /*
  // This is for Event Details (Don't delete yet - Ryan)
  loadEvents() {
    this.isLoading = true;
    console.log('Loading events...');
    
    this.eventService.getEvents().subscribe(
      (data: AppEvent[]) => {
        this.events = data;
        console.log('Events loaded:', this.events);
        this.events.forEach(event => {
          event.files.forEach(file => {
            console.log('File data before conversion:', file.data);
            file.data = this.bufferToArrayBuffer(file.data);
            console.log('File data after conversion:', file.data);
          });
        });
        this.isLoading = false;
      },
      (error) => {
        console.error('Error fetching events', error);
        this.isLoading = false;
      }
    );
  }
  */

  loadEvents() {
    this.isLoading = true;
    this.loadingFinished = false;
    this.loadingMessage = 'Loading events...';
    
    // Set a maximum duration for showing the loader (200ms)
    const maxLoadingTime = 200;
    const loadStartTime = Date.now();
    
    this.eventService.getEvents().subscribe(
      (data: AppEvent[]) => {
        this.events = data;
        this.events.forEach(event => {
          if (event.files.length > 0) {
            const file = event.files[0];
            file.data = this.bufferToArrayBuffer(file.data);
            // Only keep the first file
            event.files = [file];
          }
        });
        
        // Initialize filtered events with all events
        this.filteredEvents = [...this.events];
        
        // Calculate time elapsed since loading started
        const elapsedTime = Date.now() - loadStartTime;
        
        // If loading was faster than our minimum display time, wait for the remainder
        // Otherwise hide immediately
        if (elapsedTime < maxLoadingTime) {
          setTimeout(() => {
            this.loadingFinished = true;
            this.isLoading = false;
          }, 0);
        } else {
          // Hide immediately if we've already shown loader long enough
          this.loadingFinished = true;
          this.isLoading = false;
        }
      },
      (error) => {
        console.error('Error fetching events', error);
        this.loadingFinished = true;
        this.isLoading = false;
      }
    );
  }

  // Search events based on the search query
  searchEvents(): void {
    // If search query is empty, show all events
    if (!this.searchQuery || this.searchQuery.trim() === '') {
      this.filteredEvents = [...this.events];
      return;
    }

    const query = this.searchQuery.toLowerCase().trim();
    
    // Only filter if query is at least 2 characters long
    if (query.length >= 2) {
      this.filteredEvents = this.events.filter(event => {
        // Format dates for string matching
        const startDate = this.extractDate(event.start_date_time);
        const startTime = this.extractTime(event.start_date_time);
        const endTime = this.extractTime(event.end_date_time);
        // Get location (currently hardcoded, but could be dynamic in the future)
        const location = this.getEventLocation(event);
        
        // Check if query exists in any of these fields
        return (
          event.event_name.toLowerCase().includes(query) ||
          (event.description && event.description.toLowerCase().includes(query)) ||
          startDate.includes(query) ||
          startTime.includes(query) ||
          endTime.includes(query) ||
          location.toLowerCase().includes(query)
        );
      });
    } else {
      // For queries less than 3 characters, show all events
      this.filteredEvents = [...this.events];
    }
  }

  bufferToArrayBuffer(buffer: any): ArrayBuffer {

    if (buffer.data) {
      buffer = buffer.data;
    }

    const arrayBuffer = new ArrayBuffer(buffer.length);
    const view = new Uint8Array(arrayBuffer);
    for (let i = 0; i < buffer.length; ++i) {
      view[i] = buffer[i];
    }
    return arrayBuffer;
  }

  getBase64Image(file: UploadedImage): string {
    console.log('File:', file);

    if (!file.data || file.data.byteLength === 0) {
      console.error('file data is empty');
      return '';
    }

    // Convert ArrayBuffer to Uint8Array
    const uint8Array = new Uint8Array(file.data);
    console.log('Uint8Array length:', uint8Array.length);

    // Convert Uint8Array to binary string
    const binary = uint8Array.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
    console.log('Binary string length:', binary.length);
    
    const base64String = btoa(binary);
    console.log('Base64:', base64String);
    
    return `data:${file.contentType};base64,${base64String}`;
  }

    // Extract date from ISO date-time string
    extractDate(dateTime: Date): string {
      return new Date(dateTime).toISOString().split('T')[0];
    }
  
    // Extract time from ISO date-time string
    extractTime(dateTime: Date): string {
      return new Date(dateTime).toISOString().split('T')[1].substring(0, 5);
    }

  // Get event location (currently hardcoded, but can be expanded later)
  getEventLocation(event: AppEvent): string {
    // This could be updated to use actual location data from the event object when available
    return 'Nexus Arena, HELP';
  }
}
