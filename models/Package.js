const mongoose = require('mongoose');

const Package = new mongoose.Schema({
    name: { type: String },
    monthlyPrice: { type: String },
    yearlyPrice: { type: String },
    commentLimit: { type: String },
    accountLimit: { type: String },
    // profileLimit: { type: String },
    creatorLimit: { type: String },
    pageLimit: { type: String },
    bothActive: { type: Boolean },
    status: { type: String },
    type: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Package', Package);
