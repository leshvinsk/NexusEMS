const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const connectDB = require('./config/db');
const Admin = require('./models/Admin');
const Event = require('./models/createEvent');
const Ticket = require('./models/ticket');
const Discount = require('./models/discount');

// Just log minimal server info
console.log('Starting NexusEMS server...');
console.log('Environment check:');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'Set' : 'Not set');
console.log('GMAIL_USER:', process.env.GMAIL_USER ? 'Set' : 'Not set');

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Add error handling for database connection
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.once('open', () => {
    console.log('Connected to MongoDB');
});

// Initialize middleware
app.use(express.json({ extended: false }));
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Define routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/organizers', require('./routes/organizers'));
app.use('/api/events', require('./routes/events'));
app.use('/api/seats', require('./routes/seats'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/discounts', require('./routes/discounts'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/waitlist', require('./routes/waitlist'));

// Multer setup for file uploads
const storage = multer.memoryStorage(); // Store files in memory as Buffer
const upload = multer({ storage });

// Function to generate a new pk_event_id
async function generateEventId() {
  const lastEvent = await Event.findOne().sort({ pk_event_id: -1 }).exec();
  if (lastEvent && lastEvent.pk_event_id) {
    const lastIdNumber = parseInt(lastEvent.pk_event_id.split('-')[1], 10);
    const newIdNumber = lastIdNumber + 1;
    return `E-${newIdNumber.toString().padStart(3, '0')}`;
  } else {
    return 'E-001';
  }
}

// Function to generate a new ticket ID
async function generateTicketId() {
  const lastTicket = await Ticket.findOne().sort({ pk_ticket_id: -1 }).exec();
  if (lastTicket && lastTicket.pk_ticket_id) {
    const lastIdNumber = parseInt(lastTicket.pk_ticket_id.split('-')[1], 10);
    const newIdNumber = lastIdNumber + 1;
    return `T-${newIdNumber.toString().padStart(3, '0')}`;
  } else {
    return 'T-001';
  }
}

// We're now importing generateDiscountId from discounts.js

// Endpoint to handle event form submission
app.post('/api/events', upload.array('files', 5), async (req, res) => {
  console.log('Request body:', req.body);
  console.log('Request files:', req.files);

  const {
    event_name,
    start_date_time,
    end_date_time,
    description,
    organizer_id,
    ticketTypes,
    discounts,
    seatLayouts
  } = req.body;

  const files = req.files.map(file => ({
    filename: file.originalname,
    data: file.buffer,
    contentType: file.mimetype
  }));

  const pk_event_id = await generateEventId();

  // Parse JSON strings if they are passed as strings
  const parsedTicketTypes = typeof ticketTypes === 'string' ? JSON.parse(ticketTypes) : ticketTypes;
  const parsedDiscounts = typeof discounts === 'string' ? JSON.parse(discounts) : discounts;
  const parsedSeatLayouts = typeof seatLayouts === 'string' ? JSON.parse(seatLayouts) : seatLayouts;

  const newEvent = new Event({
    pk_event_id,
    event_name,
    start_date_time,
    end_date_time,
    description,
    files,
    organizer_id: organizer_id || 'default-organizer',
    ticketTypes: parsedTicketTypes || []
  });

  try {
    // Save the event
    const savedEvent = await newEvent.save();
    console.log('Event saved:', savedEvent);

    // Process discounts if provided
    if (parsedDiscounts && parsedDiscounts.length > 0) {
      // If parsedDiscounts is an array of discount objects
      if (typeof parsedDiscounts[0] === 'object') {
        for (const discountData of parsedDiscounts) {
          // Generate a unique discount ID or use the provided one
          const discount_id = discountData.discount_id || discountData.id || await discountsModule.generateDiscountId();

          // Check if this discount already exists
          const existingDiscount = await Discount.findOne({ discount_id: discount_id });

          if (!existingDiscount) {
            // Handle ticketTypeIds - it could be an array, undefined, or null
            const ticketTypeIds = Array.isArray(discountData.ticketTypeIds) ? discountData.ticketTypeIds : [];

            // Process the ticket type IDs
            let processedTicketTypeIds = [];

            if (ticketTypeIds.length > 0) {
              processedTicketTypeIds = ticketTypeIds;
              console.log(`Creating discount with ticketTypeIds: ${processedTicketTypeIds.join(', ')}`);
            } else {
              console.log('Creating discount that applies to all tickets (empty ticketTypeIds)');
            }

            const newDiscount = new Discount({
              discount_id,
              name: discountData.name || 'Unnamed Discount',
              percentage: typeof discountData.percentage === 'number' ? discountData.percentage : 0,
              ticketTypeIds: processedTicketTypeIds,
              expiry_date: discountData.expiry_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              event_id: pk_event_id // Link the discount to this event
            });

            await newDiscount.save();
            console.log(`Discount created: ${discount_id}`);
          } else {
            console.log(`Discount ${discount_id} already exists, updating it`);
            // Handle ticketTypeIds - it could be an array, undefined, or null
            const ticketTypeIds = Array.isArray(discountData.ticketTypeIds) ? discountData.ticketTypeIds : [];

            // Process the ticket type IDs
            let processedTicketTypeIds = [];

            if (ticketTypeIds.length > 0) {
              processedTicketTypeIds = ticketTypeIds;
              console.log(`Updating discount with ticketTypeIds: ${processedTicketTypeIds.join(', ')}`);
            } else if (existingDiscount.ticketTypeIds && existingDiscount.ticketTypeIds.length > 0) {
              // Keep existing ticket type IDs if none provided
              processedTicketTypeIds = existingDiscount.ticketTypeIds;
              console.log(`Keeping existing ticketTypeIds: ${processedTicketTypeIds.join(', ')}`);
            } else {
              console.log('Updating discount to apply to all tickets (empty ticketTypeIds)');
            }

            // Update the existing discount with new data
            existingDiscount.name = discountData.name || existingDiscount.name;
            existingDiscount.percentage = typeof discountData.percentage === 'number' ? discountData.percentage : existingDiscount.percentage;
            existingDiscount.ticketTypeIds = processedTicketTypeIds;
            existingDiscount.expiry_date = discountData.expiry_date || existingDiscount.expiry_date;
            existingDiscount.event_id = pk_event_id; // Link to this event

            await existingDiscount.save();
          }
        }
      }
      // If parsedDiscounts is an array of discount IDs
      else if (typeof parsedDiscounts[0] === 'string') {
        // Update the event with the discount IDs
        console.log(`Adding discount IDs to event: ${parsedDiscounts.join(', ')}`);

        // Create any missing discounts
        for (const discountId of parsedDiscounts) {
          // Check if discount exists
          const existingDiscount = await Discount.findOne({ discount_id: discountId });
          if (!existingDiscount) {
            // Create a default discount if it doesn't exist
            const newDiscount = new Discount({
              discount_id: discountId,
              name: 'Default Discount',
              percentage: 10,
              ticketTypeIds: [],
              expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              event_id: pk_event_id // Link the discount to this event
            });
            await newDiscount.save();
            console.log(`Created missing discount: ${discountId}`);
          } else {
            // Update the existing discount to link it to this event
            existingDiscount.event_id = pk_event_id;
            await existingDiscount.save();
            console.log(`Updated existing discount ${discountId} to link to event ${pk_event_id}`);
          }
        }
      }
    }

    // Process seat layouts and create tickets if provided
    if (parsedSeatLayouts && parsedSeatLayouts.length > 0) {
      for (const layout of parsedSeatLayouts) {
        if (layout.seats && layout.seats.length > 0) {
          const tickets = [];

          for (const seat of layout.seats) {
            // Generate a unique ticket ID
            const ticket_id = await generateTicketId();

            tickets.push({
              pk_ticket_id: ticket_id,
              ticket_type: seat.ticketType,
              layout: layout.layout,
              row: seat.row,
              seat_no: seat.seatNo
            });
          }

          // Save tickets to database
          if (tickets.length > 0) {
            await Ticket.insertMany(tickets);
            console.log(`Created ${tickets.length} tickets for layout ${layout.layout}`);
          }
        }
      }
    }

    res.json(savedEvent);
  } catch (error) {
    console.error('Error saving event:', error);
    res.status(500).send(error);
  }
});

// Endpoint to retrieve all events
app.get('/api/events', async (req, res) => {
  try {
    // Check if organizer_id filter is provided
    const filter = {};
    if (req.query.organizer_id) {
      filter.organizer_id = req.query.organizer_id;
      console.log(`Filtering events by organizer_id: ${req.query.organizer_id}`);
    }
    
    const events = await Event.find(filter);
    console.log(`Found ${events.length} events matching filter`);
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).send(error);
  }
});

