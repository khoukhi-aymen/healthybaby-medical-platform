const fs = require("fs");
const mongoose = require("mongoose");
const DoctorShema = require("../models/Schémas/DoctorSchedule.model");
const VisiteurSchema = require("../models/Schémas/User.model");
const PreAppointmentSchema = require("../models/Schémas/preAppointment.model");
const AppointmentSchema = require("../models/Schémas/Appointment.model");
const BlogSchema = require("../models/Schémas/DoctorBlog.model");
const BlogInteraction = require("../models/Schémas/Comments.model");
const TestimonialSchema = require("../models/Schémas/testimonial.model");
const ContactSchema = require("../models/Schémas/Contact.model");
const SchedulePerDoctorSchema = require("../models/Schémas/DoctorSchedule.model");
const logAttack = require("../helpers/logger");
const validator = require('validator');
const nodemailer = require("nodemailer");
const sanitizeHtml = require('sanitize-html');
const path = require("path");




function looksLikeXSS(input) {
  if (typeof input !== "string") return false;

  const patterns = [
    /<script.*?>.*?<\/script>/gi,
    /on\w+\s*=/gi, // ex: onclick=
    /javascript:/gi,
    /<.*?on\w+\s*=.*?>/gi, // <img onerror=...>
    /<iframe.*?>.*?<\/iframe>/gi,
    /<svg.*?>.*?<\/svg>/gi,
    /<math.*?>.*?<\/math>/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /&#[xX]?[0-9a-fA-F]+;/gi, // ex: &#x3C;
    /document\.cookie/gi,
    /document\.write/gi,
    /window\.location/gi,
    /eval\(/gi,
    /setTimeout\(/gi,
    /setInterval\(/gi,
    /Function\(/gi,
  ];

  return patterns.some((regex) => regex.test(input));
}

// Parcours récursif
function detectXSSDeep(obj) {
  if (typeof obj === "string") {
    return looksLikeXSS(obj);
  }

  if (Array.isArray(obj)) {
    return obj.some(detectXSSDeep);
  }

  if (obj && typeof obj === "object") {
    return Object.values(obj).some(detectXSSDeep);
  }

  return false;
}


// Options globales pour sanitize-html (aucune balise ni attribut autorisé)
const sanitizeOptions = {
  allowedTags: [],
  allowedAttributes: {},
};

// Helper pour nettoyer un texte
function cleanText(text) {
  return sanitizeHtml(text || "", sanitizeOptions);
}



/*-------------------------------------- My Appoitmetns --------------------------------*/

/*********************** My Appoitements ***************/

exports.getAppointmentsForDoctor = function ({ userId, startDate, endDate, req }) {
  return new Promise((resolve, reject) => {
    if (!userId) return reject("Missing doctor ID.");

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid doctor ID.");
    }

    if (detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans le doctor ID", req, "xss");
      return reject("Error while retrieving appointments.");
    }

    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate", req, "xss");
      return reject("Error while retrieving appointments.");
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate", req, "xss");
      return reject("Error while retrieving appointments.");
    }

    // Nettoyage avec cleanText (aucune balise ni attribut autorisé)
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";


      return DoctorShema.findOne({ userId })
      .then((doctorSchedule) => {
        if (!doctorSchedule) return resolve([]);

        const query = {
          scheduleId: doctorSchedule._id,
          status: {
            $in: ["Pending", "Approved", "Rejected", "In follow-up", "Completed"],
          },
          archived: false, //Exclure les rendez-vous archivés
        };

        if (sanitizedStartDate && sanitizedEndDate) {
          query.appointmentDate = {
            $gte: new Date(sanitizedStartDate),
            $lte: new Date(sanitizedEndDate),
          };
        }

        return AppointmentSchema.find(query).sort({ appointmentDate: -1 }).limit(100);
      })
      .then((appointments) => {
        resolve(appointments);
      })
      .catch((err) => {
        reject("Error while retrieving appointments.");
      });
  });
};


/*********************** view pré-appointment ***************/

exports.getPreAppointmentById = ({ preId, req }) => {
  return new Promise((resolve, reject) => {
    // Vérifier si l'ID de la pré-appointment est fourni
    if (!preId) {
      return reject("Missing pre-appointment ID.");
    }

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(preId)) {
      return reject("Invalid pre-appointment ID.");
    }

    // Détection XSS dans l'ID
    if (detectXSSDeep(preId)) {
      logAttack("Tentative XSS détectée dans le preId", req, "xss");
      return reject("error retrieving pre-appointment.");
    }


      PreAppointmentSchema.findById(preId)  // Recherche de la pré-appointment par ID
      .then(preAppointment => {
        // Si la pré-appointment n'est pas trouvée
        if (!preAppointment) {
          return reject("Pre-appointment not found.");
        }

        // Si trouvé, retourner les données de la pré-appointment
        resolve(preAppointment);
      })
      .catch(err => {
        reject("Failed to retrieve pre-appointment.");
      });
  });
};


/************************* view témoignage *****************/

exports.getTestimonialByAppointmentId = ({ appointmentId, req }) => {
  return new Promise((resolve, reject) => {
    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
      return reject("Invalid appointment ID.");
    }

    if (detectXSSDeep(appointmentId)) {
      logAttack("Possible XSS in appointment ID", req, "xss");
      return reject("Invalid request.");
    }

      TestimonialSchema.findOne({ appointmentId })
      .then(testimonial => {
        if (!testimonial) {
          return reject("No testimonial found for this appointment.");
        }

        resolve(testimonial);
      })
      .catch(err => {
        reject("Database error.");
      });
  });
};



/********************* Approve Appoitmets ************/

exports.approveAppointmentById = ({ appointmentId, req }) => {
  return new Promise((resolve, reject) => {
    if (!appointmentId) return reject("Missing appointment ID.");
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) return reject("Invalid appointment ID.");

    if (detectXSSDeep(appointmentId)) {
      logAttack("Tentative XSS détectée dans l'ID du rendez-vous", req, "xss");
      return reject("Error updating appointment.");
    }


      AppointmentSchema.findById(appointmentId)
      .then(appointment => {
        if (!appointment) return reject("Appointment not found.");
        appointment.status = "Approved";
        return appointment.save();
      })
      .then(savedAppointment => {
        return PreAppointmentSchema.findById(savedAppointment.preAppointmentId)
          .then(preApp => {
            if (!preApp) return reject("PreAppointment not found.");

            // Préparer l'envoi d'email
            const transporter = nodemailer.createTransport({
              service: "gmail",
              auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
              },
            });

            const mailOptions = {
              from: `"Mommy & Me" <${process.env.EMAIL_USER}>`,
              to: preApp.email,
              subject: "✅ Appointment Approved",
              html: `
                <p>Hello <strong>${preApp.name}</strong>,</p>
                <p>Your appointment with Dr. <strong>${savedAppointment.doctorName}</strong> on <strong>${savedAppointment.appointmentDate.toDateString()}</strong> at <strong>${savedAppointment.appointmentHour}</strong> has been <span style="color:green;">approved</span>.</p>
                <p>Thank you for choosing our clinic!</p>
              `,
            };

            return transporter.sendMail(mailOptions)
              .then(() => savedAppointment);
          });
      })
      .then(() => {
        resolve("Appointment approved and email notification sent.");
      })
      .catch(err => {
        reject("Error approving appointment and sending email.");
      });
  });
};

