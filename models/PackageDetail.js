const mongoose = require('mongoose');

const PackageDetail = new mongoose.Schema({
    userid: { type: String },
    amount: { type: String },
    membershipType: { type: String }, //monthly,yearly
    type: { type: String },       //renew/upgrade/new    
    fromPlanId: { type: String },
    toPlanId: { type: String },
    expireDate: { type: String },
    status: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('PackageDetail', PackageDetail);
