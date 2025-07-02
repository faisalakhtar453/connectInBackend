const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  name: {type: String,required: true,},
  value: { type: mongoose.Schema.Types.Mixed },
  status: { type: String, },
},{ timestamps: true });

module.exports = mongoose.model('Setting', SettingSchema);
