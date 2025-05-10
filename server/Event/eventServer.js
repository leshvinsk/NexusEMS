const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const Event = require('./event.model'); 

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/NexusEMS', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

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

// Endpoint to handle event form submission
app.post('/api/events', upload.array('files', 5), async (req, res) => {
  console.log('Request body:', req.body);
  console.log('Request files:', req.files);

  const { event_name, start_date_time, end_date_time, description } = req.body;
  const files = req.files.map(file => ({
    filename: file.originalname,
    data: file.buffer,
    contentType: file.mimetype
  }));

  const pk_event_id = await generateEventId();

  const newEvent = new Event({
    pk_event_id,
    event_name,
    start_date_time,
    end_date_time,
    description,
    files
  });

  try {
    const savedEvent = await newEvent.save();
    console.log('Event saved:', savedEvent);
    res.json(savedEvent);
  } catch (error) {
    console.error('Error saving event:', error);
    res.status(500).send(error);
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});