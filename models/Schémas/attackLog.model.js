const mongoose = require("mongoose");

//Schéma des logs d'attaque
const attackLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  ip: String,
  url: String,
  userAgent: String,
  message: String,
  type: { type: String, default: "unknown" }
});




//Export du modèle (sans connexion directe !)
module.exports = mongoose.model("AttackLog", attackLogSchema);
