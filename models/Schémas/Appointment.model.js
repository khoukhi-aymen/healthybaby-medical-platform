const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    preAppointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PreAppointment",
      required: true,
    },
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SchedulePerDoctor",
      required: true,
    },
    doctorName: {
      type: String,
      required: true,
    },
    appointmentDate: {
      type: Date,
      required: true,
    },
    appointmentHour: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "In follow-up", "Completed"],
      default: "Pending",
    },
    appointmentType: {
      type: String,
      enum: ["feeding", "pediatrics"], // Type de rendez-vous : "feeding" ou "pediatrics"
      required: true, // S'il y a un type, il doit être précisé
    },
    appointmentMode: {
      type: String,
      enum: ["online", "Face-to-face", null], // Mode de rendez-vous : "online" ou "Face-to-face" (null pour d'autres types)
      default: null, // Par défaut, mode est null si ce n'est pas un rendez-vous "feeding"
    },
    isReviewed: {
      type: Boolean,
      default: false, // Par défaut, le rendez-vous n'est pas encore noté
    },
    archived: {
      type: Boolean,
      default: false,
    },
  },

  { timestamps: true }
);


module.exports = mongoose.model("Appointment", appointmentSchema);