/*********************** delete Appoitment ***************/

exports.DeleteAppointmentModel = ({id,preAppointmentId,scheduleId,doctorName,appointmentDate,appointmentHour,userId,req}) => {
  return new Promise((resolve, reject) => {
    // Vérification des données
    if (!doctorName || !appointmentDate || !appointmentHour) {
      return reject("Missing required data.");
    }


    if (!id) return reject("appointment ID is required for deleting.");

    // Vérification de la validité de l'ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reject("Invalid Appointment ID.");
    }

    if (!preAppointmentId) return reject("preAppointment ID is required for deleting.");

    // Vérification de la validité de l'ID de l'appointment
    if (!mongoose.Types.ObjectId.isValid(preAppointmentId)) {
      return reject("Invalid preAppointment ID.");
    }

    if (!scheduleId) return reject("schedule ID is required for deleting.");

    // Vérification de la validité de l'ID de l'appointment
    if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
      return reject("Invalid schedule ID.");
    }

    if (!userId) return reject("user ID is required for deleting.");

    // Vérification de la validité de l'ID de l'appointment
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    // Vérification anti-XSS
    if (
      detectXSSDeep(id) ||
      detectXSSDeep(preAppointmentId) ||
      detectXSSDeep(scheduleId) ||
      detectXSSDeep(doctorName) ||
      detectXSSDeep(appointmentDate) ||
      detectXSSDeep(appointmentHour) ||
      detectXSSDeep(userId)
    ) {
      logAttack("Tentative XSS détectée lors de la suppression d'un rendez-vous", req, "xss");
      return reject("Failed to delete appointment.");
    }

    let patientEmail = "";
    let patientName = "";

      // Supprimer le rendez-vous principal
      return AppointmentSchema.findByIdAndDelete(id)
      .then((deletedAppointment) => {
        if (!deletedAppointment) {
          return reject("Appointment not found.");
        }

        // Supprimer le pré-rendez-vous
        return PreAppointmentSchema.findByIdAndDelete(preAppointmentId);
      })
      .then((deletedPreApp) => {
        if (!deletedPreApp) {
          return reject("Pre-appointment not found.");
        }

        patientEmail = deletedPreApp.email;
        patientName = deletedPreApp.name;

        // Charger le planning du médecin
        return SchedulePerDoctorSchema.findById(scheduleId);
      })
      .then((scheduleDoc) => {
        if (!scheduleDoc) {
          return reject("Doctor schedule not found.");
        }

        const schedules = scheduleDoc.schedules || [];
        const formattedDate = new Date(appointmentDate).toISOString().split("T")[0]; // YYYY-MM-DD
        const targetDay = schedules.find((day) => day.date === formattedDate);

        if (!targetDay) {
          return reject("No schedule found for the specified date.");
        }

        // Déplacer le créneau horaire de reserved vers available
        const reservedIndex = targetDay.reserved.indexOf(appointmentHour);
        if (reservedIndex !== -1) {
          targetDay.reserved.splice(reservedIndex, 1);
          if (!targetDay.available.includes(appointmentHour)) {
            targetDay.available.push(appointmentHour);
          }
        }

        // Mise à jour du planning
        return SchedulePerDoctorSchema.updateOne(
          { _id: scheduleId },
          { $set: { schedules: schedules } }
        );
      })
      .then(() => {
        // ENVOI DE L'EMAIL ICI
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const mailOptions = {
          from: `"Mommy & Me" <${process.env.EMAIL_USER}>`,
          to: patientEmail,
          subject: "❌ Appointment Cancelled",
          html: `
            <p>Hello <strong>${patientName}</strong>,</p>
            <p>We regret to inform you that your appointment with Dr. <strong>${doctorName}</strong> on <strong>${new Date(appointmentDate).toDateString()}</strong> at <strong>${appointmentHour}</strong> has been <span style="color:red;">cancelled</span>.</p>
            <p>If you have any questions, please contact us.</p>
            <p>Thank you for your understanding.</p>
          `,
        };

        return transporter.sendMail(mailOptions);
      })
      .then(() => {
        resolve("Appointment successfully deleted and email sent.");
      })
      .catch((err) => {
        reject("Failed to delete appointment.");
      });
  });
};


/******************** Completed Appoitment ***********/

exports.CompletedAppointmentById = ({ appointmentId, req }) => {
  return new Promise((resolve, reject) => {
    if (!appointmentId) return reject("Missing appointment ID.");
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) return reject("Invalid appointment ID.");

    if (detectXSSDeep(appointmentId)) {
      logAttack("Possible XSS detected in appointment ID", req, "xss");
      return reject("Error updating appointment.");
    }

      AppointmentSchema.findById(appointmentId)
      .then(appointment => {
        if (!appointment) return reject("Appointment not found.");
        appointment.status = "Completed";
        return appointment.save();
      })
      .then(savedAppointment => {
        return PreAppointmentSchema.findById(savedAppointment.preAppointmentId)
          .then(preApp => {
            if (!preApp) return reject("PreAppointment not found.");

            // Setup email
            const transporter = nodemailer.createTransport({
              service: "gmail",
              auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
              },
            });

            const mailOptions = {
              from: `"Mommy & Me" <${process.env.EMAIL_USER}>`,
              to: preApp.email,
              subject: "🎯 Appointment Completed",
              html: `
                <p>Hello <strong>${preApp.name}</strong>,</p>
                <p>Your appointment with Dr. <strong>${savedAppointment.doctorName}</strong> on <strong>${savedAppointment.appointmentDate.toDateString()}</strong> at <strong>${savedAppointment.appointmentHour}</strong> has been marked as <span style="color:blue;">completed</span>.</p>
                <p>We hope your experience was great. Thank you for trusting our clinic!</p>
              `,
            };

            return transporter.sendMail(mailOptions)
              .then(() => savedAppointment);
          });
      })
      .then(() => {
        resolve("Appointment marked as completed and email sent.");
      })
      .catch(err => {
        reject("Error completing appointment and sending email.");
      });
  });
};

