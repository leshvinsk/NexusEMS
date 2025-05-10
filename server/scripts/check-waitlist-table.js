const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/nexusems', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.connection.on('connected', async () => {
  console.log('Connected to MongoDB');
  
  try {
    // List all collections in the database
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in the database:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    // Check if waitlists collection exists
    const waitlistExists = collections.some(collection => collection.name === 'waitlists');
    console.log(`Waitlist collection exists: ${waitlistExists}`);
    
    // If waitlist collection exists, count documents
    if (waitlistExists) {
      const count = await mongoose.connection.db.collection('waitlists').countDocuments();
      console.log(`Number of documents in waitlists collection: ${count}`);
    }
    
    // Close the connection
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