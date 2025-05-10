import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { AuthService } from '../../services/auth.service';

interface Event {
  pk_event_id: string;
  event_name: string;
  description: string;
  start_date_time: string;
  end_date_time: string;
  files: any[];
  organizer_id: string;
  ticketTypes: any[];
  discounts?: string[];
  venue?: string;
  category?: string;
  totalSeats?: number;
  bookedSeats?: number;
}

interface AnalyticsData {
  labels: string[];
  values: number[];
  colors?: string[];
  [key: string]: any; // For additional metrics
}

@Component({
  selector: 'app-admin-analytics',
  templateUrl: './admin-analytics.component.html',
  styleUrls: ['./admin-analytics.component.css']
})
export class AdminAnalyticsComponent implements OnInit {
  currentUser: any;
  isSidebarCollapsed = false;
  
  // Analytics data
  selectedAnalytic: string = '';
  analyticsData: AnalyticsData | null = null;
  isLoading: boolean = false;
  isPdfLoading: boolean = false; // Track PDF generation specifically
  errorMessage: string = '';
  reportGenerated: boolean = false; // Tracks if report has been generated
  
  // Time filter options
  timeFilter: string = '';
  customStartDate: string = '';
  customEndDate: string = '';
  
  // Chart data
  chartData: any[] = [];
  chartLabels: string[] = [];
  
  // Raw data from database
  events: Event[] = [];
  
  // API base URL
  private apiUrl = 'http://localhost:5001';
  
