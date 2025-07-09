const mongoose = require('mongoose');

const CommentSetting = new mongoose.Schema({
    linkedAccountId: { type: String, required: true, },
    creatorid: { type: String },
    keywordid: { type: String },
    emoji: { type: Boolean },
    hashtag: { type: Boolean },
    exclamation: { type: Boolean },
    author: { type: Boolean },
    status: { type: Boolean },
}, { timestamps: true });

module.exports = mongoose.model('CommentSetting', CommentSetting);
