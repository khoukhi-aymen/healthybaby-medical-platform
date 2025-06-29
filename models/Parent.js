const fs = require("fs");
const mongoose = require("mongoose");
const PreAppointmentSchema = require("../models/Schémas/preAppointment.model");
const VisiteurSchema = require("../models/Schémas/User.model");
const AppointmentSchema = require("../models/Schémas/Appointment.model");
const SchedulePerDoctorSchema = require("../models/Schémas/DoctorSchedule.model");
const ContactSchema = require("../models/Schémas/Contact.model");
const TestimonialSchema = require("../models/Schémas/testimonial.model");
const BlogSchema = require("../models/Schémas/DoctorBlog.model");
const BlogInteraction = require("../models/Schémas/Comments.model");
const logAttack = require("../helpers/logger");
const validator = require('validator');
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
//kkkk
exports.getUserAppointmentsModel = ({lang,userId, startDate, endDate, req }) => {
  return new Promise((resolve, reject) => {
     // === Messages d'erreur selon la langue ===
    const messages = {
      en: {
        missingId: "Missing user ID.",
        invalidId: "Invalid user ID.",
        fail: "An error occurred while retrieving appointments.",
      },
      ar: {
        missingId: "معرّف المستخدم مفقود",
        invalidId: "معرّف المستخدم غير صالح",
        fail: "حدث خطأ أثناء استرجاع المواعيد",
      },
    };

    const t = messages[lang] || messages['en'];

    if (!userId) return reject(t.missingId);


    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject(t.invalidId);
    }

    // XSS detection dans userID
    if (detectXSSDeep(userId)||detectXSSDeep(lang)) {
      logAttack("Tentative XSS détectée dans la page My Appoitments", req, "xss");
      return reject(t.fail);
    }
    

    // XSS detection dans startDate
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate", req, "xss");
      return reject(t.fail);
    }
  
    // XSS detection dans endDate
    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate", req, "xss");
      return reject(t.fail);
    }

    let preAppointmentIds = [];

       PreAppointmentSchema.find({ userId })
      .then((preAppointments) => {
        if (!preAppointments || preAppointments.length === 0) {
          return resolve([]);
        }

        preAppointmentIds = preAppointments.map((pre) => pre._id);

        let query = {
          preAppointmentId: { $in: preAppointmentIds },
          status: {
            $in: [
              "Pending",
              "Approved",
              "Rejected",
              "In follow-up",
              "Completed",
            ],
          },
          archived: false, //Exclure les rendez-vous archivés
        };

        // Dates assainies
        const sanitizedStartDate = startDate ? cleanText(startDate) : "";
        const sanitizedEndDate = endDate ? cleanText(endDate) : "";

        if (sanitizedStartDate && sanitizedEndDate) {
          query.appointmentDate = {
            $gte: new Date(sanitizedStartDate),
            $lte: new Date(sanitizedEndDate),
          };
        }

        return AppointmentSchema.find(query)
          .sort({ appointmentDate: -1 })
          .limit(100);
      })
      .then((appointments) => {
        resolve(appointments);
      })
      .catch((err) => {
        reject(t.fail);
      });
  });
};


/*********************** pré-appointment ***************/
//kkkk
exports.getPreAppointmentById = ({lang, preId, req }) => {
  return new Promise((resolve, reject) => {
    const messages = {
      en: {
        missingId: "Missing pre-appointment ID.",
        invalidId: "Invalid pre-appointment ID.",
        xss: "Error retrieving pre-appointment.",
        notFound: "Pre-appointment not found.",
        fail: "Failed to retrieve pre-appointment."
      },
      ar: {
        missingId: "رقم تعريف الموعد المسبق مفقود",
        invalidId: "رقم تعريف الموعد المسبق غير صالح",
        xss: "حدث خطأ أثناء استرجاع الموعد المسبق",
        notFound: "الموعد المسبق غير موجود",
        fail: "فشل في استرجاع الموعد المسبق"
      }
    };

    const t = messages[lang] || messages.en;
    // Vérifier si l'ID de la pré-appointment est fourni
    if (!preId) {
      return reject(t.missingId);
    }

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(preId)) {
      return reject(t.invalidId);
    }

    // Détection XSS dans l'ID
    if (detectXSSDeep(preId) || detectXSSDeep(lang)) {
      logAttack("Tentative XSS détectée dans le preId", req, "xss");
      return reject(t.xss);
    }

      return PreAppointmentSchema.findById(preId)  // Recherche de la pré-appointment par ID
      .then(preAppointment => {
        // Si la pré-appointment n'est pas trouvée
        if (!preAppointment) {
          return reject(t.notFound);
        }

        // Si trouvé, retourner les données de la pré-appointment
        resolve(preAppointment);
      })
      .catch(err => {
        reject(t.fail);
      });
  });
};