/******************** Archive Appoitment ***********/

exports.ArchiveAppointmentById = ({ id, preAppointmentId, scheduleId, doctorName, appointmentDate, appointmentHour, userId, req }) => {
  return new Promise((resolve, reject) => {
    // Vérification des données
    if (!doctorName || !appointmentDate || !appointmentHour) {
      return reject("Missing required data.");
    }

    if (!id) return reject("appointment ID is required for archiving.");

    // Vérification de la validité de l'ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reject("Invalid Appointment ID.");
    }

    if (!preAppointmentId) return reject("preAppointment ID is required for archiving.");

    // Vérification de la validité de l'ID de l'appointment
    if (!mongoose.Types.ObjectId.isValid(preAppointmentId)) {
      return reject("Invalid preAppointment ID.");
    }

     if (!scheduleId) return reject("schedule ID is required for archiving.");

    // Vérification de la validité de l'ID de l'appointment
    if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
      return reject("Invalid schedule ID.");
    }

    if (!userId) return reject("user ID is required for archiving.");

    // Vérification de la validité de l'ID de l'appointment
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    // Vérification anti-XSS
    if (
      detectXSSDeep(id) ||
      detectXSSDeep(preAppointmentId) ||
      detectXSSDeep(scheduleId) ||
      detectXSSDeep(doctorName) ||
      detectXSSDeep(appointmentDate) ||
      detectXSSDeep(appointmentHour) ||
      detectXSSDeep(userId)
    ) {
      logAttack("Tentative XSS détectée lors de la suppression d'un rendez-vous", req, "xss");
      return reject("Failed to archive appointment.");
    }

      AppointmentSchema.findById(id)
      .then(appointment => {
        if (!appointment) return Promise.reject("Appointment not found.");

        // Marquer le rendez-vous comme archivé
        appointment.archived = true;

        return appointment.save()
          .then(() => {
            // Rechercher le calendrier du médecin
            return SchedulePerDoctorSchema.findById(scheduleId);
          })
          .then(schedule => {
            if (!schedule) return Promise.reject("Doctor schedule not found.");

            // Extraire la date au bon format (YYYY-MM-DD)
            const targetDate = new Date(appointmentDate).toISOString().split("T")[0];

            const day = schedule.schedules.find(d => d.date === targetDate);
            if (!day) return Promise.reject("Date not found in doctor's schedule.");

            // Supprimer le créneau réservé
            day.reserved = day.reserved.filter(h => h !== appointmentHour);

            // Optionnel : remettre l'heure dans les créneaux disponibles
            if (!day.available.includes(appointmentHour)) {
              day.available.push(appointmentHour);
            }

            return schedule.save();
          });
      })
      .then(() => {
        resolve("Appointment archived and slot removed from calendar.");
      })
      .catch(err => {
        reject("Error archiving appointment.");
      });
  });
};



/******************** follow-up Appoitment ***********/


exports.getUserAndDoctorSchedulesModel = ({ userId, appointmentId, req }) => {
  return new Promise((resolve, reject) => {
    // --- Vérifications préalables ---
    if (!userId || !appointmentId){
       return reject("Missing user ID or appointment ID.");
    }

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(appointmentId)
    ) return reject("Invalid user or appointment ID.");

    if (detectXSSDeep(userId) || detectXSSDeep(appointmentId)) {
      logAttack("Tentative XSS détectée dans Book Appointment follow-up", req, "xss");
      return reject("Invalid input.");
    }

      AppointmentSchema.findById(appointmentId)
      .then((appointment) => {
        if (!appointment) {
          return reject("Appointment not found.");
        }

        const preappointmentId = appointment.preAppointmentId;

        SchedulePerDoctorSchema.find({})
          .then((allSchedules) => {
            const doctorSchedules = {};

            allSchedules.forEach((schedule) => {
              const doctorName = schedule.doctorName;
              const scheduleId = schedule._id.toString();

              doctorSchedules[doctorName] = {
                _id: scheduleId,
                schedules: {},
              };

              schedule.schedules.forEach((day) => {
                doctorSchedules[doctorName].schedules[day.date] = {
                  available: day.available,
                  reserved: day.reserved,
                };
              });
            });

            resolve({ doctorSchedules, preappointmentId });
          })
          .catch((err) => {
            return reject("Failed to get doctor schedules.");
          });
      })
      .catch((err) => {
        reject("Failed to retrieve appointment.");
      });
  });
};