// Endpoint to retrieve a single event by ID
app.get('/api/events/:id', async (req, res) => {
  try {
    const event = await Event.findOne({ pk_event_id: req.params.id });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).send(error);
  }
});

// Function to initialize admin accounts
const initializeAdmins = async () => {
  try {
    // Count existing admins
    const count = await Admin.countDocuments();
    
    // If there are already 3 or more admins, don't create default ones
    if (count >= 3) {
      console.log('Admin accounts already exist in the database.');
      return;
    }
    
    console.log('Creating default admin accounts...');
    
    // Create admin accounts from environment variables
    const adminData = [
      {
        admin_id: process.env.ADMIN1_ID,
        username: process.env.ADMIN1_USERNAME,
        email: process.env.ADMIN1_EMAIL,
        password: process.env.ADMIN1_PASSWORD,
        contact_no: process.env.ADMIN1_CONTACT
      },
      {
        admin_id: process.env.ADMIN2_ID,
        username: process.env.ADMIN2_USERNAME,
        email: process.env.ADMIN2_EMAIL,
        password: process.env.ADMIN2_PASSWORD,
        contact_no: process.env.ADMIN2_CONTACT
      },
      {
        admin_id: process.env.ADMIN3_ID,
        username: process.env.ADMIN3_USERNAME,
        email: process.env.ADMIN3_EMAIL,
        password: process.env.ADMIN3_PASSWORD,
        contact_no: process.env.ADMIN3_CONTACT
      }
    ];
    
    // Insert admin accounts individually to properly trigger the password hashing
    // middleware in the Admin model
    for (const admin of adminData) {
      // Check if admin already exists
      const existingAdmin = await Admin.findOne({ username: admin.username });
      if (!existingAdmin) {
        // Create new admin with mongoose model to trigger the pre-save hook
        const newAdmin = new Admin(admin);
        await newAdmin.save();
        console.log(`Admin account created: ${admin.username}`);
      }
    }
    console.log('Default admin accounts created successfully.');
  } catch (error) {
    console.error('Error initializing admin accounts:', error.message);
  }
};

// Initialize admin accounts when server starts
initializeAdmins();

// Define PORT
const PORT = process.env.PORT || 5001;

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