/*********************** Leave Testimonial ***************/
//kkkk
exports.LeaveTestimonialModel = ({lang, name, message, image, appointmentId, req }) => {
  return new Promise((resolve, reject) => {
    const messages = {
      en: {
        missingFields: "Please fill in all the fields.",
        invalidId: "Invalid appointment ID.",
        messageTooLong: "Please keep your message under 80 characters.",
        invalidImage: "Invalid image type. Only JPG, JPEG, and PNG are allowed.",
        imageTooLarge: "Image is too large. Maximum size allowed is 2MB.",
        xss: "Failed to submit testimonial. Please try again.",
        duplicate: "Testimonial already submitted.",
        success: "Thank you! Your testimonial will be reviewed before publication.",
        fail: "Failed to submit testimonial. Please try again."
      },
      ar: {
        missingFields: "يرجى ملء جميع الحقول",
        invalidId: "معرّف الموعد غير صالح",
        messageTooLong: "يرجى عدم تجاوز 80 حرفًا في الشهادة",
        invalidImage: "JPG، JPEG و PNG نوع الصورة غير صالح. يُسمح فقط بـ",
        imageTooLarge: "الصورة كبيرة جدًا. الحجم الأقصى المسموح به هو 2 ميغابايت",
        xss: "فشل إرسال الشهادة. يرجى المحاولة مرة أخرى",
        duplicate: "تم إرسال شهادة مسبقًا لهذا الموعد",
        success: "شكرًا لك! سيتم مراجعة شهادتك قبل النشر",
        fail: "فشل إرسال الشهادة. يرجى المحاولة لاحقًا"
      }
    };

    const t = messages[lang] || messages["en"];

    if (!name || !message || !image || !appointmentId) {
      return reject(t.missingFields);
    }

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return reject(t.invalidId);
    }

    // Vérification de la taille de message (maximum 80 lettres)
    if (message.length > 80) {
      return reject(t.messageTooLong);
    }

    // Vérification extension image
    const allowedExtensions = [".jpg", ".jpeg", ".png"];
    const fileExtension = path.extname(image.originalname).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      logAttack("Tentative XSS via image upload (testimonial)", req, "xss");
      return reject(t.invalidImage);
    }

    // Vérification de la taille de l'image (maximum 2 Mo)
    const maxSize = 2 * 1024 * 1024; // 2 Mo en octets
    if (image.size > maxSize) {
      return reject(t.imageTooLarge);
    }

    // Détection XSS dans le nom et le message
    if (
      detectXSSDeep(name) ||
      detectXSSDeep(message) ||
      detectXSSDeep(appointmentId) ||
      detectXSSDeep(image) ||
      detectXSSDeep(lang)
    ) {
      logAttack("Tentative XSS dans un témoignage", req, "xss");
      return reject(t.xss);
    }

    // Assainissement des champs
    const sanitizedName = cleanText(name);
    const sanitizedMessage = cleanText(message);
    const sanitizedImage = cleanText(image?.filename || "");

      //Vérifie s’il existe déjà un témoignage pour ce rendez-vous
      return TestimonialSchema.findOne({ appointmentId })
      .then((existingTestimonial) => {
        if (existingTestimonial) {
          return reject(t.duplicate);
        }


        const newTestimonial = new TestimonialSchema({
          appointmentId,
          name: sanitizedName,
          message: sanitizedMessage,
          testimonial_image: sanitizedImage,
          status: "Pending", //par défaut "Pending"
        });

        return newTestimonial.save();
      })
      .then((savedTestimonial) => {
        if (!savedTestimonial || !savedTestimonial._id) {
          return reject(t.fail); // ajout a échoué
        }
        //Met à jour le champ isReviewed à true dans le rendez-vous lié
        return AppointmentSchema.updateOne(
          { _id: appointmentId },
          { $set: { isReviewed: true } }
        );
      })
      .then(() => {
        resolve(t.success);
      })
      .catch((err) => {
        reject(t.fail);
      });
  });
};

/*********************** update Testimonial ***************/
//kkkk
exports.getTestimonialByAppointmentIdModel = (appointmentId, req) => {
  return new Promise((resolve, reject) => {
    if (!appointmentId) return reject("Appointment ID is required.");

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return reject("Invalid Appointment ID.");
    }

    if (detectXSSDeep(appointmentId)) {
      logAttack("Tentative XSS détectée dans l'appointmentId pour le témoignage", req, "xss");
      return reject("An error occurred while retrieving the testimonial.");
    }

    const sanitizedAppointmentId = appointmentId;
     TestimonialSchema.findOne({ appointmentId: sanitizedAppointmentId })
      .then((testimonial) => {

        if (!testimonial) {
          return reject("Testimonial not found for this appointment.");
        }

        resolve({ testimonial });
      })
      .catch((err) => {
        reject("An error occurred while retrieving the testimonial.");
      });
  });
};

//kkkk
exports.UpdateTestimonialModel = ({lang, testimonialId, name, message, image, appointmentId, req }) => {
  return new Promise((resolve, reject) => {
    // === Messages traduits ===
    const messages = {
      en: {
        missingFields: "Please fill in all the fields.",
        missingTestimonialId: "Testimonial ID is required for updating.",
        invalidTestimonialId: "Invalid Testimonial ID.",
        missingAppointmentId: "Appointment ID is required for updating.",
        invalidAppointmentId: "Invalid Appointment ID.",
        invalidImageType: "Invalid image type. Only JPG, JPEG, and PNG are allowed.",
        imageTooLarge: "Image is too large. Maximum size allowed is 2MB.",
        xssDetected: "Failed to update the testimonial. Please try again.",
        notFound: "Testimonial not found or unauthorized.",
        updateFail: "Failed to update the testimonial. Please try again.",
        updateSuccess: "Your testimonial has been updated successfully and will be reviewed before publication."
      },
      ar: {
        missingFields: "يرجى ملء جميع الحقول",
        missingTestimonialId: "معرّف الشهادة مطلوب للتحديث",
        invalidTestimonialId: "معرّف الشهادة غير صالح",
        missingAppointmentId: "معرّف الموعد مطلوب للتحديث",
        invalidAppointmentId: "معرّف الموعد غير صالح",
        invalidImageType: " JPG و JPEG و PNG نوع الصورة غير صالح. يُسمح فقط بـ",
        imageTooLarge: "الصورة كبيرة جدًا. الحد الأقصى المسموح به هو 2 ميغابايت",
        xssDetected: "فشل في تحديث الشهادة. حاول مرة أخرى",
        notFound: "لم يتم العثور على الشهادة أو ليس لديك صلاحية",
        updateFail: "فشل في تحديث الشهادة. حاول مرة أخرى",
        updateSuccess: "تم تحديث شهادتك بنجاح وسيتم مراجعتها قبل النشر"
      }
    };

    const t = messages[lang] || messages.en;
    // Vérification des champs requis
    if (!name || !message) {
      return reject(t.missingFields);
    }

    if (!testimonialId){
      return reject(t.missingTestimonialId);
    }

    // Vérification de la validité de l'ID
    if (!mongoose.Types.ObjectId.isValid(testimonialId)) {
      return reject(t.invalidTestimonialId);
    }

    // Vérification de la validité de l'ID de l'appointment
    if (!appointmentId)
      return reject(t.missingAppointmentId);

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return reject(t.invalidAppointmentId);
    }

    // Vérification de la validité de l'image téléchargée
    if (image) {
      const allowedExtensions = [".jpg", ".jpeg", ".png"];
      const fileExtension = path.extname(image.originalname).toLowerCase();
      if (!allowedExtensions.includes(fileExtension)) {
        logAttack(
          "Tentative XSS via image upload dans la mise à jour du témoignage",
          req,
          "xss"
        );
        return reject(t.invalidImageType);
      }

      // Vérification de la taille de l'image (maximum 2 Mo)
      const maxSize = 2 * 1024 * 1024;
      if (image && image.size > maxSize) {
        return reject(t.imageTooLarge);
      }
    }

    // Vérification de l'absence d'injections XSS
    if (
      detectXSSDeep(name) ||
      detectXSSDeep(message) ||
      detectXSSDeep(image) ||
      detectXSSDeep(testimonialId) ||
      detectXSSDeep(appointmentId) ||
      detectXSSDeep(lang)
    ) {
      logAttack(
        "Tentative XSS dans le contenu du témoignage (update)",
        req,
        "xss"
      );
      return reject(t.xssDetected);
    }

    // Sanitation des données
    const sanitizedName = cleanText(name);
    const sanitizedMessage = cleanText(message);
    const sanitizedImage = image ? cleanText(image.filename || "") : null;

    let oldImagePath = null;

      return TestimonialSchema.findOne({
          _id: testimonialId,
          appointmentId: appointmentId,
      })
      .then((existingTestimonial) => {
        if (!existingTestimonial) {
          return reject(t.notFound);
        }

        // console.log(existingTestimonial.testimonial_image);
        // console.log(sanitizedImage);

        if (sanitizedImage && existingTestimonial.testimonial_image) {
          oldImagePath = path.join(
            __dirname,
            "..",
            "assets",
            "uploads",
            existingTestimonial.testimonial_image
          );
        }

        // console.log(oldImagePath);

        const updateFields = {
          name: sanitizedName,
          message: sanitizedMessage,
          status: "Pending", // Chaque update passe par validation
          appointmentId: appointmentId, // Utilisation de appointmentId dans la mise à jour
        };

        if (sanitizedImage) {
          updateFields.testimonial_image = sanitizedImage; // Met à jour l'image
        }

        return TestimonialSchema.findOneAndUpdate(
          { _id: testimonialId, appointmentId: appointmentId }, // Vérifie que le témoignage correspond au rendez-vous
          updateFields,
          { new: true }
        );
      })
      .then((updatedTestimonial) => {

        if (!updatedTestimonial) {
          return reject(t.notFound);
        }

        // Suppression de l’ancienne image si nécessaire
        if (oldImagePath) {
          fs.unlink(oldImagePath, (err) => {});
        }

        resolve(t.updateSuccess);
      })
      .catch((err) => {
        reject(t.updateFail);
      });
  });
};


