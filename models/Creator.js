const mongoose = require('mongoose');

const Creator = new mongoose.Schema({
    linkedAccountId: { type: String, required: true, },
    linkedAccountPageId: { type: [String] },
    isPageSpecific: { type: Boolean },
    name: { type: String },
    url: { type: String },
    imageUrl: { type: String },
    tagLine: { type: String },
    status: { type: String },
    lastScrapedAt: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Creator', Creator);
