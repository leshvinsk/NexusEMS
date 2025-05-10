const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const OrganizerSchema = new mongoose.Schema({
  organizer_id: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  isTemporaryPassword: {
    type: Boolean,
    default: true
  },
  organization: {
    type: String,
    required: true
  },
  organizerName: {
    type: String,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
OrganizerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
OrganizerSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const Organizer = mongoose.model('Organizer', OrganizerSchema);

module.exports = Organizer; 