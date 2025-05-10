const express = require('express');
const router = express.Router();
const Seating = require('../models/seating');

// Get all seats
router.get('/', async (req, res) => {
    try {
        console.log('Fetching all seats...');
        const seats = await Seating.find();
        console.log(`Found ${seats.length} seats`);
        res.status(200).json(seats);
    } catch (error) {
        console.error('Error fetching seats:', error);
        res.status(500).json({ 
            message: 'Error fetching seats',
            error: error.message 
        });
    }
});

// Create seats for a layout
router.post('/create', async (req, res) => {
    try {
        const { layout, seats } = req.body;
        
        console.log('Received request body:', JSON.stringify(req.body, null, 2));
        
        if (!layout || !seats || !Array.isArray(seats)) {
            console.log('Invalid request data:', {
                layout: layout,
                hasSeats: !!seats,
                isArray: Array.isArray(seats)
            });
            return res.status(400).json({ 
                message: 'Invalid request data',
                details: 'Layout and seats array are required'
            });
        }

        // Validate layout
        const validLayouts = ['LF - Left', 'LF - Center', 'LF - Right', 'B - Left', 'B - Center', 'B - Right'];
        if (!validLayouts.includes(layout)) {
            return res.status(400).json({
                message: 'Invalid layout',
                details: `Layout must be one of: ${validLayouts.join(', ')}`
            });
        }

        // Validate each seat object
        const invalidSeats = seats.filter(seat => {
            return !seat.layout || !seat.row || typeof seat.seat_no !== 'number' || seat.seat_no < 1;
        });

        if (invalidSeats.length > 0) {
            console.log('Invalid seat objects found:', invalidSeats);
            return res.status(400).json({
                message: 'Invalid seat data',
                details: 'Each seat must have layout, row, and seat_no (number >= 1)',
                invalidSeats: invalidSeats
            });
        }

        console.log(`Creating seats for layout: ${layout}`);
        console.log(`Number of seats to create: ${seats.length}`);

        // Delete existing seats for this layout
        const deleteResult = await Seating.deleteMany({ layout });
        console.log(`Deleted ${deleteResult.deletedCount} existing seats for layout ${layout}`);
        
        // Insert new seats
        const createdSeats = await Seating.insertMany(seats);
        console.log(`Successfully created ${createdSeats.length} seats for layout ${layout}`);
        
        res.status(201).json(createdSeats);
    } catch (error) {
        console.error('Error creating seats:', error);
        res.status(500).json({ 
            message: 'Error creating seats',
            error: error.message,
            stack: error.stack
        });
    }
});

module.exports = router; 