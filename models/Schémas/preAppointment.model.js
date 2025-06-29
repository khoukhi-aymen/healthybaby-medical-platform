const mongoose = require("mongoose");

const preAppointmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Optionnel, si un utilisateur est connecté
    },
    name: String,
    email: String,
    whatsapp: String,
    residence: String,
    video_consent: { type: String, enum: ["Yes", "No"], required: true },
    diseases: [String],
    other_diseases: String,
    concern_summary: String,
    payment_confirmed: { type: String, enum: ["Yes", "No"] },
    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);


module.exports = mongoose.model("PreAppointment", preAppointmentSchema);