const nodemailer = require('nodemailer');
require('dotenv').config();

// Create a nodemailer transporter with Yandex configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: true, // use SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    // Do not fail on invalid certs
    rejectUnauthorized: false
  }
});

// Verify transporter configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('SMTP Server connection error:', error);
  } else {
    console.log('SMTP Ready');
  }
});

/**
 * Send a password reset email with a temporary password
 * @param {string} email - Recipient email
 * @param {string} username - Username of the admin
 * @param {string} tempPassword - Temporary password
 * @returns {Promise<boolean>} - Returns true if email was sent successfully
 */
const sendPasswordResetEmail = async (email, username, tempPassword) => {
  try {
    console.log(`Attempting to send password reset email to: ${email}`);
    
    const mailOptions = {
      from: {
        name: 'NexusEMS System',
        address: process.env.EMAIL_FROM
      },
      to: email,
      subject: 'NexusEMS Account Password Reset',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">NexusEMS Password Reset</h2>
          <p>Hello <strong>${username}</strong>,</p>
          <p>Your account password has been reset as requested. Please use the following temporary password to log in:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; font-family: monospace; font-size: 18px; margin: 20px 0;">
            ${tempPassword}
          </div>
          <p>For security reasons, we recommend changing your password after logging in.</p>
          <p>If you did not request this password reset, please contact the system administrator immediately.</p>
          <p style="margin-top: 30px;">Best regards,<br>NexusEMS Team</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
};

/**
 * Send a welcome email to new organizers with their account credentials
 * @param {string} email - Recipient email
 * @param {string} organizerName - Name of the organizer
 * @param {string} username - Username of the organizer
 * @param {string} password - Temporary password
 * @param {string} organizerId - Organizer ID
 * @returns {Promise<boolean>} - Returns true if email was sent successfully
 */
const sendOrganizerWelcomeEmail = async (email, organizerName, username, password, organizerId) => {
  try {
    console.log(`Attempting to send welcome email to new organizer: ${email}`);
    
    const mailOptions = {
      from: {
        name: 'NexusEMS System',
        address: process.env.EMAIL_FROM
      },
      to: email,
      subject: 'Welcome to NexusEMS - Your Event Organizer Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">Welcome to NexusEMS!</h2>
          <p>Hello <strong>${organizerName}</strong>,</p>
          <p>Your Event Organizer account has been created successfully. You can now log in to the NexusEMS platform to manage your events.</p>
          
          <h3 style="color: #1a73e8; margin-top: 20px;">Your Account Information</h3>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Organizer ID:</strong> ${organizerId}</p>
            <p><strong>Username:</strong> ${username}</p>
            <p><strong>Password:</strong> ${password}</p>
          </div>
          
          <p style="color: #d32f2f;"><strong>Important:</strong> For security reasons, we recommend changing your password after your first login.</p>
          
          <p>If you have any questions or need assistance, please contact our support team.</p>
          
          <p style="margin-top: 30px;">Best regards,<br>NexusEMS Team</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Organizer welcome email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending organizer welcome email:', error);
    return false;
  }
};

/**
 * Send a notification email to organizer when their account is removed
 * @param {string} email - Recipient email
 * @param {string} organizerName - Name of the organizer
 * @param {string} organizerId - Organizer ID
 * @returns {Promise<boolean>} - Returns true if email was sent successfully
 */
const sendOrganizerRemovalEmail = async (email, organizerName, organizerId) => {
  try {
    console.log(`Attempting to send account removal notification to organizer: ${email}`);
    
    const mailOptions = {
      from: {
        name: 'NexusEMS System',
        address: process.env.EMAIL_FROM
      },
      to: email,
      subject: 'NexusEMS - Account Removal Notification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">Account Removal Notification</h2>
          <p>Hello <strong>${organizerName}</strong>,</p>
          <p>We regret to inform you that your Event Organizer account (ID: ${organizerId}) has been removed from the NexusEMS platform.</p>
          
          <p>If you believe this action was taken in error or if you have any questions, please contact our support team immediately.</p>
          
          <p style="margin-top: 30px;">Best regards,<br>NexusEMS Team</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Organizer removal notification email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending organizer removal notification email:', error);
    return false;
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendOrganizerWelcomeEmail,
  sendOrganizerRemovalEmail
}; 