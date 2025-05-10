import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

interface UploadedImage {
  url: string;
  file: File;
  name: string;
}

@Component({
  selector: 'app-create-event',
  templateUrl: './createEvent.component.html',
  styleUrls: ['./createEvent.component.css'],
  standalone:false
})
export class CreateEventComponent implements OnInit {
  selectedFiles: UploadedImage[] = [];
  readonly MAX_FILES = 5;
  readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
  today: string = '';
  showModal: boolean = false;
  eventName: string = '';
  eventDate: string = '';
  startTime: string = '';
  endTime: string = '';

  constructor(
    private http: HttpClient, 
    private router: Router
  ) {}

  ngOnInit() {
    const today = new Date();
    this.today = today.toISOString().split('T')[0];
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const remainingSlots = this.MAX_FILES - this.selectedFiles.length;
      const files = Array.from(input.files).slice(0, remainingSlots);

      files.forEach(file => {
        // Check file size
        if (file.size > this.MAX_FILE_SIZE) {
          alert(`File ${file.name} is too large. Maximum size is 5MB.`);
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            this.selectedFiles.push({
              url: e.target.result as string,
              file: file,
              name: file.name
            });
          }
        };
        reader.readAsDataURL(file);
      });

      // Clear input to allow uploading the same file again
      input.value = '';
    }
  }

  removeImage(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  onSubmit(form: any) {
    if (form.valid) {
      const today = new Date(form.value.eventDate); // Get the event date
  
      // Convert time values into valid ISO date-time format
      const startDateTime = new Date(`${today.toISOString().split('T')[0]}T${form.value.startTime}:00Z`);
      const endDateTime = new Date(`${today.toISOString().split('T')[0]}T${form.value.endTime}:00Z`);
  
      const formData = new FormData();
      formData.append('event_name', form.value.eventName);
      formData.append('event_date', form.value.eventDate);
      formData.append('start_date_time', startDateTime.toISOString());  // ✅ Proper Date Format
      formData.append('end_date_time', endDateTime.toISOString());  // ✅ Proper Date Format
      formData.append('description', form.value.eventDescription);
  
      this.selectedFiles.forEach(file => {
        formData.append('files', file.file);
      });
  
      this.http.post('http://localhost:3000/api/events', formData).subscribe(
        (response: any) => {
          console.log('Event created successfully', response);
          this.eventName = form.value.eventName;
          this.eventDate = form.value.eventDate;
          this.startTime = form.value.startTime;
          this.endTime = form.value.endTime;
          this.showModal = true;
        },
        (error) => {
          console.error('Error creating event', error);
        }
      );
    }
  }
  

  closeModal() {
    this.showModal = false;
  }
}
