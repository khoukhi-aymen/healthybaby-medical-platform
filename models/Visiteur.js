const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const validator = require('validator');
const sanitizeHtml = require('sanitize-html');
const path = require("path");
const logAttack = require("../helpers/logger");
const User = require("./Schémas/User.model");
const BlogSchema = require("../models/Schémas/DoctorBlog.model");
const BlogInteraction = require("../models/Schémas/Comments.model");
const Contact = require("./Schémas/Contact.model");
const TestimonialSchema = require("../models/Schémas/testimonial.model");



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
    /Function\(/gi
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


/****************** oublie mot de passe ******************/
// kkkk
exports.ForgotPasswordModel = ({ email, lang, req }) => {
  return new Promise((resolve, reject) => {
    // === Lang messages ===
    const messages = {
      en: {
        invalidEmail: "Please enter a valid email.",
        xssDetected: "Invalid input detected.",
        notFound: "No account with that email was found.",
        success: "A password reset link has been sent to your email.",
        fail: "Error sending reset link. Please try again."
      },
      ar: {
        invalidEmail: "يرجى إدخال بريد إلكتروني صالح",
        xssDetected: "تم اكتشاف إدخال غير صالح",
        notFound: "لم يتم العثور على حساب بهذا البريد الإلكتروني",
        success: "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني",
        fail: "حدث خطأ أثناء إرسال رابط إعادة التعيين. حاول مرة أخرى"
      }
    };

    const t = messages[lang] || messages["en"];

    if (!email || !validator.isEmail(email)) {
      return reject(t.invalidEmail);
    }

    if (detectXSSDeep(email) || detectXSSDeep(lang)) {
      logAttack("Tentative de XSS dans l'email du mot de passe oublié", req, "xss");
      return reject(t.xssDetected);
    }

    const sanitizedEmail = validator.normalizeEmail(email);

      User.findOne({ email: sanitizedEmail })
      .then(user => {
        if (!user) {
         return reject(t.notFound);
        }

        // Générer token sécurisé
        const token = crypto.randomBytes(32).toString("hex");
        const expire = Date.now() + 3600000; // 1h

        user.resetPasswordToken = token;
        user.resetPasswordExpires = expire;

        return user.save();
      })
      .then((updatedUser) => {
       const resetLink = `${process.env.RESET_URL}/${updatedUser.resetPasswordToken}`;
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });


        const mailOptions = {
          to: updatedUser.email,
          from: `"Mommy & Me" <${process.env.EMAIL_USER}>`,
          subject: "🔐 Password Reset Request",
          html: `
            <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
              <div style="max-width: 600px; margin: auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <h2 style="color: #333;">Hi ${updatedUser.full_name},</h2>
                <p style="color: #555; font-size: 16px;">
                  We received a request to reset your password for your <strong>Mommy & Me</strong> account.
                </p>
                <p style="color: #555; font-size: 16px;">
                  To proceed, simply click the button below:
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetLink}" style="background-color: #007bff; color: #fff; padding: 14px 24px; border-radius: 5px; text-decoration: none; font-weight: bold;">
                    Reset Password
                  </a>
                </div>
                <p style="color: #999; font-size: 14px;">
                  This link will expire in 1 hour. If you didn’t request this, please ignore this email — your account is safe.
                </p>
                <hr style="margin: 40px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #aaa; font-size: 13px; text-align: center;">
                  © ${new Date().getFullYear()} Mommy & Me. All rights reserved.
                </p>
              </div>
            </div>
          `,
        };


        return transporter.sendMail(mailOptions);
      })
      .then(() => {
        resolve(t.success);
      })
      .catch(err => {
        console.error(err);
        reject(t.fail);
      });
  });
};

/*********************** reset mot de passe ***********************/
// kkkk
exports.GetResetPasswordModel = ({ token, req }) => {
  return new Promise((resolve, reject) => {
    if (!token || typeof token !== "string" || detectXSSDeep(token)) {
      logAttack("Tentative de XSS ou jeton de réinitialisation invalide détecté", req, "xss");
      return reject("Invalid password reset link.");
    }

      User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
      })
      .then(user => {

        if (!user) {
          return reject("Password reset link is invalid or has expired.");
        }

        resolve(user); // suffisant pour afficher la vue
      })
      .catch(err => {
        reject("An error occurred. Please try again later.");
      });
  });
};

