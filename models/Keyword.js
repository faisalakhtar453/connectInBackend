const mongoose = require('mongoose');

const Keyword = new mongoose.Schema({
    userid: { type: String, required: true, },
    linkedAccountId: { type: String, required: true, },
    keyword: { type: Array },
    status: { type: String },
    lastScrapedAt: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Keyword', Keyword);
