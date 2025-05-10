// Import the mongoose library
const mongoose = require('mongoose');

// Define the schema for the Discount model
const discountSchema = new mongoose.Schema({
  // Primary key for the discount, must be a string and is required
  discount_id: { type: String, required: true }, // Format: "D-001"
  // Name of the discount, must be a string and is required
  name: { type: String, required: true },
  // Percentage of the discount, must be a number and is required
  percentage: { type: Number, required: true },
  // Ticket type IDs this discount applies to (empty array means applies to all tickets)
  ticketTypeIds: {
    type: [String],
    default: []
  },
  // Expiry date of the discount, must be a date and is required
  expiry_date: { type: Date, required: true },
  // Event ID this discount is associated with
  event_id: { type: String, default: null },
  // Creation date of the discount, defaults to current date
  created_at: { type: Date, default: Date.now }
});

// Create the Discount model using the discountSchema
const Discount = mongoose.model('Discount', discountSchema);

// Export the Discount model for use in other parts of the application
module.exports = Discount;