// kkkk
exports.ResetPasswordModel = ({lang, token, password, confirmPassword, req }) => {
  return new Promise((resolve, reject) => {
    // === Lang messages ===
    const messages = {
      en: {
        invalidData: "Invalid data.",
        passwordMismatch: "Passwords do not match.",
        weakPassword: "Password must be at least 8 characters.",
        passwordComplexity: "Password must contain at least one uppercase letter, one lowercase letter, and one number.",
        invalidLink: "Reset link is invalid or expired.",
        success: "Password reset successful. Please login...",
        fail: "Something went wrong. Try again later."
      },
      ar: {
        invalidData: "بيانات غير صالحة",
        passwordMismatch: "كلمتا المرور غير متطابقتين",
        weakPassword: "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل",
        passwordComplexity: "يجب أن تحتوي كلمة المرور على حرف كبير، حرف صغير ورقم",
        invalidLink: "رابط إعادة التعيين غير صالح أو منتهي الصلاحية",
        success: "...تمت إعادة تعيين كلمة المرور بنجاح. الرجاء تسجيل الدخول",
        fail: "حدث خطأ ما. حاول مرة أخرى لاحقًا"
      }
    };

    const t = messages[lang] || messages['en'];
    if (!token ||typeof token !== "string" || detectXSSDeep(token) ||detectXSSDeep(password) ||detectXSSDeep(confirmPassword) || detectXSSDeep(lang)) {
      logAttack("Tentative XSS ou données invalides dans reset-password POST", req, "xss");
      return reject(t.invalidData);
    }

    if (password !== confirmPassword) {
      return reject(t.passwordMismatch);
    }

    
    if (password.length < 8) {
      return reject(t.weakPassword);
    }

    // Vérification complexité : majuscule, minuscule, chiffre
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!strongPasswordRegex.test(password)) {
     return reject(t.passwordComplexity);
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

      User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
      })
      .then(user => {
        if (!user) {
          return reject(t.invalidLink);
        }

        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        return user.save().then(() => {
          resolve(t.success);
        });
      })
      .catch(err => {
        reject(t.fail);
      });
  });
};


/************************ Home ***********************/
// kkkk
exports.getApprovedTestimonials = (req) => {
  return new Promise((resolve, reject) => {
    TestimonialSchema.aggregate([
      { $match: { status: "Approved" } },
      { $sample: { size: 20 } }
    ])
      .then((testimonials) => {
        resolve(testimonials);
      })
      .catch((err) => {
        reject("Unable to load testimonials.");
      });
  });
};