/*********************** delete Appoitment ***************/
//kkkk
exports.DeleteAppointmentModel = ({lang,appointmentId,preAppointmentId,scheduleId,doctorName,appointmentDate,appointmentHour,userId,req}) => {
  return new Promise((resolve, reject) => {
    // === Messages traduits ===
    const messages = {
      en: {
        missingData: "Missing required data.",
        missingAppId: "Appointment ID is required for deleting.",
        invalidAppId: "Invalid Appointment ID.",
        missingPreAppId: "Pre-appointment ID is required for deleting.",
        invalidPreAppId: "Invalid pre-appointment ID.",
        missingScheduleId: "Schedule ID is required for deleting.",
        invalidScheduleId: "Invalid schedule ID.",
        missingUserId: "User ID is required for deleting.",
        invalidUserId: "Invalid user ID.",
        xss: "Failed to delete appointment.",
        notFoundApp: "Appointment not found.",
        notFoundPreApp: "Pre-appointment not found.",
        notFoundSchedule: "Doctor schedule not found.",
        notFoundDay: "No schedule found for the specified date.",
        success: "Appointment successfully deleted.",
        fail: "Failed to delete appointment."
      },
      ar: {
        missingData: "البيانات المطلوبة مفقودة",
        missingAppId: "معرف الموعد مطلوب للحذف",
        invalidAppId: "معرف الموعد غير صالح",
        missingPreAppId: "معرف الاستشارة الأولية مطلوب للحذف",
        invalidPreAppId: "معرف الاستشارة الأولية غير صالح",
        missingScheduleId: "معرف الجدول الزمني مطلوب للحذف",
        invalidScheduleId: "معرف الجدول الزمني غير صالح",
        missingUserId: "معرف المستخدم مطلوب للحذف",
        invalidUserId: "معرف المستخدم غير صالح",
        xss: "فشل في حذف الموعد",
        notFoundApp: "لم يتم العثور على الموعد",
        notFoundPreApp: "لم يتم العثور على الاستشارة الأولية",
        notFoundSchedule: "لم يتم العثور على جدول الطبيب",
        notFoundDay: "لا يوجد جدول لهذا التاريخ",
        success: "تم حذف الموعد بنجاح",
        fail: "فشل في حذف الموعد"
      }
    };

    const t = messages[lang] || messages.en;

    // Vérification des données
    if (!doctorName || !appointmentDate || !appointmentHour) {
      return reject(t.missingData);
    }


    if (!appointmentId) {
      return reject(t.missingPreAppId);
    }

    // Vérification de la validité de l'ID
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return reject(t.missingAppId);
    }

    if (!preAppointmentId){
      return reject(t.invalidAppId);
    }

    // Vérification de la validité de l'ID de l'appointment
    if (!mongoose.Types.ObjectId.isValid(preAppointmentId)) {
      return reject(t.invalidPreAppId);
    }

    if (!scheduleId){
      return reject(t.missingScheduleId);
    }

    // Vérification de la validité de l'ID de l'appointment
    if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
      return reject(t.invalidScheduleId);
    }

    if (!userId) return reject(t.missingUserId);

    // Vérification de la validité de l'ID de l'appointment
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject(t.invalidUserId);
    }

    // Vérification anti-XSS
    if (
      detectXSSDeep(appointmentId) ||
      detectXSSDeep(preAppointmentId) ||
      detectXSSDeep(scheduleId) ||
      detectXSSDeep(doctorName) ||
      detectXSSDeep(appointmentDate) ||
      detectXSSDeep(appointmentHour) ||
      detectXSSDeep(userId)||
      detectXSSDeep(lang)
    ) {
      logAttack("Tentative XSS détectée lors de la suppression d'un rendez-vous", req, "xss");
      return reject(t.xss);
    }


        // Supprimer le rendez-vous principal
      return AppointmentSchema.findByIdAndDelete(appointmentId)
      .then((deletedAppointment) => {
        if (!deletedAppointment) {
          return reject(t.notFoundApp);
        }

        // Supprimer le pré-rendez-vous
        return PreAppointmentSchema.findByIdAndDelete(preAppointmentId);
      })
      .then((deletedPreApp) => {
        if (!deletedPreApp) {
          return reject(t.notFoundPreApp);
        }

        // Charger le planning du médecin
        return SchedulePerDoctorSchema.findById(scheduleId);
      })
      .then((scheduleDoc) => {
        if (!scheduleDoc) {
          return reject(t.notFoundSchedule);
        }

        const schedules = scheduleDoc.schedules || [];
        const formattedDate = new Date(appointmentDate).toISOString().split("T")[0]; // YYYY-MM-DD
        const targetDay = schedules.find((day) => day.date === formattedDate);

        if (!targetDay) {
          return reject(t.notFoundDay);
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
        resolve(t.success);
      })
      .catch((err) => {
        reject(t.fail);
      });
  });
};



