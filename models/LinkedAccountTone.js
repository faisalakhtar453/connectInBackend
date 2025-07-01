const mongoose = require('mongoose');

const LinkedAccountTone = new mongoose.Schema({
    userid: { type: String, required: true, },
    linkedAccountId: { type: String, },
    linkedAccountPageId: { type: String, },
    tone: { type: String, required: true, },
    formalityLevel: { type: String, required: true, },
    questionsFrequency: { type: String, required: true, },
    commentsLength: { type: String, required: true, },
    personality: { type: String, required: true, },
    gender: { type: String, },
}, { timestamps: true });

module.exports = mongoose.model('LinkedAccountTone', LinkedAccountTone);
