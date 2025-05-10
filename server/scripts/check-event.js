const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Event = require('../models/createEvent');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/nexusems', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Function to check if an event exists
async function checkEvent(eventId) {
  try {
    console.log(`Looking for event with pk_event_id: ${eventId}`);
    const event = await Event.findOne({ pk_event_id: eventId });
    
    if (event) {
      console.log('Event found:');
      console.log(`- ID: ${event.pk_event_id}`);
      console.log(`- Name: ${event.event_name}`);
      console.log(`- Organizer: ${event.organizer_id}`);
      return true;
    } else {
      console.log('Event not found');
      
      // List all events
      console.log('\nListing all events:');
      const events = await Event.find({});
      
      if (events.length === 0) {
        console.log('No events found in the database');
      } else {
        events.forEach(e => {
          console.log(`- ID: ${e.pk_event_id}, Name: ${e.event_name}`);
        });
      }
      
      return false;
    }
  } catch (error) {
    console.error('Error checking event:', error);
    return false;
  }
}

// Get event ID from command line argument or use default
const eventId = process.argv[2] || 'E-001';

mongoose.connection.on('connected', async () => {
  console.log('Connected to MongoDB');
  
  try {
    await checkEvent(eventId);
    mongoose.connection.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});