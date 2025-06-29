const ParentModel = require("../models/Parent")


/*-------------------------------------- My Appoitmetns --------------------------------*/


/*********************** My Appoitements ***************/
exports.getMyAppoitementsPage = (req, res, next) => {
    const userId = req.session.userID;
    // Vérifie si les dates sont présentes dans req.body, sinon utilise les 100 derniers blogs
    let { startDate, endDate,lang } = req.body || {};

    // Si startDate et endDate ne sont pas définies, récupérer les 100 derniers blogs
    if (!startDate || !endDate) {
      startDate = null; // On ne filtre pas par date
      endDate = null; // On ne filtre pas par date
    }

  ParentModel.getUserAppointmentsModel({lang,userId,startDate,endDate, req })
    .then((appointments) => {
      // console.log(appointments);
      res.render("dahbordPatient/MyAppoitements/MyAppoitements", {
        appointments: appointments,
        startDate,
        endDate,
        message: null
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordPatient/MyAppoitements/MyAppoitements", {
        appointments: [],
        startDate,
        endDate,
        message: req.flash("msg")[0]
      });
    });
};


exports.postMyAppointmentsPage = (req, res, next) => {
  const userId = req.session.userID;
  const { startDate, endDate } = req.body;
  const lang = req.body.lang || 'en';

  ParentModel.getUserAppointmentsModel({lang, userId, startDate, endDate, req })
    .then((appointments) => {
      res.render("dahbordPatient/MyAppoitements/MyAppoitements", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        appointments,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken(),
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/MyApp"); // Redirection vers elle-même avec message flash
    });
};

/*********************** pré-appointment ***************/

exports.PreAppointmentDetails = (req, res) => {
  const preId = req.params.id; // Récupérer l'ID de la pré-appointment
  const lang = req.body.lang || 'en';

  // Appeler la fonction du modèle avec les paramètres nécessaires
  ParentModel.getPreAppointmentById({lang, preId, req })
    .then(preAppointment => {
      // Si la pré-appointment est trouvée, retourner les détails
      res.json({
        success: true,
        name: preAppointment.name,
        email: preAppointment.email,
        whatsapp: preAppointment.whatsapp,
        residence: preAppointment.residence,
        video_consent: preAppointment.video_consent,
        diseases: preAppointment.diseases,
        other_diseases: preAppointment.other_diseases || 'None',
        concern_summary: preAppointment.concern_summary,
        payment_confirmed: preAppointment.payment_confirmed || 'No'
      });
    })
    .catch(err => {
      res.json({ success: false, message: err })
    });
};

/*********************** Leave Testimonial  ***************/
exports.getLeaveTestimonialPage = (req, res, next) => {
  const appointmentId = req.params.appointmentId;
  const message = req.flash("msg")[0]; // récupère le message flash
  res.render("dahbordPatient/MyAppoitements/Témoignage", {
    appointmentId,
    message
  });
};


exports.PostLeaveTestimonial = (req, res, next) => {
  const image = req.file;
  const { message, name } = req.body;
  const appointmentId = req.params.appointmentId;
  const lang = req.body.lang || 'en';

  ParentModel.LeaveTestimonialModel({lang, name, message, image, appointmentId, req })
    .then((msg) => {
      req.flash("msg", msg);
      res.redirect("/LeaveTestimonial/" + appointmentId);
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/LeaveTestimonial/" + appointmentId);
    });
};



/*********************** delete Appoitment  ***************/
exports.DeleteAppoitment = (req, res, next) => {
  const { appointmentId } = req.params;
  const userId = req.session.userID;
  const {preAppointmentId,scheduleId,doctorName,appointmentDate,appointmentHour} = req.body;
  const lang = req.body.lang || 'en';

  // === Dictionnaire des messages ===
  const messages = {
    en: {
      missingFields: "Missing required fields"
    },
    ar: {
      missingFields: "الحقول المطلوبة مفقودة"
    }
  };

  const t = messages[lang] || messages.en;

  if (!appointmentId || !preAppointmentId || !scheduleId || !doctorName || !appointmentDate || !appointmentHour) {
    return res.status(400).json({ success: false, message: t.missingFields });
  }

  ParentModel.DeleteAppointmentModel({lang,appointmentId,preAppointmentId,scheduleId,doctorName,appointmentDate,appointmentHour,userId,req})
    .then((msg) => res.json({ success: true, message: msg }))
    .catch((err) => res.json({ success: false, message: err.message || err }));
};




/*********************** Update Testimonial  ***************/
exports.getUpdateTestimonialPage = (req, res, next) => {
  const appointmentId = req.params.appointmentId;

  ParentModel.getTestimonialByAppointmentIdModel(appointmentId, req)
    .then(({ testimonial }) => {
      res.render("dahbordPatient/MyAppoitements/Update_Témoignage", {
        testimonial: testimonial,
        message: req.flash("msg")[0]
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordPatient/MyAppoitements/Update_Témoignage", {
        testimonial: [],
        message: req.flash("msg")[0]
      });
    });
};


exports.PostUpdateTestimonial = (req, res, next) => {
  const image = req.file; // Récupération du fichier image
  const {testimonialId, name, message } = req.body; // Récupération des champs du formulaire
  const appointmentId = req.params.appointmentId; // Récupération de l'appointmentId depuis l'URL
  const lang = req.body.lang || 'en';

  // Appel du modèle pour mettre à jour le témoignage
  ParentModel.UpdateTestimonialModel({lang, testimonialId, name, message, image, appointmentId, req })
    .then((msg) => {
      req.flash("msg", msg); // Message de succès
      res.redirect(`/MyApp/update_testimonial/${appointmentId}`); // Redirection vers la page de mise à jour
    })
    .catch((err) => {
      req.flash("msg", err); // Message d'erreur
      res.redirect(`/MyApp/update_testimonial/${appointmentId}`); // Redirection vers la page de mise à jour
    });
};



/*********************** Update Pre-appoitement ***************/

exports.getUpdatePreAppointmentPage = (req, res, next) => {
  const preAppointmentId = req.params.id;
  const doctorId = req.session.userID;

  ParentModel.getPreAppointmentModel(preAppointmentId, doctorId, req)
    .then((preAppointment) => {
      res.render("dahbordPatient/MyAppoitements/UpdatePre-Appoitement.ejs", {
        preAppointment,
        message: req.flash("msg")[0],
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordPatient/MyAppoitements/UpdatePre-Appoitement.ejs", {
        preAppointment: [],
        message: req.flash("msg")[0],
      });
    });
};


exports.PostUpdatePreAppointment = (req, res, next) => {
  const preAppointmentId = req.params.id;
  const {name,email,whatsapp,residence,video_consent,diseases = [],other_diseases,concern_summary,payment_confirmed} = req.body;
  const userId = req.session.userID;
  const lang = req.body.lang || 'en';

  ParentModel.UpdatePreAppointmentModel({lang,preAppointmentId,name,email,whatsapp,residence,video_consent,diseases,other_diseases,concern_summary,payment_confirmed,userId,req,})
    .then((msg) => {
      req.flash("msg", msg);
      res.redirect(`/UpdatePre-Appointment/${preAppointmentId}`);
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect(`/UpdatePre-Appointment/${preAppointmentId}`);
    });
};



/*-------------------------------------- My Appoitmetns --------------------------------*/












/*--------------------------------- Book Appoitement -----------------------------------*/


/*********************** Book Appoitement  ***************/


exports.getBookAppoitementPage = (req, res, next) => {
  const userId = req.session.userID;

  ParentModel.getUserAndDoctorSchedulesModel({ userId, req })
    .then(({ user, doctorSchedules,hasPreAppointment}) => {
      // Récupère depuis la session
      const preappointmentId = req.session.preappointment_id || null;

      res.render("dahbordPatient/Book_Appoitement", {
        user: user,
        doctorSchedules: doctorSchedules,
        hasPreAppointment:hasPreAppointment,
        message: req.flash("msg")[0],
        preappointmentId,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordPatient/Book_Appoitement", {
        user: null,
        doctorSchedules: null,
        hasPreAppointment: false,
        message: req.flash("msg")[0],
        preappointmentId: null,
      });
    });
};
  
  
exports.postPreAppointment = (req, res, next) => {
    const {name,email,whatsapp,residence,video_consent,diseases,other_diseases,concern_summary,payment_confirmed} = req.body;
    const lang = req.body.lang || 'en';
    const userId = req.session.userID;
  
    ParentModel.PreAppointmentFormModel({lang,name,email,whatsapp,residence,video_consent,diseases,other_diseases,concern_summary,payment_confirmed,userId,req,})
      .then((response) => {
        req.session.preappointment_id = response.id;
        req.flash('msg',response.message)
        // Redirection
        res.redirect("/BookAppoitement");
      })
      .catch((err) => {
        req.flash('msg',err)
        res.redirect("/BookAppoitement");
      });
};



exports.postAppointment = (req, res) => {
    const {lang, doctor, date, time, appointmentType, appointmentMode,scheduleId} = req.body;
    const preappointmentId = req.body.preappointmentId || req.session.preappointment_id;
    const userId = req.session.userID;


    const messages = {
      en: {
        missing: "Missing or invalid appointment data.",
        missingMode: "Please specify the mode for feeding appointments.",
        error: "Failed to book appointment.",
      },
      ar: {
        missing: "بيانات الحجز غير كاملة أو غير صالحة",
        missingMode: "يرجى تحديد نوع الاستشارة للرضاعة",
        error: "فشل في حجز الموعد",
      },
    };

    const t = messages[lang] || messages["en"];

  
    // Validation de base
    if (!doctor || !date || !time || !preappointmentId) {
      return res.status(400).json({
        success: false,
        message: t.missing,
      });
    }
  
    // Si le type est feeding, on exige aussi le mode (online/in-person)
    if (appointmentType === "feeding" && !appointmentMode) {
      return res.status(400).json({
        success: false,
        message: t.missingMode,
      });
    }
  
    const doctorSchedule = req.body.doctorSchedule;
  
    ParentModel.BookAppointmentModel({
      lang,
      doctorSchedule,
      doctor,
      date,
      time,
      preappointmentId,
      userId,
      appointmentType,
      appointmentMode,
      scheduleId,
      req
    })
      .then((message) => {
        delete req.session.preappointment_id;
  
        return res.json({ success: true, message });
      })
      .catch((err) => {
        return res.status(500).json({
          success: false,
          message: typeof err === "string" ? err : t.error,
        });
      });
};
  
  
  
/*----------------------------------- All Blogs ----------------------------------------*/


/*************** Nutrition Blogs ****************/

exports.getNutritionBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate,lang } = req.body || {};
  const userId = req.session.userID;

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  ParentModel.getNutritionBlogsModel(lang,userId,startDate, endDate, req)
    .then((blogs) => {
      res.render("dahbordPatient/blogs/nutrition.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordPatient/blogs/nutrition.ejs", {
        blogs: [],
        startDate,
        endDate,
        message: req.flash("msg")[0],
      });
    });
};



