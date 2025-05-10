const express = require('express');
const router = express.Router();
const Waitlist = require('../models/waitlist');
const Event = require('../models/createEvent');
const WaitlistNotifier = require('../services/waitlistNotifier');

// Get all waitlist entries
router.get('/', async (req, res) => {
  try {
    const waitlistEntries = await Waitlist.find({});
    
    res.status(200).json({
      success: true,
      count: waitlistEntries.length,
      data: waitlistEntries
    });
  } catch (error) {
    console.error('Error fetching all waitlist entries:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Trigger waitlist notifications for an event
router.post('/notify/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Check if event exists
    const event = await Event.findOne({ pk_event_id: eventId });
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    // Process waitlist notifications
    const result = await WaitlistNotifier.checkAndNotifyWaitlist(eventId);
    
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error processing waitlist notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing waitlist notifications',
      error: error.message
    });
  }
});

// Add a user to the waitlist
router.post('/', async (req, res) => {
  try {
    console.log('Received waitlist request:', req.body);
    const { event_id, name, email, contact } = req.body;

    // Validate required fields
    if (!event_id || !name || !email || !contact) {
      console.log('Missing required fields:', { event_id, name, email, contact });
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    console.log('Looking for event with pk_event_id:', event_id);
    // Check if the event exists
    const event = await Event.findOne({ pk_event_id: event_id });
    console.log('Event found:', event ? 'Yes' : 'No');
    
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    // Check if user is already on the waitlist for this event
    console.log('Checking if user is already on waitlist:', { event_id, email });
    const existingEntry = await Waitlist.findOne({ event_id, email });
    console.log('Existing entry found:', existingEntry ? 'Yes' : 'No');
    
    if (existingEntry) {
      return res.status(400).json({ 
        success: false, 
        message: 'You are already on the waitlist for this event' 
      });
    }

    try {
      // Generate a unique waitlist ID
      const timestamp = Date.now().toString().slice(-6);
      const randomNum = Math.floor(Math.random() * 1000);
      const waitlist_id = `W-${timestamp}${randomNum}`;
      
      console.log('Generated waitlist_id:', waitlist_id);
      
      // Create a new waitlist entry with the generated ID
      const waitlistEntry = new Waitlist({
        waitlist_id,
        event_id,
        name,
        email,
        contact
      });

      console.log('Created waitlist entry:', waitlistEntry);

      // Save the waitlist entry
      const savedEntry = await waitlistEntry.save();
      console.log('Saved waitlist entry:', savedEntry);

      res.status(201).json({
        success: true,
        message: 'Successfully added to waitlist',
        data: savedEntry
      });
    } catch (saveError) {
      console.error('Error saving waitlist entry:', saveError);
      return res.status(500).json({
        success: false,
        message: 'Error saving to waitlist',
        error: saveError.message
      });
    }
  } catch (error) {
    console.error('Error adding to waitlist:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get all waitlist entries for an event
router.get('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const waitlistEntries = await Waitlist.find({ event_id: eventId });
    
    res.status(200).json({
      success: true,
      count: waitlistEntries.length,
      data: waitlistEntries
    });
  } catch (error) {
    console.error('Error fetching waitlist entries:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Check if a user is on the waitlist for an event
router.get('/check', async (req, res) => {
  try {
    console.log('Checking waitlist status with query:', req.query);
    const { event_id, email } = req.query;
    
    if (!event_id || !email) {
      console.log('Missing required parameters:', { event_id, email });
      return res.status(400).json({ 
        success: false, 
        message: 'Event ID and email are required' 
      });
    }
    
    console.log('Looking for waitlist entry with:', { event_id, email });
    const waitlistEntry = await Waitlist.findOne({ event_id, email });
    console.log('Waitlist entry found:', waitlistEntry ? 'Yes' : 'No');
    
    res.status(200).json({
      success: true,
      isOnWaitlist: !!waitlistEntry,
      data: waitlistEntry
    });
  } catch (error) {
    console.error('Error checking waitlist status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Update waitlist entry status
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['waiting', 'notified', 'registered'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid status is required' 
      });
    }
    
    const waitlistEntry = await Waitlist.findOneAndUpdate(
      { waitlist_id: id },
      { status },
      { new: true }
    );
    
    if (!waitlistEntry) {
      return res.status(404).json({ 
        success: false, 
        message: 'Waitlist entry not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Waitlist entry updated',
      data: waitlistEntry
    });
  } catch (error) {
    console.error('Error updating waitlist entry:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Remove a user from the waitlist
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const waitlistEntry = await Waitlist.findOneAndDelete({ waitlist_id: id });
    
    if (!waitlistEntry) {
      return res.status(404).json({ 
        success: false, 
        message: 'Waitlist entry not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Removed from waitlist',
      data: waitlistEntry
    });
  } catch (error) {
    console.error('Error removing from waitlist:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

module.exports = router;