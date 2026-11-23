const mongoose = require('mongoose');

const forgotPasswordSchema = new mongoose.Schema({
  email: String,
  otp: String,
  expiredAt: {
    type: Date,
    default: Date.now,
    expires: 180
  }
},{timestamps: true});

const forgotPassword = mongoose.model("ForgotPassword", forgotPasswordSchema, "forgot-password");
module.exports = forgotPassword;