/************************ Register ***********************/
// kkkk
exports.RegisterUserModel = ({lang,role,full_name,email,password,Speciality,medical_license,diploma,isAdmin,req}) => {
  return new Promise((resolve, reject) => {
    // === Lang messages ===
    const messages = {
      en: {
        invalidEmail: "Invalid credentials.",
        weakPassword: "Password must be at least 8 characters long.",
        passwordComplexity: "Password must contain at least one uppercase letter, one lowercase letter, and one number.",
        invalidRole: "Invalid user role.",
        invalidFile: "Invalid file type. Only PDF, JPG, JPEG, and PNG are allowed.",
        fileTooLarge: "Diploma is too large. Maximum size allowed is 2MB.",
        xssError: "Registration failed. Please try again.",
        emailExists: "This email is already in use.",
        success: "You have registered successfully. Please wait for an admin to activate your account.",
        fail: "Registration failed. Please try again."
      },
      ar: {
        invalidEmail: "معلومات تسجيل الدخول غير صالحة",
        weakPassword: "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل",
        passwordComplexity: "يجب أن تحتوي كلمة المرور على حرف كبير، حرف صغير ورقم على الأقل",
        invalidRole: "دور المستخدم غير صالح",
        invalidFile: "PDF، JPG، JPEG  نوع الملف غير مسموح. يُقبل فقط",
        fileTooLarge: "الملف كبير جدًا. الحد الأقصى هو 2 ميغابايت",
        xssError: "فشل التسجيل. حاول مرة أخرى",
        emailExists: "هذا البريد الإلكتروني مستخدم بالفعل",
        success: "تم التسجيل بنجاح. الرجاء الانتظار حتى يتم تفعيل حسابك",
        fail: "فشل التسجيل. حاول مرة أخرى"
      }
    };

    const t = messages[lang] || messages['en'];
    //Validation basique de l'email
    if (!email || !validator.isEmail(email)) {
      return reject(t.invalidEmail);
    }

    // Vérification du mot de passe fort
    if (!password || password.length < 8) {
      return reject(t.weakPassword);
    }

    // Expression régulière pour vérifier la complexité du mot de passe
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

    if (!strongPasswordRegex.test(password)) {
      return reject(t.passwordComplexity);
    }

    //Vérification du rôle
    if (!["doctor", "parent"].includes(role)) {
      return reject(t.invalidRole);
    }

    //Vérification du fichier uploadé
    if (diploma) {
      const allowedExtensions = [".pdf", ".jpg", ".jpeg", ".png"];
      const fileExtension = path.extname(diploma.originalname).toLowerCase();
      if (!allowedExtensions.includes(fileExtension)) {
        logAttack(
          "Tentative XSS détectée dans le formulaire d'inscription(fichier .js détécté)",
          req,
          "xss"
        );
        return reject(t.invalidFile);
      }

      // Vérification de la taille du fichier (max 2 Mo)
      const maxSize = 2 * 1024 * 1024; // 2 Mo en octets
      if (diploma.size > maxSize) {
        return reject(t.fileTooLarge);
      }
    }

    // Détection XSS avant nettoyage
    if (
      detectXSSDeep(full_name) ||
      detectXSSDeep(Speciality) ||
      detectXSSDeep(medical_license) ||
      detectXSSDeep(diploma) ||
      detectXSSDeep(role) ||
      detectXSSDeep(isAdmin) ||
      detectXSSDeep(password) ||
      detectXSSDeep(email)||
      detectXSSDeep(lang)
    ) {
      logAttack("Tentative XSS détectée dans le formulaire d'inscription",req,"xss");
      return reject(t.xssError);
    }

    // Assainissement XSS de tous les champs texte
    const sanitizedFullName = cleanText(full_name);
    const sanitizedEmail = validator.normalizeEmail(email);
    const sanitizedSpeciality = cleanText(Speciality);
    const sanitizedLicense = cleanText(medical_license);
    const rawPassword = password;
    const sanitizedDiploma = diploma ? cleanText(diploma.filename || "") : "";

      User.findOne({ email: sanitizedEmail })
      .then((existingUser) => {
        if (existingUser) {
          return reject(t.emailExists);
        }
        return bcrypt.hash(rawPassword, 10);
      })
      .then((hashedPassword) => {
        if (!hashedPassword) return;

        const newUser = new User({
          full_name: sanitizedFullName,
          email: sanitizedEmail,
          password: hashedPassword,
          role,
          Speciality: role === "doctor" ? sanitizedSpeciality : "",
          medical_license: role === "doctor" ? sanitizedLicense : "",
          diploma: role === "doctor" ? sanitizedDiploma : "",
          isAdmin,
          status: "Pending",
          createdAt: new Date(),
        });

        return newUser.save();
      })
      .then(() => {
         resolve(t.success);
      })
      .catch((err) => {
        reject(t.fail);
      });
  });
};


