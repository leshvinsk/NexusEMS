const express = require('express');
const router = express.Router();
const Booking = require('../models/booking');
const Ticket = require('../models/ticket');
const Event = require('../models/createEvent');
const Seating = require('../models/seating');
const WaitlistNotifier = require('../services/waitlistNotifier');
const nodemailer = require('nodemailer');
const path = require('path');
const { url } = require('inspector');
const mongoose = require('mongoose');

// Generate a unique booking ID
function generateBookingId() {
  return 'BK-' + Date.now().toString();
}

// Format section name to be more readable
function formatSectionName(section) {
  if (!section) return 'A';
  
  // Handle section names like "b---right" or "a---left"
  if (section.includes('---')) {
    const parts = section.split('---');
    if (parts.length === 2) {
      const sectionLetter = parts[0].toUpperCase();
      const sectionLocation = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
      return `${sectionLetter} - ${sectionLocation}`;
    }
  }
  
  // If it doesn't match the pattern, just return the original with first letter capitalized
  return section.charAt(0).toUpperCase() + section.slice(1);
}

// Create a new booking
router.post('/', async (req, res) => {
  try {
    const bookingData = req.body;
    console.log('Received booking data:', bookingData);
    
    // Use provided booking ID or generate a new one
    const booking_id = bookingData.booking_id || generateBookingId();
    
    // Create a new booking with all required fields
    const newBooking = new Booking({
      booking_id,
      event_id: bookingData.event_id,
      event_name: bookingData.event_name,
      customer_name: bookingData.customer_name || '',
      customer_email: bookingData.customer_email || '',
      seats: bookingData.seats || [],
      subtotal: bookingData.subtotal || 0,
      discount: bookingData.discount || 0,
      total: bookingData.total || 0,
      promo_code: bookingData.promo_code || null,
      status: bookingData.status || 'pending'
    });
    
    console.log('Creating booking with data:', newBooking);
    
    // Save the booking
    const savedBooking = await newBooking.save();
    console.log('Booking saved successfully:', savedBooking);
    
    // Return the booking ID
    res.status(201).json({ 
      success: true, 
      booking_id,
      message: 'Booking created successfully' 
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating booking', 
      error: error.message 
    });
  }
});

// Get a booking by ID
router.get('/:id', async (req, res) => {
  try {
    console.log(`Looking for booking with ID: ${req.params.id}`);
    const booking = await Booking.findOne({ booking_id: req.params.id });
    
    if (!booking) {
      console.log(`Booking with ID ${req.params.id} not found`);
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }
    
    console.log(`Found booking:`, booking);
    res.status(200).json({ 
      success: true, 
      booking 
    });
  } catch (error) {
    console.error('Error getting booking:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting booking', 
      error: error.message 
    });
  }
});

// Update booking status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status is required' 
      });
    }
    
    const booking = await Booking.findOne({ booking_id: req.params.id });
    
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }
    
    booking.status = status;
    booking.updated_at = Date.now();
    
    await booking.save();
    
    res.status(200).json({ 
      success: true, 
      message: 'Booking status updated successfully' 
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating booking status', 
      error: error.message 
    });
  }
});

// Update booking with customer information
router.put('/:id/customer', async (req, res) => {
  try {
    const { customer_name, customer_email } = req.body;
    
    if (!customer_name || !customer_email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Customer name and email are required' 
      });
    }
    
    const booking = await Booking.findOne({ booking_id: req.params.id });
    
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }
    
    booking.customer_name = customer_name;
    booking.customer_email = customer_email;
    booking.updated_at = Date.now();
    
    await booking.save();
    
    res.status(200).json({ 
      success: true, 
      message: 'Customer information updated successfully' 
    });
  } catch (error) {
    console.error('Error updating customer information:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating customer information', 
      error: error.message 
    });
  }
});

// Update booking with payment information
router.put('/:id/payment', async (req, res) => {
  try {
    const { payment_method, payment_id } = req.body;
    
    if (!payment_method || !payment_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment method and ID are required' 
      });
    }
    
    const booking = await Booking.findOne({ booking_id: req.params.id });
    
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }
    
    booking.payment_method = payment_method;
    booking.payment_id = payment_id;
    booking.status = 'paid';
    booking.updated_at = Date.now();
    
    await booking.save();
    
    // Update ticket status to booked
    if (booking.seats && booking.seats.length > 0) {
      const ticketIds = booking.seats
        .filter(seat => seat.ticket_id)
        .map(seat => seat.ticket_id);
      
      if (ticketIds.length > 0) {
        await Ticket.updateMany(
          { ticket_id: { $in: ticketIds } },
          { $set: { status: 'booked' } }
        );
      }
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Payment information updated successfully' 
    });
  } catch (error) {
    console.error('Error updating payment information:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating payment information', 
      error: error.message 
    });
  }
});