exports.postNutritionBlogsPage = (req, res, next) => {
  const { startDate, endDate } = req.body;
  const userId = req.session.userID;
  const lang = req.body.lang || 'en';

  // Appel du modèle avec ou sans plage de dates
  ParentModel.getNutritionBlogsModel(lang,userId,startDate, endDate,req)
    .then((blogs) => {
      res.render("dahbordPatient/blogs/nutrition.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/MyApp/Nutrition"); // Redirection vers elle-même avec message flash
    });
};



/************ Breastfeeding Blogs ***************/

exports.getBreastfeedingBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate,lang } = req.body || {};
  const userId = req.session.userID;

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  ParentModel.getBreastfeedingBlogsModel(lang,userId,startDate, endDate, req)
    .then((blogs) => {
      res.render("dahbordPatient/blogs/breastfeeding.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordPatient/blogs/breastfeeding.ejs", {
        blogs: [],
        startDate,
        endDate,
        message: req.flash("msg")[0],
      });
    });
};


exports.postBreastfeedingBlogsPage = (req, res, next) => {
  const { startDate, endDate } = req.body;
  const lang = req.body.lang || 'en';
  const userId = req.session.userID;

  // Appel du modèle avec ou sans plage de dates
  ParentModel.getBreastfeedingBlogsModel(lang,userId,startDate, endDate,req)
    .then((blogs) => {
      res.render("dahbordPatient/blogs/breastfeeding.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/MyApp/Breastfeeding"); // Redirection vers elle-même avec message flash
    });
};