/************************ login ***********************/
// kkkk
exports.LoginUserModel = (lang,email, password,req) => {
  return new Promise((resolve, reject) => {
    // === Lang messages ===
    const messages = {
      en: {
        invalidEmail: "Invalid credentials.",
        missingFields: "Email and password are required.",
        xssError: "An error occurred during login. Please try again.",
        inactive: "Please wait for activation...",
        locked: "Account is locked. Try again in 2 minutes.",
        fail: "An error occurred during login. Please try again."
      },
      ar: {
        invalidEmail: "معلومات تسجيل الدخول غير صالحة",
        missingFields: "البريد الإلكتروني وكلمة المرور مطلوبان",
        xssError: "حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى",
        inactive: " ...يرجى الانتظار حتى يتم تفعيل حسابك ",
        locked: "تم قفل الحساب. حاول مرة أخرى بعد دقيقتين",
        fail: "حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى"
      }
    };

    const t = messages[lang] || messages['en'];

    // Sécurisation : Validation de l'email(pour ne pas injecter de code js dans le champ email ==> (XSS))
    if (!email || !validator.isEmail(email)) {
      return reject(t.invalidEmail);
    }

    if (!email || !password) {
      return reject(t.missingFields);
    }
    


    // Détection XSS avant nettoyage
    if (
      detectXSSDeep(password) ||
      detectXSSDeep(email) ||
      detectXSSDeep(lang)
    ) {
      logAttack(
        "Tentative XSS détectée dans le formulaire de connexion",
        req,
        "xss"
      );
      return reject(t.xssError);
    }

    // Sécurisation : Assainir le mot de passe pour éviter des attaques XSS
    const LoginPassword = password;
    const sanitizedEmail = validator.normalizeEmail(email); // pour email c'est mieux normalize

      User.findOne({ email: sanitizedEmail })
      .then((user) => {
        if (!user) {
          return bcrypt
            .compare(LoginPassword, "$2b$10$dummyhash.....") // Empêche le timing attack
            .then(() => {
              return reject(t.invalidEmail);
            });
        }

        // Vérification si le compte est activé
        if (user.status !== "Active") {
          return reject(t.inactive);
        }

        //Si le compte est toujours bloqué
        if (user.lockUntil && user.lockUntil > Date.now()) {
          return reject(t.locked);
        }

        //Si le blocage est expiré, on réinitialise les tentatives
        if (user.lockUntil && user.lockUntil <= Date.now()) {
          user.loginAttempts = 0;
          user.lockUntil = undefined;
          return user.save().then(() => {
            // On continue la vérification du mot de passe après déblocage
            return bcrypt
              .compare(LoginPassword, user.password)
              .then((isMatch) => {
                if (isMatch) {
                  return resolve(user);
                } else {
                  user.loginAttempts = 1; // Nouvelle tentative après déblocage
                  return user.save().then(() => {
                    return reject(t.invalidEmail);
                  });
                }
              });
          });
        }

        //Vérification du mot de passe si pas bloqué
        return bcrypt.compare(LoginPassword, user.password).then((isMatch) => {
          if (isMatch) {
            // Réinitialiser les tentatives si succès
            user.loginAttempts = 0;
            user.lockUntil = undefined;
            return user.save().then(() => {
              return resolve(user);
            });
          } else {
            // Tentative échouée → Incrémentation
            user.loginAttempts = (user.loginAttempts || 0) + 1;

            // Bloquer le compte après 3 tentatives
            if (user.loginAttempts >= 3) {
              user.lockUntil = new Date(Date.now() + 60 * 2000); // 2 heure
            }

            return user.save().then(() => {
              return reject(t.invalidEmail);
            });
          }
        });
      })
      .catch((err) => {
        reject(t.fail);
      });
  });
};


/************************************* Blogs **********************************/


/*************** Nutrition Blogs ****************/
// kkkk
exports.getNutritionBlogsModel = (lang,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    // === Messages d'erreur selon la langue ===
    const messages = {
      en: {
        fail: "An error occurred while retrieving blogs."
      },
      ar: {
        fail: "حدث خطأ أثناء استرجاع المقالات"
      }
    };

    const t = messages[lang] || messages['en']; // fallback anglais

    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack(
        "Tentative XSS détectée dans le startDate (blogs nutrition)",
        req,
        "xss"
      );
       return reject(t.fail);
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack(
        "Tentative XSS détectée dans le endDate (blogs nutrition)",
        req,
        "xss"
      );
      return reject(t.fail);
    }

    // Nettoyage avec cleanText (aucune balise ni attribut autorisé)
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";

    let query = {
      category: "nutrition", // Toujours filtrer par catégorie 'nutrition'
      status: "Approved", // Facultatif mais recommandé pour ne pas renvoyer les blogs en attente ou rejetés
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
        reject(t.fail);
      });
  });
};