exports.BookAppointmentFollowUpModel = ({doctorSchedule,doctor,date,time,preappointmentId,userId,appointmentType,appointmentMode,scheduleId,req}) => {
  return new Promise((resolve, reject) => {
    // 1. Validations
    if (!doctor || !date || !time || !preappointmentId || !userId || !scheduleId) {
      return reject("Missing or invalid appointment data.");
    }

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(preappointmentId) ||
      !mongoose.Types.ObjectId.isValid(scheduleId)
    ) {
      return reject("Invalid ObjectId detected.");
    }

    if (!appointmentType) {
      return reject("Appointment type must be specified.");
    }

    if (appointmentType === "feeding" && !appointmentMode) {
      return reject("Feeding mode must be specified.");
    }

    if (
      detectXSSDeep(doctor) || detectXSSDeep(date) || detectXSSDeep(time) ||
      detectXSSDeep(preappointmentId) || detectXSSDeep(userId) ||
      detectXSSDeep(scheduleId) || detectXSSDeep(appointmentType) ||
      detectXSSDeep(appointmentMode) || detectXSSDeep(doctorSchedule)
    ) {
      logAttack("Tentative XSS détectée dans le formulaire de rendez-vous", req, "xss");
      return reject("Failed to book new appointment.");
    }

    // 2. Début du traitement
    let oldDate = null;
    let oldTime = null;
    let scheduleDocGlobal;

      // 3. Vérifier le pré-rendez-vous
      return PreAppointmentSchema.findById(preappointmentId)
      .then((preApp) => {
        if (!preApp) {
          return reject("Pre-appointment not found.");
        } 
        return SchedulePerDoctorSchema.findById(scheduleId);
      })
      .then((scheduleDoc) => {
        if (!scheduleDoc) {
          return reject("Doctor's schedule not found.");
        } 
        scheduleDocGlobal = scheduleDoc;

        // 4. Chercher un ancien rendez-vous (pour libérer l'ancien créneau)
        return AppointmentSchema.findOne({ preAppointmentId: preappointmentId });
      })
      .then((existingAppointment) => {
        if (existingAppointment) {
          oldDate = existingAppointment.appointmentDate.toISOString().split("T")[0];
          oldTime = existingAppointment.appointmentHour;
        }

        // 5. Mettre à jour le planning
        scheduleDocGlobal.schedules = scheduleDocGlobal.schedules.map((day) => {
          //Libérer ancien créneau
          if (oldDate && day.date === oldDate) {
            day.reserved = day.reserved.filter((slot) => slot !== oldTime);
            if (!day.available.includes(oldTime)) {
              day.available.push(oldTime);
            }
          }

          //Réserver nouveau créneau
          if (day.date === date) {
            day.available = day.available.filter((slot) => slot !== time);
            if (!day.reserved.includes(time)) {
              day.reserved.push(time);
            }
          }

          return day;
        });

        return scheduleDocGlobal.save();
      })
      .then(() => {
        // 6. Créer ou mettre à jour le rendez-vous
        return AppointmentSchema.findOneAndUpdate(
          { preAppointmentId: preappointmentId },
          {
            preappointmentId ,
            scheduleId,
            doctorName: doctor,
            appointmentDate: date,
            appointmentHour: time,
            status: "In follow-up", // ici on fixe le statut à "In follow-up"
            appointmentType,
            appointmentMode,
            isReviewed: false,
            archived: false,
          },
          { upsert: true, new: true }
        );
      })
      .then((result) => {
        savedAppointment = result;
        return PreAppointmentSchema.findById(preappointmentId);
      })
      .then((preApp) => {
        if (!preApp) return reject("PreAppointment not found.");

        // Setup email
        const transporter = require("nodemailer").createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const mailOptions = {
          from: `"Mommy & Me" <${process.env.EMAIL_USER}>`,
          to: preApp.email,
          subject: "🗓️ Appointment Confirmed - In Follow-Up",
          html: `
            <p>Hello <strong>${preApp.name}</strong>,</p>
            <p>We are pleased to inform you that your appointment has been successfully booked and is now <strong>marked as "In follow-up"</strong>.</p>
            
            <h4>Appointment Details:</h4>
            <ul>
              <li><strong>Doctor:</strong> Dr. ${savedAppointment.doctorName}</li>
              <li><strong>Date:</strong> ${new Date(savedAppointment.appointmentDate).toLocaleDateString()}</li>
              <li><strong>Time:</strong> ${savedAppointment.appointmentHour}</li>
              <li><strong>Type:</strong> ${savedAppointment.appointmentType}</li>
              ${
                savedAppointment.appointmentMode
                  ? `<li><strong>Mode:</strong> ${savedAppointment.appointmentMode}</li>`
                  : ""
              }
            </ul>

            <p>Thank you for choosing our clinic.</p>
            <p>— Mommy & Me Clinic</p>
          `,
        };


        return transporter.sendMail(mailOptions);
      })
      .then(() => {
        // 7. Mettre à jour le pré-rendez-vous
        return PreAppointmentSchema.updateOne(
          { _id: preappointmentId },
          { $set: { isCompleted: false } }
        );
      })
      .then(() => {
        // 8. Déconnexion propre
        resolve("Appointment successfully booked. Thank you.");
      })
      .catch((err) => {
       reject("Failed to book appointment.");
      });
  });
};





/*-------------------------------------- My Appoitmetns --------------------------------*/


/*-------------------------------------- My Time Slots ---------------------------------*/

/*********************** Add Time sLots + Details calendrer + My Time sLot  ***************/

exports.getAllTimeSlots = (userId,req) => {
  return new Promise((resolve, reject) => {
    if (!userId) return reject("Missing user ID.");

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    // Détection XSS
    if (detectXSSDeep(userId)) {
      logAttack(
        "Tentative XSS détectée dans la page des crénaux",
        req,
        "xss"
      );
      return reject("Error retrieving time slots.");
    }

      // On commence par récupérer le nom du docteur via VisiteurSchema
      return VisiteurSchema.findById(userId)
      .then((user) => {
        if (!user) {
          return reject("Doctor not found.");
        }

        const doctorName = user.full_name;

        // Ensuite on cherche ses créneaux
        return DoctorShema.findOne({ userId }).then((doc) => {

          if (!doc) {
            // Aucun document = première fois
            return resolve({
              doctorName,
              schedules: [],
            });
          }

          resolve({
            doctorName,
            schedules: doc.schedules || [],
          });
        });
      })
      .catch((err) => {
        return reject("An error occurred while retrieving time slots.");
      });
  });
};

  
/*********************** Add Time sLots + My Time sLot   ***************/

exports.TimeSlotModel = ({ userId, doctorSchedules, req }) => {
  return new Promise((resolve, reject) => {
    //Vérification basique
    if (!doctorSchedules || typeof doctorSchedules !== "object" || !userId) {
      return reject("Invalid input format.");
    }

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    //Vérifie si doctorSchedules ou userId contiennent du XSS
    if (detectXSSDeep(userId) || detectXSSDeep(doctorSchedules)) {
      logAttack(
        "Tentative XSS détectée dans le formulaire de création de calendrier",
        req,
        "xss"
      );
      return reject("Failed to save time slots.");
    }

      return VisiteurSchema.findById(userId)
      .then((user) => {
        if (!user) {
          return reject("User not found.");
        }

        const doctorName = user.full_name;

        //Ajout d’une protection XSS sur le nom aussi
        if (detectXSSDeep(doctorName)) {
          logAttack("Tentative XSS détectée dans le formulaire de création de calendrier",req,"xss");
          return reject("Failed to save time slots.");
        }

        const schedules = Object.entries(doctorSchedules[doctorName] || {}).map(
          ([date, { available, reserved }]) => ({
            date,
            available: available || [],
            reserved: reserved || [],
          })
        );

        return DoctorShema.findOneAndUpdate(
          { userId },
          {
            $set: {
              doctorName,
              schedules,
            },
          },
          { upsert: true, new: true }
        );
      })
      .then(() => {
        resolve("Doctor time slots saved successfully.");
      })
      .catch((err) => {
        return reject("Failed to save time slots.");
      });
  });
};



/*-------------------------------------- My Time Slots ---------------------------------*/







/*-------------------------------------- My Blogs --------------------------------------*/


/*********************** Add Blog ***************/

exports.AddBlogModel = ({title, author, category, content, image, userId, req}) => {
  return new Promise((resolve, reject) => {
    // Vérification des champs requis
    if (!title || !author || !category || !content || !image) {
      return reject("Please fill in all the fields.");
    }

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    // Vérifie si la catégorie est valide
    const validCategories = [
      "general",
      "nutrition",
      "mental-health",
      "pediatrics",
      "feeding",
      "parenting-advice",
      "others",
    ];
    if (!validCategories.includes(category)) {
      return reject("Invalid blog category.");
    }

    // Vérification du type de fichier
    const allowedExtensions = [".jpg", ".jpeg", ".png"];
    const fileExtension = path.extname(image.originalname).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      logAttack(
        "Tentative XSS via image upload dans l'ajout de blog",
        req,
        "xss"
      );
      return reject("Invalid image type. Only JPG, JPEG, and PNG are allowed.");
    }

    // Vérification de la taille de l'image (maximum 2 Mo)
    const maxSize = 2 * 1024 * 1024; // 2 Mo en octets
    if (image.size > maxSize) {
      return reject("Image is too large. Maximum size allowed is 2MB.");
    }

    // Détection XSS
    if (
      detectXSSDeep(title) ||
      detectXSSDeep(author) ||
      detectXSSDeep(category) ||
      detectXSSDeep(content) ||
      detectXSSDeep(image) ||
      detectXSSDeep(userId)
    ) {
      logAttack("Tentative XSS dans le contenu du blog", req, "xss");
      return reject("Failed to publish the blog. Please try again.");
    }

    // Assainissement
    const sanitizedTitle = cleanText(title);
    const sanitizedAuthor = cleanText(author);
    const sanitizedCategory = cleanText(category);
    const sanitizedContent = cleanText(content);
    const sanitizedImage = cleanText(image?.filename || "");

        const newBlog = new BlogSchema({
          userId,
          title: sanitizedTitle,
          author: sanitizedAuthor,
          category: sanitizedCategory,
          content: sanitizedContent,
          image: sanitizedImage,
          status: "Pending", //par défaut "Pending"
        });

      return newBlog.save()
      .then(() => {
        resolve(
          "Thank you! Your blog has been submitted and will be reviewed by our team before publication."
        );
      })
      .catch((err) => {
        return reject("Failed to publish the blog. Please try again.");
      });
  });
};



/*********************** My Blogs ***************/


exports.getMyBlogsModel = (userId, startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    if (!userId) return reject("Missing user ID.");

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    // Détection XSS
    if (detectXSSDeep(userId)) {
      logAttack(
        "Tentative XSS détectée dans la page de My Blogs",
        req,
        "xss"
      );
      return reject("An error occurred while retrieving blogs.");
    }

    // Détection et assainissement des entrées de startDate et endDate
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le formulaire de filtrage par date", req, "xss");
      return reject("An error occurred while retrieving");
    }
    
    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le formulaire de filtrage par date", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }


      // On récupère d'abord le nom de l'utilisateur (docteur)
      return VisiteurSchema.findById(userId)
      .then((user) => {
        if (!user) {
          return reject("Doctor not found.");
        }

        const doctorName = user.full_name;

        //Ajout d’une protection XSS sur le nom aussi
        if (detectXSSDeep(doctorName)) {
          logAttack(
            "Tentative XSS détectée dans le formulaire de création de calendrier",
            req,
            "xss"
          );
          return reject("An error occurred while retrieving blogs.");
        }

        let query = { userId: userId };


        // Assainissement des dates
        const sanitizedStartDate = startDate ? validator.escape(startDate) : '';
        const sanitizedEndDate = endDate ? validator.escape(endDate) : '';

        // Si startDate et endDate sont définis, filtrer les blogs par date
        if (sanitizedStartDate && sanitizedEndDate) {
          query.createdAt = {
            $gte: new Date(sanitizedStartDate),
            $lte: new Date(sanitizedEndDate),
          };
        }

        // Récupérer les 100 blogs les plus récents dans la plage de dates spécifiée ou en général
        return BlogSchema.find(query).sort({ createdAt: -1 }).limit(100)  // Limite de 100 blogs
          .then((blogs) => {
            resolve({
              doctorName,
              blogs
            });
          });
      })
      .catch((err) => {
        return reject("An error occurred while retrieving blogs.");
      });
  });
};




/*********************** delete Blog ***************/

exports.DeleteBlogModel = ({ BlogId, userId, req }) => {
  return new Promise((resolve, reject) => {
    if (!BlogId) return reject("Blog ID is required for deletion.");

    if (!mongoose.Types.ObjectId.isValid(BlogId)) {
      return reject("Invalid Blog ID.");
    }

    if (!userId) return reject("Missing user ID.");

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    if (detectXSSDeep(userId) || detectXSSDeep(BlogId)) {
      logAttack(
        "Tentative XSS détectée dans le formulaire de suppression de blog",
        req,
        "xss"
      );
      return reject("Failed to delete the blog. Please try again.");
    }

    let blog;

      return BlogSchema.findById(BlogId)
      .then((foundBlog) => {
        if (!foundBlog) return reject("Blog not found.");

        if (foundBlog.userId.toString() !== userId.toString()) {
          return reject("You are not authorized to delete this blog.");
        }

        blog = foundBlog;

        // Supprimer le blog
        return BlogSchema.deleteOne({ _id: BlogId });
      })
      .then(() => {
        // Supprimer l'image si elle existe
        if (blog.image) {
          const imagePath = path.join(
            __dirname,
            "..",
            "assets",
            "uploads",
            blog.image
          );
          fs.unlink(imagePath, (err) => {}); //permet de supprimer l'image
        }

        // Supprimer les commentaires uniquement si le blog était approuvé
        if (blog.status === "Approved") {
          return BlogInteraction.deleteOne({ blogId: blog._id });
        }

        return;
      })
      .then(() => {
        resolve("Blog has been successfully deleted.");
      })
      .catch((err) => {
        reject("Failed to delete the blog. Please try again.");
      });
  });
};




/*********************** update Blog ***************/


exports.getBlogByIdModel = (blogId, userId, req) => {
  return new Promise((resolve, reject) => {
    if (!blogId) return reject("Blog ID is required for updating.");
    

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return reject("Invalid Blog ID.");
    }


    if (!userId) return reject("Missing user ID.");

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    if (detectXSSDeep(blogId) || detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans la récupération du blog pour update", req, "xss");
      return reject("An error occurred while retrieving the blog.");
    }

    const sanitizedBlogId = blogId;

      return BlogSchema.findOne({ _id: sanitizedBlogId, userId: userId })
      .then((blog) => {
        if (!blog) {
          return reject("Blog not found or unauthorized.");
        }

        return VisiteurSchema.findById(userId).then((user) => {

          if (!user) return reject("Doctor not found.");
          if (detectXSSDeep(user.full_name)) {
            logAttack("XSS détecté dans le nom de l'utilisateur", req, "xss");
            return reject("An error occurred while retrieving the blog.");
          }

          resolve({
            blog,
            doctorName: user.full_name
          });
        });
      })
      .catch((err) => {
        reject("An error occurred while retrieving the blog.");
      });
  });
};



exports.UpdateBlogModel = ({ blogId, title, author, category, content, image, userId, req }) => {
  return new Promise((resolve, reject) => {
    if (!title || !author || !category || !content) {
      return reject("Please fill in all the fields.");
    }

    if (!blogId) return reject("Blog ID is required for updating.");

    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return reject("Invalid Blog ID.");
    }

    if (!userId) return reject("Missing user ID.");

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    const validCategories = ["general", "nutrition", "mental-health", "pediatrics","feeding","parenting-advice","others"];
    if (!validCategories.includes(category)) {
      return reject("Invalid blog category.");
    }

    if (image) {
      const allowedExtensions = [".jpg", ".jpeg", ".png"];
      const fileExtension = path.extname(image.originalname).toLowerCase();
      if (!allowedExtensions.includes(fileExtension)) {
        logAttack(
          "Tentative XSS via image upload dans la mise à jour du blog",
          req,
          "xss"
        );
        return reject("Invalid image type. Only JPG, JPEG, and PNG are allowed.");
      }
    }

    const maxSize = 2 * 1024 * 1024;
    if ((image) && image.size > maxSize) {
      return reject("Image is too large. Maximum size allowed is 2MB.");
    }

    if (
      detectXSSDeep(title) ||
      detectXSSDeep(author) ||
      detectXSSDeep(category) ||
      detectXSSDeep(content) ||
      detectXSSDeep(image) ||
      detectXSSDeep(blogId) ||
      detectXSSDeep(userId)
    ) {
      logAttack("Tentative XSS dans le contenu du blog (update)", req, "xss");
      return reject("Failed to update the blog. Please try again.");
    }

    const sanitizedTitle = cleanText(title);
    const sanitizedAuthor = cleanText(author);
    const sanitizedCategory = cleanText(category);
    const sanitizedContent = cleanText(content);
    const sanitizedImage = image ? cleanText(image.filename || "") : null;


    let oldImagePath = null;

      return BlogSchema.findOne({ _id: blogId, userId: userId })
      .then((existingBlog) => {
        if (!existingBlog) {
          return reject("Blog not found or unauthorized.");
        }

        if (sanitizedImage && existingBlog.image) {
          oldImagePath = path.join(__dirname, "..", "assets", "uploads", existingBlog.image);
        }

        const updateFields = {
          title: sanitizedTitle,
          author: sanitizedAuthor,
          category: sanitizedCategory,
          content: sanitizedContent,
          status: "Pending",// chaque update passe par validation
        };

        if (sanitizedImage) {
          updateFields.image = sanitizedImage;
        }

        return BlogSchema.findOneAndUpdate(
          { _id: blogId, userId: userId },
          updateFields,
          { new: true }
        );
      })
      .then((updatedBlog) => {

        if (!updatedBlog) {
          return reject("Blog not found or unauthorized.");
        }

        // Suppression de l’ancienne image si nécessaire
        if (oldImagePath) {
          fs.unlink(oldImagePath, (err) => {});
        }

        resolve("Your blog has been updated successfully and will be reviewed before publication.");
      })
      .catch((err) => {
        return reject("Failed to update the blog. Please try again.");
      });
  });
};



/************ General Blogs *****************/


exports.getGeneralBlogsModel = (userId,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    if (!userId) return reject("Missing user ID.");

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    // Détection XSS
    if (detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans la page general Blogs",req,"xss");
      return reject("Error retrieving user or schedules.");
    }
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (blogs general)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (blogs general)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }

    // Nettoyage avec cleanText (aucune balise ni attribut autorisé)
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";

     let query = {
      category: "general", // Toujours filtrer par catégorie 'general'
      status: "Approved",  // Facultatif mais recommandé pour ne pas renvoyer les blogs en attente ou rejetés
    };

    if (sanitizedStartDate && sanitizedEndDate) {
      query.createdAt = {
        $gte: new Date(sanitizedStartDate),
        $lte: new Date(sanitizedEndDate),
      };
    }


      return BlogSchema.find(query).sort({ createdAt: -1 }).limit(100)
      .then((blogs) => {
        resolve(blogs);
      })
      .catch((err) => {
        reject("An error occurred while retrieving blogs.");
      });
  });
};


/*************** Nutrition Blogs ****************/


exports.getNutritionBlogsModel = (userId,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    if (!userId) return reject("Missing user ID.");

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    // Détection XSS
    if (detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans la page Nutrition Blogs",req,"xss");
      return reject("Error retrieving user or schedules.");
    }
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (blogs nutrition)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (blogs nutrition)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }

    // Nettoyage avec cleanText (aucune balise ni attribut autorisé)
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";

     let query = {
      category: "nutrition", // Toujours filtrer par catégorie 'nutrition'
      status: "Approved",  // Facultatif mais recommandé pour ne pas renvoyer les blogs en attente ou rejetés
    };

    if (sanitizedStartDate && sanitizedEndDate) {
      query.createdAt = {
        $gte: new Date(sanitizedStartDate),
        $lte: new Date(sanitizedEndDate),
      };
    }

      return BlogSchema.find(query).sort({ createdAt: -1 }).limit(100)
      .then((blogs) => {
        resolve(blogs);
      })
      .catch((err) => {
        reject("An error occurred while retrieving blogs.");
      });
  });
};



/************ Mental-Health Blogs ***************/

exports.getMentalHealthBlogsModel = (userId,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    if (!userId) return reject("Missing user ID.");

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    // Détection XSS
    if (detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans la page mental-health Blogs",req,"xss");
      return reject("Error retrieving user or schedules.");
    }
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (blogs Mental-Health)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (blogs Mental-Health)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }

    // Nettoyage avec cleanText (aucune balise ni attribut autorisé)
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";


     let query = {
      category: "mental-health", // Toujours filtrer par catégorie 'Mental-Health'
      status: "Approved",  // Facultatif mais recommandé pour ne pas renvoyer les blogs en attente ou rejetés
    };

    if (sanitizedStartDate && sanitizedEndDate) {
      query.createdAt = {
        $gte: new Date(sanitizedStartDate),
        $lte: new Date(sanitizedEndDate),
      };
    }

      return BlogSchema.find(query).sort({ createdAt: -1 }).limit(100)
      .then((blogs) => {
        resolve(blogs);
      })
      .catch((err) => {
        reject("An error occurred while retrieving blogs.");
      });
  });
};


