const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  waitlist_id: {
    type: String,
    required: true,
    unique: true
  },
  event_id: {
    type: String,
    required: true,
    ref: 'Event'
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  contact: {
    type: String,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['waiting', 'notified', 'registered'],
    default: 'waiting'
  }
});

// Generate a unique waitlist ID before saving
waitlistSchema.pre('save', async function(next) {
  try {
    if (!this.waitlist_id) {
      console.log('Generating waitlist_id for new entry');
      // Generate a unique ID with format W-XXX
      const count = await mongoose.models.Waitlist.countDocuments();
      const randomNum = Math.floor(Math.random() * 1000);
      const timestamp = Date.now().toString().slice(-6);
      this.waitlist_id = `W-${timestamp}${randomNum}`;
      console.log('Generated waitlist_id:', this.waitlist_id);
    }
    next();
  } catch (error) {
    console.error('Error in waitlist pre-save hook:', error);
    next(error);
  }
});

const Waitlist = mongoose.model('Waitlist', waitlistSchema);

module.exports = Waitlist;