// Generate PDF for a booking
router.get('/:id/pdf', async (req, res) => {
  try {
    const booking = await Booking.findOne({ booking_id: req.params.id });
    
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }
    
    // We'll use PDFKit to generate the PDF
    // First, let's check if PDFKit is installed
    let PDFDocument;
    try {
      PDFDocument = require('pdfkit');
    } catch (err) {
      console.error('PDFKit not installed. Please install it using: npm install pdfkit');
      return res.status(500).json({
        success: false,
        message: 'PDF generation is not available. PDFKit is not installed.'
      });
    }
    
    // Create a PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ticket-${booking.booking_id}.pdf`);
    
    // Pipe the PDF to the response
    doc.pipe(res);
    
    // Add content to the PDF
    // Header
    doc.fontSize(25).text('NexusEMS Ticket', { align: 'center' });
    doc.moveDown();
    
    // Logo
    //doc.image(path.join(__dirname, '../../assets/favicon/favicon.png'), 50, 50, { width: 100 });
    //doc.moveDown(5);
    
    // Booking details
    doc.fontSize(18).text('Booking Confirmation', { underline: true });
    doc.moveDown();
    
    doc.fontSize(12);
    doc.text(`Booking ID: ${booking.booking_id}`);
    doc.text(`Event: ${booking.event_name}`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    doc.text(`Time: ${new Date().toLocaleTimeString()}`);
    doc.text(`Status: ${booking.status.toUpperCase()}`);
    doc.moveDown();
    
    // Customer details
    doc.fontSize(14).text('Customer Information');
    doc.fontSize(12);
    doc.text(`Name: ${booking.customer_name || 'Not provided'}`);
    doc.text(`Email: ${booking.customer_email || 'Not provided'}`);
    doc.moveDown();
    
    // Seat details
    doc.fontSize(14).text('Seat Information');
    doc.fontSize(12);
    
    if (booking.seats && booking.seats.length > 0) {
      booking.seats.forEach((seat, index) => {
        doc.text(`Seat ${index + 1}: Section ${formatSectionName(seat.section)}, Row ${seat.row}, Seat ${seat.seat_no}`);
        if (seat.ticket_type) {
          doc.text(`  Type: ${seat.ticket_type}, Price: $${seat.price.toFixed(2)}`);
        }
      });
    } else {
      doc.text('No seat information available');
    }
    doc.moveDown();
    
    // Payment details
    doc.fontSize(14).text('Payment Information');
    doc.fontSize(12);
    doc.text(`Subtotal: $${booking.subtotal.toFixed(2)}`);
    if (booking.discount > 0) {
      doc.text(`Discount: $${booking.discount.toFixed(2)}`);
    }
    doc.text(`Total: $${booking.total.toFixed(2)}`);
    doc.text(`Payment Method: ${booking.payment_method || 'Not provided'}`);
    doc.text(`Payment ID: ${booking.payment_id || 'Not provided'}`);
    doc.moveDown();
    

    // Footer
    doc.fontSize(10).text('Thank you for your purchase!', { align: 'center' });
    doc.text('This ticket is valid only with a valid ID matching the customer name.', { align: 'center' });
    doc.text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });
    
    // Finalize the PDF
    doc.end();
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error generating PDF', 
      error: error.message 
    });
  }
});

