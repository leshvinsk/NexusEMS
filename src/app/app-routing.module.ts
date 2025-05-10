import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { HomepageComponent } from './homepage/homepage.component';
import { AdminComponent } from './pages/administrator/admin.component';
import { OrganizerComponent } from './pages/organizer/organizer.component';
import { CreateEventComponent } from './createEvent/createEvent.component';
import { EventDetailComponent } from './event-detail/event-detail.component';
import { AuthGuard } from './guards/auth.guard';
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
import { WaitlistManagementComponent } from './waitlist-management/waitlist-management.component';
import { AttendeeListComponent } from './attendee-list/attendee-list.component';


// Define the application routes
const routes: Routes = [
  {
    path: '',
    redirectTo: 'home', // Redirect to home on empty path
    pathMatch: 'full'
  },
  {
    path: 'home',
    component: HomepageComponent // Route for homepage
  },
  {
    path: 'login',
    component: LoginComponent // Route for login page
  },
  {
    path: 'administrator',
    component: AdminComponent, // Route for admin dashboard
    canActivate: [AuthGuard],
    data: { requiredRole: 'Administrator' }
  },
  {
    path: 'admin-settings',
    component: AdminSettingsComponent, // Route for admin settings
    canActivate: [AuthGuard],
    data: { requiredRole: 'Administrator' }
  }, 
  {
    path: 'admin-analytics',
    component: AdminAnalyticsComponent, // Route for admin analytics
    canActivate: [AuthGuard],
    data: { requiredRole: 'Administrator' }
  },
  {
    path: 'organizer',
    component: OrganizerComponent, // Route for organizer dashboard
    canActivate: [AuthGuard],
    data: { requiredRole: 'Organizer' }
  },
  {
    path: 'ticket-setup',
    component: TicketSetupComponent, // Route for ticket setup page
    canActivate: [AuthGuard],
    data: { requiredRole: 'Organizer' }
  },
  {
    path: 'seat-setup',
    component: SeatSetupComponent, // Route for seat setup page
    canActivate: [AuthGuard],
    data: { requiredRole: 'Organizer' }
  },
  {
    path: 'attendee-list',
    component: AttendeeListComponent, // Route for attendee list page
    canActivate: [AuthGuard],
    data: { requiredRole: 'Organizer' }
  },
  {
    path: 'attendee-list/:id',
    component: AttendeeListComponent, // Route for attendee list page with event ID
    canActivate: [AuthGuard],
    data: { requiredRole: 'Organizer' }
  },
  {
    path: 'event-analytics',
    component: EventAnalyticsComponent, // Route for event analytics
    canActivate: [AuthGuard],
    data: { requiredRole: 'Organizer' }
  },
  {
    path: 'waitlist-management',
    component: WaitlistManagementComponent, // Route for waitlist management page
    canActivate: [AuthGuard],
    data: { requiredRole: 'Organizer' }
  },
  {
    path: 'waitlist-management/:id',
    component: WaitlistManagementComponent, // Route for waitlist management page with event ID
    canActivate: [AuthGuard],
    data: { requiredRole: 'Organizer' }
  },
  {
    path: 'event/:id',
    component: EventDetailComponent // Route for event details
  },
  {
    path: 'create-event',
    component: CreateEventComponent // Route for create event page
  },
  {
    path: 'change-password',
    component: ChangePasswordComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'seat-selection',
    component: SeatSelectionComponent // Route for seat selection page (default, no event ID)
  },
  {
    path: 'seat-selection/:id',
    component: SeatSelectionComponent // Route for seat selection page with event ID
  },
  {
    path: 'payment',
    component: PaymentComponent // Route for payment page
  },
  {
    path: 'booking-confirmation',
    component: BookingConfirmationComponent // Route for booking confirmation page
  },
  {
    path: 'booking-failed',
    component: BookingFailedComponent // Route for booking failed page
  },



  // The wildcard route should always be last
  {
    path: '**',
    redirectTo: 'home' // Redirect to home for unmatched routes
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { enableTracing: true })], // Enable tracing for debugging
  exports: [RouterModule] // Export the RouterModule for use in other modules
})
export class AppRoutingModule {}