/***************** Update Pre-appoitement ***************/
//kkkk
exports.getPreAppointmentModel = (preAppointmentId, doctorId, req) => {
  return new Promise((resolve, reject) => {
    // Vérifications de sécurité
    if (!doctorId || !preAppointmentId) {
      return reject("Unauthorized access.");
    }

    if (!mongoose.Types.ObjectId.isValid(preAppointmentId)) {
      return reject("Invalid pre-appointment ID.");
    }

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return reject("Invalid doctor ID.");
    }

    if (detectXSSDeep(preAppointmentId) || detectXSSDeep(doctorId)) {
      logAttack("Tentative d'injection XSS dans le form update pré-rendez-vous", req, "xss");
      return reject("Error while retrieving the pre-appointment.");
    }

      return PreAppointmentSchema.findById(preAppointmentId)
      .then((preAppointment) => {

        if (!preAppointment) {
          return reject("No pre-appointment found.");
        }

        resolve(preAppointment);
      })
      .catch((err) => {
        reject("Error while retrieving the pre-appointment.");
      });
  });
};
//kkkk
exports.UpdatePreAppointmentModel = ({lang,preAppointmentId,name,email,whatsapp,residence,video_consent,diseases = [],other_diseases,concern_summary,payment_confirmed,userId,req}) => {
  return new Promise((resolve, reject) => {
    const messages = {
      en: {
        missingId: "Pre-appointment ID is required.",
        invalidId: "Invalid pre-appointment ID.",
        missingUserId: "User ID is required.",
        invalidUserId: "Invalid user ID.",
        invalidConsent: "Invalid or missing video consent.",
        invalidPayment: "Invalid or missing payment confirmation.",
        xssError: "An error occurred during the update.",
        notFound: "Pre-appointment not found or unauthorized.",
        updateFailed: "Update failed.",
        success: "Your pre-appointment has been successfully updated."
      },
      ar: {
        missingId: "معرّف الحجز المسبق مطلوب",
        invalidId: "معرّف الحجز المسبق غير صالح",
        missingUserId: "معرّف المستخدم مطلوب",
        invalidUserId: "معرّف المستخدم غير صالح",
        invalidConsent: "الموافقة على الفيديو غير صالحة أو مفقودة",
        invalidPayment: "تأكيد الدفع غير صالح أو مفقود",
        xssError: "حدث خطأ أثناء التحديث",
        notFound: "لم يتم العثور على الحجز المسبق أو غير مصرح به",
        updateFailed: "فشل في تحديث الحجز المسبق",
        success: "تم تحديث الحجز المسبق بنجاح"
      }
    };

    const t = messages[lang] || messages["en"];

    // Vérifications de base
    if (!preAppointmentId) {
      return reject(t.missingId);
    }
    if (!mongoose.Types.ObjectId.isValid(preAppointmentId)) {
      return reject(t.invalidId);
    }
    if (!userId) {
      return reject(t.missingUserId);
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject(t.invalidUserId);
    }

    if (!video_consent || !["Yes", "No"].includes(video_consent)) {
      return reject(t.invalidConsent);
    }

    if (!["Yes", "No"].includes(payment_confirmed)) {
      return reject(t.invalidPayment);
    }

    // Détection XSS
    if (
      detectXSSDeep(name) ||
      detectXSSDeep(email) ||
      detectXSSDeep(whatsapp) ||
      detectXSSDeep(residence) ||
      detectXSSDeep(video_consent) ||
      detectXSSDeep(concern_summary) ||
      detectXSSDeep(diseases) ||
      detectXSSDeep(other_diseases) ||
      detectXSSDeep(payment_confirmed) ||
      detectXSSDeep(userId) ||
      detectXSSDeep(lang)
    ) {
      logAttack("Tentative XSS détectée dans le formulaire Pre-rendez-vous",req,"xss");
      return reject(t.xssError);
    }

    // Nettoyage
    const sanitizedData = {
      name: cleanText(name),
      email: cleanText(email),
      whatsapp: cleanText(whatsapp),
      residence: cleanText(residence),
      video_consent: cleanText(video_consent),
      diseases: diseases.map(cleanText),
      other_diseases: cleanText(other_diseases),
      concern_summary: cleanText(concern_summary),
      payment_confirmed: cleanText(payment_confirmed),
    };

      return PreAppointmentSchema.findOne({ _id: preAppointmentId, userId })
      .then((existing) => {
        if (!existing) {
          return reject(t.notFound);
        }

        return PreAppointmentSchema.findOneAndUpdate(
          { _id: preAppointmentId, userId },
          sanitizedData,
          { new: true }
        );
      })
      .then((updatedDoc) => {
        if (!updatedDoc){
          return reject(t.updateFailed);
        }
        resolve(t.success);
      })
      .catch((err) => {
        reject(t.xssError);
      });
  });
};



/*-------------------------------------- My Appoitmetns --------------------------------*/






/*--------------------------------- Book Appoitement -----------------------------------*/


/*********************** Book PreAppoitement  ***************/
//kkkk
exports.getUserAndDoctorSchedulesModel = ({ userId, req }) => {
  return new Promise((resolve, reject) => {
    if (!userId) return reject("Missing user ID.");

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject("Invalid user ID.");
    }

    // Détection XSS
    if (detectXSSDeep(userId)) {
      logAttack("Tentative XSS détectée dans la page Book Appoitment",req,"xss");
      return reject("Error retrieving user or schedules.");
    }

      Promise.all([
          VisiteurSchema.findById(userId),
          SchedulePerDoctorSchema.find({}),
          PreAppointmentSchema.findOne({ userId, isCompleted: true }),
      ])
      .then(([user, allSchedules,preAppointment]) => {

        if (!user) {
          return reject("User not found.");
        }

        const doctorSchedules = {};

        allSchedules.forEach((schedule) => {
          const doctorName = schedule.doctorName;
          const scheduleId = schedule._id.toString(); // Ajouter l'ID du document dans le schedule

          // Initialiser le médecin avec son nom, son ID et les horaires
          doctorSchedules[doctorName] = {
            _id: scheduleId,
            schedules: {},
          };

          // Ajouter les horaires pour chaque jour
          schedule.schedules.forEach((day) => {
            doctorSchedules[doctorName].schedules[day.date] = {
              available: day.available,
              reserved: day.reserved,
            };
          });
        });

        // On ajoute un flag pour savoir si le pré-rendez-vous a été complété
        const hasPreAppointment = Boolean(preAppointment);

        resolve({
          user,
          doctorSchedules,
          hasPreAppointment,
        });
      })
      .catch((err) => {
        return reject("Failed to retrieve data.");
      });
  });
};
  
