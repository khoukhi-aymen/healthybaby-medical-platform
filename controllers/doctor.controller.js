const DoctorModel = require("../models/Doctor")

/************************ Lougout ***********************/
exports.LogoutFunctionController = (req, res, next) => {
  delete req.session.userID;
  delete req.session.role;
  // Laisse preappointment_id intact
  res.redirect('/home');
};






/*-------------------------------------- My Appoitmetns --------------------------------*/

/*********************** My Appoitements ***************/


exports.getMyAppoitementsPage = (req, res, next) => {
  const userId = req.session.userID;
  let { startDate, endDate } = req.body || {};

  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  DoctorModel.getAppointmentsForDoctor({ userId, startDate, endDate, req })
    .then((appointments) => {
      res.render("dahbordMedecin/MyApointements/MyAppoitements", {
        appointments,
        startDate,
        endDate,
        message: null
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordMedecin/MyApointements/MyAppoitements", {
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

   DoctorModel.getAppointmentsForDoctor({ userId, startDate, endDate, req })
    .then((appointments) => {
      res.render("dahbordMedecin/MyApointements/MyAppoitements", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        appointments,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken(),
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/MyAppoitements"); // Redirection vers elle-même avec message flash
    });
};

/*********************** view pré-appointment ***************/

exports.PreAppointmentDetails = (req, res) => {
  const preId = req.params.id; // Récupérer l'ID de la pré-appointment

  // Appeler la fonction du modèle avec les paramètres nécessaires
  DoctorModel.getPreAppointmentById({ preId, req })
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

/************************* view témoignage *****************/

exports.ViewTestimonial = (req, res) => {
  const appointmentId = req.params.id;

  DoctorModel.getTestimonialByAppointmentId({ appointmentId, req })
    .then(testimonial => {
      res.json({
        success: true,
        name: testimonial.name,
        message: testimonial.message,
        status:testimonial.status,
        testimonial_image: testimonial.testimonial_image
      });
    })
    .catch(err => {
      res.json({ success: false, message: err });
    });
};


/********************* Approve Appoitment ************/

exports.approveAppointment = (req, res) => {
  const appointmentId = req.params.id;

  DoctorModel.approveAppointmentById({ appointmentId, req })
    .then((msg) => {
      res.json({ success: true, message: msg });
    })
    .catch(err => {
      res.status(400).json({ success: false, message: err });
    });
};

/********************** delete Appoitment  ************/


exports.DeleteAppoitment = (req, res, next) => {
  const { id } = req.params;
  const userId = req.session.userID;
  const {preAppointmentId,scheduleId,doctorName,appointmentDate,appointmentHour} = req.body;

  if (!id || !preAppointmentId || !scheduleId || !doctorName || !appointmentDate || !appointmentHour) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  DoctorModel.DeleteAppointmentModel({id,preAppointmentId,scheduleId,doctorName,appointmentDate,appointmentHour,userId,req})
    .then((msg) => res.json({ success: true, message: msg }))
    .catch((err) => res.json({ success: false, message: err.message || err }));
};

/******************** Completed Appoitment ***********/

exports.CompletedAppointment = (req, res) => {
  const appointmentId = req.params.id;

  DoctorModel.CompletedAppointmentById({ appointmentId, req })
    .then((msg) => {
      res.json({ success: true, message: msg });
    })
    .catch(err => {
      res.status(400).json({ success: false, message: err });
    });
};

/******************** Archive Appoitment ***********/

exports.ArchiveAppointment = (req, res) => {
  const { id } = req.params;
  const userId = req.session.userID;
  const {preAppointmentId,scheduleId,doctorName,appointmentDate,appointmentHour} = req.body;

  if (!id || !preAppointmentId || !scheduleId || !doctorName || !appointmentDate || !appointmentHour) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  DoctorModel.ArchiveAppointmentById({id,preAppointmentId,scheduleId,doctorName,appointmentDate,appointmentHour,userId,req})
    .then((msg) => {
      res.json({ success: true, message: msg });
    })
    .catch(err => {
      res.status(400).json({ success: false, message: err });
    });
};






/*********************** Book Appoitement(follow-up) ***************/

exports.getBookAppoitementFollowUpPage = (req, res, next) => {
  const userId = req.session.userID;
  const appointmentId = req.params.id;

  DoctorModel.getUserAndDoctorSchedulesModel({ userId, appointmentId, req })
    .then(({ doctorSchedules, preappointmentId }) => {
      res.render("dahbordMedecin/MyApointements/Book_Appoitement(Follow-up)", {
        doctorSchedules,
        message: req.flash("msg")[0],
        preappointmentId,
        appointmentId
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordMedecin/MyApointements/Book_Appoitement(Follow-up)", {
        doctorSchedules: null,
        message: req.flash("msg")[0],
        preappointmentId: null,
        appointmentId:null
      });
    });
};


exports.postAppointmentFollowUp = (req, res) => {
    const { doctor, date, time, appointmentType, appointmentMode,scheduleId} = req.body;
    const preappointmentId = req.body.preappointmentId || req.session.preappointment_id;
    const userId = req.session.userID;
  
    // Validation de base
    if (!doctor || !date || !time || !preappointmentId) {
      return res.status(400).json({
        success: false,
        message: "Missing or invalid appointment data.",
      });
    }
  
    // Si le type est feeding, on exige aussi le mode (online/in-person)
    if (appointmentType === "feeding" && !appointmentMode) {
      return res.status(400).json({
        success: false,
        message: "Please specify the mode for feeding appointments.",
      });
    }
  
    const doctorSchedule = req.body.doctorSchedule;

  
    DoctorModel.BookAppointmentFollowUpModel({doctorSchedule,doctor,date,time,preappointmentId, userId,appointmentType,appointmentMode,scheduleId,req})
      .then((message) => {
        return res.json({ success: true, message });
      })
      .catch((err) => {
        return res.status(500).json({
          success: false,
          message: typeof err === "string" ? err : "Failed to book appointment.",
        });
      });
};



/*********************** View Questionnaire ***************/
exports.getViewQuestionnairePage = (req,res,next)=>{
    res.render("dahbordMedecin/MyApointements/ViewQuestionnaire");
}


/*********************** View Testimonial ***************/
exports.getViewTestimonialPage = (req,res,next)=>{
    res.render("dahbordMedecin/MyApointements/ViewTémoignage");
}


/*-------------------------------------- My Appoitmetns --------------------------------*/








/*-------------------------------------- My Time Slots ---------------------------------*/

/*********************** Add Time sLots ***************/
exports.getAddTimesLotPage = (req, res, next) => {
  const userId = req.session.userID;

  DoctorModel.getAllTimeSlots(userId,req)
    .then(({ doctorName, schedules }) => {
      res.render("dahbordMedecin/MesTimeslots/AddTimesLot", {
        doctorName,
        schedules,
        message:null
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordMedecin/MesTimeslots/AddTimesLot", {
        doctorName: null,
        schedules: [],
        message:req.flash("msg")[0]
      });
    });

};


exports.postAddTimeSlots = (req, res) => {
  const doctorSchedules = req.body.doctorSchedules;
  const userId = req.session.userID;

  if (!doctorSchedules || typeof doctorSchedules !== "object") {
    return res.status(400).json({ success: false, message: "Invalid data format." });
  }


  DoctorModel.TimeSlotModel({ userId, doctorSchedules,req})
    .then((message) => {
      return res.json({ success: true, message });
    })
    .catch((err) => {
      return res.status(500).json({success: false,message: typeof err === "string" ? err : "Failed to save time slots."});
    });
};
  



/*********************** Details calendrer ***************/
exports.getDetailscalendrierPage = (req,res,next)=>{

    const userId = req.session.userID;

    DoctorModel.getAllTimeSlots(userId,req)
      .then(({ doctorName, schedules }) => {
        res.render("dahbordMedecin/MesTimeslots/Detailscalendrier", {
          doctorName,
          schedules,
          message:null
        });
      })
      .catch((err) => {
        req.flash("msg", err);
        res.render("dahbordMedecin/MesTimeslots/Detailscalendrier",{
          doctorName:null,
          schedules:[],
          message:req.flash("msg")[0]
        });
      });
}





/************************* My Time sLot *****************/
exports.getMyTimesLotPage = (req,res,next)=>{
    const userId = req.session.userID;

    DoctorModel.getAllTimeSlots(userId,req)
      .then(({ doctorName, schedules }) => {
        res.render("dahbordMedecin/MesTimeslots/MyTimesLot",{
          doctorName,
          schedules,
          message:null
        });
      })
      .catch((err) => {
        req.flash("msg", err);
        res.render("dahbordMedecin/MesTimeslots/MyTimesLot",{
          doctorName:null,
          schedules:[],
          message:req.flash("msg")[0]
        });
      });
}


exports.postChangeTimeSlots = (req, res) => {
  const doctorSchedules = req.body.doctorSchedules;
  const userId = req.session.userID;

  if (!doctorSchedules || typeof doctorSchedules !== "object") {
    return res
      .status(400)
      .json({ success: false, message: "Invalid data format." });
  }

  DoctorModel.TimeSlotModel({ userId, doctorSchedules, req })
    .then((message) => {
      return res.json({ success: true, message });
    })
    .catch((err) => {
      return res
        .status(500)
        .json({
          success: false,
          message: typeof err === "string" ? err : "Failed to save time slots.",
        });
    });
};



/******************* view Details Appointement **********/

exports.getviewDetailsAppointementPage = (req,res,next)=>{
    res.render("dahbordMedecin/MesTimeslots/viewDetailsAppointement");
}



/*-------------------------------------- My Time Slots ---------------------------------*/








/*-------------------------------------- My Blogs --------------------------------------*/


/*********************** Add Blog ***************/

exports.getAddBlogPage = (req,res,next)=>{
    res.render("dahbordMedecin/MesBlogs/AddBlog",{message:req.flash("msg")[0]});
}


exports.PostAddBlog = (req, res, next) => {
    const image = req.file; // Récupération du fichier image uploadé

    // Données envoyées par le formulaire
    const { title, author, category, content } = req.body;

    // On récupère le docteur connecté depuis la session
    const userId = req.session.userID;

    // Appel du modèle
    DoctorModel.AddBlogModel({title,author,category,content,image,userId,req})
    .then((msg) => {
        req.flash("msg", msg);
        res.redirect("/AddBlog"); // Redirection vers la page des blogs du docteur
    })
    .catch((err) => {
        req.flash("msg", err);
        res.redirect("/AddBlog"); // Retour au formulaire en cas d'erreur
    });
};



/*********************** My Blogs ***************/

exports.getMyBlogsPage = (req, res, next) => {
  const userId = req.session.userID;

  // Vérifie si les dates sont présentes dans req.body, sinon utilise les 100 derniers blogs
  let { startDate, endDate } = req.body || {};

  // Si startDate et endDate ne sont pas définies, récupérer les 100 derniers blogs
  if (!startDate || !endDate) {
    startDate = null;  // On ne filtre pas par date
    endDate = null;    // On ne filtre pas par date
  }

  // Appel du modèle avec ou sans filtre de dates
  DoctorModel.getMyBlogsModel(userId, startDate, endDate,req)
    .then((data) => {
      res.render("dahbordMedecin/MesBlogs/MesBlogs", {
        blogs: data.blogs, 
        doctorName: data.doctorName,
        startDate,
        endDate,
        message:null
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordMedecin/MesBlogs/MesBlogs", { 
        blogs: [], 
        doctorName: null,
        startDate,
        endDate,
        message:req.flash("msg")[0]
      });
    });
};



exports.postMyBlogsPage = (req, res, next) => {
  const userId = req.session.userID;
  const { startDate, endDate } = req.body;

  // Appel du modèle avec ou sans plage de dates
  DoctorModel.getMyBlogsModel(userId, startDate, endDate,req)
    .then((data) => {
      res.render("dahbordMedecin/MesBlogs/MesBlogs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: data.blogs,
        doctorName: data.doctorName,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/MyBlogs"); // Redirection vers elle-même avec message flash
    });
};



/*********************** delete Blog ***************/

exports.DeleteBlog = (req, res, next) => {
  const { id } = req.params; // Récupération de l'ID du blog à partir des paramètres de la route
  const userId = req.session.userID; // Récupération de l'utilisateur connecté depuis la session


  // Appel du modèle pour supprimer le blog
  DoctorModel.DeleteBlogModel({ BlogId: id, userId, req })
  .then((msg) => {
     return res.json({ success: true, message: msg })
  })
  .catch((err) => {
    res.json({ success: false, message: err })
  });
};




/*********************** Update Blog ***************/

exports.getUpdateBlogPage = (req, res, next) => {
  const blogId = req.params.id;
  const userId = req.session.userID;

  DoctorModel.getBlogByIdModel(blogId, userId, req)
    .then(({ blog, doctorName }) => {
      res.render("dahbordMedecin/MesBlogs/UpdateBlog", {
        blog,
        doctorName,
        message:req.flash("msg")[0]
      });
    })
    .catch((err) => {
        req.flash("msg", err);
        res.render("dahbordMedecin/MesBlogs/UpdateBlog", {
          blog:[],
          doctorName:null,
          message:req.flash("msg")[0]
        })
    });
};


exports.PostUpdateBlog = (req, res, next) => {
  const image = req.file; // Récupération du fichier image uploadé
  const { title, author, category, content } = req.body;
  const userId = req.session.userID;
  const blogId = req.params.id; // ici tu récupères l'id du blog à mettre à jour

  DoctorModel.UpdateBlogModel({ blogId, title, author, category, content, image, userId, req })
    .then((msg) => {
      req.flash("msg", msg);
      res.redirect(`/MyBlogs/update/${blogId}`);
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect(`/MyBlogs/update/${blogId}`); // pareil ici
    });
};



/*********************** General Blogs *************/


exports.getGeneralBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate } = req.body || {};
  const userId = req.session.userID;

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }


  DoctorModel.getGeneralBlogsModel(userId,startDate, endDate, req)
    .then((blogs) => {
      res.render("dahbordMedecin/MesBlogs/blogs/general.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordMedecin/MesBlogs/blogs/general.ejs", {
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

  // Appel du modèle avec ou sans plage de dates
  DoctorModel.getGeneralBlogsModel(userId,startDate, endDate,req)
    .then((blogs) => {
      res.render("dahbordMedecin/MesBlogs/blogs/general.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/MyAppoitements/General"); // Redirection vers elle-même avec message flash
    });
};


/********************* Nutrition Blogs *************/


exports.getNutritionBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate } = req.body || {};
  const userId = req.session.userID;

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  DoctorModel.getNutritionBlogsModel(userId,startDate, endDate, req)
    .then((blogs) => {
      res.render("dahbordMedecin/MesBlogs/blogs/nutrition.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordMedecin/MesBlogs/blogs/nutrition.ejs", {
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


  // Appel du modèle avec ou sans plage de dates
  DoctorModel.getNutritionBlogsModel(userId,startDate, endDate,req)
    .then((blogs) => {
      res.render("dahbordMedecin/MesBlogs/blogs/nutrition.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/MyAppoitements/Nutrition"); // Redirection vers elle-même avec message flash
    });
};


/***************** Mental-Health Blogs *************/


exports.getMentalHealthBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate } = req.body || {};
  const userId = req.session.userID;

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  DoctorModel.getMentalHealthBlogsModel(userId,startDate, endDate, req)
    .then((blogs) => {
      res.render("dahbordMedecin/MesBlogs/blogs/mental-health.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordMedecin/MesBlogs/blogs/mental-health.ejs", {
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


  // Appel du modèle avec ou sans plage de dates
  DoctorModel.getMentalHealthBlogsModel(userId,startDate, endDate,req)
    .then((blogs) => {
      res.render("dahbordMedecin/MesBlogs/blogs/mental-health.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/MyAppoitements/mental-health"); // Redirection vers elle-même avec message flash
    });
};


/***************** pediatrics Blogs *************/


exports.getPediatricsBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate } = req.body || {};
  const userId = req.session.userID;

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  DoctorModel.getPediatricsBlogsModel(userId,startDate, endDate, req)
    .then((blogs) => {
      res.render("dahbordMedecin/MesBlogs/blogs/pediatrics.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordMedecin/MesBlogs/blogs/pediatrics.ejs", {
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


  // Appel du modèle avec ou sans plage de dates
  DoctorModel.getPediatricsBlogsModel(userId,startDate, endDate,req)
    .then((blogs) => {
      res.render("dahbordMedecin/MesBlogs/blogs/pediatrics.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/MyAppoitements/Pediatrics"); // Redirection vers elle-même avec message flash
    });
};


/***************** Breastfeeding Blogs *************/


exports.getBreastfeedingBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate } = req.body || {};
  const userId = req.session.userID;

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  DoctorModel.getBreastfeedingBlogsModel(userId,startDate, endDate, req)
    .then((blogs) => {
      res.render("dahbordMedecin/MesBlogs/blogs/breastfeeding.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordMedecin/MesBlogs/blogs/breastfeeding.ejs", {
        blogs: [],
        startDate,
        endDate,
        message: req.flash("msg")[0],
      });
    });
};


exports.postBreastfeedingBlogsPage = (req, res, next) => {
  const { startDate, endDate } = req.body;
  const userId = req.session.userID;


  // Appel du modèle avec ou sans plage de dates
  DoctorModel.getBreastfeedingBlogsModel(userId,startDate, endDate,req)
    .then((blogs) => {
      res.render("dahbordMedecin/MesBlogs/blogs/breastfeeding.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/MyAppoitements/Breastfeeding"); // Redirection vers elle-même avec message flash
    });
};


/***************** ParentingAdvice Blogs *************/


exports.getParentingAdviceBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate } = req.body || {};
  const userId = req.session.userID;

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  DoctorModel.getParentingAdviceBlogsModel(userId,startDate, endDate, req)
    .then((blogs) => {
      res.render("dahbordMedecin/MesBlogs/blogs/parenting-advice.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordMedecin/MesBlogs/blogs/parenting-advice.ejs", {
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


  // Appel du modèle avec ou sans plage de dates
  DoctorModel.getParentingAdviceBlogsModel(userId,startDate, endDate,req)
    .then((blogs) => {
      res.render("dahbordMedecin/MesBlogs/blogs/parenting-advice.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/MyAppoitements/Parenting-advice"); // Redirection vers elle-même avec message flash
    });
};

/***************** ParentingAdvice Blogs *************/


exports.getOthersBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate } = req.body || {};
  const userId = req.session.userID;

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  DoctorModel.getOthersBlogsModel(userId,startDate, endDate, req)
    .then((blogs) => {
      res.render("dahbordMedecin/MesBlogs/blogs/others.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dahbordMedecin/MesBlogs/blogs/others.ejs", {
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


  // Appel du modèle avec ou sans plage de dates
  DoctorModel.getOthersBlogsModel(userId,startDate, endDate,req)
    .then((blogs) => {
      res.render("dahbordMedecin/MesBlogs/blogs/others.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/MyAppoitements/Others"); // Redirection vers elle-même avec message flash
    });
};





/**************** details Blog *****************/


exports.getblogDetailsPage = (req, res, next) => {
  const blogID = req.params.blogID;
  const userId = req.session.userID;

  DoctorModel.getBlogByblogIDModel(userId,blogID, req)
    .then(({ blog, comments }) => {
      // Calcul du nombre total de commentaires + sous-commentaires
      let totalComments = 0;
      comments.forEach(comment => {
        totalComments += 1; // commentaire principal
        if (Array.isArray(comment.replies)) {
          totalComments += comment.replies.length; // sous-commentaires
        }
      });

      res.render("dahbordMedecin/MesBlogs/blogs/blog-details.ejs", {
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
      res.render("dahbordMedecin/MesBlogs/blogs/blog-details.ejs", {
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

  if (!commentText || typeof commentText !== "string" || commentText.trim() === "") {
    req.flash("msg", "Comment is required.");
    req.flash("msgType", "error"); //ajoute le type ici aussi
    return res.redirect(`/MyAppoitements/blog-details/${blogId}`);
  }

  DoctorModel.addCommentModel({userId, blogId, commentText, req })
    .then((msg) => {
      req.flash("msg", msg); // message success provenant du modèle
      req.flash("msgType", "success"); //type success
      res.redirect(`/MyAppoitements/blog-details/${blogId}`);
    })
    .catch((err) => {
      req.flash("msg", typeof err === "string" ? err : "Error while adding the comment.");
      req.flash("msgType", "error"); //ajoute le type ici aussi
      res.redirect(`/MyAppoitements/blog-details/${blogId}`);
    });
};


/************** sous commentaire *************/


exports.postReplyComment = (req, res) => {
  const blogId = req.params.blogId;
  const commentId = req.params.commentId;
  const replyText = req.body.reply;
  const userId = req.session.userID;

  if (!replyText || typeof replyText !== "string" || replyText.trim() === "") {
    req.flash("msg", "Reply is required.");
    req.flash("msgType", "error");
    return res.redirect(`/MyAppoitements/blog-details/${blogId}`);
  }

  DoctorModel.PostReplyCommentModel({userId, blogId, commentId, replyText, req })
    .then((msg) => {
      req.flash("msg", msg);
      req.flash("msgType", "success");
      res.redirect(`/MyAppoitements/blog-details/${blogId}`);
    })
    .catch((err) => {
      req.flash("msg", typeof err === "string" ? err : "Error while adding the reply.");
      req.flash("msgType", "error");
      res.redirect(`/MyAppoitements/blog-details/${blogId}`);
    });
};


/************ supprimer commentaire **********/

exports.deleteComment = (req, res) => {
  const { blogId, commentId } = req.params;
  const userId = req.session.userID;
  

  // Vérification rapide des IDs
  if (!blogId || !commentId) {
    req.flash("msg", "Missing blog or comment ID.");
    req.flash("msgType", "error");
    return res.redirect(`/MyAppoitements/blog-details/${blogId}`);
  }

  DoctorModel.deleteCommentModel({userId, blogId, commentId, req })
    .then((msg) => {
      req.flash("msg", msg);
      req.flash("msgType", "success");
      res.redirect(`/MyAppoitements/blog-details/${blogId}`);
    })
    .catch((err) => {
      req.flash("msg", typeof err === "string" ? err : "Error deleting comment.");
      req.flash("msgType", "error");
      res.redirect(`/MyAppoitements/blog-details/${blogId}`);
    });
};


/*********** supprimer une réponse ********/

exports.deleteReply = (req, res) => {
  const { blogId, commentId, replyId } = req.params;
  const userId = req.session.userID;

  // Vérification des IDs
  if (!blogId || !commentId || !replyId) {
    req.flash("msg", "Missing IDs.");
    req.flash("msgType", "error");
    return res.redirect(`/MyAppoitements/blog-details/${blogId}`);
  }

  DoctorModel.deleteReplyModel({ userId, blogId, commentId, replyId, req })
    .then((msg) => {
      req.flash("msg", msg);
      req.flash("msgType", "success");
      res.redirect(`/MyAppoitements/blog-details/${blogId}`);
    })
    .catch((err) => {
      req.flash("msg", typeof err === "string" ? err : "Error deleting reply.");
      req.flash("msgType", "error");
      res.redirect(`/MyAppoitements/blog-details/${blogId}`);
    });
};


/*-------------------------------------- My Blogs --------------------------------------*/








/*-------------------------------------- Contact --------------------------------------*/

/*********************** Contact Admin From Doctor ***************/


exports.getContactAdminFromDoctorPage = (req, res, next) => {
  res.render("dahbordMedecin/contact", { message:req.flash("msg")[0]});
};



exports.postContactAdminFromDoctorPage = (req, res, next) => {
    const { name, email, phone, subject, message } = req.body;

    // Envoi au modèle
    DoctorModel.ContactFormModel({ name, email, phone, subject, message, req})
        .then((msg) => {
            req.flash("msg", msg);
            res.redirect("/ContactAdminFromDoctor");
        })
        .catch((err) => {
            req.flash("msg", err);
            res.redirect("/ContactAdminFromDoctor");
        });
};






