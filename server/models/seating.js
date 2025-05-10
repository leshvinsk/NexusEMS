const mongoose = require('mongoose');

const seatingSchema = new mongoose.Schema({
    layout: {
        type: String,
        required: true,
        enum: ['LF - Left', 'LF - Center', 'LF - Right', 'B - Left', 'B - Center', 'B - Right']
    },
    row: {
        type: String,
        required: true
    },
    seat_no: {
        type: Number,
        required: true,
        min: 1
    }
});

// Create a compound index for layout, row, and seat_no to ensure uniqueness
seatingSchema.index({ layout: 1, row: 1, seat_no: 1 }, { unique: true });

const Seating = mongoose.model('Seating', seatingSchema);

module.exports = Seating;
