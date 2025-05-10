const Waitlist = require('../models/waitlist');
const Event = require('../models/createEvent');
const Ticket = require('../models/ticket');
const Booking = require('../models/booking');
const nodemailer = require('nodemailer');

/**
 * Service to handle waitlist notifications when tickets become available
 */
class WaitlistNotifier {
  /**
   * Check for available tickets and notify waitlisted users
   * @param {string} eventId - The event ID to check
   * @returns {Promise<Object>} - Result of the notification process
   */
  static async checkAndNotifyWaitlist(eventId) {
    try {
      // Get event details
      const event = await Event.findOne({ pk_event_id: eventId });
      if (!event) {
        return { 
          success: false, 
          message: 'Event not found' 
        };
      }

      // Get ticket information
      const tickets = await Ticket.find({ event_id: eventId });
      if (!tickets || tickets.length === 0) {
        return { 
          success: false, 
          message: 'No tickets found for this event' 
        };
      }

      // Count available tickets
      const availableTickets = tickets.filter(ticket => ticket.status === 'available').length;
      
      console.log(`Event ${eventId} has ${availableTickets} available tickets`);
      
      if (availableTickets <= 0) {
        return { 
          success: true, 
          message: 'No tickets available for notification',
          availableTickets: 0,
          notifiedUsers: []
        };
      }

      // Get waitlisted users who are still waiting (not notified or registered)
      const waitlistedUsers = await Waitlist.find({ 
        event_id: eventId, 
        status: 'waiting' 
      }).sort({ created_at: 1 }); // Sort by creation date (first come, first served)

      if (waitlistedUsers.length === 0) {
        return { 
          success: true, 
          message: 'No users in waitlist to notify',
          availableTickets,
          notifiedUsers: []
        };
      }

      // Determine how many users to notify (up to the number of available tickets)
      const usersToNotify = waitlistedUsers.slice(0, availableTickets);
      
      // Update status to 'notified' for these users
      const notificationPromises = usersToNotify.map(user => 
        Waitlist.findByIdAndUpdate(
          user._id, 
          { status: 'notified' }, 
          { new: true }
        )
      );
      
      const notifiedUsers = await Promise.all(notificationPromises);
      
      // Send actual email notifications
      console.log(`Notifying ${notifiedUsers.length} users for event ${eventId}`);
      
      // Create a nodemailer transporter
      const transporter = nodemailer.createTransport({
        service: 'gmail',  // Using the Gmail service preset
        auth: {
          user: process.env.GMAIL_USER || 'your-email@gmail.com',
          pass: process.env.GMAIL_PASS || 'your-app-password'
        }
      });
      
      // Send emails to each notified user
      for (const user of notifiedUsers) {
        try {
          console.log(`Preparing to send email to ${user.email} (${user.waitlist_id})`);
          
          const emailDetails = this.createEmailContent(user.email, event.event_name, user.name, eventId);
          
          // Send the email
          const info = await transporter.sendMail(emailDetails);
          
          console.log(`Email sent to ${user.email}: ${info.response}`);
        } catch (emailError) {
          console.error(`Error sending email to ${user.email}:`, emailError);
          // Continue with other users even if one email fails
        }
      }

      return {
        success: true,
        message: `${notifiedUsers.length} users notified of available tickets`,
        availableTickets,
        notifiedUsers: notifiedUsers.map(user => ({
          waitlist_id: user.waitlist_id,
          name: user.name,
          email: user.email,
          notified_at: new Date()
        }))
      };
    } catch (error) {
      console.error('Error in waitlist notification process:', error);
      return {
        success: false,
        message: 'Error processing waitlist notifications',
        error: error.message
      };
    }
  }

  /**
   * Create email content for waitlist notification
   * @param {string} email - Recipient email
   * @param {string} eventName - Name of the event
   * @param {string} userName - Name of the user
   * @param {string} eventId - ID of the event
   * @returns {Object} - Email details for nodemailer
   */
  static createEmailContent(email, eventName, userName, eventId) {
    const emailSubject = `Tickets now available for ${eventName}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #3f51b5;">Good News!</h1>
          <p style="font-size: 16px; color: #4CAF50;">Tickets are now available for your waitlisted event.</p>
        </div>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">Dear ${userName},</h2>
          <p>We're pleased to inform you that tickets are now available for <strong>${eventName}</strong> that you were waitlisted for.</p>
          <p>Please visit the event site and complete your booking within the next <strong>24 hours</strong> to secure your spot.</p>
          <p>After this time, your reservation may be released to other waitlisted customers.</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="http://localhost:4200/event/${eventId}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Book Now</a>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="color: #666; font-size: 14px;">Thank you for your patience!</p>
          <p style="color: #666; font-size: 14px;">If you have any questions, please contact our support team.</p>
          <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} NexusEMS. All rights reserved.</p>
        </div>
      </div>
    `;
    
    return {
      from: `"NexusEMS" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: emailSubject,
      html: emailHtml
    };
  }
}

module.exports = WaitlistNotifier;