/*************** General Blogs ****************/
// kkkk
exports.getGeneralBlogsModel = (lang,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    // === Messages d'erreur selon la langue ===
    const messages = {
      en: {
        fail: "An error occurred while retrieving blogs."
      },
      ar: {
        fail: "حدث خطأ أثناء استرجاع المقالات"
      }
    };

    const t = messages[lang] || messages['en']; // fallback anglais

    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack(
        "Tentative XSS détectée dans le startDate (blogs general)",
        req,
        "xss"
      );
      return reject(t.fail);
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack(
        "Tentative XSS détectée dans le endDate (blogs general)",
        req,
        "xss"
      );
      return reject(t.fail);
    }

    // Nettoyage avec cleanText (aucune balise ni attribut autorisé)
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";

    let query = {
      category: "general", // Toujours filtrer par catégorie 'general'
      status: "Approved", // Facultatif mais recommandé pour ne pas renvoyer les blogs en attente ou rejetés
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
        return reject(t.fail);
      });
  });
};


/*************** mental-health Blogs ****************/
// kkkk
exports.getMentalHealthBlogsModel = (lang,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    // === Messages d'erreur selon la langue ===
    const messages = {
      en: {
        fail: "An error occurred while retrieving blogs."
      },
      ar: {
        fail: "حدث خطأ أثناء استرجاع المقالات"
      }
    };

    const t = messages[lang] || messages['en']; // fallback anglais
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (blogs mental-health)", req, "xss");
      return reject(t.fail);
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (blogs mental-health)", req, "xss");
      return reject(t.fail);
    }

    // Nettoyage avec cleanText (aucune balise ni attribut autorisé)
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";

     let query = {
      category: "mental-health", // Toujours filtrer par catégorie 'mental-health'
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
        return reject(t.fail);
      });
  });
};

/*************** BreastFeeding Blogs ****************/
// kkkk
exports.getBreastFeedingBlogsModel = (lang,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    // === Messages d'erreur selon la langue ===
    const messages = {
      en: {
        fail: "An error occurred while retrieving blogs."
      },
      ar: {
        fail: "حدث خطأ أثناء استرجاع المقالات"
      }
    };

    const t = messages[lang] || messages['en']; // fallback anglais
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (blogs feeding)", req, "xss");
      return reject(t.fail);
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (blogs feeding)", req, "xss");
      return reject(t.fail);
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
        return reject(t.fail);
      });
  });
};


/*************** Pediatrics Blogs ****************/
// kkkk
exports.getPediatricsBlogsModel = (lang,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
     // === Messages d'erreur selon la langue ===
    const messages = {
      en: {
        fail: "An error occurred while retrieving blogs."
      },
      ar: {
        fail: "حدث خطأ أثناء استرجاع المقالات"
      }
    };

    const t = messages[lang] || messages['en']; // fallback anglais
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack(
        "Tentative XSS détectée dans le startDate (blogs pediatrics)",
        req,
        "xss"
      );
      return reject(t.fail);
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack(
        "Tentative XSS détectée dans le endDate (blogs pediatrics)",
        req,
        "xss"
      );
      return reject(t.fail);
    }
    
    // Nettoyage avec cleanText (aucune balise ni attribut autorisé)
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";

    let query = {
      category: "pediatrics", // Toujours filtrer par catégorie 'pediatrics'
      status: "Approved", // Facultatif mais recommandé pour ne pas renvoyer les blogs en attente ou rejetés
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
        return reject(t.fail);
      });
  });
};