// Email a ticket to the customer - Simplified version without PDF attachment
router.post('/:id/email', async (req, res) => {
  try {
    console.log('Email ticket request received for booking ID:', req.params.id);
    
    const booking = await Booking.findOne({ booking_id: req.params.id });
    
    if (!booking) {
      console.log('Booking not found:', req.params.id);
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }
    
    console.log('Booking found:', booking.booking_id);
    
    // Check if customer email is available
    if (!booking.customer_email) {
      console.log('No customer email available for booking:', booking.booking_id);
      return res.status(400).json({
        success: false,
        message: 'Customer email is not available'
      });
    }
    
    // Check if email is valid
    if (!booking.customer_email.includes('@')) {
      console.log('Invalid email address:', booking.customer_email);
      return res.status(400).json({
        success: false,
        message: 'Invalid email address'
      });
    }
    
    console.log('Preparing to send email to:', booking.customer_email);
    
    // Create a nodemailer transporter using the SMTP settings
    // For Gmail, you need to use an "App Password" if 2FA is enabled
    // See: https://support.google.com/accounts/answer/185833
    const transporter = nodemailer.createTransport({
      service: 'gmail',  // Using the Gmail service preset
      auth: {
        user: process.env.GMAIL_USER || 'your-email@gmail.com',
        pass: process.env.GMAIL_PASS || 'your-app-password'
      }
    });
    
    console.log('Email transporter created');
    
    // Prepare email content
    const mailOptions = {
      from: `"NexusEMS" <${process.env.GMAIL_USER || 'your-email@gmail.com'}>`,
      to: booking.customer_email,
      subject: `Your Ticket for ${booking.event_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #3f51b5;">Your Booking is Confirmed!</h1>
            <p style="font-size: 16px; color: #4CAF50;">Thank you for your purchase.</p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Booking Details</h2>
            <p><strong>Booking ID:</strong> ${booking.booking_id}</p>
            <p><strong>Event:</strong> ${booking.event_name}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
            <p><strong>Status:</strong> ${booking.status.toUpperCase()}</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h2 style="color: #333;">Seat Information</h2>
            ${booking.seats && booking.seats.length > 0 
              ? booking.seats.map((seat, index) => `
                  <p><strong>Seat ${index + 1}:</strong> Section ${formatSectionName(seat.section)}, Row ${seat.row}, Seat ${seat.seat_no}
                  ${seat.ticket_type ? ` (${seat.ticket_type}, $${seat.price.toFixed(2)})` : ''}</p>
                `).join('')
              : '<p>No seat information available</p>'
            }
          </div>
          
          <div style="margin-bottom: 20px;">
            <h2 style="color: #333;">Payment Information</h2>
            <p><strong>Subtotal:</strong> $${booking.subtotal.toFixed(2)}</p>
            ${booking.discount > 0 ? `<p><strong>Discount:</strong> $${booking.discount.toFixed(2)}</p>` : ''}
            <p><strong>Total:</strong> $${booking.total.toFixed(2)}</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <p style="color: #666; font-size: 14px;">Please bring this ticket (printed or digital) and a valid ID to the venue.</p>
            <p style="color: #666; font-size: 14px;">If you have any questions, please contact our support team.</p>
            <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} NexusEMS. All rights reserved.</p>
          </div>
        </div>
      `
    };
    
    console.log('Sending email...');
    
    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({
          success: false,
          message: 'Error sending email',
          error: error.message
        });
      }
      
      console.log('Email sent successfully:', info.response);
      res.status(200).json({
        success: true,
        message: 'Email sent successfully'
      });
    });
    
  } catch (error) {
    console.error('Error in email ticket endpoint:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error sending email', 
      error: error.message 
    });
  }
});