/************ Pediatrics Blogs ***************/

exports.getPediatricsBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate,lang } = req.body || {};
  const userId = req.session.userID;

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  ParentModel.getPediatricsBlogsModel(lang,userId,startDate, endDate, req)
    .then((blogs) => {
      res.render("dahbordPatient/blogs/pediatrics.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordPatient/blogs/pediatrics.ejs", {
        blogs: [],
        startDate,
        endDate,
        message: req.flash("msg")[0],
      });
    });
};


exports.postPediatricsBlogsPage = (req, res, next) => {
  const { startDate, endDate } = req.body;
  const userId = req.session.userID;
  const lang = req.body.lang || 'en';

  // Appel du modèle avec ou sans plage de dates
  ParentModel.getPediatricsBlogsModel(lang,userId,startDate, endDate,req)
    .then((blogs) => {
      res.render("dahbordPatient/blogs/pediatrics.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/MyApp/Pediatrics"); // Redirection vers elle-même avec message flash
    });
};



/************ General Blogs ***************/

exports.getGeneralBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate,lang } = req.body || {};
  const userId = req.session.userID;

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  ParentModel.getGeneralBlogsModel(lang,userId,startDate, endDate, req)
    .then((blogs) => {
      res.render("dahbordPatient/blogs/general.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordPatient/blogs/general.ejs", {
        blogs: [],
        startDate,
        endDate,
        message: req.flash("msg")[0],
      });
    });
};


