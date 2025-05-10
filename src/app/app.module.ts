import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { RouterModule } from '@angular/router';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { AppComponent } from './app.component';
import { LoginComponent } from './pages/login/login.component';
import { HomepageComponent } from './homepage/homepage.component';
import { NavbarComponent } from './navbar/navbar.component';
import { AdminComponent } from './pages/administrator/admin.component';
import { OrganizerComponent } from './pages/organizer/organizer.component';
import { EventDetailComponent } from './event-detail/event-detail.component';
import { CreateEventComponent } from './createEvent/createEvent.component';
import { ChangePasswordComponent } from './pages/change-password/change-password.component';
import { PaymentComponent } from './payment/payment.component';
import { BookingConfirmationComponent } from './booking-confirmation/booking-confirmation.component';
import { BookingFailedComponent } from './booking-failed/booking-failed.component';
import { SeatSelectionComponent } from './seat-selection/seat-selection.component';
import { TicketSetupComponent } from './ticket-setup/ticket-setup.component';
import { SeatSetupComponent } from './seat-setup/seat-setup.component';
import { AdminSettingsComponent } from './pages/admin-settings/admin-settings.component';
import { AdminAnalyticsComponent } from './pages/admin-analytics/admin-analytics.component';
import { EventAnalyticsComponent } from './pages/event-analytics/event-analytics.component';
import { WaitlistFormComponent } from './waitlist-form/waitlist-form.component';
import { WaitlistManagementComponent } from './waitlist-management/waitlist-management.component';
import { AttendeeListComponent } from './attendee-list/attendee-list.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    HomepageComponent,
    AdminComponent,
    OrganizerComponent,
    EventDetailComponent,
    CreateEventComponent,
    ChangePasswordComponent,
    NavbarComponent,
    PaymentComponent,
    BookingConfirmationComponent,
    BookingFailedComponent,
    SeatSelectionComponent,
    TicketSetupComponent,
    SeatSetupComponent,
    AdminSettingsComponent,
    AdminAnalyticsComponent,
    EventAnalyticsComponent,
    WaitlistFormComponent,
    WaitlistManagementComponent,
    AttendeeListComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    RouterModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  providers: [],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule { }
