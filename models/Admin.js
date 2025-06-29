const fs = require("fs");
const mongoose = require("mongoose");
const DoctorShema = require("../models/Schémas/DoctorSchedule.model");
const BlogSchema = require("../models/Schémas/DoctorBlog.model");
const VisiteurSchema = require("../models/Schémas/User.model");
const BlogInteraction = require("../models/Schémas/Comments.model");
const AppointmentSchema = require("../models/Schémas/Appointment.model");
const PreAppointmentSchema = require("../models/Schémas/preAppointment.model");
const ContactSchema = require("../models/Schémas/Contact.model");
const TestimonialSchema = require("../models/Schémas/testimonial.model");
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

/*-------------------------------------- All Accounts --------------------------------*/


/*********************** Pending Accounts ***************/

// afficher tout les comptes en attente

exports.getPendingAccountsModel = ({ userId, startDate, endDate, req }) => {
  return new Promise((resolve, reject) => {
    // Validation sécurité
    if (!userId) return reject("Missing user ID.");
    if (!mongoose.Types.ObjectId.isValid(userId)) return reject("Invalid user ID.");
    if (detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans la récupération des comptes en attente", req, "xss");
      return reject("An error occurred while retrieving accounts.");
    }

    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS dans startDate (comptes en attente)", req, "xss");
      return reject("An error occurred while retrieving accounts.");
    }
    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS dans endDate (comptes en attente)", req, "xss");
      return reject("An error occurred while retrieving accounts.");
    }

    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";

        let query = { status: "Pending" };

        if (sanitizedStartDate && sanitizedEndDate) {
          query.createdAt = {
            $gte: new Date(sanitizedStartDate),
            $lte: new Date(sanitizedEndDate)
          };
        } else if (sanitizedStartDate) {
          query.createdAt = { $gte: new Date(sanitizedStartDate) };
        } else if (sanitizedEndDate) {
          query.createdAt = { $lte: new Date(sanitizedEndDate) };
        }

        return VisiteurSchema.find(query)
          .sort({ createdAt: -1 })
          .limit(100)
      .then((accounts) => {
        resolve(accounts);
      })
      .catch((err) => {
        reject("Failed to retrieve pending accounts.");
      });
  });
};

// Approuver un compte utilisateur en attente

exports.ApprovePendingAccountModel = ({ AccountID, adminId, req }) => {
  return new Promise((resolve, reject) => {
    if (!AccountID || !adminId) {
      return reject("Missing required data.");
    }

    if (!mongoose.Types.ObjectId.isValid(AccountID) || !mongoose.Types.ObjectId.isValid(adminId)) {
      return reject("Invalid ID(s).");
    }

    if (detectXSSDeep(AccountID) || detectXSSDeep(adminId)) {
      logAttack("Tentative XSS détectée pendant l'approbation d'un compte", req, "xss");
      return reject("Failed to approve account.");
    }

    // Configurer nodemailer ici (à l'intérieur du modèle)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
      VisiteurSchema.findById(AccountID)
      .then(user => {
        if (!user) {
          return reject("User account not found.");
        }

        user.status = "Active";
        return user.save().then(updatedUser => {
          // Envoi de l’email une fois l’utilisateur activé
          const mailOptions = {
            from: `"Mommy & Me" <${process.env.EMAIL_USER}>`,
            to: updatedUser.email,
            subject: "🎉 Your Account Has Been Activated!",
            html: `
              <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px;">
                <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                  <h2 style="color: #2d2d2d;">Hello ${updatedUser.full_name},</h2>
                  <p style="font-size: 16px; color: #444;">
                    🎉 We're excited to let you know that your <strong>Mommy & Me</strong> account has been successfully <strong>activated</strong>!
                  </p>
                  <p style="font-size: 16px; color: #444;">
                    You can now sign in and start using all the features available on our platform.
                  </p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${
                      process.env.LOGIN_URL
                    }" style="background-color: #28a745; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                      Log In to My Account
                    </a>
                  </div>
                  <p style="font-size: 14px; color: #888;">
                    If you have any questions, feel free to contact our support team.
                  </p>
                  <p style="font-size: 14px; color: #888;">
                    Thank you for joining us!<br>
                    – The Mommy & Me Team 👩‍⚕️👨‍👧
                  </p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
                  <p style="font-size: 12px; color: #ccc; text-align: center;">
                    &copy; ${new Date().getFullYear()} Mommy & Me. All rights reserved.
                  </p>
                </div>
              </div>
            `,
          };

          return transporter
            .sendMail(mailOptions)
            .then(() => {
              resolve("User account approved and email sent.");
            })
            .catch((emailErr) => {
              resolve("User approved but failed to send email.");
            });
        });
      })
      .catch(err => {
        reject("Failed to approve account.");
      });
  });
};

// supprimer un compte utilisateur en attente

// Étapes de suppression de données
// 1.Récupération de l'utilisateur
// Récupère l’utilisateur (VisiteurSchema.findById).

// 2.Suppression des contacts ==> (si présent)
// Supprime tous les contacts liés à l’email de l’utilisateur (ContactSchema.deleteMany).

// 3.Suppression des blogs ==> (si présent)
// Supprime les blogs écrits par l'utilisateur.

// Supprime l’image associée à chaque blog s’il y en a.

// Supprime les interactions uniquement pour les blogs approuvés.

// 4.Suppression du planning (si utilisateur est docteur) ==> (si présent)
// Supprime le planning du docteur (DoctorShema.deleteOne).

// Supprime les rendez-vous et pré-rendez-vous associés à ce planning.

// 5.Cas spécifique si utilisateur est un parent 
// Récupère tous ses pré-rendez-vous.

// Supprime les rendez-vous liés à ces pré-rendez-vous. ==> (si présent)

// Supprime les pré-rendez-vous. ==> (si présent)

// Met à jour le planning des docteurs (SchedulePerDoctorSchema) pour libérer les créneaux réservés. ==> (si présent)

// 6.Suppression du diplôme ==> (si présent)
// Supprime le fichier diplôme du système (fs.unlink).

// 7.Suppression finale de l'utilisateur
// Supprime l’entrée du compte dans la collection VisiteurSchema.


exports.DeletePendingAccountModel = ({ AccountID, adminId, req }) => {
  return new Promise((resolve, reject) => {
    if (!AccountID || !adminId) return reject("Missing required data.");

    if (!mongoose.Types.ObjectId.isValid(AccountID) || !mongoose.Types.ObjectId.isValid(adminId)) {
      return reject("Invalid ID.");
    }

    if (detectXSSDeep(AccountID) || detectXSSDeep(adminId)) {
      logAttack("Tentative XSS détectée pendant la suppression d'un compte en attente", req, "xss");
      return reject("Error while deleting account.");
    }

    let userEmail = "";
    let userRole = "";
    let userDiploma = "";
    let userObj = null;


      return VisiteurSchema.findById(AccountID)
      .then((user) => {
          if (!user) return reject("User not found.");

          userObj = user; // ← on le garde pour la fin
          userEmail = user.email || "";
          userRole = user.role;
          userDiploma = user.diploma || "";

        return ContactSchema.deleteMany({ email: userEmail });
      })
      .then(() => {
        // Étape 3 : Supprimer les blogs du docteur
        return BlogSchema.find({ userId: AccountID });
      })
      .then((blogs) => {
        if (!blogs.length) return;

        const blogDeletionPromises = blogs.map((blog) => {
          const promises = [];

          // Supprimer l'image si elle existe
          if (blog.image) {
            const imagePath = path.join(
              __dirname,
              "..",
              "assets",
              "uploads",
              blog.image
            );
            fs.unlink(imagePath, (err) => {});
          }

          // Supprimer le blog
          promises.push(BlogSchema.deleteOne({ _id: blog._id }));

          // Supprimer les interactions seulement si blog approuvé
          if (blog.status === "Approved") {
            promises.push(BlogInteraction.deleteMany({ blogId: blog._id }));
          }

          return Promise.all(promises);
        });

        return Promise.all(blogDeletionPromises);
      })
      .then(() => {
        // Si DOCTOR → supprimer planning et rendez-vous liés
        if (userRole === "doctor") {
          return DoctorShema.findOne({ userId: AccountID }).then((schedule) => {
            if (!schedule) return;

            const doctorScheduleId = schedule._id;

            // Étape 1 : supprimer le planning du docteur
            return DoctorShema.deleteOne({ userId: AccountID })
              .then(() =>
                // Étape 2 : récupérer les rendez-vous liés au planning supprimé
                AppointmentSchema.find({ scheduleId: doctorScheduleId })
              )
              .then((appointments) => {
                if (!appointments.length) return;

                const appointmentIds = appointments.map((a) => a._id);
                const preIds = appointments.map((a) =>
                  a.preAppointmentId.toString()
                );

                // Étape 3 : mettre isCompleted à false pour les pré-rendez-vous associés
                const updatePreAppointments = PreAppointmentSchema.updateMany(
                  { _id: { $in: preIds } },
                  { $set: { isCompleted: false } }
                );

                // Étape 4 : suppression des pré-rendez-vous
                const deletePreAppointments = PreAppointmentSchema.deleteMany({
                  _id: { $in: preIds },
                });

                // Étape 5 : suppression des rendez-vous
                const deleteAppointments = AppointmentSchema.deleteMany({
                  _id: { $in: appointmentIds },
                });

                return Promise.all([
                  updatePreAppointments,
                  deletePreAppointments,
                  deleteAppointments,
                ]);
              });
          });
        }

        // Si PARENT → supprimer les pré-rendez-vous et rdv liés, et libérer les créneaux
        if (userRole === "parent") {
          return PreAppointmentSchema.find({ userId: AccountID }).then(
            (preAppointments) => {
              if (!preAppointments.length) return;

              const preIds = preAppointments.map((p) => p._id);

              return AppointmentSchema.find({
                preAppointmentId: { $in: preIds },
              }).then((appointments) => {
                if (!appointments.length) {
                  return PreAppointmentSchema.deleteMany({
                    _id: { $in: preIds },
                  });
                }

                // Regrouper les rendez-vous par scheduleId
                const appointmentsBySchedule = appointments.reduce(
                  (acc, appointment) => {
                    const key = appointment.scheduleId.toString();
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(appointment);
                    return acc;
                  },
                  {}
                );

                // Pour chaque planning, on libère les créneaux correspondants à TOUS les RDV liés
                const updatePromises = Object.entries(
                  appointmentsBySchedule
                ).map(([scheduleId, scheduleAppointments]) => {
                  return DoctorShema.findById(scheduleId).then(
                    (scheduleDoc) => {
                      if (!scheduleDoc) return;

                      scheduleAppointments.forEach((appointment) => {
                        const targetDay = scheduleDoc.schedules.find(
                          (day) =>
                            day.date ===
                            appointment.appointmentDate
                              .toISOString()
                              .slice(0, 10)
                        );

                        if (!targetDay) return;

                        const hourIndex = targetDay.reserved.indexOf(
                          appointment.appointmentHour
                        );
                        if (hourIndex !== -1) {
                          targetDay.reserved.splice(hourIndex, 1);
                          targetDay.available.push(appointment.appointmentHour);
                        }
                      });

                      return scheduleDoc.save();
                    }
                  );
                });

                return Promise.all(updatePromises)
                  .then(() =>
                    AppointmentSchema.deleteMany({
                      _id: { $in: appointments.map((a) => a._id) },
                    })
                  )
                  .then(() =>
                    PreAppointmentSchema.deleteMany({ _id: { $in: preIds } })
                  );
              });
            }
          );
        }

        // Si aucun rôle ne correspond → rien de plus à supprimer
        return;
      })
      .then((user) => {
        if (userObj && userObj.diploma) {
          const diplomaPath = path.join(
            __dirname,
            "..",
            "assets",
            "uploads",
            userObj.diploma
          );
          fs.unlink(diplomaPath, (err) => {});
        }

        return VisiteurSchema.deleteOne({ _id: AccountID });
      })
      .then(() => {
        resolve("Account and all related actions deleted.");
      })
      .catch((err) => {
        reject("Failed to delete account.");
      });
  });
};



/*********************** Active Accounts ***************/

// afficher tout les comptes actives

exports.getActiveAccountsModel = ({ userId, startDate, endDate, req }) => {
  return new Promise((resolve, reject) => {
    // Sécurité : validation de l'userId
    if (!userId) return reject("Missing user ID.");
    if (!mongoose.Types.ObjectId.isValid(userId)) return reject("Invalid user ID.");
    if (detectXSSDeep(userId)) {
      logAttack("XSS detected in getActiveAccountsModel userId", req, "xss");
      return reject("Unauthorized access.");
    }

    // Sécurité : validation XSS des dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("XSS detected in startDate (active accounts)", req, "xss");
      return reject("Error retrieving accounts.");
    }
    if (endDate && detectXSSDeep(endDate)) {
      logAttack("XSS detected in endDate (active accounts)", req, "xss");
      return reject("Error retrieving accounts.");
    }

    // Nettoyage des dates
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";

        // Création du filtre pour les comptes actifs
        let query = { status: "Active" };
        if (sanitizedStartDate && sanitizedEndDate) {
          query.createdAt = { $gte: new Date(sanitizedStartDate), $lte: new Date(sanitizedEndDate) };
        } else if (sanitizedStartDate) {
          query.createdAt = { $gte: new Date(sanitizedStartDate) };
        } else if (sanitizedEndDate) {
          query.createdAt = { $lte: new Date(sanitizedEndDate) };
        }

      return VisiteurSchema.find(query).sort({ createdAt: -1 }).limit(100)
      .then(accounts => {
        const statsPromises = accounts.map(account => {
          const userId = account._id;

          // Étape 1 : récupérer les preAppointments de l'utilisateur
          return PreAppointmentSchema.find({ userId }, '_id')
            .then(preAppointments => {
              const preAppointmentIds = preAppointments.map(p => p._id);

              // Étape 2 : collecter les stats dépendantes
              return Promise.all([
                // Total PreAppointments
                Promise.resolve(preAppointmentIds.length),

                // Total Appointments liés aux PreAppointments
                AppointmentSchema.countDocuments({
                  preAppointmentId: { $in: preAppointmentIds },
                }),

                // Blogs approuvés par l'utilisateur
                BlogSchema.countDocuments({ userId, status: "Approved" }),

                // Témoignages approuvés

                TestimonialSchema.aggregate([
                  {
                    $lookup: {
                      from: "appointments",
                      localField: "appointmentId",
                      foreignField: "_id",
                      as: "appointment",
                    },
                  },
                  { $unwind: "$appointment" },
                  {
                    $lookup: {
                      from: "preappointments",
                      localField: "appointment.preAppointmentId",
                      foreignField: "_id",
                      as: "preAppointment",
                    },
                  },
                  { $unwind: "$preAppointment" },
                  {
                    $match: {
                      status: "Approved",
                      "preAppointment.userId": new mongoose.Types.ObjectId(userId),
                    },
                  },
                  {
                    $count: "totalTestimonials",
                  },
                ]).then((testimonialAgg) => {
                  return testimonialAgg.length > 0
                    ? testimonialAgg[0].totalTestimonials
                    : 0;
                }),

                // Plannings créés (si médecin)
                DoctorShema.countDocuments({ userId }),

                // Nombre de commentaires
                BlogInteraction.aggregate([
                  {
                    $facet: {
                      mainComments: [
                        { $unwind: "$comments" },
                        { $match: { "comments.user": userId } },
                        { $count: "count" },
                      ],
                      replies: [
                        { $unwind: "$comments" },
                        { $unwind: "$comments.replies" },
                        { $match: { "comments.replies.user": userId } },
                        { $count: "count" },
                      ],
                    },
                  },
                  {
                    $project: {
                      totalComments: {
                        $add: [
                          {
                            $ifNull: [
                              { $arrayElemAt: ["$mainComments.count", 0] },
                              0,
                            ],
                          },
                          {
                            $ifNull: [
                              { $arrayElemAt: ["$replies.count", 0] },
                              0,
                            ],
                          },
                        ],
                      },
                    },
                  },
                ]),

                // Appointments où l'utilisateur est docteur (via SchedulePerDoctor)
                AppointmentSchema.find({})
                  .populate("scheduleId", "userId")
                  .then((appointments) => {
                    return appointments.filter((a) => {
                      return (
                        a.scheduleId &&
                        a.scheduleId.userId &&
                        a.scheduleId.userId.toString() === userId.toString()
                      );
                    }).length;
                  }),
              ]).then(
                ([
                  totalPreAppointments,
                  totalAppointments,
                  totalBlogs,
                  totalTestimonials,
                  totalSchedules,
                  commentAgg,
                  totalAppointmentsAsDoctor, //nouveau
                ]) => {
                  const totalComments =
                    commentAgg.length > 0 ? commentAgg[0].totalComments : 0;

                  return {
                    userId,
                    full_name: account.full_name,
                    role: account.role,
                    email: account.email,
                    Speciality: account.Speciality || "",
                    medical_license: account.medical_license || "",
                    diploma: account.diploma || "",
                    status: account.status || "",
                    isAdmin: account.isAdmin || false,
                    createdAt: account.createdAt,
                    stats: {
                      totalPreAppointments,
                      totalAppointments,
                      totalBlogsApproved: totalBlogs,
                      totalTestimonialsApproved: totalTestimonials,
                      totalDoctorsWithSchedules: totalSchedules,
                      totalComments,
                      totalAppointmentsAsDoctor, //Nouveau champ
                    },
                  };
                }
              );
            });
        });

        return Promise.all(statsPromises)
          .then(accountsWithStats => {
            resolve({ accounts: accountsWithStats });
          });
      })
      .catch(err => {
        reject("Error loading active accounts.");
      });
  });
};


// supprimer un compte utilisateur active

// Étapes de suppression de données
// 1.Récupération de l'utilisateur
// Récupère l’utilisateur (VisiteurSchema.findById).

// 2.Suppression des contacts
// Supprime tous les contacts liés à l’email de l’utilisateur (ContactSchema.deleteMany).

// 3.Suppression des blogs
// Supprime les blogs écrits par l'utilisateur.

// Supprime l’image associée à chaque blog s’il y en a.

// Supprime les interactions uniquement pour les blogs approuvés.

// 4.Suppression du planning (si utilisateur est docteur)
// Supprime le planning du docteur (DoctorShema.deleteOne).

// Supprime les rendez-vous et pré-rendez-vous associés à ce planning.

// 5.Cas spécifique si utilisateur est un parent
// Récupère tous ses pré-rendez-vous.

// Supprime les rendez-vous liés à ces pré-rendez-vous.

// Supprime les pré-rendez-vous.

// Met à jour le planning des docteurs (SchedulePerDoctorSchema) pour libérer les créneaux réservés.

// 6.Suppression du diplôme (si présent)
// Supprime le fichier diplôme du système (fs.unlink).

// 7.Suppression finale de l'utilisateur
// Supprime l’entrée du compte dans la collection VisiteurSchema.


exports.DeleteActiveAccountModel = ({ AccountID, adminId, req }) => {
  return new Promise((resolve, reject) => {
    if (!AccountID || !adminId) return reject("Missing required data.");

    if (!mongoose.Types.ObjectId.isValid(AccountID) || !mongoose.Types.ObjectId.isValid(adminId)) {
      return reject("Invalid ID.");
    }

    if (detectXSSDeep(AccountID) || detectXSSDeep(adminId)) {
      logAttack("Tentative XSS détectée pendant la suppression d'un compte Activé", req, "xss");
      return reject("Error while deleting account.");
    }

    let userEmail = "";
    let userRole = "";
    let userDiploma = "";
    let userObj = null;

      return VisiteurSchema.findById(AccountID)
      .then((user) => {
          if (!user) return reject("User not found.");

          userObj = user; // ← on le garde pour la fin
          userEmail = user.email || "";
          userRole = user.role;
          userDiploma = user.diploma || "";

        return ContactSchema.deleteMany({ email: userEmail });
      })
      .then(() => {
        // Étape 3 : Supprimer les blogs du docteur
        return BlogSchema.find({ userId: AccountID });
      })
      .then((blogs) => {
        if (!blogs.length) return;

        const blogDeletionPromises = blogs.map((blog) => {
          const promises = [];

          // Supprimer l'image si elle existe
          if (blog.image) {
            const imagePath = path.join(
              __dirname,
              "..",
              "assets",
              "uploads",
              blog.image
            );
            fs.unlink(imagePath, (err) => {});
          }

          // Supprimer le blog
          promises.push(BlogSchema.deleteOne({ _id: blog._id }));

          // Supprimer les interactions seulement si blog approuvé
          if (blog.status === "Approved") {
            promises.push(BlogInteraction.deleteMany({ blogId: blog._id }));
          }

          return Promise.all(promises);
        });

        return Promise.all(blogDeletionPromises);
      })
      .then(() => {
        // Si DOCTOR → supprimer planning et rendez-vous liés
        if (userRole === "doctor") {
          return DoctorShema.findOne({ userId: AccountID }).then((schedule) => {
            if (!schedule) return;

            const doctorScheduleId = schedule._id;

            // Étape 1 : supprimer le planning du docteur
            return DoctorShema.deleteOne({ userId: AccountID })
              .then(() =>
                // Étape 2 : récupérer les rendez-vous liés au planning supprimé
                AppointmentSchema.find({ scheduleId: doctorScheduleId })
              )
              .then((appointments) => {
                if (!appointments.length) return;

                const appointmentIds = appointments.map((a) => a._id);
                const preIds = appointments.map((a) =>
                  a.preAppointmentId.toString()
                );

                // Étape 3 : mettre isCompleted à false pour les pré-rendez-vous associés
                const updatePreAppointments = PreAppointmentSchema.updateMany(
                  { _id: { $in: preIds } },
                  { $set: { isCompleted: false } }
                );

                // Étape 4 : suppression des pré-rendez-vous
                const deletePreAppointments = PreAppointmentSchema.deleteMany({
                  _id: { $in: preIds },
                });

                // Étape 5 : suppression des rendez-vous
                const deleteAppointments = AppointmentSchema.deleteMany({
                  _id: { $in: appointmentIds },
                });

                return Promise.all([
                  updatePreAppointments,
                  deletePreAppointments,
                  deleteAppointments,
                ]);
              });
          });
        }

        // Si PARENT → supprimer les pré-rendez-vous et rdv liés, et libérer les créneaux
        if (userRole === "parent") {
          return PreAppointmentSchema.find({ userId: AccountID }).then(
            (preAppointments) => {
              if (!preAppointments.length) return;

              const preIds = preAppointments.map((p) => p._id);

              return AppointmentSchema.find({
                preAppointmentId: { $in: preIds },
              }).then((appointments) => {
                if (!appointments.length) {
                  return PreAppointmentSchema.deleteMany({
                    _id: { $in: preIds },
                  });
                }

                // Regrouper les rendez-vous par scheduleId
                const appointmentsBySchedule = appointments.reduce(
                  (acc, appointment) => {
                    const key = appointment.scheduleId.toString();
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(appointment);
                    return acc;
                  },
                  {}
                );

                // Pour chaque planning, on libère les créneaux correspondants à TOUS les RDV liés
                const updatePromises = Object.entries(
                  appointmentsBySchedule
                ).map(([scheduleId, scheduleAppointments]) => {
                  return DoctorShema.findById(scheduleId).then(
                    (scheduleDoc) => {
                      if (!scheduleDoc) return;

                      scheduleAppointments.forEach((appointment) => {
                        const targetDay = scheduleDoc.schedules.find(
                          (day) =>
                            day.date ===
                            appointment.appointmentDate
                              .toISOString()
                              .slice(0, 10)
                        );

                        if (!targetDay) return;

                        const hourIndex = targetDay.reserved.indexOf(
                          appointment.appointmentHour
                        );
                        if (hourIndex !== -1) {
                          targetDay.reserved.splice(hourIndex, 1);
                          targetDay.available.push(appointment.appointmentHour);
                        }
                      });

                      return scheduleDoc.save();
                    }
                  );
                });

                return Promise.all(updatePromises)
                  .then(() =>
                    AppointmentSchema.deleteMany({
                      _id: { $in: appointments.map((a) => a._id) },
                    })
                  )
                  .then(() =>
                    PreAppointmentSchema.deleteMany({ _id: { $in: preIds } })
                  );
              });
            }
          );
        }

        // Si aucun rôle ne correspond → rien de plus à supprimer
        return;
      })
      .then((user) => {
        if (userObj && userObj.diploma) {
          const diplomaPath = path.join(
            __dirname,
            "..",
            "assets",
            "uploads",
            userObj.diploma
          );
          fs.unlink(diplomaPath, (err) => {});
        }

        return VisiteurSchema.deleteOne({ _id: AccountID });
      })
      .then(() => {
        resolve("Account and all related actions deleted.");
      })
      .catch((err) => {
        reject("Failed to delete account.");
      });
  });
};



/*-------------------------------------- All Accounts --------------------------------*/

/*-------------------------------------- All Blogs --------------------------------*/

/*********************** Pending Blogs ***************/

// afficher tout les Blogs en attente

exports.getPendingBlogsModel = ({ userId, startDate, endDate, req }) => {
  return new Promise((resolve, reject) => {
    // Validation de l'user ID (admin connecté)
    if (!userId) return reject("Missing user ID.");
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }
    if (detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans la récupération des Blogs en attente", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }

    // Validation des dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS dans startDate (blogs en attente)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }
    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS dans startDate (blogs en attente)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }

    // Nettoyage avec cleanText (aucune balise ni attribut autorisé)
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";



        let query = { status: "Pending" };

        if (sanitizedStartDate && sanitizedEndDate) {
          query.createdAt = {
            $gte: new Date(sanitizedStartDate),
            $lte: new Date(sanitizedEndDate),
          };
        } else if (sanitizedStartDate) {
          query.createdAt = { $gte: new Date(sanitizedStartDate) };
        } else if (sanitizedEndDate) {
          query.createdAt = { $lte: new Date(sanitizedEndDate) };
        }

      return BlogSchema.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .then((blogs) => {
        resolve(blogs);
      })
      .catch((err) => {
        reject("Failed to retrieve pending blogs.");
      });
  });
};


// approuver un Blog en attente

exports.ApprovePendingBlogModel = ({ BlogID, adminId, req }) => {
  return new Promise((resolve, reject) => {
    
    if (!BlogID || !adminId) {
      return reject("Missing required data.");
    }

    if (!mongoose.Types.ObjectId.isValid(BlogID)) {
      return reject("Invalid Blog ID.");
    }

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return reject("Invalid Admin ID.");
    }

    if (detectXSSDeep(BlogID) || detectXSSDeep(adminId)) {
      logAttack("Tentative XSS détectée pendant l'approbation d'un blog", req, "xss");
      return reject("Failed to approve blog.");
    }

       BlogSchema.findById(BlogID)
      .then(blog => {
        if (!blog) {
          return reject("Blog not found.");
        }

        // Mise à jour du statut
        blog.status = "Approved";
        return blog.save();
      })
      .then(() => {
        resolve("Blog approved successfully.");
      })
      .catch(err => {
        reject("Failed to approve blog.");
      });
  });
};

// supprimer un Blog en attente

exports.DeletePendingBlogModel = ({ BlogID, adminId, req }) => {
  return new Promise((resolve, reject) => {
    if (!BlogID || !adminId) {
      return reject("Missing required data.");
    }

    if (!mongoose.Types.ObjectId.isValid(BlogID)) {
      return reject("Invalid Blog ID.");
    }

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return reject("Invalid Admin ID.");
    }

    if (detectXSSDeep(BlogID) || detectXSSDeep(adminId)) {
      logAttack("Tentative XSS détectée pendant la suppression d'un blog", req, "xss");
      return reject("Failed to delete blog.");
    }

    let blog;

      BlogSchema.findById(BlogID) 
      .then((foundBlog) => {
        if (!foundBlog) {
          return reject("Blog not found.");
        }

        blog = foundBlog;

        // Supprimer le blog
        return BlogSchema.deleteOne({ _id: BlogID });
      })
      .then(() => {
        // Supprimer l'image associée
        if (blog.image) {
          const imagePath = path.join(
            __dirname,
            "..",
            "assets",
            "uploads",
            blog.image
          );
          fs.unlink(imagePath, (err) => {});
        }

        // Si le blog était "Approved", supprimer les commentaires associés
        if (blog.status === "Approved") {
          return BlogInteraction.deleteOne({ blogId: blog._id });
        }

        return; // sinon (Pending ou Rejected), rien à faire
      })
      .then(() => {
        resolve("Blog deleted successfully.");
      })
      .catch((err) => {
        reject("Failed to delete blog.");
      });
  });
};


/*********************** Active Blogs ***************/

// afficher tout les Blogs accéptés

exports.getApprovedBlogsModel = ({ userId, startDate, endDate, req }) => {
  return new Promise((resolve, reject) => {
    // Validation de l'user ID (admin connecté)
    if (!userId) return reject("Missing user ID.");
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }
    if (detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans la récupération des Blogs accéptés", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }

    // Validation des dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS dans startDate (blogs approuvés)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }
    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS dans endDate (blogs approuvés)", req, "xss");
      return reject("An error occurred while retrieving blogs.");
    }

    // Nettoyage avec cleanText (aucune balise ni attribut autorisé)
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";

        let query = { status: "Approved" };

        if (sanitizedStartDate && sanitizedEndDate) {
          query.createdAt = {
            $gte: new Date(sanitizedStartDate),
            $lte: new Date(sanitizedEndDate),
          };
        } else if (sanitizedStartDate) {
          query.createdAt = { $gte: new Date(sanitizedStartDate) };
        } else if (sanitizedEndDate) {
          query.createdAt = { $lte: new Date(sanitizedEndDate) };
        }

        return BlogSchema.find(query)
        .sort({ createdAt: -1 })
        .limit(100)
        .then(async (blogs) => {
        const blogIds = blogs.map(blog => blog._id);

        //Ajouter les populations des users et replies
        return BlogInteraction.find({ blogId: { $in: blogIds } })
          .populate("comments.user")
          .populate("comments.replies.user")
          .then((interactions) => {
            const interactionMap = {};
            interactions.forEach(interaction => {
              interactionMap[interaction.blogId.toString()] = interaction.comments;
            });

            const blogsWithComments = blogs.map(blog => {
              const blogObj = blog.toObject();
              blogObj.comments = interactionMap[blog._id.toString()] || [];
              return blogObj;
            });

            resolve(blogsWithComments);
          });
      })
      .catch((err) => {
        reject("Failed to retrieve Approved blogs.");
      });
  });
};

// supprimer un Blog accépté

exports.DeleteActiveBlogModel = ({ BlogID, adminId, req }) => {
  return new Promise((resolve, reject) => {
    if (!BlogID || !adminId) {
      return reject("Missing required data.");
    }

    if (!mongoose.Types.ObjectId.isValid(BlogID)) {
      return reject("Invalid Blog ID.");
    }

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return reject("Invalid Admin ID.");
    }

    if (detectXSSDeep(BlogID) || detectXSSDeep(adminId)) {
      logAttack("Tentative XSS détectée pendant la suppression d'un blog", req, "xss");
      return reject("Failed to delete blog.");
    }

    let blog;

      BlogSchema.findById(BlogID)
      .then((foundBlog) => {
        if (!foundBlog) {
          return reject("Blog not found.");
        }

        blog = foundBlog;

        // Supprimer le blog
        return BlogSchema.deleteOne({ _id: BlogID });
      })
      .then(() => {
        // Supprimer l'image associée
        if (blog.image) {
          const imagePath = path.join(
            __dirname,
            "..",
            "assets",
            "uploads",
            blog.image
          );
          fs.unlink(imagePath, (err) => {});
        }

        // Si le blog était "Approved", supprimer les commentaires associés
        if (blog.status === "Approved") {
          return BlogInteraction.deleteOne({ blogId: blog._id });
        }

        return; // sinon (Pending ou Rejected), rien à faire
      })
      .then(() => {
        resolve("Blog deleted successfully.");
      })
      .catch((err) => {
        reject("Failed to delete blog.");
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



/*-------------------------------------- All Testimonials --------------------------*/

/*********************** Pending Testimonials ***************/

// afficher tout les témoignages en attente

exports.getPendingTestimonialsModel = ({ userId, startDate, endDate, req }) => {
  return new Promise((resolve, reject) => {
    // Valider userId (admin connecté)
    if (!userId) return reject("Missing user ID.");
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }
    if (detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans la récupération des témoignages en attente", req, "xss");
      return reject("An error occurred while retrieving testimonials.");
    }

    // Valider dates (XSS)
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans startDate (témoignages en attente)", req, "xss");
      return reject("An error occurred while retrieving testimonials.");
    }
    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans endDate (témoignages en attente)", req, "xss");
      return reject("An error occurred while retrieving testimonials.");
    }

    // Nettoyer les dates
    const sanitizedStartDate = startDate ? validator.escape(startDate) : '';
    const sanitizedEndDate = endDate ? validator.escape(endDate) : '';

        let query = { status: "Pending" };

        if (sanitizedStartDate && sanitizedEndDate) {
          query.createdAt = {
            $gte: new Date(sanitizedStartDate),
            $lte: new Date(sanitizedEndDate),
          };
        } else if (sanitizedStartDate) {
          query.createdAt = { $gte: new Date(sanitizedStartDate) };
        } else if (sanitizedEndDate) {
          query.createdAt = { $lte: new Date(sanitizedEndDate) };
        }

      return TestimonialSchema.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .then((testimonials) => {
        resolve(testimonials);
      })
      .catch((err) => {
        reject("Failed to retrieve pending testimonials.");
      });
  });
};


// approuver un témoignage en attente

exports.ApprovePendingTestimonialModel = ({ TestimonialID, adminId, req }) => {
  return new Promise((resolve, reject) => {
    
    if (!TestimonialID || !adminId) {
      return reject("Missing required data.");
    }

    if (!mongoose.Types.ObjectId.isValid(TestimonialID)) {
      return reject("Invalid Testimonial ID.");
    }

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return reject("Invalid Admin ID.");
    }

    if (detectXSSDeep(TestimonialID) || detectXSSDeep(adminId)) {
      logAttack("Tentative XSS détectée pendant l'approbation d'un témoignage", req, "xss");
      return reject("Failed to approve testimonial.");
    }

      TestimonialSchema.findById(TestimonialID)
      .then(testimonial => {
        if (!testimonial) {
          return reject("Testimonial not found.");
        }

        // Mise à jour du statut
        testimonial.status = "Approved";
        return testimonial.save();
      })
      .then(() => {
        resolve("Testimonial approved successfully.");
      })
      .catch(err => {
        reject("Failed to approve testimonial.");
      });
  });
};


// supprimer un témoignage en attente


exports.DeletePendingTestimonialModel = ({ TestimonialID, adminId, req }) => {
  return new Promise((resolve, reject) => {
    // Vérification des données requises
    if (!TestimonialID || !adminId) {
      return reject("Missing required data.");
    }

    // Validation des identifiants MongoDB
    if (!mongoose.Types.ObjectId.isValid(TestimonialID)) {
      return reject("Invalid Testimonial ID.");
    }

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return reject("Invalid Admin ID.");
    }

    // Sécurité XSS
    if (detectXSSDeep(TestimonialID) || detectXSSDeep(adminId)) {
      logAttack("Tentative XSS détectée pendant la suppression d'un témoignage", req, "xss");
      return reject("Failed to delete testimonial.");
    }

    let testimonial;


      TestimonialSchema.findById(TestimonialID)
      .then((foundTestimonial) => {
        if (!foundTestimonial) {
          return reject("Testimonial not found.");
        }

        if (foundTestimonial.status !== "Pending") {
          return reject("Only pending testimonials can be deleted.");
        }

        testimonial = foundTestimonial;
        const appointmentId = testimonial.appointmentId;

        // Supprimer le témoignage
        return TestimonialSchema.deleteOne({ _id: TestimonialID })
          .then(() => {
            // Supprimer l'image s'il y en a une
            if (testimonial.testimonial_image) {
              const imagePath = path.join(__dirname, "..", 
                "assets", 
                "uploads", 
                testimonial.testimonial_image
              );
              fs.unlink(imagePath, (err) => {});//supprimer l'image de témoignage
            }

            // Vérifier si le rendez-vous existe
            return AppointmentSchema.findById(appointmentId);
          })
          .then((appointment) => {
            if (appointment) {
              // Si le rendez-vous existe, mettre à jour isReviewed à false
              return AppointmentSchema.findByIdAndUpdate(
                appointment._id,
                { isReviewed: false },
                { new: true }
              );
            }
            // Si le rendez-vous n'existe pas, ne rien faire
            return;
          });
      })
      .then(() => {
        resolve("Testimonial deleted successfully.");
      })
      .catch((err) => {
        reject("Failed to delete testimonial.");
      });
  });
};



/*********************** Active Testimonials ****************/


// afficher tout les témoignages  accéptées 

exports.getApprovedTestimonialsModel = ({ userId, startDate, endDate, req }) => {
  return new Promise((resolve, reject) => {
    // Vérification ID utilisateur (admin connecté)
    if (!userId) return reject("Missing user ID.");
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    if (detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans la récupération des témoignages approuvés", req, "xss");
      return reject("An error occurred while retrieving testimonials.");
    }

    // Vérifier les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS dans startDate (testimonials approved)", req, "xss");
      return reject("An error occurred while retrieving testimonials.");
    }
    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS dans endDate (testimonials approved)", req, "xss");
      return reject("An error occurred while retrieving testimonials.");
    }

    const sanitizedStartDate = startDate ? validator.escape(startDate) : '';
    const sanitizedEndDate = endDate ? validator.escape(endDate) : '';

        let query = { status: "Approved" };

        if (sanitizedStartDate && sanitizedEndDate) {
          query.createdAt = {
            $gte: new Date(sanitizedStartDate),
            $lte: new Date(sanitizedEndDate),
          };
        } else if (sanitizedStartDate) {
          query.createdAt = { $gte: new Date(sanitizedStartDate) };
        } else if (sanitizedEndDate) {
          query.createdAt = { $lte: new Date(sanitizedEndDate) };
        }

      return TestimonialSchema.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .then((testimonials) => {
        resolve(testimonials);
      })
      .catch((err) => {
        reject("Failed to retrieve approved testimonials.");
      });
  });
};


// supprimer un témoignage accépté

exports.DeleteActiveTestimonialModel = ({ TestimonialID, adminId, req }) => {
  return new Promise((resolve, reject) => {
    if (!TestimonialID || !adminId) {
      return reject("Missing required data.");
    }

    if (!mongoose.Types.ObjectId.isValid(TestimonialID)) {
      return reject("Invalid Testimonial ID.");
    }

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return reject("Invalid Admin ID.");
    }

    if (detectXSSDeep(TestimonialID) || detectXSSDeep(adminId)) {
      logAttack("Tentative XSS détectée pendant la suppression d'un témoignage approuvé", req, "xss");
      return reject("Failed to delete testimonial.");
    }

    let testimonial;

      TestimonialSchema.findById(TestimonialID)
      .then((foundTestimonial) => {
        if (!foundTestimonial) {
          return reject("Testimonial not found.");
        }

        if (foundTestimonial.status !== "Approved") {
          return reject("Only approved testimonials can be deleted.");
        }

        testimonial = foundTestimonial;
        const appointmentId = testimonial.appointmentId;

        return TestimonialSchema.deleteOne({ _id: TestimonialID }).then(() => {
          if (testimonial.testimonial_image) {
            const imagePath = path.join(
              __dirname,
              "..",
              "assets",
              "uploads",
              testimonial.testimonial_image
            );
            fs.unlink(imagePath, (err) => {}); // suppression de l'image
          }

          // Vérifier si le rendez-vous existe
          return AppointmentSchema.findById(appointmentId);
        });
      })
      .then((appointment) => {
        if (appointment) {
          // Remettre isReviewed à false si rendez-vous trouvé
          return AppointmentSchema.findByIdAndUpdate(
            appointment._id,
            { isReviewed: false },
            { new: true }
          );
        }
        return;
      })
      .then(() => {
        resolve("Approved testimonial deleted successfully.");
      })
      .catch((err) => {
        reject("Failed to delete approved testimonial.");
      });
  });
};








/*-------------------------------------- All Testimonials --------------------------*/





/*-------------------------------------- All Messages --------------------------*/

// afficher tout les messages de contact

exports.getAllContactMessagesModel = ({ userId, startDate, endDate, req }) => {
  return new Promise((resolve, reject) => {
    if (!userId) return reject("Missing user ID.");
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    if (detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans l’ID utilisateur (Contact Messages)", req, "xss");
      return reject("An error occurred while retrieving contact messages.");
    }

    // Vérifier et assainir les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS dans startDate (Contact Messages)", req, "xss");
      return reject("An error occurred while retrieving contact messages.");
    }
    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS dans endDate (Contact Messages)", req, "xss");
      return reject("An error occurred while retrieving contact messages.");
    }

    // Nettoyage avec cleanText (aucune balise ni attribut autorisé)
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";


        let query = {}; // Aucun filtre par défaut

        if (sanitizedStartDate && sanitizedEndDate) {
          query.createdAt = {
            $gte: new Date(sanitizedStartDate),
            $lte: new Date(sanitizedEndDate),
          };
        } else if (sanitizedStartDate) {
          query.createdAt = { $gte: new Date(sanitizedStartDate) };
        } else if (sanitizedEndDate) {
          query.createdAt = { $lte: new Date(sanitizedEndDate) };
        }

      return ContactSchema.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .then((contacts) => {
        resolve(contacts);
      })
      .catch((err) => {
        reject("Failed to retrieve contact messages.");
      });
  });
};

//supprimer un message de contact

exports.DeleteContactMessageModel = ({ ContactID, adminId, req }) => {
  return new Promise((resolve, reject) => {
    if (!ContactID || !adminId) {
      return reject("Missing required data.");
    }

    if (!mongoose.Types.ObjectId.isValid(ContactID)) {
      return reject("Invalid Contact ID.");
    }

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return reject("Invalid Admin ID.");
    }

    if (detectXSSDeep(ContactID) || detectXSSDeep(adminId)) {
      logAttack("Tentative XSS détectée pendant la suppression d'un message de contact", req, "xss");
      return reject("Failed to delete contact message.");
    }

      ContactSchema.findById(ContactID)
      .then((contact) => {
        if (!contact) {
          return reject("Contact message not found.");
        }

        return ContactSchema.deleteOne({ _id: ContactID });
      })
      .then(() => {
        resolve("Contact message deleted successfully.");
      })
      .catch((err) => {
        reject("Failed to delete contact message.");
      });
  });
};

/*-------------------------------------- All Messages --------------------------*/