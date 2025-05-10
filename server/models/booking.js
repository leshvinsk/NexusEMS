const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  booking_id: {
    type: String,
    required: true,
    unique: true
  },
  event_id: {
    type: String,
    required: true
  },
  event_name: {
    type: String,
    required: true
  },
  customer_name: {
    type: String,
    default: ''
  },
  customer_email: {
    type: String,
    default: ''
  },
  seats: [
    {
      seat_id: String,
      ticket_id: String,
      ticket_type: String,
      price: Number,
      section: String,
      row: String,
      seat_no: Number
    }
  ],
  subtotal: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  promo_code: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled'],
    default: 'pending'
  },
  payment_method: {
    type: String,
    default: ''
  },
  payment_id: {
    type: String,
    default: ''
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Booking', bookingSchema);