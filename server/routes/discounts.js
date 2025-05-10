const express = require('express');
const router = express.Router();
const Discount = require('../models/discount');

// Generate Discount ID
async function generateDiscountId() {
    // Get all discounts and sort them properly
    const allDiscounts = await Discount.find().exec();

    if (allDiscounts && allDiscounts.length > 0) {
        // Extract the numeric part of each ID and find the maximum
        let maxIdNumber = 0;

        for (const discount of allDiscounts) {
            if (discount.discount_id && discount.discount_id.startsWith('D-')) {
                const idParts = discount.discount_id.split('-');
                if (idParts.length === 2) {
                    const idNumber = parseInt(idParts[1], 10);
                    if (!isNaN(idNumber) && idNumber > maxIdNumber) {
                        maxIdNumber = idNumber;
                    }
                }
            }
        }

        // Increment the maximum ID number found by 1 (not by 30)
        const nextId = maxIdNumber + 1;
        console.log(`Generating next discount ID: D-${nextId.toString().padStart(3, '0')} (from max: ${maxIdNumber})`);
        return `D-${nextId.toString().padStart(3, '0')}`;
    }

    console.log('No existing discounts found, starting with D-001');
    return 'D-001';
}

// Create a new discount
router.post('/', async (req, res) => {
    try {
        const { name, percentage, expiry_date, discount_id: providedId, event_id } = req.body;

        if (!name || percentage === undefined) {
            return res.status(400).json({
                message: 'Invalid request data',
                details: 'Name and percentage are required'
            });
        }

        // Use provided ID or generate a new one
        let discount_id;
        if (!providedId || providedId.startsWith('temp-')) {
            // If no ID provided or it's a temporary client-side ID, generate a new one
            discount_id = await generateDiscountId();
            console.log(`Generated new discount ID: ${discount_id} (replacing: ${providedId || 'none'})`);
        } else {
            discount_id = providedId;
            console.log(`Using provided discount ID: ${discount_id}`);
        }

        // Check if a discount with this ID already exists
        const existingDiscount = await Discount.findOne({ discount_id });

        if (existingDiscount) {
            console.log(`Discount with ID ${discount_id} already exists, updating it`);

            // Handle ticketTypeIds - it could be an array, undefined, or null
            const { ticketTypeIds } = req.body;

            // Process the ticket type IDs
            let processedTicketTypeIds = [];

            if (Array.isArray(ticketTypeIds) && ticketTypeIds.length > 0) {
                processedTicketTypeIds = ticketTypeIds;
                console.log(`Updating discount with ticketTypeIds: ${processedTicketTypeIds.join(', ')}`);
            } else {
                console.log('Updating discount to apply to all tickets (empty ticketTypeIds)');
            }

            // Update existing discount
            existingDiscount.name = name;
            existingDiscount.percentage = percentage;
            existingDiscount.ticketTypeIds = processedTicketTypeIds;
            existingDiscount.expiry_date = expiry_date || existingDiscount.expiry_date;
            if (event_id) existingDiscount.event_id = event_id;

            const updatedDiscount = await existingDiscount.save();
            console.log(`Successfully updated discount: ${discount_id}`);

            return res.status(200).json(updatedDiscount);
        }

        // Handle ticketTypeIds - it could be an array, undefined, or null
        const { ticketTypeIds } = req.body;

        // Process the ticket type IDs
        let processedTicketTypeIds = [];

        if (Array.isArray(ticketTypeIds) && ticketTypeIds.length > 0) {
            processedTicketTypeIds = ticketTypeIds;
            console.log(`Creating discount with ticketTypeIds: ${processedTicketTypeIds.join(', ')}`);
        } else {
            console.log('Creating discount that applies to all tickets (empty ticketTypeIds)');
        }

        // Create new discount
        const newDiscount = new Discount({
            discount_id,
            name,
            percentage,
            ticketTypeIds: processedTicketTypeIds,
            event_id: event_id || null,
            expiry_date: expiry_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default to 30 days from now
        });

        const savedDiscount = await newDiscount.save();
        console.log(`Successfully created discount: ${discount_id}`);

        res.status(201).json(savedDiscount);
    } catch (error) {
        console.error('Error creating discount:', error);
        res.status(500).json({
            message: 'Error creating discount',
            error: error.message
        });
    }
});

// Get all discounts
router.get('/', async (req, res) => {
    try {
        // Check if we're filtering by event_id
        const { event_id } = req.query;

        let query = {};
        if (event_id) {
            query.event_id = event_id;
            console.log(`Fetching discounts for event: ${event_id}`);
        }

        const discounts = await Discount.find(query);
        console.log(`Found ${discounts.length} discounts${event_id ? ` for event ${event_id}` : ''}`);

        res.status(200).json(discounts);
    } catch (error) {
        console.error('Error fetching discounts:', error);
        res.status(500).json({
            message: 'Error fetching discounts',
            error: error.message
        });
    }
});

// Get discounts by event ID
router.get('/event/:eventId', async (req, res) => {
    try {
        const eventId = req.params.eventId;
        console.log(`Fetching discounts for event: ${eventId}`);

        const discounts = await Discount.find({ event_id: eventId });
        console.log(`Found ${discounts.length} discounts for event ${eventId}`);

        res.status(200).json(discounts);
    } catch (error) {
        console.error(`Error fetching discounts for event ${req.params.eventId}:`, error);
        res.status(500).json({
            message: 'Error fetching discounts by event ID',
            error: error.message
        });
    }
});

// Get discount by ID
router.get('/:id', async (req, res) => {
    try {
        const discountId = req.params.id;
        const discount = await Discount.findOne({ discount_id: discountId });

        if (!discount) {
            return res.status(404).json({ message: 'Discount not found' });
        }

        res.status(200).json(discount);
    } catch (error) {
        console.error('Error fetching discount by ID:', error);
        res.status(500).json({
            message: 'Error fetching discount',
            error: error.message
        });
    }
});

// Delete discount by ID
router.delete('/:id', async (req, res) => {
    try {
        const discountId = req.params.id;
        console.log(`Attempting to delete discount with ID: ${discountId}`);

        const discount = await Discount.findOne({ discount_id: discountId });

        if (!discount) {
            console.log(`Discount with ID ${discountId} not found`);
            return res.status(404).json({ message: 'Discount not found' });
        }

        await Discount.deleteOne({ discount_id: discountId });
        console.log(`Successfully deleted discount with ID: ${discountId}`);

        res.status(200).json({ message: 'Discount deleted successfully' });
    } catch (error) {
        console.error(`Error deleting discount with ID ${req.params.id}:`, error);
        res.status(500).json({
            message: 'Error deleting discount',
            error: error.message
        });
    }
});

// Export the router directly for Express to use
module.exports = router;

// Also make the generateDiscountId function available
router.generateDiscountId = generateDiscountId;