//kkkk
exports.PreAppointmentFormModel = ({lang,name,email,whatsapp,residence,video_consent,diseases,other_diseases,concern_summary,payment_confirmed,userId, req}) => {
    return new Promise((resolve, reject) => {
      // === Messages d'erreur/succès par langue ===
    const messages = {
      en: {
        missingFields: "Please fill in all the fields.",
        invalidEmail: "Invalid email format.",
        invalidWhatsapp: "Invalid WhatsApp number.",
        invalidUserId: "Invalid user ID.",
        xssDetected: "Failed to submit your Preappointment. Please try again later.",
        submitSuccess: "Your Preappointment has been successfully submitted.",
        submitFail: "Failed to submit your Preappointment. Please try again later.",
      },
      ar: {
        missingFields: "يرجى ملء جميع الحقول",
        invalidEmail: "تنسيق البريد الإلكتروني غير صالح",
        invalidWhatsapp: "رقم واتساب غير صالح",
        invalidUserId: "معرّف المستخدم غير صالح",
        xssDetected: "فشل في إرسال طلبك المسبق، يرجى المحاولة لاحقًا",
        submitSuccess: "تم إرسال طلبك المسبق بنجاح",
        submitFail: "فشل في إرسال طلبك المسبق، يرجى المحاولة لاحقًا",
      },
    };

    const t = messages[lang] || messages['en'];
      // Vérification des champs requis
      if (
        !name ||
        !email ||
        !whatsapp ||
        !residence ||
        !video_consent ||
        !concern_summary ||
        !payment_confirmed ||
        !userId
      ) {
        return reject(t.missingFields);
      }

      if (!validator.isEmail(email)) {
        return reject(t.invalidEmail);
      }

      if (!validator.isMobilePhone(whatsapp, "any")) {
        return reject(t.invalidWhatsapp);
      }

      // Vérifie que c’est un ObjectId valide
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return reject(t.invalidUserId);
      }

      // Détection XSS
      if (
        detectXSSDeep(name) ||
        detectXSSDeep(email) ||
        detectXSSDeep(whatsapp) ||
        detectXSSDeep(residence) ||
        detectXSSDeep(video_consent) ||
        detectXSSDeep(concern_summary) ||
        detectXSSDeep(diseases) ||
        detectXSSDeep(other_diseases) ||
        detectXSSDeep(payment_confirmed) ||
        detectXSSDeep(userId) ||
        detectXSSDeep(lang)
      ) {
        logAttack(
          "Tentative XSS détectée dans le formulaire Pre-rendez-vous",
          req,
          "xss"
        );
        return reject(t.xssDetected);
      }

      // Assainissement des données
      // Sanitize scalar inputs
      const sanitizedName = cleanText(name);
      const sanitizedEmail = validator.normalizeEmail(email || ""); // Garder validator pour l'email
      const sanitizedWhatsapp = cleanText(whatsapp);
      const sanitizedResidence = cleanText(residence);
      const sanitizedVideoConsent = cleanText(video_consent);
      const sanitizedConcernSummary = cleanText(concern_summary);
      const sanitizedOtherDiseases = cleanText(other_diseases);
      const sanitizedPaymentConfirmed = cleanText(payment_confirmed);

      // Sanitize diseases[]
      const sanitizedDiseases = Array.isArray(diseases)
        ? diseases.map((d) => cleanText(String(d)))
        : [];


        const newPreAppointment = new PreAppointmentSchema({
            userId,
            name: sanitizedName,
            email: sanitizedEmail,
            whatsapp: sanitizedWhatsapp,
            residence: sanitizedResidence,
            video_consent: sanitizedVideoConsent,
            diseases: sanitizedDiseases,
            other_diseases: sanitizedOtherDiseases,
            concern_summary: sanitizedConcernSummary,
            payment_confirmed: sanitizedPaymentConfirmed,
            isCompleted: true,
        });
        return newPreAppointment.save()
        .then((savedPreAppointment) => {
          // Retourner l'ID de l'enregistrement créé avec le message
          resolve({
            message: t.submitSuccess,
            id: savedPreAppointment._id,
          });
        })
        .catch((err) => {
          return reject(t.submitFail);
        });
    });
};

//kkkk
exports.BookAppointmentModel = ({lang,doctorSchedule,doctor,date,time,preappointmentId,userId,appointmentType,appointmentMode,scheduleId,req,}) => {
  return new Promise((resolve, reject) => {
     // === Traductions ===
    const messages = {
      en: {
        missing: "Missing or invalid appointment data.",
        invalidUserId: "Invalid user ID.",
        invalidPreAppId: "Invalid pre-appointment ID.",
        invalidScheduleId: "Invalid schedule ID.",
        missingType: "Appointment type must be specified.",
        missingMode: "Feeding mode must be specified.",
        xss: "Failed to book appointment.",
        preNotFound: "Pre-appointment not found.",
        scheduleNotFound: "Schedule not found in the database.",
        success: "Appointment successfully booked. Thank you.",
        fail: "Failed to book appointment.",
      },
      ar: {
        missing: "بيانات الحجز مفقودة أو غير صالحة",
        invalidUserId: "معرف المستخدم غير صالح",
        invalidPreAppId: "معرّف ما قبل الموعد غير صالح",
        invalidScheduleId: "معرف الجدول غير صالح",
        missingType: "يجب تحديد نوع الموعد",
        missingMode: "يجب تحديد وضع الرضاعة",
        xss: "فشل في حجز الموعد",
        preNotFound: "لم يتم العثور على ما قبل الموعد",
        scheduleNotFound: "لم يتم العثور على الجدول في قاعدة البيانات",
        success: "تم حجز الموعد بنجاح. شكرًا لك",
        fail: "فشل في حجز الموعد",
      },
    };

    const t = messages[lang] || messages["en"];

    if (!doctor ||!date ||!time ||!preappointmentId ||!userId || !scheduleId) {
      return reject(t.missing);
    }

     // Vérifie que c’est un ObjectId valide
     if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject(t.invalidUserId);
    }


    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(preappointmentId)) {
      return reject(t.invalidPreAppId);
    }

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
      return reject(t.invalidScheduleId);
    }

    //on vérifie que le type de rendez vous si'il  été défini
    if (!appointmentType){
      return reject(t.missingType);
    }

    // Si le type est "feeding", on vérifie que le mode a été défini
    if (appointmentType === "feeding" && !appointmentMode) {
      return reject(t.missingMode);
    }

    // Protection XSS (comme dans l'exemple précédent)
    if (
      detectXSSDeep(doctor) ||
      detectXSSDeep(date) ||
      detectXSSDeep(time) ||
      detectXSSDeep(preappointmentId) ||
      detectXSSDeep(userId) ||
      detectXSSDeep(scheduleId) ||
      detectXSSDeep(appointmentType) ||
      detectXSSDeep(appointmentMode)||
      detectXSSDeep(doctorSchedule)||
      detectXSSDeep(lang)
    ) {
      logAttack("Tentative XSS détectée dans le formulaire de rendez-vous", req, "xss");
      return reject(t.xss);
    }

      return PreAppointmentSchema.findById(preappointmentId)
      .then((preApp) => {
        if (!preApp) {
          return reject(t.preNotFound);
        }

        // Vérification que le planning existe bien
        return SchedulePerDoctorSchema.findById(scheduleId);
      })
      .then((scheduleDoc) => {
        if (!scheduleDoc) {
          return reject(t.scheduleNotFound);
        }

        // Enregistrer le rendez-vous avec appointmentType et appointmentMode
        const appointment = new AppointmentSchema({
          preAppointmentId: preappointmentId,
          scheduleId: scheduleId, //Rattache ce RDV au planning exact
          doctorName: doctor,
          appointmentDate: new Date(date),
          appointmentHour: time,
          status: "Pending",
          appointmentType: appointmentType, // Ajouter le type de rendez-vous
          appointmentMode: appointmentMode, // Ajouter le mode de rendez-vous
          isReviewed: false,
          archived: false
        });

        return appointment.save();
      })
      // AJOUT : mettre isCompleted à false dans le pré-rendez-vous
      .then(() => {
        return PreAppointmentSchema.updateOne(
          { _id: preappointmentId },
          { $set: { isCompleted: false } }
        );
      })
      // Mise à jour du planning
      .then(() => {
        // Convertir et mettre à jour le planning de médecin concernée
        const formattedScheduleArray = Object.entries(doctorSchedule.schedules).map(
            ([date, slots]) => ({
              date,
              available: slots.available || [],
              reserved: slots.reserved || [],
            })
          );
          
          return SchedulePerDoctorSchema.updateOne(
            { _id: doctorSchedule._id },
            { $set: { schedules: formattedScheduleArray } }
          );
      })
      .then(() => {
        resolve(t.success);
      })
      .catch((err) => {
        reject(t.fail);
      });
  });
};
  
  
/*----------------------------------- All Blogs ----------------------------------------*/


