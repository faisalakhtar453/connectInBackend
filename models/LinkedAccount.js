const mongoose = require('mongoose');

const LinkedAccount = new mongoose.Schema({
    userid: { type: String, required: true, },
    name: { type: String },
    url: { type: String },
    imageUrl: { type: String },
    tagLine: { type: String },
    pageData: { type: String },
    status: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('LinkedAccount', LinkedAccount);
