const mongoose = require("mongoose");

const testimonialSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment", // Référence au modèle Appointment
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    testimonial_image: {
      type: String, // Stocke le nom ou chemin du fichier image
      required: true,
    },
    status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending", // Par défaut : en attente d'approbation admin
    }
  },
  {
    timestamps: true, // Crée automatiquement `createdAt` et `updatedAt`
  }
);


module.exports = mongoose.model("Testimonial", testimonialSchema);
