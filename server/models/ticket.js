// Import the mongoose library
const mongoose = require('mongoose');

// Define the schema for the Ticket model
const ticketSchema = new mongoose.Schema({
  // Primary key for the ticket, e.g., "T-001"
  ticket_id: { type: String, required: true },

  // Event ID this ticket belongs to
  event_id: { type: String, required: true },

  // Type of the ticket (e.g., VIP, Regular, etc.)
  ticket_type: { type: String, required: true },

  // Layout section the ticket belongs to (e.g., "LF - Left", "B - Right", etc.)
  layout: { type: String, required: true },

  // Row in the layout (e.g., "A", "B", etc.)
  row: { type: String, required: true },

  // Seat number in the row
  seat_no: { type: Number, required: true },

  // Price of the ticket
  price: { type: Number, required: true },

  // Status of the ticket (available, booked, etc.)
  status: { type: String, required: true, default: 'available' }
});

// Create the Ticket model using the ticketSchema
const Ticket = mongoose.model('Ticket', ticketSchema);

// Export the Ticket model
module.exports = Ticket;
