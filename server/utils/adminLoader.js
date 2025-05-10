const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

/**
 * Gets all admin data from environment variables
 * 
 * Environment variables should follow this pattern:
 * ADMIN_COUNT=number
 * ADMIN_ID_1, ADMIN_USERNAME_1, ADMIN_EMAIL_1, ADMIN_PASSWORD_1, ADMIN_CONTACT_1
 * ADMIN_ID_2, ADMIN_USERNAME_2, ADMIN_EMAIL_2, ADMIN_PASSWORD_2, ADMIN_CONTACT_2
 * etc.
 * 
 * For backward compatibility, also supports:
 * ADMIN1_ID, ADMIN1_USERNAME, ADMIN1_EMAIL, ADMIN1_PASSWORD, ADMIN1_CONTACT
 * ADMIN2_ID, ADMIN2_USERNAME, ADMIN2_EMAIL, ADMIN2_PASSWORD, ADMIN2_CONTACT
 * etc.
 */
function getAdminData() {
  const adminData = [];
  
  // Check if ADMIN_COUNT is defined
  const adminCount = process.env.ADMIN_COUNT ? parseInt(process.env.ADMIN_COUNT, 10) : 0;
  
  // Load admins from new pattern (ADMIN_ID_1, etc.)
  for (let i = 1; i <= adminCount; i++) {
    // Only add if the required fields exist
    if (process.env[`ADMIN_ID_${i}`] && process.env[`ADMIN_USERNAME_${i}`]) {
      adminData.push({
        admin_id: process.env[`ADMIN_ID_${i}`],
        username: process.env[`ADMIN_USERNAME_${i}`],
        email: process.env[`ADMIN_EMAIL_${i}`],
        password: process.env[`ADMIN_PASSWORD_${i}`],
        contact_no: process.env[`ADMIN_CONTACT_${i}`]
      });
    }
  }
  
  // For backward compatibility, check old pattern (ADMIN1_ID, etc.)
  // If no admins found using new pattern
  if (adminData.length === 0) {
    // Try to find admins using old pattern
    for (let i = 1; i <= 10; i++) { // Support up to 10 admins in old format
      if (process.env[`ADMIN${i}_ID`] && process.env[`ADMIN${i}_USERNAME`]) {
        adminData.push({
          admin_id: process.env[`ADMIN${i}_ID`],
          username: process.env[`ADMIN${i}_USERNAME`],
          email: process.env[`ADMIN${i}_EMAIL`],
          password: process.env[`ADMIN${i}_PASSWORD`],
          contact_no: process.env[`ADMIN${i}_CONTACT`]
        });
      } else {
        // Stop if we don't find consecutive admin entries
        if (i > 3) break;
      }
    }
  }
  
  return adminData;
}

module.exports = { getAdminData }; 