/*************** Nutrition Blogs ****************/

// kkkk
exports.getNutritionBlogsModel = (lang,userId,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    // === Messages d'erreur localisés ===
    const messages = {
      en: {
        invalidId: "Invalid user ID.",
        xssDetected: "Unauthorized access.",
        fail: "An error occurred while retrieving blogs."
      },
      ar: {
        invalidId: "معرّف المستخدم غير صالح",
        xssDetected: "دخول غير مصرح به",
        fail: "حدث خطأ أثناء استرجاع المقالات"
      }
    };

    const t = messages[lang] || messages['en']; // fallback en anglais

    if (!userId){
        return reject(t.invalidId);
    }

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject(t.invalidId);
    }

    // Détection XSS
    if (detectXSSDeep(userId) || detectXSSDeep(lang)) {
      logAttack("Tentative XSS détectée dans la page Nutrition Blogs",req,"xss");
      return reject(t.xssDetected);
    }
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (blogs nutrition)", req, "xss");
      return reject(t.xssDetected);
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (blogs nutrition)", req, "xss");
      return reject(t.xssDetected);
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
        reject(t.fail)
      });
  });
};



/********** Breastfeeding Blogs ****************/

//kkkk
exports.getBreastfeedingBlogsModel = (lang,userId,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    // === Messages d'erreur localisés ===
    const messages = {
      en: {
        invalidId: "Invalid user ID.",
        xssDetected: "Unauthorized access.",
        fail: "An error occurred while retrieving blogs."
      },
      ar: {
        invalidId: "معرّف المستخدم غير صالح",
        xssDetected: "دخول غير مصرح به",
        fail: "حدث خطأ أثناء استرجاع المقالات"
      }
    };

    const t = messages[lang] || messages['en']; // fallback en anglais

    if (!userId){
        return reject(t.invalidId);
    }

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject(t.invalidId);
    }

    // Détection XSS
    if (detectXSSDeep(userId) || detectXSSDeep(lang)) {
      logAttack("Tentative XSS détectée dans la page Breastfeeding Blogs",req,"xss");
      return reject(t.xssDetected);
    }
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (blogs feeding)", req, "xss");
      return reject(t.xssDetected);
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (blogs feeding)", req, "xss");
      return reject(t.xssDetected);
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
        reject(t.fail)
      });
  });
};


/************ Pediatrics Blogs *****************/

//kkkk
exports.getPediatricsBlogsModel = (lang,userId,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    // === Messages d'erreur localisés ===
    const messages = {
      en: {
        invalidId: "Invalid user ID.",
        xssDetected: "Unauthorized access.",
        fail: "An error occurred while retrieving blogs."
      },
      ar: {
        invalidId: "معرّف المستخدم غير صالح",
        xssDetected: "دخول غير مصرح به",
        fail: "حدث خطأ أثناء استرجاع المقالات"
      }
    };

    const t = messages[lang] || messages['en']; // fallback en anglais

    if (!userId){
        return reject(t.invalidId);
    }

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject(t.invalidId);
    }

    // Détection XSS
    if (detectXSSDeep(userId) || detectXSSDeep(lang)) {
      logAttack("Tentative XSS détectée dans la page Pediatrics Blogs",req,"xss");
      return reject(t.xssDetected);
    }
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (blogs Pediatrics)", req, "xss");
      return reject(t.xssDetected);
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (blogs Pediatrics)", req, "xss");
      return reject(t.xssDetected);
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
        reject(t.fail)
      });
  });
};


/************ General Blogs *****************/

// kkkk
exports.getGeneralBlogsModel = (lang,userId,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {

    // === Messages d'erreur localisés ===
    const messages = {
      en: {
        invalidId: "Invalid user ID.",
        xssDetected: "Unauthorized access.",
        fail: "An error occurred while retrieving blogs."
      },
      ar: {
        invalidId: "معرّف المستخدم غير صالح",
        xssDetected: "دخول غير مصرح به",
        fail: "حدث خطأ أثناء استرجاع المقالات"
      }
    };

    const t = messages[lang] || messages['en']; // fallback en anglais


    if (!userId){
      return reject(t.invalidId);
    }

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject(t.invalidId);
    }

    // Détection XSS
    if (detectXSSDeep(userId) || detectXSSDeep(lang)) {
      logAttack("Tentative XSS détectée dans la page general Blogs",req,"xss");
      return reject(t.xssDetected);
    }
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (blogs general)", req, "xss");
      return reject(t.xssDetected);
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (blogs general)", req, "xss");
      return reject(t.xssDetected);
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
       reject(t.fail)
      });
  });
};

