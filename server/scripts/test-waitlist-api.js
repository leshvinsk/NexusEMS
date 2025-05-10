const axios = require('axios');

const API_URL = 'http://localhost:5001/api';

// Test adding a user to the waitlist
async function testAddToWaitlist() {
  try {
    const response = await axios.post(`${API_URL}/waitlist`, {
      event_id: 'E-001', // Replace with an actual event ID from your database
      name: 'Test User',
      email: 'test@example.com',
      contact: '1234567890'
    });
    
    console.log('Add to waitlist response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error adding to waitlist:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Test checking if a user is on the waitlist
async function testCheckWaitlist(event_id, email) {
  try {
    const response = await axios.get(`${API_URL}/waitlist/check?event_id=${event_id}&email=${email}`);
    
    console.log('Check waitlist response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error checking waitlist:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Test getting all waitlist entries for an event
async function testGetWaitlistEntries(event_id) {
  try {
    const response = await axios.get(`${API_URL}/waitlist/event/${event_id}`);
    
    console.log('Get waitlist entries response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting waitlist entries:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Run the tests
async function runTests() {
  try {
    // Test adding to waitlist
    const addResult = await testAddToWaitlist();
    
    // Test checking waitlist
    await testCheckWaitlist('E-001', 'test@example.com');
    
    // Test getting waitlist entries
    await testGetWaitlistEntries('E-001');
    
    console.log('All tests completed successfully');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the tests
runTests();