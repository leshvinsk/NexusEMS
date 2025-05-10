const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Define Admin Schema
const AdminSchema = new mongoose.Schema({
  admin_id: {
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
  password: {
    type: String,
    required: true
  },
  contact_no: {
    type: String,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Create Admin model
const Admin = mongoose.model('Admin', AdminSchema);

// Function to reset and recreate admin accounts
async function resetAdmins() {
  try {
    // Delete all existing admin accounts
    console.log('Deleting existing admin accounts...');
    await Admin.deleteMany({});
    console.log('All admin accounts deleted');

    // Create new admin accounts
    console.log('Creating new admin accounts...');

    // Process each admin
    const adminPromises = [
      createAdmin(
        process.env.ADMIN1_ID,
        process.env.ADMIN1_USERNAME,
        process.env.ADMIN1_EMAIL,
        process.env.ADMIN1_PASSWORD,
        process.env.ADMIN1_CONTACT
      ),
      createAdmin(
        process.env.ADMIN2_ID,
        process.env.ADMIN2_USERNAME,
        process.env.ADMIN2_EMAIL,
        process.env.ADMIN2_PASSWORD,
        process.env.ADMIN2_CONTACT
      ),
      createAdmin(
        process.env.ADMIN3_ID,
        process.env.ADMIN3_USERNAME,
        process.env.ADMIN3_EMAIL,
        process.env.ADMIN3_PASSWORD,
        process.env.ADMIN3_CONTACT
      )
    ];

    await Promise.all(adminPromises);
    console.log('All admin accounts created successfully');

    // Verify the admins were created
    const admins = await Admin.find({});
    console.log(`Found ${admins.length} admins in the database:`);
    admins.forEach(admin => {
      console.log(`- ${admin.username} (${admin.admin_id})`);
    });

  } catch (err) {
    console.error('Error resetting admin accounts:', err);
  } finally {
    mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
}

// Helper function to create an admin with hashed password
async function createAdmin(id, username, email, password, contact) {
  try {
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create and save the admin
    const admin = new Admin({
      admin_id: id,
      username,
      email,
      password: hashedPassword,
      contact_no: contact
    });

    await admin.save();
    console.log(`Admin ${username} created successfully`);
  } catch (err) {
    console.error(`Error creating admin ${username}:`, err);
    throw err;
  }
}

// Run the reset function
resetAdmins(); 