exports.postGeneralBlogsPage = (req, res, next) => {
  const { startDate, endDate } = req.body;
  const userId = req.session.userID;
  const lang = req.body.lang || 'en';

  // Appel du modèle avec ou sans plage de dates
  ParentModel.getGeneralBlogsModel(lang,userId,startDate, endDate,req)
    .then((blogs) => {
      res.render("dahbordPatient/blogs/general.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/MyApp/General"); // Redirection vers elle-même avec message flash
    });
};


/************ Mental-Health Blogs ***************/

exports.getMentalHealthBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate,lang } = req.body || {};
  const userId = req.session.userID;

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  ParentModel.getMentalHealthBlogsModel(lang,userId,startDate, endDate, req)
    .then((blogs) => {
      res.render("dahbordPatient/blogs/mental-health.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordPatient/blogs/mental-health.ejs", {
        blogs: [],
        startDate,
        endDate,
        message: req.flash("msg")[0],
      });
    });
};


exports.postMentalHealthBlogsPage = (req, res, next) => {
  const { startDate, endDate } = req.body;
  const userId = req.session.userID;
  const lang = req.body.lang || 'en';

  // Appel du modèle avec ou sans plage de dates
  ParentModel.getMentalHealthBlogsModel(lang,userId,startDate, endDate,req)
    .then((blogs) => {
      res.render("dahbordPatient/blogs/mental-health.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/MyApp/Mental-health"); // Redirection vers elle-même avec message flash
    });
};


/************ Parenting-advice Blogs ***************/

exports.getParentingAdviceBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate ,lang} = req.body || {};
  const userId = req.session.userID;

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  ParentModel.getParentingAdviceBlogsModel(lang,userId,startDate, endDate, req)
    .then((blogs) => {
      res.render("dahbordPatient/blogs/parenting-advice.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordPatient/blogs/parenting-advice.ejs", {
        blogs: [],
        startDate,
        endDate,
        message: req.flash("msg")[0],
      });
    });
};


exports.postParentingAdviceBlogsPage = (req, res, next) => {
  const { startDate, endDate } = req.body;
  const userId = req.session.userID;
  const lang = req.body.lang || 'en';
  // Appel du modèle avec ou sans plage de dates
  ParentModel.getParentingAdviceBlogsModel(lang,userId,startDate, endDate,req)
    .then((blogs) => {
      res.render("dahbordPatient/blogs/parenting-advice.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/MyApp/Parenting-advice"); // Redirection vers elle-même avec message flash
    });
};



/************ others Blogs ***************/

exports.getOthersBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate,lang } = req.body || {};
  const userId = req.session.userID;

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }


  ParentModel.getOthersBlogsModel(lang,userId,startDate, endDate, req)
    .then((blogs) => {
      res.render("dahbordPatient/blogs/others.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordPatient/blogs/others.ejs", {
        blogs: [],
        startDate,
        endDate,
        message: req.flash("msg")[0],
      });
    });
};


exports.postOthersBlogsPage = (req, res, next) => {
  const { startDate, endDate } = req.body;
  const userId = req.session.userID;
  const lang = req.body.lang || 'en';

  // Appel du modèle avec ou sans plage de dates
  ParentModel.getOthersBlogsModel(lang,userId,startDate, endDate,req)
    .then((blogs) => {
      res.render("dahbordPatient/blogs/others.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/MyApp/Others"); // Redirection vers elle-même avec message flash
    });
};

/**************** details Blog *****************/


