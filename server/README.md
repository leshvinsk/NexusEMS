# NexusEMS Backend Server

This is the backend server for the NexusEMS application. It provides authentication and data management for the application.

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/nexusems
   JWT_SECRET=your_jwt_secret_key

   # Admin credentials
   ADMIN1_ID=A001
   ADMIN1_USERNAME=admin1
   ADMIN1_EMAIL=admin1@example.com
   ADMIN1_PASSWORD=admin123
   ADMIN1_CONTACT=1234567890

   ADMIN2_ID=A002
   ADMIN2_USERNAME=admin2
   ADMIN2_EMAIL=admin2@example.com
   ADMIN2_PASSWORD=admin456
   ADMIN2_CONTACT=0987654321

   ADMIN3_ID=A003
   ADMIN3_USERNAME=admin3
   ADMIN3_EMAIL=admin3@example.com
   ADMIN3_PASSWORD=admin789
   ADMIN3_CONTACT=1122334455
   ```

3. Start the server:
   ```
   npm run dev
   ```

## Features

- JWT Authentication
- Admin account management
- Automatic initialization of admin accounts

## API Endpoints

- `POST /api/auth/login` - Login with username and password
- `GET /api/auth/user` - Get authenticated user data (requires token) 