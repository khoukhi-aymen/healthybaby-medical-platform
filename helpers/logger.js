const AttackLog = require("../models/Schémas/attackLog.model");

/**
 * Enregistre une tentative d'attaque dans MongoDB (via Mongoose déjà connecté dans server.js)
 */
function logAttack(message, req = null, type = "unknown") {
  const logData = {
    message,
    type,
  };

  if (req) {
    logData.ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    logData.url = req.originalUrl || req.url;
    logData.userAgent = req.headers["user-agent"];
  }

  // Enregistrement dans la collection via le modèle AttackLog (Mongoose)
  return AttackLog.create(logData)
    .then(() => {
      console.log(`🔒 [${type.toUpperCase()}] Attack log saved to MongoDB.`);
    })
    .catch((err) => {
      console.error("❌ Error while logging attack:", err);
    });
}

module.exports = logAttack;
