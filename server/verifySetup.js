const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Log basic environment variables
console.log('Environment check:');
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
console.log('ADMIN1_USERNAME:', process.env.ADMIN1_USERNAME);
console.log('ADMIN1_PASSWORD:', process.env.ADMIN1_PASSWORD);

// Define a simple Admin schema for testing
const AdminSchema = new mongoose.Schema({
  username: String,
  password: String,
  email: String,
  contact_no: String,
  admin_id: String
});

// Create Admin model
const Admin = mongoose.model('Admin', AdminSchema);

// Connect to MongoDB and verify setup
async function verifySetup() {
  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    // Clear any existing data for a clean test
    await Admin.deleteMany({});
    console.log('Cleared existing admin data');

    // Create a test admin with plain password
    const plainPassword = process.env.ADMIN1_PASSWORD;
    console.log('Plain password:', plainPassword);

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);
    console.log('Hashed password:', hashedPassword);

    // Create the admin with hashed password
    const admin = new Admin({
      username: process.env.ADMIN1_USERNAME,
      password: hashedPassword,
      email: process.env.ADMIN1_EMAIL,
      contact_no: process.env.ADMIN1_CONTACT,
      admin_id: process.env.ADMIN1_ID
    });

    await admin.save();
    console.log('Test admin created successfully');

    // Test password comparison
    const foundAdmin = await Admin.findOne({ username: process.env.ADMIN1_USERNAME });
    if (!foundAdmin) {
      console.log('Error: Admin not found after creation');
      return;
    }

    console.log('Found admin:', foundAdmin);

    // Test password comparison manually
    const isMatch = await bcrypt.compare(plainPassword, foundAdmin.password);
    console.log('Password match result:', isMatch);

    console.log('Verification complete. Everything is working correctly.');
  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
}

verifySetup(); 