/************ Mental-Health Blogs ***************/
// kkkk
exports.getMentalHealthBlogsModel = (lang,userId,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
   // === Messages d'erreur localisés ===
    const messages = {
      en: {
        invalidId: "Invalid user ID.",
        xssDetected: "Unauthorized access.",
        fail: "An error occurred while retrieving blogs."
      },
      ar: {
        invalidId: "معرّف المستخدم غير صالح",
        xssDetected: "دخول غير مصرح به",
        fail: "حدث خطأ أثناء استرجاع المقالات"
      }
    };

    const t = messages[lang] || messages['en']; // fallback en anglais


    if (!userId){
      return reject(t.invalidId);
    }

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject(t.invalidId);
    }

    // Détection XSS
    if (detectXSSDeep(userId) || detectXSSDeep(lang)) {
      logAttack("Tentative XSS détectée dans la page mental-health Blogs",req,"xss");
      return reject(t.xssDetected);
    }
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (blogs Mental-Health)", req, "xss");
      return reject(t.xssDetected);
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (blogs Mental-Health)", req, "xss");
      return reject(t.xssDetected);
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
        reject(t.fail)
      });
  });
};


/************ Parenting-advice Blogs ************/

// kkkk
exports.getParentingAdviceBlogsModel = (lang,userId,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    // === Messages d'erreur localisés ===
    const messages = {
      en: {
        invalidId: "Invalid user ID.",
        xssDetected: "Unauthorized access.",
        fail: "An error occurred while retrieving blogs."
      },
      ar: {
        invalidId: "معرّف المستخدم غير صالح",
        xssDetected: "دخول غير مصرح به",
        fail: "حدث خطأ أثناء استرجاع المقالات"
      }
    };

    const t = messages[lang] || messages['en']; // fallback en anglais

    if (!userId) {
      return reject(t.invalidId);
    }

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject(t.invalidId);
    }

    // Détection XSS
    if (detectXSSDeep(userId) || detectXSSDeep(lang)) {
      logAttack("Tentative XSS détectée dans la page Parenting-advice Blogs",req,"xss");
      return reject(t.xssDetected);
    }
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (blogs Parenting-advice)", req, "xss");
      return reject(t.xssDetected);
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (blogs Parenting-advice)", req, "xss");
      return reject(t.xssDetected);
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
        reject(t.fail)
      });
  });
};



/***************** Others Blogs ****************/

// kkkk
exports.getOthersBlogsModel = (lang,userId,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    // === Messages d'erreur localisés ===
    const messages = {
      en: {
        invalidId: "Invalid user ID.",
        xssDetected: "Unauthorized access.",
        fail: "An error occurred while retrieving blogs."
      },
      ar: {
        invalidId: "معرّف المستخدم غير صالح",
        xssDetected: "دخول غير مصرح به",
        fail: "حدث خطأ أثناء استرجاع المقالات"
      }
    };

    const t = messages[lang] || messages['en']; // fallback en anglais

    if (!userId) {
      return reject(t.invalidId);
    }

    // Vérifie que c’est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reject(t.invalidId);
    }

    // Détection XSS
    if (detectXSSDeep(userId) || detectXSSDeep(lang)) {
      logAttack("Tentative XSS détectée dans la page Others Blogs",req,"xss");
      return reject(t.xssDetected);
    }
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (blogs Others)", req, "xss");
      return reject(t.xssDetected);
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (blogs Others)", req, "xss");
      return reject(t.xssDetected);
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
        reject(t.fail)
      });
  });
};


/******************* details Blog **********************/
//kkkk
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
//kkkk
exports.addCommentModel = ({lang, blogId, commentText, userId, req }) => {
  return new Promise((resolve, reject) => {
    // === Dictionnaire de traduction ===
    const messages = {
      en: {
        invalidBlogId: "Invalid blog ID.",
        invalidUserId: "Invalid user ID.",
        emptyComment: "Comment cannot be empty.",
        xssError: "An error occurred while validating the comment.",
        success: "Comment successfully added.",
        failure: "Failed to add comment. Please try again."
      },
      ar: {
        invalidBlogId: "معرّف المدوّنة غير صالح",
        invalidUserId: "معرّف المستخدم غير صالح",
        emptyComment: "لا يمكن ترك التعليق فارغًا",
        xssError: "حدث خطأ أثناء التحقق من التعليق",
        success: "تمت إضافة التعليق بنجاح",
        failure: "فشل في إضافة التعليق. حاول مرة أخرى"
      }
    };

    const t = messages[lang] || messages["en"]; // fallback sur anglais

    // Basic validation
    if (!blogId || !mongoose.Types.ObjectId.isValid(blogId)) {
      return reject(t.invalidBlogId);
    }

    // Basic validation
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reject(t.invalidUserId);
    }

    if (!commentText || typeof commentText !== "string" || commentText.trim() === "") {
      return reject(t.emptyComment);
    }

    // XSS detection
    if (detectXSSDeep(blogId) || detectXSSDeep(commentText) || detectXSSDeep(userId) || detectXSSDeep(lang)) {
      logAttack("Tentative d'attaque XSS détectée dans un commentaire de blog", req, "xss");
      return reject(t.xssError);
    }

    // Sanitization
    const sanitizedComment = cleanText(commentText.trim());

    // Database connection
        // Add the comment
        return BlogInteraction.findOneAndUpdate(
          { blogId },
          {
            $push: {
              comments: {
                user: userId,
                text: sanitizedComment,
                createdAt: new Date(),
              }
            }
          },
          { upsert: true, new: true }
        )
      .then(() => {
        resolve(t.success);
      })
      .catch((err) => {
        reject(t.failure);
      });
  });
};



/************** ajouter sous commentaire *************/
//kkkk
exports.PostReplyCommentModel = ({lang,userId, blogId, commentId, replyText, req }) => {
  return new Promise((resolve, reject) => {
     // === Dictionnaire de traduction ===
    const messages = {
      en: {
        invalidBlogId: "Invalid blog ID.",
        invalidCommentId: "Invalid comment ID.",
        invalidUserId: "Invalid user ID.",
        emptyReply: "Reply cannot be empty.",
        xssError: "An error occurred while validating the reply.",
        success: "Reply successfully added.",
        failure: "Failed to add reply. Please try again.",
        commentNotFound: "Comment not found or blog does not exist."
      },
      ar: {
        invalidBlogId: "معرّف المدوّنة غير صالح",
        invalidCommentId: "معرّف التعليق غير صالح",
        invalidUserId: "معرّف المستخدم غير صالح",
        emptyReply: "لا يمكن ترك الرد فارغًا",
        xssError: "حدث خطأ أثناء التحقق من الرد",
        success: "تمت إضافة الرد بنجاح",
        failure: "فشل في إضافة الرد. حاول مرة أخرى",
        commentNotFound: "لم يتم العثور على التعليق أو التدوينة غير موجودة"
      }
    };

    const t = messages[lang] || messages["en"]; // fallback sur anglais

    // --- 1. Validation des données ---
    if (!blogId || !mongoose.Types.ObjectId.isValid(blogId)) {
      return reject(t.invalidBlogId);
    }

    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      return reject(t.invalidCommentId);
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reject(t.invalidUserId);
    }

    if (!replyText || typeof replyText !== "string" || replyText.trim() === "") {
      return reject(t.emptyReply);
    }

    // --- 2. Protection contre XSS ---
    if (
      detectXSSDeep(blogId) ||
      detectXSSDeep(commentId) ||
      detectXSSDeep(replyText) ||
      detectXSSDeep(userId) ||
      detectXSSDeep(lang)
    ) {
      logAttack("Tentative d'attaque XSS détectée dans une réponse",req,"xss");
      return reject(t.xssError);
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
              },
            },
          },
          { new: true }
        )
      .then((updatedDoc) => {

        if (!updatedDoc) {
          return reject(t.commentNotFound);
        }

        resolve(t.success);
      })
      .catch((err) => {
        reject(t.failure);
      });
  });
};


