const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Waitlist = require('../models/waitlist');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/nexusems', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.connection.on('connected', async () => {
  console.log('Connected to MongoDB');
  
  try {
    // Create a sample waitlist entry
    const sampleWaitlist = new Waitlist({
      event_id: 'E-001', // Replace with an actual event ID from your database
      name: 'Test User',
      email: 'test@example.com',
      contact: '1234567890'
    });
    
    // Save the sample waitlist entry
    await sampleWaitlist.save();
    console.log('Sample waitlist entry created:', sampleWaitlist);
    
    // Close the connection
    mongoose.connection.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error creating waitlist entry:', error);
    mongoose.connection.close();
  }
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});