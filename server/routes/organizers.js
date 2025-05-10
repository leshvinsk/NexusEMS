const express = require('express');
const router = express.Router();
const Organizer = require('../models/Organizer');
const Admin = require('../models/Admin');
const auth = require('../middleware/auth');
const { sendOrganizerWelcomeEmail, sendOrganizerRemovalEmail } = require('../utils/emailUtils');
require('dotenv').config();

// Generate a random password
const generateRandomPassword = (length) => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
};

// Generate a unique organizer ID starting with 'E'
const generateOrganizerId = async () => {
  // Get the current count of organizers
  const count = await Organizer.countDocuments();
  // Format: E followed by 5 digits (padded with zeros)
  return `E${(count + 1).toString().padStart(5, '0')}`;
};

// @route   POST api/organizers/register
// @desc    Register a new event organizer
// @access  Private (Admin only)
router.post('/register', auth, async (req, res) => {
  // Check if user is an Administrator
  if (req.user.role !== 'Administrator') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }

  const { username, email, phone, organization, organizerName } = req.body;

  try {
    // Check if username, email, or phone already exists in admins collection
    const adminExists = await Admin.findOne({
      $or: [
        { username },
        { email },
        { contact_no: phone }
      ]
    });

    if (adminExists) {
      // Determine which field caused the conflict
      if (adminExists.username === username) {
        return res.status(400).json({ error: 'Username already registered as an admin' });
      }
      if (adminExists.email === email) {
        return res.status(400).json({ error: 'Email already registered as an admin' });
      }
      if (adminExists.contact_no === phone) {
        return res.status(400).json({ error: 'Phone number already registered as an admin' });
      }
    }

    // Check if username, email, or phone already exists in organizers collection
    const organizerExists = await Organizer.findOne({
      $or: [
        { username },
        { email },
        { phone }
      ]
    });

    if (organizerExists) {
      // Determine which field caused the conflict
      if (organizerExists.username === username) {
        return res.status(400).json({ error: 'Username already registered as an organizer' });
      }
      if (organizerExists.email === email) {
        return res.status(400).json({ error: 'Email already registered as an organizer' });
      }
      if (organizerExists.phone === phone) {
        return res.status(400).json({ error: 'Phone number already registered as an organizer' });
      }
    }

    // Generate a unique organizer ID and temporary password
    const organizerId = await generateOrganizerId();
    const tempPassword = generateRandomPassword(10);

    // Create a new organizer
    const newOrganizer = new Organizer({
      organizer_id: organizerId,
      username,
      email,
      phone,
      password: tempPassword, // Will be hashed by the pre-save hook
      organization,
      organizerName,
      isTemporaryPassword: true
    });

    // Save the organizer to the database
    const savedOrganizer = await newOrganizer.save();

    // Send welcome email with credentials
    const emailSent = await sendOrganizerWelcomeEmail(
      email,
      organizerName,
      username,
      tempPassword, // Send the unhashed password in the email
      organizerId
    );

    if (!emailSent) {
      console.warn('Warning: Failed to send welcome email to organizer');
    }

    // Return the saved organizer (excluding password)
    const organizerResponse = {
      id: savedOrganizer._id,
      organizer_id: savedOrganizer.organizer_id,
      username: savedOrganizer.username,
      email: savedOrganizer.email,
      phone: savedOrganizer.phone,
      organization: savedOrganizer.organization,
      organizerName: savedOrganizer.organizerName,
      created_at: savedOrganizer.created_at
    };

    res.status(201).json({
      message: 'Organizer registered successfully',
      organizer: organizerResponse,
      emailSent
    });
  } catch (error) {
    console.error('Organizer registration error:', error);
    res.status(500).json({ error: 'Server error during organizer registration' });
  }
});

// @route   GET api/organizers
// @desc    Get all organizers
// @access  Private (Admin only)
router.get('/', auth, async (req, res) => {
  // Check if user is an Administrator
  if (req.user.role !== 'Administrator') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }

  try {
    const organizers = await Organizer.find().select('-password');
    res.json(organizers);
  } catch (error) {
    console.error('Error fetching organizers:', error);
    res.status(500).json({ error: 'Server error while fetching organizers' });
  }
});

// @route   DELETE api/organizers/:id
// @desc    Delete an organizer
// @access  Private (Admin only)
router.delete('/:id', auth, async (req, res) => {
  // Check if user is an Administrator
  if (req.user.role !== 'Administrator') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }

  try {
    // Find the organizer
    const organizer = await Organizer.findById(req.params.id);
    
    if (!organizer) {
      return res.status(404).json({ error: 'Organizer not found' });
    }

    // Send notification email before deletion
    const emailSent = await sendOrganizerRemovalEmail(
      organizer.email,
      organizer.organizerName,
      organizer.organizer_id
    );

    if (!emailSent) {
      console.warn(`Warning: Failed to send removal notification to organizer: ${organizer.email}`);
    }

    // Delete the organizer
    await Organizer.findByIdAndDelete(req.params.id);

    res.json({ 
      message: 'Organizer removed successfully',
      emailSent
    });
  } catch (error) {
    console.error('Error deleting organizer:', error);
    res.status(500).json({ error: 'Server error while deleting organizer' });
  }
});

module.exports = router; 