/************ supprimer un commentaire **********/
//kkkk
exports.deleteCommentModel = ({lang, userId, blogId, commentId, req }) => {
  return new Promise((resolve, reject) => {
    // === Dictionnaire de messages ===
    const messages = {
      en: {
        invalidUserId: "Invalid user ID.",
        invalidBlogId: "Invalid blog ID.",
        invalidCommentId: "Invalid comment ID.",
        xssError: "An error occurred while validating the data.",
        notFound: "Blog or comment not found.",
        success: "Comment successfully deleted.",
        failure: "Failed to delete comment. Please try again.",
      },
      ar: {
        invalidUserId: "معرّف المستخدم غير صالح",
        invalidBlogId: "معرّف التدوينة غير صالح",
        invalidCommentId: "معرّف التعليق غير صالح",
        xssError: "حدث خطأ أثناء التحقق من البيانات",
        notFound: "لم يتم العثور على التدوينة أو التعليق",
        success: "تم حذف التعليق بنجاح",
        failure: "فشل في حذف التعليق. حاول مرة أخرى",
      },
    };
    const t = messages[lang] || messages["en"];

    // Validation des IDs
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reject(t.invalidUserId);
    }

    if (!blogId || !mongoose.Types.ObjectId.isValid(blogId)) {
      return reject(t.invalidBlogId);
    }
    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      return reject(t.invalidCommentId);
    }

    // Protection contre XSS (au cas où tu utilises la variable)
    if (detectXSSDeep(blogId) || detectXSSDeep(commentId) || detectXSSDeep(userId) || detectXSSDeep(lang)) {
      logAttack("Tentative d'attaque XSS détectée dans suppression commentaire", req, "xss");
      return reject(t.xssError);
    }

        // Mise à jour : suppression du commentaire dans le tableau comments
      return BlogInteraction.findOneAndUpdate(
          { blogId },
          { $pull: { comments: { _id: commentId } } },
          { new: true }
      )
      .then((updatedDoc) => {
        if (!updatedDoc) {
          return reject(t.notFound);
        }
        resolve(t.success);
      })
      .catch(err => {
        reject(t.failure);
      });
  });
};


/*************** supprimer une réponse **********/
//kkkk
exports.deleteReplyModel = ({lang, userId, blogId, commentId, replyId, req }) => {
  return new Promise((resolve, reject) => {
    // === Dictionnaire de messages ===
    const messages = {
      en: {
        invalidUserId: "Invalid user ID.",
        invalidBlogId: "Invalid blog ID.",
        invalidCommentId: "Invalid comment ID.",
        invalidReplyId: "Invalid reply ID.",
        xssError: "An error occurred while validating the data.",
        notFound: "Reply not found or already deleted.",
        success: "Reply successfully deleted.",
        failure: "Failed to delete reply. Please try again.",
      },
      ar: {
        invalidUserId: "معرّف المستخدم غير صالح",
        invalidBlogId: "معرّف التدوينة غير صالح",
        invalidCommentId: "معرّف التعليق غير صالح",
        invalidReplyId: "معرّف الرد غير صالح",
        xssError: "حدث خطأ أثناء التحقق من البيانات",
        notFound: "لم يتم العثور على الرد أو تم حذفه بالفعل",
        success: "تم حذف الرد بنجاح",
        failure: "فشل في حذف الرد. حاول مرة أخرى",
      },
    };
    const t = messages[lang] || messages["en"];

    // === Validation des IDs ===
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reject(t.invalidUserId);
    }
    if (!blogId || !mongoose.Types.ObjectId.isValid(blogId)) {
      return reject(t.invalidBlogId);
    }
    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      return reject(t.invalidCommentId);
    }
    if (!replyId || !mongoose.Types.ObjectId.isValid(replyId)) {
      return reject(t.invalidReplyId);
    }

    // Sécurité contre XSS
    if (detectXSSDeep(blogId) || detectXSSDeep(commentId) || detectXSSDeep(replyId) || detectXSSDeep(userId) || detectXSSDeep(lang)) {
      logAttack("Tentative XSS détectée dans suppression réponse", req, "xss");
      return reject(t.xssError);
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
          return reject(t.notFound);
        }
        resolve(t.success);
      })
      .catch((err) => {
        return reject(t.failure);
      });
  });
};




/*----------------------------------- All Blogs ----------------------------------------*/



/*--------------------------------- Book Appoitement -----------------------------------*/



/*-------------------------------------- Contact --------------------------------------*/

/*********************** Contact Admin From Parent ***************/
//kkkk
exports.ContactFormModel = ({lang, name, email, phone, subject, message, req }) => {
  return new Promise((resolve, reject) => {
    // === Messages multilingues ===
    const messages = {
      en: {
        required: "All fields are required.",
        invalidEmail: "Invalid email format.",
        invalidPhone: "Invalid phone number.",
        xss: "Failed to send your message. Please try again later.",
        success: "Your message has been sent successfully.",
        fail: "Failed to send your message. Please try again later.",
      },
      ar: {
        required: "جميع الحقول مطلوبة",
        invalidEmail: "تنسيق البريد الإلكتروني غير صالح",
        invalidPhone: "رقم الهاتف غير صالح",
        xss: "فشل في إرسال رسالتك. حاول مرة أخرى لاحقًا",
        success: "تم إرسال رسالتك بنجاح",
        fail: "فشل في إرسال رسالتك. حاول مرة أخرى لاحقًا",
      },
    };

    const t = messages[lang] || messages.en;

    // Vérification de base
    if (!name || !email || !phone || !subject || !message) {
      return reject(t.required);
    }

    if (!validator.isEmail(email)) {
      return reject(t.invalidEmail);
    }

    if (!validator.isMobilePhone(phone, "any")) {
      return reject(t.invalidPhone);
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
      return reject(t.xss);
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
        resolve(t.success)
      })
      .catch((err) => {
        return reject(t.fail)
      });
  });
};