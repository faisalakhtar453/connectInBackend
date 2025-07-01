const mongoose = require('mongoose');

const UserGeneralDetail = new mongoose.Schema({
    userid: { type: String, required: true, },
    industry: { type: String, },
    marketingSource: { type: String, },
    keyWords: { type: String, },
}, { timestamps: true });

module.exports = mongoose.model('UserGeneralDetail', UserGeneralDetail);