exports.getblogDetailsPage = (req, res, next) => {
  const blogID = req.params.blogID;
  const userId = req.session.userID;

  ParentModel.getBlogByblogIDModel(userId,blogID, req)
    .then(({ blog, comments }) => {
      // Calcul du nombre total de commentaires + sous-commentaires
      let totalComments = 0;
      comments.forEach(comment => {
        totalComments += 1; // commentaire principal
        if (Array.isArray(comment.replies)) {
          totalComments += comment.replies.length; // sous-commentaires
        }
      });

      res.render("dahbordPatient/blogs/blog-details.ejs", {
        blog,
        comments,
        totalComments, //on passe le total ici
        currentUser: userId, // très important pour vérifier dans la vue EJS
        message: req.flash("msg")[0],
        messageType: req.flash("msgType")[0] || "success"
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      req.flash("msgType", "error");
      res.render("dahbordPatient/blogs/blog-details.ejs", {
        blog: null,
        comments: [],
        totalComments: 0, //valeur par défaut
        currentUser: userId, // toujours utile même si erreur
        message: req.flash("msg")[0],
        messageType: req.flash("msgType")[0]
      });
    });
};


/************** ajouter commentaire ***********/

exports.postComment = (req, res) => {
  const blogId = req.params.id;
  const commentText = req.body.comment;
  const userId = req.session.userID;
  const lang = req.body.lang || 'en';

  if (!commentText || typeof commentText !== "string" || commentText.trim() === "") {
    req.flash("msg", lang === "ar" ? "التعليق مطلوب" : "Comment is required.");
    req.flash("msgType", "error"); //ajoute le type ici aussi
    return res.redirect(`/MyApp/blog-details/${blogId}`);
  }

  ParentModel.addCommentModel({lang,userId, blogId, commentText, req })
    .then((msg) => {
      req.flash("msg", msg); // message success provenant du modèle
      req.flash("msgType", "success"); //type success
      res.redirect(`/MyApp/blog-details/${blogId}`);
    })
    .catch((err) => {
      req.flash("msg", typeof err === "string" ? err : "Error while adding the comment.");
      req.flash("msgType", "error"); //ajoute le type ici aussi
      res.redirect(`/MyApp/blog-details/${blogId}`);
    });
};


/************** sous commentaire *************/

exports.postReplyComment = (req, res) => {
  const blogId = req.params.blogId;
  const commentId = req.params.commentId;
  const replyText = req.body.reply;
  const userId = req.session.userID;
  const lang = req.body.lang || 'en';

  if (!replyText || typeof replyText !== "string" || replyText.trim() === "") {
    req.flash("msg", lang === "ar" ? "الرد مطلوب" : "Reply is required.");
    req.flash("msgType", "error");
    return res.redirect(`/MyApp/blog-details/${blogId}`);
  }

  ParentModel.PostReplyCommentModel({lang,userId, blogId, commentId, replyText, req })
    .then((msg) => {
      req.flash("msg", msg);
      req.flash("msgType", "success");
      res.redirect(`/MyApp/blog-details/${blogId}`);
    })
    .catch((err) => {
      req.flash("msg", typeof err === "string" ? err : "Error while adding the reply.");
      req.flash("msgType", "error");
      res.redirect(`/MyApp/blog-details/${blogId}`);
    });
};


/************ supprimer commentaire **********/

exports.deleteComment = (req, res) => {
  const { blogId, commentId } = req.params;
  const userId = req.session.userID;
  const lang = req.body.lang || "en"; // Priorité à lang dans l’URL
  

  // Vérification rapide des IDs
  if (!blogId || !commentId) {
    req.flash("msg", lang === "ar" ? "معرّف التدوينة ومعرّف التعليق مطلوبان": "Blog ID and Comment ID are required.");
    req.flash("msgType", "error");
    return res.redirect(`/MyApp/blog-details/${blogId}`);
  }

  ParentModel.deleteCommentModel({lang,userId, blogId, commentId, req })
    .then((msg) => {
      req.flash("msg", msg);
      req.flash("msgType", "success");
      res.redirect(`/MyApp/blog-details/${blogId}`);
    })
    .catch((err) => {
      req.flash("msg", typeof err === "string" ? err : "Error deleting comment.");
      req.flash("msgType", "error");
      res.redirect(`/MyApp/blog-details/${blogId}`);
    });
};


/*********** supprimer une réponse ********/

exports.deleteReply = (req, res) => {
  const { blogId, commentId, replyId } = req.params;
  const userId = req.session.userID;
  const lang = req.body.lang || "en"; // Langue envoyée via champ hidden (ex: dans le modal)

  // Vérification des IDs
  if (!blogId || !commentId || !replyId) {
    req.flash("msg", lang === "ar" ? "معرّف التدوينة، التعليق، والرد مطلوبة" : "Blog ID, comment ID, and reply ID are required.");
    req.flash("msgType", "error");
    return res.redirect(`/MyApp/blog-details/${blogId}`);
  }

  ParentModel.deleteReplyModel({lang, userId, blogId, commentId, replyId, req })
    .then((msg) => {
      req.flash("msg", msg);
      req.flash("msgType", "success");
      res.redirect(`/MyApp/blog-details/${blogId}`);
    })
    .catch((err) => {
      req.flash("msg", typeof err === "string" ? err : "Error deleting reply.");
      req.flash("msgType", "error");
      res.redirect(`/MyApp/blog-details/${blogId}`);
    });
};



/*----------------------------------- All Blogs ----------------------------------------*/






/*--------------------------------- Book Appoitement -----------------------------------*/









/*---------------------------------------- Contact -------------------------------------*/



/*********************** ContactAdminFromParent  ***************/
exports.getContactAdminFromParentPage = (req,res,next)=>{
    res.render("dahbordPatient/contact",{message:req.flash("msg")[0]});
}


exports.postContactAdminFromParentPage = (req, res, next) => {
    const { name, email, phone, subject, message } = req.body;
    const lang = req.body.lang || 'en';


    // Envoi au modèle
    ParentModel.ContactFormModel({lang, name, email, phone, subject, message, req})
        .then((msg) => {
            req.flash("msg", msg);
            res.redirect("/ContactAdminFromParent");
        })
        .catch((err) => {
            req.flash("msg", err);
            res.redirect("/ContactAdminFromParent");
        });
};

/*---------------------------------------- Contact -------------------------------------*/





