const mongoose = require("mongoose");


const DoctorBlogSchema = new mongoose.Schema(
  {
    // Référence facultative au docteur (utilisateur connecté)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    author: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["general", "nutrition", "mental-health", "pediatrics","feeding","parenting-advice","others"]

    },
    image: {
      type: String, // chemin de l'image uploadée (ex: /uploads/blogs/image123.jpg)
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending", // Par défaut : en attente d'approbation admin
    },
  },
  {
    timestamps: true, // ajoute createdAt et updatedAt
  }
);



module.exports = mongoose.model("DoctorBlog", DoctorBlogSchema);