// Get all bookings
router.get('/all', async (req, res) => {
  try {
    const bookings = await Booking.find({});
    
    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching all bookings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get bookings for a specific event with user details
router.get('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Find all bookings for the event
    const bookings = await Booking.find({ event_id: eventId });
    
    if (!bookings || bookings.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }
    
    // Combine booking data with user, ticket, and seat details
    const attendees = bookings.map(booking => {
      return {
        booking_id: booking.booking_id,
        user_id: booking.customer_email,
        event_id: booking.event_id,
        booking_date: booking.created_at || new Date(),
        payment_status: booking.status,
        user_name: booking.customer_name || 'Unknown',
        user_email: booking.customer_email || 'Unknown',
        ticket_type: booking.seats && booking.seats.length > 0 ? booking.seats[0].ticket_type : 'Standard',
        ticket_price: booking.total || 0,
        seat_number: booking.seats && booking.seats.length > 0 ? 
          `Section ${booking.seats[0].section}, Row ${booking.seats[0].row}, Seat ${booking.seats[0].seat_no}` : 'N/A'
      };
    });
    
    res.status(200).json({
      success: true,
      count: attendees.length,
      data: attendees
    });
  } catch (error) {
    console.error('Error fetching bookings for event:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Cancel a booking and free up the ticket and seat
router.delete('/:bookingId', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { bookingId } = req.params;
    
    console.log(`Cancelling booking with ID: ${bookingId}`);
    
    // Find the booking
    const booking = await Booking.findOne({ booking_id: bookingId });
    
    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    console.log(`Found booking: ${booking.booking_id} for event: ${booking.event_id}`);
    
    // If the booking has seats, update the corresponding tickets to be available
    if (booking.seats && booking.seats.length > 0) {
      console.log(`Booking has ${booking.seats.length} seats. Updating ticket status...`);
      
      // Extract ticket IDs from the seats
      const ticketIds = booking.seats
        .filter(seat => seat.ticket_id)
        .map(seat => seat.ticket_id);
      
      if (ticketIds.length > 0) {
        console.log(`Updating status of ${ticketIds.length} tickets to 'available'`);
        
        // Update ticket status to 'available'
        const updateResult = await Ticket.updateMany(
          { ticket_id: { $in: ticketIds } },
          { $set: { status: 'available' } },
          { session }
        );
        
        console.log(`Ticket update result: ${JSON.stringify(updateResult)}`);
      }
    }
    
    // Delete the booking
    const deleteResult = await Booking.deleteOne({ booking_id: bookingId }, { session });
    console.log(`Booking deletion result: ${JSON.stringify(deleteResult)}`);
    
    // Commit the transaction
    await session.commitTransaction();
    session.endSession();
    
    console.log(`Booking ${bookingId} cancelled successfully`);
    
    // Check if there are waitlisted users to notify
    try {
      console.log(`Checking for waitlisted users for event ${booking.event_id}`);
      const notificationResult = await WaitlistNotifier.checkAndNotifyWaitlist(booking.event_id);
      console.log('Waitlist notification result:', notificationResult);
    } catch (notificationError) {
      console.error('Error notifying waitlisted users:', notificationError);
      // Continue with the response even if notification fails
    }
    
    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    // Abort the transaction on error
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling booking',
      error: error.message
    });
  }
});

// Fetch bookings for specific events by organizer ID
router.post('/events', async (req, res) => {
  try {
    const { eventIds, organizerId } = req.body;
    
    if (!eventIds || !eventIds.length || !organizerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Event IDs and organizer ID are required' 
      });
    }

    console.log(`Fetching bookings for events: ${eventIds} by organizer: ${organizerId}`);
    
    // First verify that the events belong to this organizer
    const events = await Event.find({
      pk_event_id: { $in: eventIds },
      organizer_id: organizerId
    });
    
    const validEventIds = events.map(event => event.pk_event_id);
    console.log(`Verified event IDs for this organizer: ${validEventIds}`);
    
    // Find all bookings for the verified events with 'paid' status
    const bookings = await Booking.find({
      event_id: { $in: validEventIds },
      status: 'paid'  // Only get 'paid' bookings
    });
    
    console.log(`Found ${bookings.length} paid bookings for these events`);
    
    res.status(200).json(bookings);
  } catch (error) {
    console.error('Error fetching bookings by events:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching bookings', 
      error: error.message 
    });
  }
});

// Get bookings for multiple events (for analytics)
router.post('/events', async (req, res) => {
  try {
    const { eventIds, organizerId } = req.body;
    
    console.log('Fetching bookings for events:', eventIds);
    console.log('Organizer ID:', organizerId);
    
    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Event IDs array is required' 
      });
    }
    
    // Verify the events belong to this organizer
    if (organizerId) {
      const events = await Event.find({ 
        pk_event_id: { $in: eventIds },
        organizer_id: organizerId
      });
      
      const validEventIds = events.map(event => event.pk_event_id);
      console.log('Valid events found for organizer:', validEventIds.length);
      
      // Get all bookings for these events
      const bookings = await Booking.find({
        event_id: { $in: validEventIds }
      });
      
      console.log(`Found ${bookings.length} bookings for these events`);
      
      // Enhance bookings with the required data
      const enhancedBookings = bookings.map(booking => {
        // Convert to plain JavaScript object to avoid mongoose document issues
        const plainBooking = booking.toObject();
        
        // Calculate the total amount correctly
        const total_amount = booking.total || booking.amount || 0;
        
        return {
          ...plainBooking,
          // Ensure these fields exist for the frontend
          total_amount,
          status: booking.status || 'pending'
        };
      });
      
      res.status(200).json(enhancedBookings);
    } else {
      // No organizer ID, just get bookings for the events
      const bookings = await Booking.find({
        event_id: { $in: eventIds }
      });
      
      console.log(`Found ${bookings.length} bookings for events without organizer check`);
      
      // Enhance bookings with the required data
      const enhancedBookings = bookings.map(booking => {
        // Convert to plain JavaScript object
        const plainBooking = booking.toObject();
        
        // Calculate the total amount correctly
        const total_amount = booking.total || booking.amount || 0;
        
        return {
          ...plainBooking,
          // Ensure these fields exist for the frontend
          total_amount,
          status: booking.status || 'pending'
        };
      });
      
      res.status(200).json(enhancedBookings);
    }
  } catch (error) {
    console.error('Error fetching bookings for events:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching bookings', 
      error: error.message 
    });
  }
});

module.exports = router;