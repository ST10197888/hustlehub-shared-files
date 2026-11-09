const mongoose = require('mongoose');

const gigSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: [true, 'Gig title is required'], 
        trim: true 
    },
    description: { 
        type: String, 
        required: [true, 'Gig description is required'] 
    },
    category: { 
        type: String, 
        required: [true, 'Category is required'] 
    },
    price: { 
        type: Number, 
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
    },
    freelancer: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    }
}, { timestamps: true });

module.exports = mongoose.model('Gig', gigSchema);