const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["doctor", "parent", "admin"],
      required: true,
    },
    full_name: String,
    email: String,
    password: String,
    Speciality: String,
    medical_license: String,
    diploma: String,
    status: String,
    isAdmin: {
      type: Boolean,
      default: false,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  {
    timestamps: true, // Ajoute createdAt et updatedAt automatiquement
  }
);


module.exports = mongoose.model('User', userSchema);
