// Import the mongoose library
const mongoose = require('mongoose');

// Define the schema for the Event model
const eventSchema = new mongoose.Schema({
  // Primary key for the event, must be a string and is required
  pk_event_id: { type: String, required: true },
  // Name of the event, must be a string and is required
  event_name: { type: String, required: true },
  // Description of the event, must be a string and is required
  description: { type: String, required: true },
  // Start time of the event, must be a date and is required
  start_date_time: { type: Date, required: true },
  // End time of the event, must be a date and is required
  end_date_time: { type: Date, required: true },
  // Array of files associated with the event
  files: [{
    // Filename of the file, must be a string
    filename: String,
    // Data of the file, stored as a Buffer
    data: Buffer,
    // Content type of the file, must be a string
    contentType: String
  }],
  // ID of the event organizer, must be a string and is required
  organizer_id: { type: String, required: true },
  // Array of ticket types associated with the event
  ticketTypes: [{
    // Ticket type ID, must be a string
    type: { type: String, required: true }, // Format: "T-001"
    // Name of the ticket type
    name: { type: String, required: true },
    // Price of the ticket
    price: { type: Number, required: true },
    // Color associated with the ticket type (optional, will be set in seat setup)
    color: { type: String, required: false, default: '#808080' }
  }],
  // Array of discount IDs associated with the event
  discounts: {
    type: [String], // Format: "D-001"
    required: false,
    default: []
  }
});

// Create the Event model using the eventSchema
const Event = mongoose.model('Event', eventSchema);

// Export the Event model for use in other parts of the application
module.exports = Event;