const express = require('express');
const router = express.Router();
const multer = require('multer');
const Event = require('../models/createEvent');

// Multer storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Generate Event ID
async function generateEventId() {
    const lastEvent = await Event.findOne().sort({ pk_event_id: -1 }).exec();
    if (lastEvent && lastEvent.pk_event_id) {
        const lastIdNumber = parseInt(lastEvent.pk_event_id.split('-')[1], 10);
        return `E-${(lastIdNumber + 1).toString().padStart(3, '0')}`;
    }
    return 'E-001';
}

// New route: Get events by organizer ID
router.get('/organizer/:organizerId', async (req, res) => {
    try {
        const { organizerId } = req.params;
        console.log(`Fetching events for organizer: ${organizerId}`);
        
        const events = await Event.find({ organizer_id: organizerId });
        console.log(`Found ${events.length} events for organizer ${organizerId}`);
        
        res.json(events);
    } catch (error) {
        console.error('Error fetching events by organizer:', error);
        res.status(500).json({ 
            message: 'Error fetching events',
            error: error.message
        });
    }
});

// New route: Get all events
router.get('/', async (req, res) => {
    try {
        console.log('Fetching all events');
        
        const events = await Event.find({});
        console.log(`Found ${events.length} events total`);
        
        res.json(events);
    } catch (error) {
        console.error('Error fetching all events:', error);
        res.status(500).json({ 
            message: 'Error fetching events',
            error: error.message
        });
    }
});

// New route: Get a single event by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`Fetching event with ID: ${id}`);
        
        const event = await Event.findOne({ pk_event_id: id });
        
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        
        console.log(`Found event: ${event.event_name}`);
        res.json(event);
    } catch (error) {
        console.error('Error fetching event by ID:', error);
        res.status(500).json({ 
            message: 'Error fetching event',
            error: error.message
        });
    }
});