/************ Pediatrics Blogs *****************/


exports.getPediatricsBlogsModel = (userId,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    if (!userId) return reject("Missing user ID.");

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    // Détection XSS
    if (detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans la page Pediatrics Blogs",req,"xss");
      return reject("Error retrieving user or schedules.");
    }
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (blogs Pediatrics)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (blogs Pediatrics)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }

    // Nettoyage avec cleanText (aucune balise ni attribut autorisé)
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";


     let query = {
      category: "pediatrics", // Toujours filtrer par catégorie 'Pediatrics'
      status: "Approved",  // Facultatif mais recommandé pour ne pas renvoyer les blogs en attente ou rejetés
    };

    if (sanitizedStartDate && sanitizedEndDate) {
      query.createdAt = {
        $gte: new Date(sanitizedStartDate),
        $lte: new Date(sanitizedEndDate),
      };
    }

      return BlogSchema.find(query).sort({ createdAt: -1 }).limit(100)
      .then((blogs) => {
        resolve(blogs);
      })
      .catch((err) => {
        reject("An error occurred while retrieving blogs.");
      });
  });
};


/********** Breastfeeding Blogs ****************/


exports.getBreastfeedingBlogsModel = (userId,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    if (!userId) return reject("Missing user ID.");

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    // Détection XSS
    if (detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans la page Breastfeeding Blogs",req,"xss");
      return reject("Error retrieving user or schedules.");
    }
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (blogs feeding)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (blogs feeding)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }


    // Nettoyage avec cleanText (aucune balise ni attribut autorisé)
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";

     let query = {
      category: "feeding", // Toujours filtrer par catégorie 'feeding'
      status: "Approved",  // Facultatif mais recommandé pour ne pas renvoyer les blogs en attente ou rejetés
    };

    if (sanitizedStartDate && sanitizedEndDate) {
      query.createdAt = {
        $gte: new Date(sanitizedStartDate),
        $lte: new Date(sanitizedEndDate),
      };
    }

      return BlogSchema.find(query).sort({ createdAt: -1 }).limit(100)
      .then((blogs) => {
        resolve(blogs);
      })
      .catch((err) => {
        reject("An error occurred while retrieving blogs.");
      });
  });
};



/************ Parenting-advice Blogs ************/

exports.getParentingAdviceBlogsModel = (userId,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    if (!userId) return reject("Missing user ID.");

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    // Détection XSS
    if (detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans la page Parenting-advice Blogs",req,"xss");
      return reject("Error retrieving user or schedules.");
    }
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (blogs Parenting-advice)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (blogs Parenting-advice)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }

    // Nettoyage avec cleanText (aucune balise ni attribut autorisé)
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";

     let query = {
      category: "parenting-advice", // Toujours filtrer par catégorie 'Parenting-advice'
      status: "Approved",  // Facultatif mais recommandé pour ne pas renvoyer les blogs en attente ou rejetés
    };

    if (sanitizedStartDate && sanitizedEndDate) {
      query.createdAt = {
        $gte: new Date(sanitizedStartDate),
        $lte: new Date(sanitizedEndDate),
      };
    }

      return BlogSchema.find(query).sort({ createdAt: -1 }).limit(100)
      .then((blogs) => {
        resolve(blogs);
      })
      .catch((err) => {
        reject("An error occurred while retrieving blogs.");
      });
  });
};


/***************** Others Blogs ****************/


exports.getOthersBlogsModel = (userId,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    if (!userId) return reject("Missing user ID.");

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    // Détection XSS
    if (detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans la page Others Blogs",req,"xss");
      return reject("Error retrieving user or schedules.");
    }
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (blogs Others)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (blogs Others)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }

    // Nettoyage avec cleanText (aucune balise ni attribut autorisé)
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";


     let query = {
      category: "others", // Toujours filtrer par catégorie 'Others'
      status: "Approved",  // Facultatif mais recommandé pour ne pas renvoyer les blogs en attente ou rejetés
    };

    if (sanitizedStartDate && sanitizedEndDate) {
      query.createdAt = {
        $gte: new Date(sanitizedStartDate),
        $lte: new Date(sanitizedEndDate),
      };
    }

      return BlogSchema.find(query).sort({ createdAt: -1 }).limit(100)
      .then((blogs) => {
        resolve(blogs);
      })
      .catch((err) => {
        reject("An error occurred while retrieving blogs.");
      });
  });
};


/******************* details Blog **********************/

exports.getBlogByblogIDModel = (userId,blogID, req) => {
  return new Promise((resolve, reject) => {
    if (!userId) return reject("Missing user ID.");

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    // Détection XSS
    if (detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans userID",req,"xss");
      return reject("An error occurred while retrieving the blog.");
    }


    // Validation de l'ID
    if (!blogID) return reject("Blog ID is required.");

    if (!mongoose.Types.ObjectId.isValid(blogID)) {
      return reject("Invalid Blog ID.");
    }

    if (detectXSSDeep(blogID)) {
      logAttack("Tentative de XSS détectée dans blogID", req, "xss");
      return reject("An error occurred while retrieving the blog.");
    }

    const sanitizedBlogID = blogID;

      // Récupération du blog et des commentaires uniquement
      return Promise.all([
          BlogSchema.findById(sanitizedBlogID),
          BlogInteraction.findOne({ blogId: sanitizedBlogID })
            .populate("comments.user") // pour l’auteur (document complet) du commentaire
            .populate("comments.replies.user"), // pour l’auteur (document complet) du sous-commentaire
      ])
      .then(([blog, interaction]) => {

        if (!blog) {
          return reject("Blog not found.");
        }

        // Récupérer uniquement les commentaires
        const comments = interaction?.comments || [];

        resolve({blog,comments});
      })
      .catch((err) => {
        reject("An error occurred while retrieving the blog.");
      });
  });
};


/******************* ajouter commentaire *****************/

