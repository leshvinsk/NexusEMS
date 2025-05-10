import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-waitlist-form',
  templateUrl: './waitlist-form.component.html',
  styleUrls: ['./waitlist-form.component.css']
})
export class WaitlistFormComponent implements OnInit {
  waitlistForm: FormGroup;
  isSubmitting = false;
  errorMessage = '';

  private readonly API_URL = 'http://localhost:5001/api';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<WaitlistFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { eventId: string, eventName: string }
  ) {
    this.waitlistForm = this.fb.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      contact: ['', [Validators.required, Validators.pattern('^[0-9]{10,12}$')]]
    });
  }

  ngOnInit(): void {
    // Check if user is already on the waitlist
    const savedEmail = localStorage.getItem('userEmail');
    if (savedEmail) {
      this.waitlistForm.patchValue({ email: savedEmail });
      this.checkWaitlistStatus(savedEmail);
    }
  }

  checkWaitlistStatus(email: string): void {
    this.http.get(`${this.API_URL}/waitlist/check?event_id=${this.data.eventId}&email=${email}`)
      .subscribe({
        next: (response: any) => {
          if (response.isOnWaitlist) {
            this.errorMessage = 'You are already on the waitlist for this event.';
            this.snackBar.open('You are already on the waitlist for this event.', 'Close', {
              duration: 5000
            });
          }
        },
          error: (error) => {
            console.error('Error checking waitlist status:', error);
          }
        });
  }

  onSubmit(): void {
    if (this.waitlistForm.invalid) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const waitlistData = {
      event_id: this.data.eventId,
      ...this.waitlistForm.value
    };

    console.log('Submitting waitlist data:', waitlistData);

    this.http.post(`${this.API_URL}/waitlist`, waitlistData)
      .subscribe({
        next: (response: any) => {
          console.log('Waitlist submission successful:', response);
          this.isSubmitting = false;

          // Save email to localStorage for future reference
          localStorage.setItem('userEmail', this.waitlistForm.value.email);

          this.snackBar.open('Successfully added to the waitlist!', 'Close', {
            duration: 5000
          });
          
          this.dialogRef.close(true);
          },
            error: (error) => {
              this.isSubmitting = false;
              console.error('Error joining waitlist:', error);
              console.error('Error details:', error.error);

              if (error.error && error.error.message) {
                this.errorMessage = error.error.message;
              } else {
                this.errorMessage = 'An error occurred. Please try again later.';
              }

              this.snackBar.open(this.errorMessage, 'Close', {
                duration: 5000
              });
            }
      });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}