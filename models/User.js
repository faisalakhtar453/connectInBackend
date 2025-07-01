const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  username: { type: String },
  loginType: { type: String, required: true },
  emailStatus: { type: String },
  forgotpasswordotp: { type: String },
  packageid: { type: String },
  cookie: { type: String },
  extensionStatus: { type: Boolean },
  cookieStatus: { type: Boolean },
  contact: { type: String },
  address1: { type: String },
  address2: { type: String },
  city: { type: String }, 
  country: { type: String },
  bio: { type: String },
  image: { type: String },
  role: { type: String },
  googleId: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
