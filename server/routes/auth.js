const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const Admin = require('../models/Admin');
const { sendPasswordResetEmail } = require('../utils/emailUtils');
require('dotenv').config();

// @route   POST api/auth/login
// @desc    Authenticate admin or organizer & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log(`Login attempt for username: ${username}`);
    console.log(`Password provided: ${password.substring(0, 3)}${'*'.repeat(password.length - 3)}`);
    
    // First check if user exists in admin collection
    let admin = await Admin.findOne({ username });

    if (admin) {
      console.log(`Admin found: ${admin.username}, Email: ${admin.email}`);
      console.log(`Admin contact_no: ${admin.contact_no}`);
      console.log(`Stored password hash: ${admin.password.substring(0, 15)}...`);
      
      // Check password
      const isMatch = await admin.comparePassword(password);
      console.log(`Password match: ${isMatch}`);

      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      // Create JWT payload for admin
      const payload = {
        user: {
          id: admin.id,
          username: admin.username,
          role: 'Administrator'
        }
      };

      // Sign and return JWT token
      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '1h' },
        (err, token) => {
          if (err) throw err;
          console.log(`Login successful for admin: ${admin.username}`);
          res.json({ 
            token,
            user: {
              id: admin.id,
              username: admin.username,
              email: admin.email,
              role: 'Administrator',
              admin_id: admin.admin_id,
              contact_no: admin.contact_no,
              isTemporaryPassword: admin.isTemporaryPassword
            },
            isAdmin: true
          });
        }
      );
    } else {
      console.log(`Admin not found: ${username}, checking organizer collection...`);
      
      // Check if user exists in organizer collection
      const Organizer = require('../models/Organizer');
      const organizer = await Organizer.findOne({ username });
      
      if (!organizer) {
        console.log(`Organizer not found: ${username}`);
        return res.status(400).json({ error: 'Invalid credentials' });
      }
      
      console.log(`Organizer found: ${organizer.username}, Email: ${organizer.email}`);
      console.log(`Stored password hash: ${organizer.password.substring(0, 15)}...`);
      
      // Check password
      const isMatch = await organizer.comparePassword(password);
      console.log(`Password match: ${isMatch}`);

      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      // Create JWT payload for organizer
      const payload = {
        user: {
          id: organizer.id,
          username: organizer.username,
          role: 'Organizer'
        }
      };

      // Sign and return JWT token
      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '1h' },
        (err, token) => {
          if (err) throw err;
          console.log(`Login successful for organizer: ${organizer.username}`);
          res.json({ 
            token,
            user: {
              id: organizer.id,
              username: organizer.username,
              email: organizer.email,
              role: 'Organizer',
              organizer_id: organizer.organizer_id,
              organization: organizer.organization,
              organizerName: organizer.organizerName,
              isTemporaryPassword: organizer.isTemporaryPassword
            },
            isAdmin: false
          });
        }
      );
    }
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET api/auth/user
// @desc    Get authenticated user
// @access  Private
router.get('/user', auth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select('-password');
    res.json(admin);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET api/auth/test
// @desc    Test API connection
// @access  Public
router.get('/test', (req, res) => {
  res.send('Authentication server is running');
});

// @route   POST api/auth/reset-password
// @desc    Reset user password (admin or organizer) and send email
// @access  Public
router.post('/reset-password', async (req, res) => {
  const { email } = req.body;

  try {
    console.log(`Password reset request for email: ${email}`);
    
    // Check if admin exists with this email
    const admin = await Admin.findOne({ email });

    if (admin) {
      console.log(`Admin found: ${admin.username}`);

      // Generate a random temporary password
      const tempPassword = generateRandomPassword(10);
      
      // Send email with temporary password
      const emailSent = await sendPasswordResetEmail(
        admin.email, 
        admin.username, 
        tempPassword
      );

      if (!emailSent) {
        console.log('Email sending failed, not updating password');
        return res.status(500).json({ error: 'Failed to send password reset email. Please contact system administrator.' });
      }

      // Only update the password in the database if email was sent successfully
      console.log('Email sent successfully, updating password in database');
      
      // Update the admin's password and set temporary flag
      admin.password = tempPassword;
      admin.isTemporaryPassword = true;
      await admin.save();
      
      console.log('Password updated successfully for admin:', admin.username);
      return res.json({ 
        message: 'Password reset successful. Please check your email for the temporary password.'
      });
    } 
    else {
      // If not found in admin collection, check organizer collection
      console.log(`Admin not found with email: ${email}, checking organizer collection...`);
      
      // Import Organizer model
      const Organizer = require('../models/Organizer');
      
      // Check if organizer exists with this email
      const organizer = await Organizer.findOne({ email });
      
      if (!organizer) {
        console.log(`Organizer not found with email: ${email}`);
        return res.status(404).json({ error: 'Account not found with this email address' });
      }
      
      console.log(`Organizer found: ${organizer.username}`);
      
      // Generate a random temporary password
      const tempPassword = generateRandomPassword(10);
      
      // Send email with temporary password using organizer-specific email function
      // Use the existing email function or create a new one specifically for organizers
      const emailSent = await sendPasswordResetEmail(
        organizer.email,
        organizer.username,
        tempPassword
      );
      
      if (!emailSent) {
        console.log('Email sending failed, not updating password');
        return res.status(500).json({ error: 'Failed to send password reset email. Please contact system administrator.' });
      }
      
      // Only update the password in the database if email was sent successfully
      console.log('Email sent successfully, updating password in database');
      
      // Update the organizer's password and set temporary flag
      organizer.password = tempPassword;
      organizer.isTemporaryPassword = true;
      await organizer.save();
      
      console.log('Password updated successfully for organizer:', organizer.username);
      return res.json({
        message: 'Password reset successful. Please check your email for the temporary password.'
      });
    }
  } catch (err) {
    console.error('Password reset error:', err.message);
    res.status(500).json({ error: 'Server error during password reset process' });
  }
});

// @route   POST api/auth/change-password
// @desc    Change user password and remove temporary flag
// @access  Private
router.post('/change-password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    console.log('Password change request for user ID:', req.user.id);
    console.log('User role from token:', req.user.role);
    
    // Check user role and find in appropriate collection
    if (req.user.role === 'Administrator') {
      // Find admin in database
      const admin = await Admin.findById(req.user.id);
      
      if (!admin) {
        console.log('Admin not found with ID:', req.user.id);
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Verify current password
      const isMatch = await admin.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Update password and remove temporary flag
      admin.password = newPassword;
      admin.isTemporaryPassword = false;
      await admin.save();
      
      console.log('Admin password changed successfully');
      res.json({ message: 'Password changed successfully' });
    } 
    else if (req.user.role === 'Organizer') {
      // Import Organizer model
      const Organizer = require('../models/Organizer');
      
      // Find organizer in database
      const organizer = await Organizer.findById(req.user.id);
      
      if (!organizer) {
        console.log('Organizer not found with ID:', req.user.id);
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Verify current password
      const isMatch = await organizer.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Update password and remove temporary flag
      organizer.password = newPassword;
      organizer.isTemporaryPassword = false;
      await organizer.save();
      
      console.log('Organizer password changed successfully');
      res.json({ message: 'Password changed successfully' });
    }
    else {
      console.log('Unknown user role:', req.user.role);
      return res.status(403).json({ error: 'Invalid user role' });
    }
  } catch (err) {
    console.error('Password change error:', err.message);
    res.status(500).json({ error: 'Server error during password change' });
  }
});

// @route   POST api/auth/send-verification
// @desc    Send verification code to email for email change
// @access  Public
router.post('/send-verification', async (req, res) => {
  const { email, code, newEmail } = req.body;

  try {
    console.log(`Verification code request for email: ${email}, new email: ${newEmail}`);
    
    // Send email with verification code
    const nodemailer = require('nodemailer');
    
    // Create reusable transporter
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,  // Your Gmail address
        pass: process.env.EMAIL_PASS   // Your Gmail password or app password
      }
    });
    
    // Define email options
    const mailOptions = {
      from: '"NexusEMS" <no-reply@nexusems.com>',
      to: email,
      subject: 'Email Change Verification Code - NexusEMS',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #1a73e8; margin: 0;">Email Change Verification</h2>
          </div>
          
          <p style="margin-bottom: 15px; color: #333333; font-size: 15px; line-height: 1.5;">Dear User,</p>
          
          <p style="margin-bottom: 15px; color: #333333; font-size: 15px; line-height: 1.5;">You have requested to change your email address to: <strong style="color: #1a73e8;">${newEmail}</strong></p>
          
          <p style="margin-bottom: 15px; color: #333333; font-size: 15px; line-height: 1.5;">Please use the verification code below to complete this process:</p>
          
          <div style="background-color: #f0f7ff; border: 2px solid #1a73e8; padding: 20px; border-radius: 6px; text-align: center; margin: 25px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a73e8; font-family: 'Courier New', monospace;">
              ${code}
            </div>
          </div>
          
          <p style="margin-bottom: 15px; color: #333333; font-size: 15px; line-height: 1.5;"><strong>Important:</strong> This code will expire in 5 minutes for security purposes.</p>
          
          <p style="margin-bottom: 15px; color: #333333; font-size: 15px; line-height: 1.5;">If you did not request this change, please ignore this email or contact our support team immediately.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666666; font-size: 13px;">
            <p style="margin: 0;">This is an automated message from NexusEMS. Please do not reply to this email.</p>
            <p style="margin-top: 10px;">&copy; ${new Date().getFullYear()} NexusEMS. All rights reserved.</p>
          </div>
        </div>
      `
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    
    return res.json({ 
      message: 'Verification code sent successfully.'
    });
  } catch (err) {
    console.error('Error sending verification code:', err);
    res.status(500).json({ error: 'Failed to send verification code. Please try again.' });
  }
});

// @route   POST api/auth/update-email
// @desc    Update user email after verification
// @access  Public
router.post('/update-email', async (req, res) => {
  const { userId, newEmail } = req.body;

  try {
    console.log(`Updating email for user ID: ${userId} to: ${newEmail}`);
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (!newEmail) {
      return res.status(400).json({ error: 'New email is required' });
    }
    
    // Check if user exists in admin collection
    let admin = null;
    try {
      admin = await Admin.findById(userId);
    } catch (idError) {
      console.error('Error finding admin by ID:', idError);
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    if (admin) {
      // Update email
      admin.email = newEmail;
      await admin.save();
      
      console.log(`Email updated successfully for admin: ${admin.username}`);
      return res.status(200).json({ 
        message: 'Email updated successfully.'
      });
    } else {
      // If not found in admin collection, check organizer collection
      const Organizer = require('../models/Organizer');
      let organizer = null;
      
      try {
        organizer = await Organizer.findById(userId);
      } catch (idError) {
        console.error('Error finding organizer by ID:', idError);
        return res.status(400).json({ error: 'Invalid user ID format' });
      }
      
      if (!organizer) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Update email
      organizer.email = newEmail;
      await organizer.save();
      
      console.log(`Email updated successfully for organizer: ${organizer.username}`);
      return res.status(200).json({ 
        message: 'Email updated successfully.'
      });
    }
  } catch (err) {
    console.error('Error updating email:', err);
    return res.status(500).json({ error: 'Failed to update email. Please try again.' });
  }
});

// @route   POST api/auth/update-phone
// @desc    Update user phone number
// @access  Private
router.post('/update-phone', auth, async (req, res) => {
  const { userId, newPhone } = req.body;

  try {
    console.log(`Updating phone for user: ${userId} to: ${newPhone}`);
    
    // Check if user exists in admin collection
    let admin = await Admin.findById(userId);

    if (admin) {
      // Update phone
      admin.phone = newPhone;
      await admin.save();
      
      console.log(`Phone updated successfully for admin: ${admin.username}`);
      return res.json({ 
        message: 'Phone number updated successfully.'
      });
    } else {
      // If not found in admin collection, check organizer collection
      const Organizer = require('../models/Organizer');
      let organizer = await Organizer.findById(userId);
      
      if (!organizer) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Update phone
      organizer.phone = newPhone;
      await organizer.save();
      
      console.log(`Phone updated successfully for organizer: ${organizer.username}`);
      return res.json({ 
        message: 'Phone number updated successfully.'
      });
    }
  } catch (err) {
    console.error('Error updating phone number:', err);
    res.status(500).json({ error: 'Failed to update phone number. Please try again.' });
  }
});

// @route   POST api/auth/check-email
// @desc    Check if email is already registered in admin or organizer collections
// @access  Public
router.post('/check-email', async (req, res) => {
  const { email, userId, userType } = req.body;

  try {
    console.log(`Checking email uniqueness for: ${email}, userId: ${userId}, userType: ${userType}`);
    
    // Check admin collection
    const adminExists = await Admin.findOne({ 
      email, 
      _id: { $ne: userId } // Exclude current user
    });
    
    if (adminExists) {
      console.log(`Email ${email} already exists in admin collection`);
      return res.status(409).json({ 
        message: 'This email is already registered to an administrator account.'
      });
    }
    
    // Check organizer collection
    const Organizer = require('../models/Organizer');
    const organizerExists = await Organizer.findOne({ 
      email,
      _id: { $ne: userId } // Exclude current user
    });
    
    if (organizerExists) {
      console.log(`Email ${email} already exists in organizer collection`);
      return res.status(409).json({ 
        message: 'This email is already registered to an organizer account.'
      });
    }
    
    // Email is unique
    console.log(`Email ${email} is unique and available`);
    return res.status(200).json({ 
      message: 'Email is available', 
      isUnique: true 
    });
  } catch (err) {
    console.error('Error checking email uniqueness:', err);
    res.status(500).json({ error: 'Server error checking email uniqueness' });
  }
});

// @route   POST api/auth/update-contact-no
// @desc    Update user contact number
// @access  Public
router.post('/update-contact-no', async (req, res) => {
  const { userId, newContactNo } = req.body;

  try {
    console.log(`Updating contact_no for user: ${userId} to: ${newContactNo}`);
    
    // Check if user exists in admin collection
    let admin = await Admin.findById(userId);

    if (admin) {
      // Update contact_no
      admin.contact_no = newContactNo;
      await admin.save();
      
      console.log(`Contact number updated successfully for admin: ${admin.username}`);
      return res.json({ 
        message: 'Contact number updated successfully.'
      });
    } else {
      // If not found in admin collection, check organizer collection
      const Organizer = require('../models/Organizer');
      let organizer = await Organizer.findById(userId);
      
      if (!organizer) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Update phone for organizer
      organizer.phone = newContactNo; // Organizers use 'phone' field
      await organizer.save();
      
      console.log(`Contact number updated successfully for organizer: ${organizer.username}`);
      return res.json({ 
        message: 'Contact number updated successfully.'
      });
    }
  } catch (err) {
    console.error('Error updating contact number:', err);
    res.status(500).json({ error: 'Failed to update contact number. Please try again.' });
  }
});

// @route   GET api/auth/user-data/:id
// @desc    Get user data by ID (for debugging)
// @access  Public (for debugging)
router.get('/user-data/:id', async (req, res) => {
  const userId = req.params.id;
  
  try {
    console.log(`Fetching user data for ID: ${userId}`);
    
    // Check admin collection
    let admin = await Admin.findById(userId);
    
    if (admin) {
      return res.json({
        username: admin.username,
        email: admin.email,
        contact_no: admin.contact_no,
        admin_id: admin.admin_id,
        role: 'Administrator'
      });
    } 
    
    // If not in admin collection, check organizer collection
    const Organizer = require('../models/Organizer');
    let organizer = await Organizer.findById(userId);
    
    if (organizer) {
      return res.json({
        username: organizer.username,
        email: organizer.email,
        contact_no: organizer.contact_no,
        organizer_id: organizer.organizer_id,
        role: 'Organizer'
      });
    }
    
    return res.status(404).json({ error: 'User not found' });
  } catch (err) {
    console.error('Error fetching user data:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST api/auth/check-contact
// @desc    Check if contact number is already registered in admin or organizer collections
// @access  Public
router.post('/check-contact', async (req, res) => {
  const { contactNo, userId, userType } = req.body;

  try {
    console.log(`Checking contact number uniqueness for: ${contactNo}, userId: ${userId}, userType: ${userType}`);
    
    // Check admin collection for contact_no
    const adminExists = await Admin.findOne({ 
      contact_no: contactNo, 
      _id: { $ne: userId } // Exclude current user
    });
    
    if (adminExists) {
      console.log(`Contact number ${contactNo} already exists in admin collection`);
      return res.status(409).json({ 
        message: 'This contact number is already registered to an administrator account.'
      });
    }
    
    // Check organizer collection for phone
    const Organizer = require('../models/Organizer');
    const organizerExists = await Organizer.findOne({ 
      phone: contactNo,
      _id: { $ne: userId } // Exclude current user
    });
    
    if (organizerExists) {
      console.log(`Contact number ${contactNo} already exists in organizer collection`);
      return res.status(409).json({ 
        message: 'This contact number is already registered to an organizer account.'
      });
    }
    
    // Contact number is unique
    console.log(`Contact number ${contactNo} is unique and available`);
    return res.status(200).json({ 
      message: 'Contact number is available', 
      isUnique: true 
    });
  } catch (err) {
    console.error('Error checking contact number uniqueness:', err);
    res.status(500).json({ error: 'Server error checking contact number uniqueness' });
  }
});

// @route   POST api/auth/send-contact-verification
// @desc    Send verification code to email for contact number change
// @access  Public
router.post('/send-contact-verification', async (req, res) => {
  const { email, code, newContactNo } = req.body;

  try {
    console.log(`Contact verification code request for email: ${email}, new contact: ${newContactNo}`);
    
    // Send email with verification code
    const nodemailer = require('nodemailer');
    
    // Create reusable transporter
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,  // Your Gmail address
        pass: process.env.EMAIL_PASS   // Your Gmail password or app password
      }
    });
    
    // Define email options
    const mailOptions = {
      from: '"NexusEMS" <no-reply@nexusems.com>',
      to: email,
      subject: 'Contact Number Change Verification Code - NexusEMS',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #1a73e8; margin: 0;">Contact Number Change Verification</h2>
          </div>
          
          <p style="margin-bottom: 15px; color: #333333; font-size: 15px; line-height: 1.5;">Dear User,</p>
          
          <p style="margin-bottom: 15px; color: #333333; font-size: 15px; line-height: 1.5;">You have requested to change your contact number to: <strong style="color: #1a73e8;">${newContactNo}</strong></p>
          
          <p style="margin-bottom: 15px; color: #333333; font-size: 15px; line-height: 1.5;">Please use the verification code below to complete this process:</p>
          
          <div style="background-color: #f0f7ff; border: 2px solid #1a73e8; padding: 20px; border-radius: 6px; text-align: center; margin: 25px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a73e8; font-family: 'Courier New', monospace;">
              ${code}
            </div>
          </div>
          
          <p style="margin-bottom: 15px; color: #333333; font-size: 15px; line-height: 1.5;"><strong>Important:</strong> This code will expire in 5 minutes for security purposes.</p>
          
          <p style="margin-bottom: 15px; color: #333333; font-size: 15px; line-height: 1.5;">If you did not request this change, please ignore this email or contact our support team immediately.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666666; font-size: 13px;">
            <p style="margin: 0;">This is an automated message from NexusEMS. Please do not reply to this email.</p>
            <p style="margin-top: 10px;">&copy; ${new Date().getFullYear()} NexusEMS. All rights reserved.</p>
          </div>
        </div>
      `
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Contact verification email sent:', info.messageId);
    
    return res.json({ 
      message: 'Verification code sent successfully.'
    });
  } catch (err) {
    console.error('Error sending contact verification code:', err);
    res.status(500).json({ error: 'Failed to send verification code. Please try again.' });
  }
});

// Helper function to generate a random password
function generateRandomPassword(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    password += chars[randomIndex];
  }
  return password;
}

module.exports = router; 