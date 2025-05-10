const express = require('express');
const router = express.Router();
const Ticket = require('../models/ticket');

// Generate Ticket ID
async function generateTicketId(startIndex = 1) {
    const lastTicket = await Ticket.findOne().sort({ ticket_id: -1 }).exec();
    if (lastTicket && lastTicket.ticket_id) {
        const lastIdNumber = parseInt(lastTicket.ticket_id.split('-')[1], 10);
        return `T-${(lastIdNumber + 1).toString().padStart(3, '0')}`;
    }
    return `T-${startIndex.toString().padStart(3, '0')}`;
}

// Generate multiple ticket IDs in batch
async function generateMultipleTicketIds(count) {
    const lastTicket = await Ticket.findOne().sort({ ticket_id: -1 }).exec();
    let startNumber = 1;

    if (lastTicket && lastTicket.ticket_id) {
        startNumber = parseInt(lastTicket.ticket_id.split('-')[1], 10) + 1;
    }

    const ticketIds = [];
    for (let i = 0; i < count; i++) {
        ticketIds.push(`T-${(startNumber + i).toString().padStart(3, '0')}`);
    }

    return ticketIds;
}

// Create tickets for an event
router.post('/create', async (req, res) => {
    try {
        const { event_id, tickets } = req.body;

        if (!event_id || !tickets || !Array.isArray(tickets)) {
            return res.status(400).json({
                message: 'Invalid request data',
                details: 'Event ID and tickets array are required'
            });
        }

        console.log(`Creating tickets for event: ${event_id}`);
        console.log(`Number of tickets to create: ${tickets.length}`);

        // Generate ticket IDs in batch for better performance
        const ticketIds = await generateMultipleTicketIds(tickets.length);

        // Create tickets with unique IDs
        const ticketsToCreate = tickets.map((ticketData, index) => ({
            ticket_id: ticketIds[index],
            event_id,
            ticket_type: ticketData.ticket_type,
            layout: ticketData.layout,
            row: ticketData.row,
            seat_no: ticketData.seat_no,
            price: ticketData.price,
            status: 'available'
        }));

        // Insert new tickets
        const createdTickets = await Ticket.insertMany(ticketsToCreate);
        console.log(`Successfully created ${createdTickets.length} tickets for event ${event_id}`);

        res.status(201).json(createdTickets);
    } catch (error) {
        console.error('Error creating tickets:', error);
        res.status(500).json({
            message: 'Error creating tickets',
            error: error.message
        });
    }
});

// Generate tickets from seat layouts
router.post('/generate-from-layout', async (req, res) => {
    try {
        const { event_id, seatLayouts } = req.body;

        if (!event_id || !seatLayouts || !Array.isArray(seatLayouts)) {
            return res.status(400).json({
                message: 'Invalid request data',
                details: 'Event ID and seatLayouts array are required'
            });
        }

        console.log(`Generating tickets for event: ${event_id} from seat layouts`);

        // Check if tickets already exist for this event
        const existingTickets = await Ticket.find({ event_id });
        const isUpdating = existingTickets.length > 0;

        if (isUpdating) {
            console.log(`Found ${existingTickets.length} existing tickets for event ${event_id}. Will update them.`);
        }

        // Prepare tickets from seat layouts
        const ticketsToCreate = [];

        // Process each layout section
        for (const layout of seatLayouts) {
            const layoutName = layout.layout;
            const ticketType = layout.ticketType;

            // Process each seat in the layout
            for (const seat of layout.seats) {
                // Use ticket type name instead of ID
                const ticketTypeName = seat.ticketTypeName || layout.ticketTypeName || 'Regular';

                ticketsToCreate.push({
                    layout: layoutName,
                    row: seat.row,
                    seat_no: seat.seatNo,
                    ticket_type: ticketTypeName, // Store the name instead of ID
                    price: seat.price,
                    event_id
                });
            }
        }

        console.log(`Prepared ${ticketsToCreate.length} tickets to ${isUpdating ? 'update' : 'create'}`);

        let updatedCount = 0;
        let createdCount = 0;

        if (isUpdating) {
            // Delete existing tickets for this event
            const deleteResult = await Ticket.deleteMany({ event_id });
            console.log(`Deleted ${deleteResult.deletedCount} existing tickets for event ${event_id}`);
            updatedCount = deleteResult.deletedCount;
        }

        // Generate ticket IDs in batch for better performance
        const ticketIds = await generateMultipleTicketIds(ticketsToCreate.length);

        // Assign ticket IDs to each ticket
        ticketsToCreate.forEach((ticket, index) => {
            ticket.ticket_id = ticketIds[index];
            ticket.status = 'available';
        });

        // Insert new tickets in batches to avoid overwhelming the database
        const BATCH_SIZE = 100;
        createdCount = 0;

        for (let i = 0; i < ticketsToCreate.length; i += BATCH_SIZE) {
            const batch = ticketsToCreate.slice(i, i + BATCH_SIZE);
            const created = await Ticket.insertMany(batch);
            createdCount += created.length;
            console.log(`Created batch of ${created.length} tickets (${createdCount}/${ticketsToCreate.length})`);
        }

        const actionText = isUpdating ? 'updated' : 'created';
        console.log(`Successfully ${actionText} ${createdCount} tickets for event ${event_id}`);

        res.status(201).json({
            message: `Successfully ${actionText} ${createdCount} tickets`,
            count: createdCount,
            updatedCount: isUpdating ? updatedCount : 0,
            isUpdate: isUpdating,
            event_id
        });
    } catch (error) {
        console.error('Error generating tickets from layout:', error);
        res.status(500).json({
            message: 'Error generating tickets',
            error: error.message
        });
    }
});

// Get all tickets
router.get('/', async (req, res) => {
    try {
        const tickets = await Ticket.find();
        res.status(200).json(tickets);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ 
            message: 'Error fetching tickets',
            error: error.message 
        });
    }
});

// Get tickets by event ID
router.get('/event/:eventId', async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const tickets = await Ticket.find({ event_id: eventId });
        res.status(200).json(tickets);
    } catch (error) {
        console.error('Error fetching tickets by event ID:', error);
        res.status(500).json({ 
            message: 'Error fetching tickets',
            error: error.message 
        });
    }
});

// Update ticket status
router.post('/update-status', async (req, res) => {
    try {
        const { ticket_ids, status } = req.body;
        
        if (!ticket_ids || !Array.isArray(ticket_ids) || ticket_ids.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Ticket IDs are required and must be an array' 
            });
        }
        
        if (!status) {
            return res.status(400).json({ 
                success: false, 
                message: 'Status is required' 
            });
        }
        
        console.log(`Updating status of ${ticket_ids.length} tickets to ${status}`);
        
        // Update ticket status
        const result = await Ticket.updateMany(
            { ticket_id: { $in: ticket_ids } },
            { $set: { status } }
        );
        
        console.log('Update result:', result);
        
        res.status(200).json({ 
            success: true, 
            message: 'Ticket status updated successfully',
            result
        });
    } catch (error) {
        console.error('Error updating ticket status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating ticket status', 
            error: error.message 
        });
    }
});

module.exports = router;