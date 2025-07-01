const mongoose = require('mongoose');

const Keyword = new mongoose.Schema({
    userid: { type: String, required: true, },
    keyword: { type: String },
    status: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Keyword', Keyword);