/*************** Parenting-advice Blogs ****************/
// kkkk
exports.getParentingAdviceBlogsModel = (lang,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    // === Messages d'erreur selon la langue ===
    const messages = {
      en: {
        fail: "An error occurred while retrieving blogs."
      },
      ar: {
        fail: "حدث خطأ أثناء استرجاع المقالات"
      }
    };

    const t = messages[lang] || messages['en']; // fallback anglais
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (blogs parenting-advice)", req, "xss");
      return reject(t.fail);
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (blogs parenting-advice)", req, "xss");
      return reject(t.fail);
    }

    // Nettoyage avec cleanText (aucune balise ni attribut autorisé)
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";

     let query = {
      category: "parenting-advice", // Toujours filtrer par catégorie 'parenting-advice'
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
        return reject(t.fail);
      });
  });
};


/******************* other Blogs ***********************/
// kkkk
exports.getOthersBlogsModel = (lang,startDate, endDate, req) => {
  return new Promise((resolve, reject) => {
    // === Messages d'erreur selon la langue ===
    const messages = {
      en: {
        fail: "An error occurred while retrieving blogs."
      },
      ar: {
        fail: "حدث خطأ أثناء استرجاع المقالات"
      }
    };

    const t = messages[lang] || messages['en']; // fallback anglais
    // Vérifie et nettoie les dates
    if (startDate && detectXSSDeep(startDate)) {
      logAttack("Tentative XSS détectée dans le startDate (other blogs)", req, "xss");
      return reject(t.fail);
    }

    if (endDate && detectXSSDeep(endDate)) {
      logAttack("Tentative XSS détectée dans le endDate (other blogs)", req, "xss");
      return reject(t.fail);
    }

    // Nettoyage avec cleanText (aucune balise ni attribut autorisé)
    const sanitizedStartDate = startDate ? cleanText(startDate) : "";
    const sanitizedEndDate = endDate ? cleanText(endDate) : "";

     let query = {
      category: "others", // Toujours filtrer par catégorie 'others'
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
        return reject(t.fail);
      });
  });
};

/******************* details Blog **********************/
// kkkk
exports.getBlogByblogIDModel = (blogID, req) => {
  return new Promise((resolve, reject) => {
    // Validation de l'ID
    if (!blogID) return reject("Blog ID is required.");

    if (!mongoose.Types.ObjectId.isValid(blogID)) {
      return reject("Invalid Blog ID.");
    }

    if (detectXSSDeep(blogID)) {
      logAttack("Tentative de XSS détectée dans blogID", req, "xss");
      return reject("An error occurred while retrieving the blog.");
    }

    const sanitizedBlogID = blogID; // blogID est déjà validé comme un ObjectId

    // Récupération du blog et des commentaires uniquement
    return Promise.all([
      BlogSchema.findById(sanitizedBlogID),
      BlogInteraction.findOne({ blogId: sanitizedBlogID })
        .populate("comments.user")
        .populate("comments.replies.user"),
    ])
      .then(([blog, interaction]) => {

        if (!blog) {
          return reject("Blog not found.");
        }

        // Récupérer uniquement les commentaires
        const comments = interaction?.comments || [];

        resolve({ blog, comments });
      })
      .catch((err) => {
        reject("An error occurred while retrieving the blog.");
      });
  });
};


/************************ Contact ***********************/
// kkkk
exports.ContactFormModel = ({lang, name, email, phone, subject, message, req }) => {
  return new Promise((resolve, reject) => {
     // === Messages selon la langue ===
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
      detectXSSDeep(message) ||
      detectXSSDeep(lang)
    ) {
      logAttack(
        "Tentative XSS détectée dans le formulaire de contact",
        req,
        "xss"
      );
      return reject(t.xss);
    }

    // Assainissement avec cleanText
    const sanitizedName = cleanText(name);
    const sanitizedEmail = validator.normalizeEmail(email);
    const sanitizedPhone = cleanText(phone);
    const sanitizedSubject = cleanText(subject);
    const sanitizedMessage = cleanText(message);

    // Création et enregistrement sans gestion de connexion ici
    const newContact = new Contact({
      name: sanitizedName,
      email: sanitizedEmail,
      phone: sanitizedPhone,
      subject: sanitizedSubject,
      message: sanitizedMessage,
    });

    newContact
      .save()
      .then(() => {
        resolve(t.success);
      })
      .catch((err) => {
        reject(t.fail);
      });
  });
};







  