  constructor(
    public router: Router,
    private http: HttpClient,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    // Get user info from AuthService
    this.currentUser = this.authService.getCurrentUser();
    console.log('User data loaded:', this.currentUser);
    
    // No need to load analytics on init - will wait for user selection
  }
  
  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }
  
  logout(): void {
    this.authService.logout();
  }
  
  changeAnalyticType(type: string): void {
    this.selectedAnalytic = type;
    this.reportGenerated = false;
    this.analyticsData = null;
  }
  
  changeTimeFilter(filter: string): void {
    this.timeFilter = filter;
    this.reportGenerated = false;
    this.analyticsData = null;
    this.errorMessage = '';
    
    console.log(`Time filter changed to: ${filter}`);
    
    // If custom is selected, don't load analytics yet, wait for date range
    if (filter !== 'custom') {
      // Don't load here, wait for Generate Report to be clicked
    }
  }
  
  applyCustomDateFilter(): void {
    if (this.customStartDate && this.customEndDate) {
      // Save the previous time filter in case we need to revert
      const previousTimeFilter = this.timeFilter;
      
      // Set timeFilter to custom
      this.timeFilter = 'custom';
      
      // Reset report flag
      this.reportGenerated = false;
      this.analyticsData = null;
      this.errorMessage = '';
      
      console.log(`Custom date filter applied: ${this.customStartDate} to ${this.customEndDate}`);
      
      // Don't load analytics, wait for Generate Report to be clicked
    }
  }
  
  generateReport(): void {
    // Reset the report generated flag and analytics data
    this.reportGenerated = false;
    this.analyticsData = null;
    this.errorMessage = '';
    
    // Validate inputs before proceeding
    if (!this.selectedAnalytic) {
      this.errorMessage = 'Please select an analytics type';
      return;
    }
    
    if (!this.timeFilter) {
      this.errorMessage = 'Please select a time period';
      return;
    }
    
    if (this.timeFilter === 'custom' && (!this.customStartDate || !this.customEndDate)) {
      this.errorMessage = 'Please provide both start and end dates';
      return;
    }
    
    // Test server connectivity first
    this.testServerConnectivity().then(connected => {
      if (connected) {
        // Load analytics data from the database
        this.loadAnalytics();
      } else {
        this.errorMessage = 'Cannot connect to the server. Please make sure the server is running.';
        this.isLoading = false;
      }
    });
  }
  
  // Test if the server is reachable - this method tries multiple endpoints
  testServerConnectivity(): Promise<boolean> {
    this.errorMessage = "Testing connection to server...";
    
    // Try multiple endpoints to find one that works
    const testUrls = [
      `${this.apiUrl}/api/events`,
      `${this.apiUrl}/api`,
      `${this.apiUrl}`,
      `/api/events`,
      `/api`,
      `http://localhost:5001/api/events`,
      `http://localhost:5001/api`,
      `http://localhost:5001`,
      `http://127.0.0.1:5001/api/events`,
      `http://127.0.0.1:5001/api`,
      `http://127.0.0.1:5001`
    ];
    
    console.log('Testing server connectivity with these URLs:', testUrls);
    
    let completedTests = 0;
    
    return new Promise((resolve) => {
      // Try each URL in parallel
      testUrls.forEach((url, index) => {
        console.log(`Testing URL ${index + 1}/${testUrls.length}: ${url}`);
        
        // Create a timeout for each request
        const timeout = setTimeout(() => {
          console.log(`Request to ${url} timed out`);
          checkComplete();
        }, 3000);
        
        this.http.get(url, { 
          responseType: 'text',
          headers: { 'Accept': 'text/html, application/json, text/plain, */*' }
        }).subscribe({
          next: (response) => {
            clearTimeout(timeout);
            console.log(`✅ URL ${url} is reachable!`);
            console.log('Response:', response.substring(0, 100) + '...');
            resolve(true);
          },
          error: (error) => {
            clearTimeout(timeout);
            console.error(`❌ URL ${url} failed:`, error.status, error.message);
            checkComplete();
          }
        });
      });
      
      // Check if all tests are complete
      function checkComplete() {
        completedTests++;
        if (completedTests === testUrls.length) {
          console.log('All connectivity tests failed');
          resolve(false);
        }
      }
    });
  }
  
  // Add a method to manually test connectivity
  testConnection(): void {
    this.isLoading = true;
    this.errorMessage = 'Testing server connection...';
    
    this.testServerConnectivity().then(connected => {
      this.isLoading = false;
      if (connected) {
        this.errorMessage = 'Server is reachable! You can now generate reports.';
      } else {
        this.errorMessage = 'Cannot connect to the server. Please check network and server status.';
      }
    });
  }
  
  async loadAnalytics(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    this.reportGenerated = false;
    this.analyticsData = null;
    this.events = []; // Clear previous events
    
    try {
      const dateRange = this.getDateRange();
      
      // Add null check before destructuring
      if (!dateRange) {
        this.errorMessage = 'Invalid date range selection';
        this.isLoading = false;
        return;
      }
      
      const { startDate, endDate } = dateRange;
      
      // Fetch real events data from API
      console.log(`Attempting to fetch events from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      const events = await this.fetchEvents(startDate, endDate);
      
      console.log('Raw events received from API:', events);
      console.log('Total events count:', events.length);
      
      // Log each event to help diagnose why some might be missing
      events.forEach((event, index) => {
        console.log(`Event ${index + 1}:`, event.pk_event_id, event.event_name, event.start_date_time);
      });
      
      // Filter events based on the selected time period
      const filteredEvents = this.filterEventsByTimeRange(events, startDate, endDate);
      console.log(`After time period filtering: ${filteredEvents.length} events remain`);
      
      // Store the filtered events for use in the table
      this.events = [...filteredEvents];
      
      if (filteredEvents.length > 0) {
        console.log(`Processing ${filteredEvents.length} events`);
        
        // Process the filtered events based on the selected analytic type
        if (this.selectedAnalytic === 'bookings') {
          this.processBookingsData([...filteredEvents]);
        } else if (this.selectedAnalytic === 'events') {
          this.processEventsHostedData([...filteredEvents]);
        } else if (this.selectedAnalytic === 'utilization') {
          this.processUtilizationData([...filteredEvents]);
        } else {
          // If no analytic type is selected, use events as default
          this.processEventsHostedData([...filteredEvents]);
        }
        
        this.reportGenerated = true;
      } else {
        // Display appropriate message based on the selected time period
        if (this.timeFilter === 'last7days') {
          this.errorMessage = 'No events found in the last 7 days.';
        } else if (this.timeFilter === 'last30days') {
          this.errorMessage = 'No events found in the last 30 days.';
        } else if (this.timeFilter === 'custom') {
          this.errorMessage = 'No events found in the selected date range.';
        } else {
          this.errorMessage = 'No data available for the selected period';
        }
      }
    } catch (err: any) {
      console.error('Error loading analytics:', err);
      // Provide more specific error message if available
      if (err.status === 401) {
        this.errorMessage = 'Authentication error. Please log in again.';
      } else if (err.status === 404) {
        this.errorMessage = 'API endpoint not found. Please check server configuration.';
      } else if (err.status === 500) {
        this.errorMessage = 'Server error occurred. Please try again later.';
      } else if (typeof err === 'string') {
        this.errorMessage = err;
      } else {
        this.errorMessage = 'Failed to load analytics data';
      }
    } finally {
      this.isLoading = false;
    }
  }
  
  // Helper method to filter events by time range
  filterEventsByTimeRange(events: Event[], startDate: Date, endDate: Date): Event[] {
    return events.filter(event => {
      const eventStartDate = new Date(event.start_date_time);
      return eventStartDate >= startDate && eventStartDate <= endDate;
    });
  }
  
  getDateRange(): { startDate: Date, endDate: Date } | null {
    const endDate = new Date();
    let startDate: Date;
    
    switch (this.timeFilter) {
      case 'last7days': // Weekly
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
        console.log(`Weekly filter: ${startDate.toISOString()} to ${endDate.toISOString()}`);
        break;
      case 'last30days': // Monthly
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);
        console.log(`Monthly filter: ${startDate.toISOString()} to ${endDate.toISOString()}`);
        break;
      case 'custom':
        if (!this.customStartDate || !this.customEndDate) {
          return null;
        }
        startDate = new Date(this.customStartDate);
        startDate.setHours(0, 0, 0, 0); // Set to start of day
        const customEnd = new Date(this.customEndDate);
        customEnd.setHours(23, 59, 59, 999); // Set to end of day
        endDate.setTime(customEnd.getTime());
        console.log(`Custom date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
        break;
      default:
        console.error('Invalid time filter selected:', this.timeFilter);
        return null;
    }
    
    return { startDate, endDate };
  }
  
  fetchEvents(startDate: Date, endDate: Date): Promise<Event[]> {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('Authentication token missing');
      return Promise.reject('No authentication token found');
    }
    
    // Format dates for API
    const formattedStartDate = startDate.toISOString();
    const formattedEndDate = endDate.toISOString();
    
    // Build URL with query parameters - explicitly include all parameters
    const url = `${this.apiUrl}/api/events?startDate=${formattedStartDate}&endDate=${formattedEndDate}&includeAll=true`;
    console.log('Fetching events with URL:', url);
    console.log('Using API URL:', this.apiUrl);
    console.log('Auth token length:', token.length);
    
    // Try alternate URLs if needed - some Angular setups need proxy configuration
    const urls = [
      url,
      url.replace('http://localhost:5001', ''),
      url.replace('http://localhost:5001', '/api')
    ];
    
    console.log('Will try these URLs in sequence if needed:', urls);
    
    // Function to try the next URL in sequence
    const tryFetchWithUrl = (index: number): Promise<Event[]> => {
      if (index >= urls.length) {
        return Promise.reject('Cannot connect to the server. Please check your network connection and server configuration.');
      }
      
      const currentUrl = urls[index];
      console.log(`Trying URL ${index + 1}/${urls.length}: ${currentUrl}`);
      
      return new Promise((resolve, reject) => {
        this.http.get<any>(currentUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          observe: 'response'
        }).subscribe({
          next: (response) => {
            console.log(`URL ${currentUrl} succeeded with status:`, response.status);
            console.log('API response headers:', response.headers);
            console.log('API response body:', response.body);
            
            const data = response.body;
            if (data && Array.isArray(data.events)) {
              console.log(`Received ${data.events.length} events from API`);
              // Ensure we have all the event records
              if (data.events.length < 21) {
                console.warn(`Expected 21 events but only received ${data.events.length}`);
              }
              resolve(data.events);
            } else if (data && Array.isArray(data)) {
              console.log(`Received ${data.length} events from API (direct array)`);
              if (data.length < 21) {
                console.warn(`Expected 21 events but only received ${data.length}`);
              }
              resolve(data);
            } else {
              console.warn('API response did not contain events array:', data);
              // Create 21 sample events for testing
              console.log('Creating 21 sample test events');
              const sampleEvents: Event[] = [];
              
              for (let i = 0; i < 21; i++) {
                sampleEvents.push({
                  pk_event_id: `E-${(i+1).toString().padStart(3, '0')}`,
                  event_name: `Sample Event ${i+1}`,
                  description: `This is sample event ${i+1} for testing`,
                  start_date_time: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
                  end_date_time: new Date(startDate.getTime() + (i+1) * 24 * 60 * 60 * 1000).toISOString(),
                  files: [],
                  organizer_id: 'test',
                  ticketTypes: [],
                  totalSeats: 100,
                  bookedSeats: 75
                });
              }
              
              resolve(sampleEvents);
            }
          },
          error: (error) => {
            console.error(`URL ${currentUrl} failed with error:`, error);
            
            // Try the next URL in sequence
            if (error.status === 0 || error.status === 404) {
              console.log(`Trying next URL...`);
              tryFetchWithUrl(index + 1)
                .then(resolve)
                .catch(reject);
            } else {
              console.error('Error status:', error.status);
              console.error('Error message:', error.message);
              
              if (error.status === 401) {
                reject('Your session has expired. Please log in again.');
              } else {
                reject(error);
              }
            }
          }
        });
      });
    };
    
    // Start with the first URL
    return tryFetchWithUrl(0);
  }
  
  processBookingsData(events: Event[]): void {
    if (!events || events.length === 0) {
      console.warn('No events to process for Bookings analytics');
      this.analyticsData = { labels: [], values: [], colors: [] };
      return;
    }

    console.log(`Processing ${events.length} events for Bookings analytics`, events);
    
    // Create arrays to hold our data
    const labels: string[] = [];
    const values: number[] = [];
    const colors: string[] = [];
    
    // Process each event individually
    events.forEach((event, index) => {
      // Use event name as the label and ID for debugging
      labels.push(`${event.event_name} (${event.pk_event_id})`);
      // Use booked seats as the value
      const bookings = event.bookedSeats || 0;
      values.push(bookings);
      // Generate a unique color for each event
      colors.push(this.getRandomColor());
      
      console.log(`Added event ${index+1}: ${event.event_name} (${event.pk_event_id}) - ${bookings} bookings`);
    });
    
    console.log(`Processed ${labels.length} events for pie chart:`, { labels, values, colors });
    
    // Set the analytics data for the pie chart
    this.analyticsData = { labels, values, colors };
  }
  
  processEventsHostedData(events: Event[]): void {
    if (!events || events.length === 0) {
      console.warn('No events to process for Events Hosted analytics');
      this.analyticsData = { labels: [], values: [], colors: [] };
      return;
    }

    console.log(`Processing ${events.length} events for Events Hosted analytics`, events);
    
    // Create arrays to hold our data
    const labels: string[] = [];
    const values: number[] = [];
    const colors: string[] = [];
    
    // Process each event individually
    events.forEach((event, index) => {
      // Use event name as the label and ID for debugging
      labels.push(`${event.event_name} (${event.pk_event_id})`);
      // Each event counts as 1
      values.push(1);
      // Generate a unique color for each event
      colors.push(this.getRandomColor());
      
      console.log(`Added event ${index+1}: ${event.event_name} (${event.pk_event_id})`);
    });
    
    console.log(`Processed ${labels.length} events for pie chart:`, { labels, values, colors });
    
    // Set the analytics data for the pie chart
    this.analyticsData = { labels, values, colors };
  }
  
  processUtilizationData(events: Event[]): void {
    if (!events || events.length === 0) {
      console.warn('No events to process for Utilization analytics');
      this.analyticsData = { labels: [], values: [], colors: [] };
      return;
    }

    console.log(`Processing ${events.length} events for Utilization analytics`, events);
    
    // Calculate the total available time slots in the selected period
    const dateRange = this.getDateRange();
    if (!dateRange) {
      console.error('Invalid date range for utilization calculation');
      return;
    }
    
    const { startDate, endDate } = dateRange;
    
    // Calculate total days in the selected period
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`Total days in selected period: ${totalDays}`);
    
    // Calculate utilization as percentage of events in the time period
    // For simplicity, we'll consider each day can have one event (100% utilization would be an event every day)
    const utilizationPercentage = Math.min(100, Math.round((events.length / totalDays) * 100));
    console.log(`Utilization percentage: ${utilizationPercentage}%`);
    
    // For the progress pie chart, we need just two segments: 
    // 1. The percentage utilized (colored)
    // 2. The percentage not utilized (gray)
    const labels = ['Utilized', 'Available'];
    const values = [utilizationPercentage, 100 - utilizationPercentage];
    const colors = ['#3969ac', '#e0e0e0']; // Blue for utilized, light gray for available
    
    console.log(`Processed utilization data:`, { labels, values, colors });
    
    // Set the analytics data for the pie chart
    this.analyticsData = { 
      labels, 
      values, 
      colors,
      totalEvents: events.length,
      totalDays: totalDays,
      utilizationPercentage: utilizationPercentage,
      eventsList: events.map(event => event.event_name)
    };
  }
  
  formatDateLabel(date: Date): string {
    // Format date as 'Feb 10' or similar
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }
  
  // Format date for display in the bookings table
  formatDateDisplay(dateTimeString: string): string {
    if (!dateTimeString) return 'N/A';
    
    const date = new Date(dateTimeString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    // Format as "Jan 1, 2023 2:30 PM"
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return date.toLocaleString('en-US', options);
  }
  
  // Pie chart helper methods
  getSliceColor(index: number): string {
    // Define an array of highly distinguishable colors for the pie chart slices
    const colors = [
      '#003f5c', // Dark blue
      '#ff6361', // Coral red
      '#58508d', // Purple
      '#bc5090', // Magenta
      '#ffa600', // Orange
      '#00b159', // Bright green
      '#7a5195', // Dark purple
      '#ef5675', // Pink
      '#488f31', // Forest green
      '#3969ac', // Royal blue
      '#de425b', // Crimson
      '#f95d6a', // Salmon
      '#00a2ff', // Bright blue
      '#8d4e85', // Plum
      '#6b4c9a', // Slate purple
      '#ffbf00', // Amber
      '#d45087', // Raspberry
      '#06d6a0', // Teal
      '#2f4b7c', // Navy blue
      '#a05195', // Violet
      '#665191', // Dark violet
      '#ff7c43', // Burnt orange
      '#0a9396', // Teal green
      '#f4a261'  // Sandy orange
    ];
    
    // Use modulo to cycle through colors if there are more slices than colors
    return colors[index % colors.length];
  }
  
  getSliceStart(index: number): string {
    if (!this.analyticsData || !this.analyticsData.values || this.analyticsData.values.length === 0) {
      return '0';
    }
    
    // Calculate the starting angle for this slice
    let total = 0;
    for (let i = 0; i < index; i++) {
      total += this.analyticsData.values[i];
    }
    
    const sum = this.analyticsData.values.reduce((a, b) => a + b, 0);
    const percentage = sum > 0 ? (total / sum) * 100 : 0;
    
    return percentage + '%';
  }
  
  getSliceEnd(index: number): string {
    if (!this.analyticsData || !this.analyticsData.values || this.analyticsData.values.length === 0) {
      return '100%';
    }
    
    // Calculate the ending angle for this slice
    let total = 0;
    for (let i = 0; i <= index; i++) {
      total += this.analyticsData.values[i];
    }
    
    const sum = this.analyticsData.values.reduce((a, b) => a + b, 0);
    const percentage = sum > 0 ? (total / sum) * 100 : 0;
    
    return percentage + '%';
  }
  
  getPercentage(index: number): number {
    if (!this.analyticsData || !this.analyticsData.values || this.analyticsData.values.length === 0) {
      return 0;
    }
    
    const sum = this.analyticsData.values.reduce((a, b) => a + b, 0);
    const percentage = sum > 0 ? Math.round((this.analyticsData.values[index] / sum) * 100) : 0;
    
    return percentage;
  }
  
  // Simple test just for the diagnostic endpoint
  testDiagnosticEndpoint(): void {
    this.isLoading = true;
    this.errorMessage = 'Testing diagnostic endpoint...';
    
    // Try multiple variations of the URL
    const testUrls = [
      `${this.apiUrl}/api/test`,
      `/api/test`,
      `http://localhost:5001/api/test`,
      `http://127.0.0.1:5001/api/test`
    ];
    
    let testsCompleted = 0;
    let succeeded = false;
    
    testUrls.forEach(url => {
      this.http.get(url, { responseType: 'json' })
        .subscribe({
          next: (response) => {
            if (!succeeded) {
              succeeded = true;
              this.isLoading = false;
              this.errorMessage = `Success! Server responded: ${JSON.stringify(response)}`;
              console.log('Server diagnostic test successful:', response);
            }
          },
          error: (error) => {
            console.error(`Diagnostic test failed for ${url}:`, error);
            testsCompleted++;
            
            if (testsCompleted === testUrls.length && !succeeded) {
              this.isLoading = false;
              this.errorMessage = `All diagnostic tests failed. Please check your browser console for details.`;
            }
          }
        });
    });
  }
  
  // Generate a conic gradient for the pie chart with equal segments
  getConicGradient(): string {
    if (!this.analyticsData || !this.analyticsData.values || this.analyticsData.values.length === 0) {
      return 'conic-gradient(#f5f5f5 0deg, #f5f5f5 360deg)';
    }
    
    try {
      // Special handling for utilization statistics - progress pie chart
      if (this.selectedAnalytic === 'utilization') {
        const utilizationPercentage = this.analyticsData['utilizationPercentage'] || 0;
        const utilizationDegrees = (utilizationPercentage / 100) * 360;
        
        // Create a gradient from blue to light gray
        return `conic-gradient(
          #3969ac 0deg ${utilizationDegrees}deg, 
          #e0e0e0 ${utilizationDegrees}deg 360deg
        )`;
      }
      
      // Normal pie chart for other analytics types
      // Count the number of categories (use labels length)
      const categoryCount = this.analyticsData.labels.length;
      
      if (categoryCount <= 0) {
        return 'conic-gradient(#f5f5f5 0deg, #f5f5f5 360deg)';
      }
      
      // Each category gets an equal segment with small gap for separation
      const degreesPerSegment = 360 / categoryCount;
      const gapSize = 1; // 1 degree gap between segments
      
      // Create the gradient string
      let gradient = 'conic-gradient(';
      
      for (let i = 0; i < categoryCount; i++) {
        const startDegree = i * degreesPerSegment + (i > 0 ? gapSize/2 : 0);
        const endDegree = (i + 1) * degreesPerSegment - gapSize/2;
        
        // Add transparent gap before color (except first segment)
        if (i > 0) {
          gradient += `rgba(255,255,255,0.8) ${startDegree - gapSize/2}deg ${startDegree}deg, `;
        }
        
        // Add color segment
        gradient += `${this.getSliceColor(i)} ${startDegree}deg ${endDegree}deg`;
        
        // Add transparent gap after color (except last segment)
        if (i < categoryCount - 1) {
          gradient += `, rgba(255,255,255,0.8) ${endDegree}deg ${endDegree + gapSize/2}deg`;
        }
        
        // Add comma except for the last item
        if (i < categoryCount - 1) {
          gradient += ', ';
        }
      }
      
      gradient += ')';
      console.log('Generated segmented gradient with gaps:', gradient);
      return gradient;
    } catch (error) {
      console.error('Error generating conic gradient:', error);
      return 'conic-gradient(#f5f5f5 0deg, #f5f5f5 360deg)';
    }
  }
  
  // Get the total count for display in the center of the pie chart
  getTotalCount(): string {
    if (!this.analyticsData) {
      return '0';
    }
    
    switch (this.selectedAnalytic) {
      case 'bookings':
        return this.analyticsData['totalBookings']?.toString() || this.analyticsData.labels.length.toString();
      case 'events':
        return this.analyticsData['totalEvents']?.toString() || this.analyticsData.labels.length.toString();
      case 'utilization':
        return this.analyticsData['avgUtilization']?.toString() || '0%';
      default:
        return this.analyticsData.labels.length.toString();
    }
  }

  getRandomColor(): string {
    // Generate a random color for chart visualization
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }
  
  // Highlight methods for connecting chart and table
  highlightSegment(index: number): void {
    // Add highlight class to pie segment
    const pieSegment = document.getElementById(`pie-segment-${index}`);
    if (pieSegment) {
      pieSegment.classList.add('highlight');
    }
    
    // Add highlight class to table row
    const tableRow = document.getElementById(`table-row-${index}`);
    if (tableRow) {
      tableRow.classList.add('highlight');
    }
  }
  
  unhighlightSegment(): void {
    // Remove highlight from all segments and rows
    document.querySelectorAll('.pie-annotation.highlight, .analytics-table tr.highlight').forEach(el => {
      el.classList.remove('highlight');
    });
  }
  
  // PDF Generation
  downloadAsPDF(): void {
    // Show loading state
    this.isPdfLoading = true;
    this.isLoading = true;
    this.errorMessage = '';
    
    try {
      // Create PDF document in landscape orientation
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Add header with logo/title
      this.addPDFHeader(pdf, pageWidth);
      
      // Get report title based on analytic type
      let reportTitle = 'Analytics Report';
      if (this.selectedAnalytic === 'bookings') {
        reportTitle = 'Booking Trends Report';
      } else if (this.selectedAnalytic === 'events') {
        reportTitle = 'Events Hosted Report';
      } else if (this.selectedAnalytic === 'utilization') {
        reportTitle = 'Venue Utilization Report';
      }
      
      // Add report title and date
      pdf.setFontSize(22);
      pdf.setTextColor(33, 33, 33);
      pdf.text(reportTitle, 14, 30);
      
      // Add date range
      const dateRange = this.getDateRange();
      if (dateRange) {
        pdf.setFontSize(11);
        pdf.setTextColor(100, 100, 100);
        const startDateStr = dateRange.startDate.toLocaleDateString();
        const endDateStr = dateRange.endDate.toLocaleDateString();
        pdf.text(`Date Range: ${startDateStr} to ${endDateStr}`, 14, 38);
      }
      
      // Draw horizontal divider
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.5);
      pdf.line(14, 42, pageWidth - 14, 42);
      
      // Add summary boxes at the top
      this.addSummaryBoxes(pdf, 48);
      
      // Add table with data (move up since we're removing the chart)
      this.addDataTable(pdf, 80);
      
      // Add footer
      this.addPDFFooter(pdf, pageHeight);
      
      // Save the PDF
      pdf.save(`${reportTitle.replace(/\s+/g, '_')}.pdf`);
      
      // Reset loading states
      this.isLoading = false;
      this.isPdfLoading = false;
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      this.errorMessage = 'Error generating PDF: ' + (error.message || 'Unknown error');
      this.isLoading = false;
      this.isPdfLoading = false;
    }
  }
  
  // Add PDF header
  private addPDFHeader(pdf: any, pageWidth: number): void {
    // Add a colored header bar
    pdf.setFillColor(33, 105, 172); // Blue bar
    pdf.rect(0, 0, pageWidth, 15, 'F');
    
    // Add application name
    pdf.setFontSize(12);
    pdf.setTextColor(255, 255, 255);
    pdf.text('NexusEMS Analytics', 14, 10);
    
    // Add current date on right side
    const currentDate = new Date().toLocaleDateString();
    pdf.text(currentDate, pageWidth - 14, 10, { align: 'right' });
  }
  
  // Add summary boxes
  private addSummaryBoxes(pdf: any, yStart: number): void {
    // Set up summary boxes
    const boxWidth = 80;
    const boxHeight = 25;
    const spacing = 10;
    
    // Box 1 - Total items
    let totalCount = 0;
    let label1 = '';
    
    if (this.selectedAnalytic === 'bookings') {
      totalCount = this.events.length;
      label1 = 'Total Bookings';
    } else if (this.selectedAnalytic === 'events') {
      totalCount = this.events.length;
      label1 = 'Total Events';
    } else if (this.selectedAnalytic === 'utilization') {
      totalCount = this.analyticsData?.['totalEvents'] || 0;
      label1 = 'Total Events';
    }
    
    // Box 2 - Period
    let value2 = '';
    let label2 = 'Time Period';
    
    if (this.timeFilter === 'last7days') {
      value2 = 'Last 7 Days';
    } else if (this.timeFilter === 'last30days') {
      value2 = 'Last 30 Days';
    } else if (this.timeFilter === 'custom') {
      value2 = 'Custom Range';
    }
    
    // Box 3 - Key statistic
    let value3 = '';
    let label3 = '';
    
    if (this.selectedAnalytic === 'bookings') {
      value3 = `${totalCount} Events`;
      label3 = 'Bookings Summary';
    } else if (this.selectedAnalytic === 'events') {
      value3 = `${totalCount} Events`;
      label3 = 'Events Summary';
    } else if (this.selectedAnalytic === 'utilization') {
      value3 = `${this.analyticsData?.['utilizationPercentage'] || 0}%`;
      label3 = 'Utilization Rate';
    }
    
    // Draw and fill the boxes
    this.drawSummaryBox(pdf, 14, yStart, boxWidth, boxHeight, totalCount.toString(), label1, '#4285F4');
    this.drawSummaryBox(pdf, 14 + boxWidth + spacing, yStart, boxWidth, boxHeight, value2, label2, '#34A853');
    this.drawSummaryBox(pdf, 14 + (boxWidth + spacing) * 2, yStart, boxWidth, boxHeight, value3, label3, '#EA4335');
  }
  
  // Helper to draw a single summary box
  private drawSummaryBox(pdf: any, x: number, y: number, width: number, height: number, value: string, label: string, color: string): void {
    // Parse the hex color
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    
    // Draw box with colored header
    pdf.setFillColor(r, g, b);
    pdf.rect(x, y, width, 6, 'F');
    
    // Draw white box body
    pdf.setFillColor(255, 255, 255);
    pdf.rect(x, y + 6, width, height - 6, 'F');
    
    // Draw border
    pdf.setDrawColor(220, 220, 220);
    pdf.rect(x, y, width, height);
    
    // Add label
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    pdf.text(label, x + 5, y + 4);
    
    // Add value
    pdf.setFontSize(16);
    pdf.setTextColor(33, 33, 33);
    pdf.text(value, x + width/2, y + 18, { align: 'center' });
  }
  
  // Add data table
  private addDataTable(pdf: any, yStart: number): void {
    // Add section title
    pdf.setFontSize(16);
    pdf.setTextColor(33, 33, 33);
    pdf.text('Data Summary', 14, yStart - 5);
    
    // Different table types based on selected analytic
    if (this.selectedAnalytic === 'bookings') {
      this.drawBookingsSummaryTable(pdf, yStart);
    } else if (this.selectedAnalytic === 'events') {
      this.drawEventsSummaryTable(pdf, yStart);
    } else if (this.selectedAnalytic === 'utilization') {
      this.drawUtilizationSummaryTable(pdf, yStart);
    }
  }
  
  // Draw bookings summary table
  private drawBookingsSummaryTable(pdf: any, yStart: number): void {
    if (!this.events || this.events.length === 0) return;
    
    // Table settings
    const colWidths = [180, 100, 100];
    const rowHeight = 12;
    const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
    const tableX = 14;
    
    // Table header - blue background
    pdf.setFillColor(33, 105, 172);
    pdf.rect(tableX, yStart, tableWidth, rowHeight, 'F');
    
    // Header text
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    let xOffset = tableX;
    pdf.text('Event Name', xOffset + 5, yStart + 8);
    xOffset += colWidths[0];
    pdf.text('Start Date', xOffset + 5, yStart + 8);
    xOffset += colWidths[1];
    pdf.text('End Date', xOffset + 5, yStart + 8);
    
    // Table border
    pdf.setDrawColor(220, 220, 220);
    pdf.rect(tableX, yStart, tableWidth, rowHeight);
    
    // Table row dividers
    for (let i = 0; i < colWidths.length - 1; i++) {
      let lineX = tableX;
      for (let j = 0; j <= i; j++) {
        lineX += colWidths[j];
      }
      pdf.line(lineX, yStart, lineX, yStart + rowHeight);
    }
    
    // Table content - increase to 15 rows since we have more space now
    const maxRows = Math.min(15, this.events.length);
    let contentY = yStart + rowHeight;
    
    for (let i = 0; i < maxRows; i++) {
      const event = this.events[i];
      
      // Alternate row background
      if (i % 2 === 1) {
        pdf.setFillColor(240, 247, 255);
        pdf.rect(tableX, contentY, tableWidth, rowHeight, 'F');
      }
      
      // Row content
      pdf.setFontSize(10);
      pdf.setTextColor(33, 33, 33);
      
      // Truncate event name if too long
      let eventName = event.event_name;
      if (eventName.length > 50) {
        eventName = eventName.substring(0, 47) + '...';
      }
      
      // Write cell content
      xOffset = tableX;
      pdf.text(eventName, xOffset + 5, contentY + 8);
      xOffset += colWidths[0];
      
      // Format dates
      const startDate = new Date(event.start_date_time);
      const endDate = new Date(event.end_date_time);
      const dateFormat = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      
      pdf.text(startDate.toLocaleDateString('en-US', dateFormat as any), xOffset + 5, contentY + 8);
      xOffset += colWidths[1];
      pdf.text(endDate.toLocaleDateString('en-US', dateFormat as any), xOffset + 5, contentY + 8);
      
      // Draw row dividers
      for (let j = 0; j < colWidths.length - 1; j++) {
        let lineX = tableX;
        for (let k = 0; k <= j; k++) {
          lineX += colWidths[k];
        }
        pdf.line(lineX, contentY, lineX, contentY + rowHeight);
      }
      
      // Draw horizontal line
      pdf.line(tableX, contentY, tableX + tableWidth, contentY);
      
      // Move to next row
      contentY += rowHeight;
    }
    
    // Bottom border of table
    pdf.line(tableX, contentY, tableX + tableWidth, contentY);
    
    // If more rows, add note
    if (this.events.length > maxRows) {
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`+ ${this.events.length - maxRows} more items not shown`, tableX, contentY + 10);
    }
  }
  
  // Draw events summary table
  private drawEventsSummaryTable(pdf: any, yStart: number): void {
    if (!this.analyticsData || !this.analyticsData.labels || this.analyticsData.labels.length === 0) return;
    
    // Table settings
    const colWidths = [350];
    const rowHeight = 12;
    const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
    const tableX = 14;
    
    // Table header - blue background
    pdf.setFillColor(33, 105, 172);
    pdf.rect(tableX, yStart, tableWidth, rowHeight, 'F');
    
    // Header text
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text('Event Name', tableX + 5, yStart + 8);
    
    // Table border
    pdf.setDrawColor(220, 220, 220);
    pdf.rect(tableX, yStart, tableWidth, rowHeight);
    
    // Table content - increase to 15 rows since we have more space now
    const maxRows = Math.min(15, this.analyticsData.labels.length);
    let contentY = yStart + rowHeight;
    
    for (let i = 0; i < maxRows; i++) {
      // Alternate row background
      if (i % 2 === 1) {
        pdf.setFillColor(240, 247, 255);
        pdf.rect(tableX, contentY, tableWidth, rowHeight, 'F');
      }
      
      // Draw color indicator
      const colorHex = this.getSliceColor(i);
      const r = parseInt(colorHex.slice(1, 3), 16);
      const g = parseInt(colorHex.slice(3, 5), 16);
      const b = parseInt(colorHex.slice(5, 7), 16);
      pdf.setFillColor(r, g, b);
      pdf.rect(tableX + 5, contentY + 3, 6, 6, 'F');
      
      // Add border to color square
      pdf.setDrawColor(100, 100, 100);
      pdf.rect(tableX + 5, contentY + 3, 6, 6, 'S');
      
      // Row content
      pdf.setFontSize(10);
      pdf.setTextColor(33, 33, 33);
      
      // Truncate label if too long
      let label = this.analyticsData.labels[i];
      if (label.length > 100) {
        label = label.substring(0, 97) + '...';
      }
      
      // Calculate percentage
      const values = this.analyticsData.values;
      const sum = values.reduce((a, b) => a + b, 0);
      const percentage = sum > 0 ? Math.round((values[i] / sum) * 100) : 0;
      
      // Write cell content
      pdf.text(`${label} (${values[i]}) - ${percentage}%`, tableX + 15, contentY + 8);
      
      // Draw horizontal line
      pdf.line(tableX, contentY, tableX + tableWidth, contentY);
      
      // Move to next row
      contentY += rowHeight;
    }
    
    // Bottom border of table
    pdf.line(tableX, contentY, tableX + tableWidth, contentY);
    
    // If more rows, add note
    if (this.analyticsData.labels.length > maxRows) {
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`+ ${this.analyticsData.labels.length - maxRows} more items not shown`, tableX, contentY + 10);
    }
  }
  
  // Draw utilization summary table
  private drawUtilizationSummaryTable(pdf: any, yStart: number): void {
    if (!this.analyticsData || !this.analyticsData['eventsList'] || this.analyticsData['eventsList'].length === 0) return;
    
    const eventsList = this.analyticsData['eventsList'];
    
    // Table settings
    const colWidths = [380];
    const rowHeight = 12;
    const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
    const tableX = 14;
    
    // Table header - blue background
    pdf.setFillColor(33, 105, 172);
    pdf.rect(tableX, yStart, tableWidth, rowHeight, 'F');
    
    // Header text
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text('Event Name', tableX + 5, yStart + 8);
    
    // Table border
    pdf.setDrawColor(220, 220, 220);
    pdf.rect(tableX, yStart, tableWidth, rowHeight);
    
    // Table content - increase to 15 rows since we have more space now
    const maxRows = Math.min(15, eventsList.length);
    let contentY = yStart + rowHeight;
    
    for (let i = 0; i < maxRows; i++) {
      // Alternate row background
      if (i % 2 === 1) {
        pdf.setFillColor(240, 247, 255);
        pdf.rect(tableX, contentY, tableWidth, rowHeight, 'F');
      }
      
      // Row content
      pdf.setFontSize(10);
      pdf.setTextColor(33, 33, 33);
      
      // Truncate event name if too long
      let eventName = eventsList[i];
      if (eventName.length > 100) {
        eventName = eventName.substring(0, 97) + '...';
      }
      
      // Write cell content
      pdf.text(eventName, tableX + 5, contentY + 8);
      
      // Draw horizontal line
      pdf.line(tableX, contentY, tableX + tableWidth, contentY);
      
      // Move to next row
      contentY += rowHeight;
    }
    
    // Bottom border of table
    pdf.line(tableX, contentY, tableX + tableWidth, contentY);
    
    // If more rows, add note
    if (eventsList.length > maxRows) {
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`+ ${eventsList.length - maxRows} more items not shown`, tableX, contentY + 10);
    }
    
    // Draw utilization summary box at the end of the table
    const boxY = contentY + 15;
    pdf.setFillColor(240, 247, 255);
    pdf.roundedRect(tableX, boxY, tableWidth, 40, 3, 3, 'F');
    
    pdf.setFontSize(12);
    pdf.setTextColor(33, 33, 33);
    pdf.text('Utilization Summary:', tableX + 10, boxY + 12);
    
    pdf.setFontSize(11);
    pdf.text(`Total Events: ${this.analyticsData['totalEvents'] || 0}`, tableX + 10, boxY + 24);
    pdf.text(`Total Days in Period: ${this.analyticsData['totalDays'] || 0}`, tableX + 200, boxY + 24);
    pdf.text(`Utilization Rate: ${this.analyticsData['utilizationPercentage'] || 0}%`, tableX + 10, boxY + 36);
  }
  
  // Add PDF footer
  private addPDFFooter(pdf: any, pageHeight: number): void {
    // Add footer line
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.line(14, pageHeight - 15, pdf.internal.pageSize.getWidth() - 14, pageHeight - 15);
    
    // Add footer text
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text('Generated by NexusEMS Analytics', 14, pageHeight - 7);
    
    // Add page number
    pdf.text(`Generated on: ${new Date().toLocaleString()}`, pdf.internal.pageSize.getWidth() - 14, pageHeight - 7, { align: 'right' });
  }
} 