// Create Event Route
router.post('/', upload.array('files', 5), async (req, res) => {
    console.log('Incoming event creation request received');
    console.log('Body keys:', Object.keys(req.body));

    // Log important fields
    if (req.body.event_name) console.log('Event name:', req.body.event_name);
    if (req.body.organizer_id) console.log('Organizer ID:', req.body.organizer_id);

    // Log files
    console.log('Files received:', req.files ? req.files.length : 0);

    try {
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

        // Parse JSON strings if they exist
        let parsedTicketTypes = [];
        let parsedDiscounts = [];

        if (ticketTypes) {
            try {
                parsedTicketTypes = JSON.parse(ticketTypes);
                console.log('Parsed ticket types:', parsedTicketTypes);

                // Validate ticket types structure
                if (Array.isArray(parsedTicketTypes)) {
                    // Make sure each ticket type has the required fields
                    parsedTicketTypes = parsedTicketTypes.map(ticket => ({
                        type: ticket.type || ticket.id || 'regular',
                        name: ticket.name || 'Regular',
                        price: ticket.price || 0,
                        color: ticket.color || '#808080'
                    }));
                } else {
                    console.error('ticketTypes is not an array after parsing');
                    parsedTicketTypes = [];
                }
            } catch (e) {
                console.error('Error parsing ticketTypes:', e);
                parsedTicketTypes = [];
            }
        }

        if (discounts) {
            try {
                parsedDiscounts = JSON.parse(discounts);
                console.log('Parsed discounts:', parsedDiscounts);

                // Process discount objects and create them in the database
                if (Array.isArray(parsedDiscounts)) {
                    const Discount = require('../models/discount');
                    const discountIds = [];

                    // Import the discounts router to access the generateDiscountId function
                    const discountsRouter = require('./discounts');

                    // Process each discount
                    for (const discount of parsedDiscounts) {
                        // Use discount_id or id, and ensure it's not empty
                        let discountId = discount.discount_id || discount.id;

                        // Check if we need to generate a new ID
                        if (!discountId || discountId === '' || discountId.startsWith('temp-')) {
                            // Use the generateDiscountId function from the discounts router
                            discountId = await discountsRouter.generateDiscountId();
                            console.log(`Generated new discount ID in events.js: ${discountId}`);
                        }

                        // Check if this discount already exists
                        const existingDiscount = await Discount.findOne({ discount_id: discountId });

                        if (!existingDiscount) {
                            // Handle ticketTypeIds - it could be an array, undefined, or null
                            const ticketTypeIds = Array.isArray(discount.ticketTypeIds) ? discount.ticketTypeIds : [];

                            // Process the ticket type IDs
                            let processedTicketTypeIds = [];

                            if (ticketTypeIds.length > 0) {
                                processedTicketTypeIds = ticketTypeIds;
                                console.log(`Creating discount with ticketTypeIds: ${processedTicketTypeIds.join(', ')}`);
                            } else {
                                console.log('Creating discount that applies to all tickets (empty ticketTypeIds)');
                            }

                            // Create a new discount record
                            const newDiscount = new Discount({
                                discount_id: discountId,
                                name: discount.name || 'Unnamed Discount',
                                percentage: typeof discount.percentage === 'number' ? discount.percentage : 0,
                                ticketTypeIds: processedTicketTypeIds,
                                expiry_date: discount.expiry_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                            });

                            await newDiscount.save();
                            console.log(`Created new discount: ${discountId}`);
                        } else {
                            console.log(`Discount ${discountId} already exists, skipping creation`);
                        }

                        // Add the ID to our list
                        discountIds.push(discountId);
                    }

                    // Update parsedDiscounts to be just the IDs for storing in the event
                    parsedDiscounts = discountIds;
                    console.log('Discount IDs to store with event:', parsedDiscounts);
                } else {
                    console.error('discounts is not an array after parsing');
                    parsedDiscounts = [];
                }
            } catch (e) {
                console.error('Error parsing discounts:', e);
                parsedDiscounts = [];
            }
        }

        // Format dates properly
        const formattedStartDate = new Date(start_date_time);
        const formattedEndDate = new Date(end_date_time);

        // Log the dates for debugging
        console.log('Start date:', start_date_time, '→', formattedStartDate);
        console.log('End date:', end_date_time, '→', formattedEndDate);

        // Log the parsed discounts for debugging
        console.log('Using discount IDs:', parsedDiscounts);

        // Create the new event
        // Create the event object with all required fields
        const eventData = {
            pk_event_id,
            event_name,
            start_date_time: formattedStartDate,
            end_date_time: formattedEndDate,
            description,
            files,
            organizer_id: organizer_id || 'default-organizer',
            ticketTypes: parsedTicketTypes || []
        };

        // Only add discounts if they exist and are valid
        if (Array.isArray(parsedDiscounts) && parsedDiscounts.length > 0) {
            eventData.discounts = parsedDiscounts;
        }

        console.log('Creating event with data:', eventData);

        const newEvent = new Event(eventData);

        const savedEvent = await newEvent.save();
        console.log('Event successfully created:', savedEvent);
        res.json(savedEvent);
    } catch (error) {
        console.error('Error creating event:', error);

        // Log more detailed error information
        if (error.name === 'ValidationError') {
            console.error('Validation errors:');
            for (const field in error.errors) {
                console.error(`Field ${field}: ${error.errors[field].message}`);
            }
        }

        // Check for specific error types
        if (error.name === 'CastError') {
            console.error(`Cast error on field ${error.path}: ${error.value}`);
        }

        // Send detailed error response
        res.status(500).json({
            message: error.message,
            name: error.name,
            errors: error.errors,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Update Event Route - Add or update ticket types
router.put('/:id/ticket-types', async (req, res) => {
    try {
        const eventId = req.params.id;
        const { ticketTypes } = req.body;

        console.log(`Updating ticket types for event ${eventId}`);
        console.log('Received ticket types:', ticketTypes);

        // Find the event
        const event = await Event.findOne({ pk_event_id: eventId });

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Process ticket types
        if (Array.isArray(ticketTypes)) {
            // Initialize ticketTypes array if it doesn't exist
            if (!event.ticketTypes) {
                event.ticketTypes = [];
            }

            // Process each ticket type
            for (const ticketType of ticketTypes) {
                // Check if this ticket type already exists in the event
                const existingIndex = event.ticketTypes.findIndex(
                    t => t.type === ticketType.id || t.type === ticketType.type
                );

                if (existingIndex >= 0) {
                    // Update existing ticket type
                    event.ticketTypes[existingIndex] = {
                        type: ticketType.id || ticketType.type,
                        name: ticketType.name,
                        price: ticketType.price,
                        color: ticketType.color || '#808080'
                    };
                    console.log(`Updated existing ticket type: ${ticketType.name}`);
                } else {
                    // Add new ticket type
                    event.ticketTypes.push({
                        type: ticketType.id || ticketType.type,
                        name: ticketType.name,
                        price: ticketType.price,
                        color: ticketType.color || '#808080'
                    });
                    console.log(`Added new ticket type: ${ticketType.name}`);
                }
            }

            // Save the updated event
            const updatedEvent = await event.save();
            console.log('Event updated with new ticket types');
            res.json(updatedEvent);
        } else {
            return res.status(400).json({ 
                message: 'Invalid request data',
                details: 'ticketTypes must be an array'
            });
        }
    } catch (error) {
        console.error('Error updating event ticket types:', error);
        res.status(500).json({
            message: 'Error updating event ticket types',
            error: error.message
        });
    }
});

// Update Event Route - Add or update discounts
router.put('/:id/discounts', async (req, res) => {
    try {
        const eventId = req.params.id;
        const { discounts } = req.body;

        console.log(`Updating discounts for event ${eventId}`);
        console.log('Received discounts:', discounts);

        // Find the event
        const event = await Event.findOne({ pk_event_id: eventId });

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Process discounts
        if (Array.isArray(discounts)) {
            // Initialize discounts array if it doesn't exist
            if (!event.discounts) {
                event.discounts = [];
            }

            // Update the discounts array
            event.discounts = discounts.map(d => d.id || d);

            // Save the updated event
            const updatedEvent = await event.save();
            console.log('Event updated with new discounts');
            res.json(updatedEvent);
        } else {
            return res.status(400).json({ 
                message: 'Invalid request data',
                details: 'discounts must be an array'
            });
        }
    } catch (error) {
        console.error('Error updating event discounts:', error);
        res.status(500).json({
            message: 'Error updating event discounts',
            error: error.message
        });
    }
});

// General Update Event Route
router.put('/:id', upload.array('files', 5), async (req, res) => {
    try {
        const eventId = req.params.id;
        const updateData = req.body;
        
        console.log(`Updating event ${eventId}`);
        console.log('Update data keys:', Object.keys(updateData));

        // Find the event
        const event = await Event.findOne({ pk_event_id: eventId });

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Process files if provided
        if (req.files && req.files.length > 0) {
            const files = req.files.map(file => ({
                filename: file.originalname,
                data: file.buffer,
                contentType: file.mimetype
            }));
            
            // Replace or append files
            if (updateData.replaceFiles === 'true') {
                event.files = files;
            } else {
                event.files = [...event.files, ...files];
            }
        }

        // Update basic fields
        if (updateData.event_name) event.event_name = updateData.event_name;
        if (updateData.description) event.description = updateData.description;
        if (updateData.start_date_time) event.start_date_time = new Date(updateData.start_date_time);
        if (updateData.end_date_time) event.end_date_time = new Date(updateData.end_date_time);

        // Process ticket types if provided
        if (updateData.ticketTypes) {
            try {
                const parsedTicketTypes = typeof updateData.ticketTypes === 'string' 
                    ? JSON.parse(updateData.ticketTypes) 
                    : updateData.ticketTypes;

                if (Array.isArray(parsedTicketTypes)) {
                    // Replace ticket types
                    event.ticketTypes = parsedTicketTypes.map(ticket => ({
                        type: ticket.type || ticket.id || 'regular',
                        name: ticket.name || 'Regular',
                        price: ticket.price || 0,
                        color: ticket.color || '#808080'
                    }));
                }
            } catch (e) {
                console.error('Error parsing ticketTypes in update:', e);
            }
        }

        // Process discounts if provided
        if (updateData.discounts) {
            try {
                const parsedDiscounts = typeof updateData.discounts === 'string' 
                    ? JSON.parse(updateData.discounts) 
                    : updateData.discounts;

                if (Array.isArray(parsedDiscounts)) {
                    // Replace discounts
                    event.discounts = parsedDiscounts.map(d => d.id || d);
                }
            } catch (e) {
                console.error('Error parsing discounts in update:', e);
            }
        }

        // Save the updated event
        const updatedEvent = await event.save();
        console.log('Event successfully updated');
        res.json(updatedEvent);
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({
            message: 'Error updating event',
            error: error.message
        });
    }
});

module.exports = router;