exports.addCommentModel = ({ blogId, commentText, userId, req }) => {
  return new Promise((resolve, reject) => {
    // Basic validation
    if (!blogId || !mongoose.Types.ObjectId.isValid(blogId)) {
      return reject("Invalid blog ID.");
    }

    // Basic validation
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    if (
      !commentText ||
      typeof commentText !== "string" ||
      commentText.trim() === ""
    ) {
      return reject("Comment cannot be empty.");
    }

    // XSS detection
    if (
      detectXSSDeep(blogId) ||
      detectXSSDeep(commentText) ||
      detectXSSDeep(userId)
    ) {
      logAttack(
        "Tentative d'attaque XSS détectée dans un commentaire de blog",
        req,
        "xss"
      );
      return reject("An error occurred while validating the comment.");
    }

    // Sanitization

    const sanitizedComment = cleanText(commentText.trim());

        // Add the comment
      return BlogInteraction.findOneAndUpdate(
          { blogId },
          {
            $push: {
              comments: {
                user: userId,
                text: sanitizedComment,
                createdAt: new Date(),
              },
            },
          },
          { upsert: true, new: true }
      )
      .then((updatedDoc) => {
        resolve("Comment successfully added.");
      })
      .catch((err) => {
        reject("Failed to add comment. Please try again.");
      });
  });
};


/************** ajouter sous commentaire *************/

exports.PostReplyCommentModel = ({userId, blogId, commentId, replyText, req }) => {
  return new Promise((resolve, reject) => {

    // --- 1. Validation des données ---
    if (!blogId || !mongoose.Types.ObjectId.isValid(blogId)) {
      return reject("Invalid blog ID.");
    }

    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      return reject("Invalid comment ID.");
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    if (!replyText || typeof replyText !== "string" || replyText.trim() === "") {
      return reject("Reply cannot be empty.");
    }

    // --- 2. Protection contre XSS ---
    if (detectXSSDeep(blogId) || detectXSSDeep(commentId) || detectXSSDeep(replyText) || detectXSSDeep(userId)) {
      logAttack("Tentative d'attaque XSS détectée dans une réponse", req, "xss");
      return reject("An error occurred while validating the reply.");
    }

    // --- 3. Nettoyage des entrées ---
    const sanitizedReply = cleanText(replyText.trim());

    // --- 4. ajout de la réponse ---
      return BlogInteraction.findOneAndUpdate(
          { blogId, "comments._id": commentId },
          {
            $push: {
              "comments.$.replies": {
                user: userId,
                text: sanitizedReply,
                createdAt: new Date(),
              }
            }
          },
          { new: true }
      )
      .then((updatedDoc) => {

        if (!updatedDoc) {
          return reject("Comment not found or blog does not exist.");
        }

        resolve("Reply successfully added.");
      })
      .catch((err) => {
        reject("Failed to add reply. Please try again.");
      });
  });
};


/************ supprimer un commentaire **********/

exports.deleteCommentModel = ({userId, blogId, commentId, req }) => {
  return new Promise((resolve, reject) => {

    // Validation des IDs
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    if (!blogId || !mongoose.Types.ObjectId.isValid(blogId)) {
      return reject("Invalid blog ID.");
    }
    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      return reject("Invalid comment ID.");
    }

    // Protection contre XSS (au cas où tu utilises la variable)
    if (detectXSSDeep(blogId) || detectXSSDeep(commentId) || detectXSSDeep(userId)) {
      logAttack("Tentative d'attaque XSS détectée dans suppression commentaire", req, "xss");
      return reject("An error occurred while validating the data.");
    }

      // Mise à jour : suppression du commentaire dans le tableau comments
      return BlogInteraction.findOneAndUpdate(
          { blogId },
          { $pull: { comments: { _id: commentId } } },
          { new: true }
      )
      .then((updatedDoc) => {
        if (!updatedDoc) {
          return reject("Blog or comment not found.");
        }
        resolve("Comment successfully deleted.");
      })
      .catch(err => {
        reject("Failed to delete comment. Please try again.");
      });
  });
};


/*************** supprimer une réponse **********/

exports.deleteReplyModel = ({ userId, blogId, commentId, replyId, req }) => {
  return new Promise((resolve, reject) => {
    // Validations des IDs
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(blogId) ||
        !mongoose.Types.ObjectId.isValid(commentId) || !mongoose.Types.ObjectId.isValid(replyId)) {
      return reject("Invalid ID(s).");
    }

    // Sécurité contre XSS
    if (detectXSSDeep(blogId) || detectXSSDeep(commentId) || detectXSSDeep(replyId) || detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans suppression réponse", req, "xss");
      return reject("Invalid data.");
    }

      // Suppression d'une sous-réponse dans le tableau replies
      return BlogInteraction.findOneAndUpdate(
          {
            blogId,
            "comments._id": commentId
          },
          {
            $pull: {
              "comments.$.replies": { _id: replyId }
            }
          },
          { new: true }
      )
      .then((updatedDoc) => {
        if (!updatedDoc) {
          return reject("Reply not found or already deleted.");
        }
        resolve("Reply successfully deleted.");
      })
      .catch((err) => {
        reject("Failed to delete reply. Try again.");
      });
  });
};

/*-------------------------------------- My Blogs --------------------------------------*/







/*-------------------------------------- Contact --------------------------------------*/

/*********************** Contact Admin From Doctor ***************/

exports.ContactFormModel = ({ name, email, phone, subject, message, req }) => {
  return new Promise((resolve, reject) => {
    // Vérification de base
    if (!name || !email || !phone || !subject || !message) {
      return reject("All fields are required.");
    }

    if (!validator.isEmail(email)) {
      return reject("Invalid email format.");
    }

    if (!validator.isMobilePhone(phone, "any")) {
      return reject("Invalid phone number.");
    }

    // Détection XSS
    if (
      detectXSSDeep(name) ||
      detectXSSDeep(email) ||
      detectXSSDeep(phone) ||
      detectXSSDeep(subject) ||
      detectXSSDeep(message)
    ) {
      logAttack(
        "Tentative XSS détectée dans le formulaire de contact",
        req,
        "xss"
      );
      return reject("Failed to send your message. Please try again later.");
    }

    // Assainissement
    const sanitizedName = cleanText(name);
    const sanitizedEmail = validator.normalizeEmail(email || ""); //validator pour l’email
    const sanitizedPhone = cleanText(phone);
    const sanitizedSubject = cleanText(subject);
    const sanitizedMessage = cleanText(message);

      const newContact = new ContactSchema({
          name: sanitizedName,
          email: sanitizedEmail,
          phone: sanitizedPhone,
          subject: sanitizedSubject,
          message: sanitizedMessage,
      });
      return newContact.save()
      .then(() => {
        resolve("Your message has been sent successfully.");
      })
      .catch((err) => {
        return reject("Failed to send your message. Please try again later.");
      });
  });
};