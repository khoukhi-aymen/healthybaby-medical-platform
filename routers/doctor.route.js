const express = require("express");
const route = require("express").Router();
const DoctorController = require("../controllers/doctor.controller");
const body = require("express").urlencoded({ extended: true });
const multer = require("multer");
const csrf = require("csurf");
const { escape } = require('mongo-escape');
const csrfProtection = csrf();
const logAttack = require("../helpers/logger");
const gaurdAuth = require("./auth.route");





//Config Multer
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'assets/uploads');
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.originalname + '-' + uniqueSuffix);
    }
  })
});




const sanitize = (obj, req = null) => {
  const suspiciousOperators = [
    "$or", "$and", "$gt", "$gte", "$lt", "$lte",
    "$ne", "$in", "$nin", "$regex", "$where"
  ];

  for (let key in obj) {
    //Supprimer les clés dangereuses (commençant par $ ou contenant .)
    if (/^\$/.test(key) || /\./.test(key)) {
      const msg = `⚠️ Clé suspecte supprimée : "${key}"`;
      console.log(msg);
      logAttack(msg, req, "nosql injection");
      delete obj[key];
      continue;
    }

    //Vérifier si la clé est une chaîne JSON stringifiée
    try {
      const parsedKey = JSON.parse(key);
      if (typeof parsedKey === "object" && parsedKey !== null) {
        for (const k in parsedKey) {
          if (suspiciousOperators.includes(k)) {
            const msg = `⚠️ Clé JSON stringifiée suspecte détectée : "${key}"`;
            console.log(msg);
            logAttack(msg, req, "nosql injection");
            delete obj[key];
            continue;
          }
        }
      }
    } catch (e) {}

    let value = obj[key];

    //Si la valeur est une chaîne
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === "object" && parsed !== null) {
          sanitize(parsed, req);
          obj[key] = parsed;
          continue;
        }
      } catch (err) {}


      // Cas spécial : chaînes de type "test@example.com $or: [{}, {}]"
      for (const op of suspiciousOperators) {
        // Opérateur déjà avec le $, donc on échappe le $
        const looseRegex = new RegExp(`\\${op}\\b`, "i");
        if (looseRegex.test(value)) {
          const msg = `⚠️ Mot-clé NoSQL suspect trouvé dans une chaîne brute : "${value}"`;
          console.log(msg);
          logAttack(msg, req, "nosql injection");
          obj[key] = "";
          break;
        }
      }




      

      // Cas spécial : chaînes de type tableau JS comme "[$ne]"
      if (/^\[\s*\$[a-zA-Z]+\s*\]$/.test(value)) {
          const msg = `⚠️ Chaîne suspecte ressemblant à un tableau contenant un opérateur NoSQL : "${value}"`;
          console.log(msg);
          logAttack(msg, req, "nosql injection");
          obj[key] = "";
      }

      // Rechercher les opérateurs dans les chaînes JSON stringifiées
      for (const op of suspiciousOperators) {
        const regex = new RegExp(`"\\s*${op}\\s*"\\s*:`, "i");
        if (regex.test(value)) {
          const msg = `⚠️ Chaîne JSON suspecte détectée dans "${key}" : ${value}`;
          console.log(msg);
          logAttack(msg, req, "nosql injection");
          obj[key] = "";
          break;
        }
      }

      // Vérifier les valeurs comme "$ne"
      if (/^\$[a-zA-Z]+$/.test(value)) {
        const msg = `⚠️ Valeur directe suspecte détectée dans "${key}" : ${value}`;
        console.log(msg);
        logAttack(msg, req, "nosql injection");
        obj[key] = "";
      }
    }

    //Si la valeur est un tableau → nettoyage récursif
    else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (typeof item === "object" && item !== null) {
          sanitize(item, req);
        } else if (typeof item === "string") {
          for (const op of suspiciousOperators) {
            if (item.includes(op)) {
              const msg = `⚠️ Élément suspect dans tableau "${key}"[${i}] : ${item}`;
              console.log(msg);
              logAttack(msg, req, "nosql injection");
              value[i] = "";
            }
          }
        }
      }
    }

    //Si c'est un objet, récursion
    else if (typeof value === "object" && value !== null) {
      sanitize(value, req);
    }
  }
};

  



// Middleware de nettoyage manuel contre les injections NoSQL(clé ou valeur)
const cleanInjNosql =(req, res, next) => {
  if (req.body){ 
    // console.log("Avant nettoyage:", JSON.stringify(req.body,null, 2));
    sanitize(req.body,req);
    // console.log("Après nettoyage:", JSON.stringify(req.body,null, 2));
  }
  if (req.query){
    // console.log("avant nettoyage query:", JSON.stringify(req.query, null, 2));
    sanitize(req.query,req);
    // console.log("Après nettoyage query:", JSON.stringify(req.query, null, 2));

  }
  if (req.params){
    // console.log("avant nettoyage params:", JSON.stringify(req.params, null, 2));
    sanitize(req.params,req);
    // console.log("Après nettoyage params:", JSON.stringify(req.params, null, 2));
  } 
  next();
};


// 2eme cauche de Protèction contre les attaques NoSQL
// Middleware qui échappe les données contre les attaques NoSQL
const mongoEscapeMiddleware = (req, res, next) => {
  if (req.body) {
    //console.log("Avant échappement:", JSON.stringify(req.body,null, 2));
    req.body = escape(req.body);
    //console.log("Après échappement:", JSON.stringify(req.body,null, 2));
  }
  if (req.query) {
    // console.log("avant nettoyage query:", JSON.stringify(req.query, null, 2));
    req.query = escape(req.query);
    // console.log("Après nettoyage query:", JSON.stringify(req.query, null, 2));
  }
  if (req.params) {
    // console.log("avant nettoyage params:", JSON.stringify(req.params, null, 2));
    req.params = escape(req.params);
    // console.log("Après nettoyage params:", JSON.stringify(req.params, null, 2));
  }
  next();
};




/*********************** LOGOUT ***********************/
route.post('/logout',DoctorController.LogoutFunctionController)





/*-------------------------------------- My Appoitmetns --------------------------------*/

// /MyAppoitements → if req.session.userID(user connexté) then vous pouvez consulter MyAppoitements else (i.e vous étes pas connectées) redirect('/home)

/*********************** My Appoitmetns ***************/

route.get('/MyAppoitements',csrfProtection, (req, res, next) => {
    res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
    next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"), DoctorController.getMyAppoitementsPage)


route.post("/MyAppoitements",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,DoctorController.postMyAppointmentsPage);


/********************* details Appoitment ************/

// Route pour afficher le details d'un Appoitment
//Ordre : body → cleanbody → csrf → controller
route.post('/MyAppoitements/PreappointmentDetails/:id', express.json(), cleanInjNosql,mongoEscapeMiddleware, csrfProtection, DoctorController.PreAppointmentDetails);


// Route pour afficher le details de témoignage
//Ordre : body → cleanbody → csrf → controller
route.post('/MyAppoitements/TestimonialView/:id', express.json(), cleanInjNosql, mongoEscapeMiddleware, csrfProtection, DoctorController.ViewTestimonial);

/********************* Approve Appoitmetn ************/

// Route pour accpter un Appoitment
//Ordre : body → cleanbody → csrf → controller
route.post('/MyAppoitements/ApproveAppointment/:id', express.json(), cleanInjNosql,mongoEscapeMiddleware, csrfProtection, DoctorController.approveAppointment);


// Route pour supprimer un Appoitment
//Ordre : body → cleanbody → csrf → controller
route.post("/MyAppoitements/DeleteAppointment/:id",express.json(),cleanInjNosql,mongoEscapeMiddleware,csrfProtection, DoctorController.DeleteAppoitment);


// Route pour marquer  un Appoitment Terminé
//Ordre : body → cleanbody → csrf → controller
route.post('/MyAppoitements/CompleteAppointment/:id', express.json(), cleanInjNosql,mongoEscapeMiddleware, csrfProtection, DoctorController.CompletedAppointment);


// Route pour archiver  un Appoitment
//Ordre : body → cleanbody → csrf → controller
route.post('/MyAppoitements/ArchiveAppointment/:id', express.json(), cleanInjNosql,mongoEscapeMiddleware, csrfProtection, DoctorController.ArchiveAppointment);



// /BookAppoitement-follow-up → if req.session.userID(user connexté) then vous pouvez consulter BookAppoitement-follow-up else (i.e vous étes pas connectées) redirect('/home)

/*********************** Book Appoitement (follow-up)***************/
route.get('/MyAppoitements/BookAppoitement-follow-up/:id',csrfProtection, (req, res, next) => {
    res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
    next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getBookAppoitementFollowUpPage)


//Ordre : upload → cleanbody → csrf → controller
route.post("/MyAppoitements/BookAppoitement-follow-up/:id",express.json({ limit: '5mb' }),cleanInjNosql,mongoEscapeMiddleware,csrfProtection, DoctorController.postAppointmentFollowUp);


// /ViewQuestionnaire → if req.session.userID(user connexté) then vous pouvez consulter ViewQuestionnaire else (i.e vous étes pas connectées) redirect('/home)

/*********************** View Questionnaire ***************/
route.get('/ViewQuestionnaire',gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getViewQuestionnairePage)

// /ViewTestimonial → if req.session.userID(user connexté) then vous pouvez consulter ViewTestimonial else (i.e vous étes pas connectées) redirect('/home)

/*********************** View Testimonial ***************/
route.get('/ViewTestimonial',gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getViewTestimonialPage)


/*-------------------------------------- My Appoitmetns --------------------------------*/








/*-------------------------------------- My Time Slots ---------------------------------*/



// /AddTimesLot → if req.session.userID(user connexté) then vous pouvez consulter AddTimesLot else (i.e vous étes pas connectées) redirect('/home)

/*********************** Add Time sLot ***************/
route.get('/AddTimesLot',csrfProtection, (req, res, next) => {
    res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
    next();
}, gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getAddTimesLotPage)


//Ordre : upload → cleanbody → csrf → controller
route.post("/AddTimesLot",express.json(),cleanInjNosql,mongoEscapeMiddleware, csrfProtection, DoctorController.postAddTimeSlots);
  




// /Detailscalender → if req.session.userID(user connexté) then vous pouvez consulter Detailscalender else (i.e vous étes pas connectées) redirect('/home)

/******************* Details calendrer *************/

route.get('/Detailscalender',csrfProtection, (req, res, next) => {
    res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
    next();
}, gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getDetailscalendrierPage)




// /MyTimesLot → if req.session.userID(user connexté) then vous pouvez consulter MyTimesLot else (i.e vous étes pas connectées) redirect('/home)

/********************* My Time sLot *****************/
route.get('/MyTimesLot',csrfProtection, (req, res, next) => {
    res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
    next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getMyTimesLotPage)


//Ordre : upload → cleanbody → csrf → controller
route.post("/MyTimesLot",express.json(),cleanInjNosql,mongoEscapeMiddleware, csrfProtection, DoctorController.postChangeTimeSlots);





// /viewDetailsAppointement → if req.session.userID(user connexté) then vous pouvez consulter viewDetailsAppointement else (i.e vous étes pas connectées) redirect('/home)

/********************* view Details Appointement *****************/
route.get('/viewDetailsAppointement',gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getviewDetailsAppointementPage)


/*-------------------------------------- My Time Slots ---------------------------------*/








/*-------------------------------------- My Blogs --------------------------------------*/


/*********************** Add Blog ***************/

// /AddBlog → if req.session.userID(user connexté) then vous pouvez consulter AddBlog else (i.e vous étes pas connectées) redirect('/home)

route.get('/AddBlog',csrfProtection,(req, res, next) => {
    res.locals.csrfToken = req.csrfToken(); // ← immédiatement après csrfProtection
    next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getAddBlogPage);


//Ordre : upload → cleanbody → csrf → controller
route.post('/AddBlog', upload.single("image"), cleanInjNosql,mongoEscapeMiddleware,csrfProtection, DoctorController.PostAddBlog);



/*********************** My Blogs ***************/

// /MyBlogs → if req.session.userID(user connexté) then vous pouvez consulter MyBlogs else (i.e vous étes pas connectées) redirect('/home)

route.get('/MyBlogs',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // ← immédiatement après csrfProtection
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getMyBlogsPage)



//Ordre : body → cleanbody → csrf → controller
route.post("/MyBlogs",body,cleanInjNosql,mongoEscapeMiddleware, csrfProtection, DoctorController.postMyBlogsPage);

// Route pour supprimer un blog
//Ordre : body → cleanbody → csrf → controller
route.post("/MyBlogs/delete/:id",express.json(),cleanInjNosql,mongoEscapeMiddleware,csrfProtection, DoctorController.DeleteBlog);



/*********************** Update Blog ***************/

// /MyBlogs/update/:id → if req.session.userID(user connexté) then vous pouvez consulter UpdateBlog else (i.e vous étes pas connectées) redirect('/home)

route.get('/MyBlogs/update/:id', csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // ← immédiatement après csrfProtection
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getUpdateBlogPage)


//Ordre : upload → cleanbody → csrf → controller

route.post('/MyBlogs/update/:id', upload.single("image"), cleanInjNosql,mongoEscapeMiddleware,csrfProtection, DoctorController.PostUpdateBlog);


/*********************** General Blogs *************/


route.get('/MyAppoitements/General',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getGeneralBlogsPage);


route.post('/MyAppoitements/General',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,DoctorController.postGeneralBlogsPage);


/*********************** Nutrition Blogs *************/


route.get('/MyAppoitements/Nutrition',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getNutritionBlogsPage);


route.post('/MyAppoitements/Nutrition',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,DoctorController.postNutritionBlogsPage);


/*********************** mental-health Blogs *************/


route.get('/MyAppoitements/mental-health',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getMentalHealthBlogsPage);


route.post('/MyAppoitements/mental-health',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,DoctorController.postMentalHealthBlogsPage);


/*********************** Pediatrics Blogs *************/


route.get('/MyAppoitements/Pediatrics',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getPediatricsBlogsPage);


route.post('/MyAppoitements/Pediatrics',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,DoctorController.postPediatricsBlogsPage);


/*********************** Breastfeeding Blogs *************/


route.get('/MyAppoitements/Breastfeeding',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getBreastfeedingBlogsPage);


route.post('/MyAppoitements/Breastfeeding',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,DoctorController.postBreastfeedingBlogsPage);


/*********************** Parenting-advice Blogs *************/


route.get('/MyAppoitements/Parenting-advice',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getParentingAdviceBlogsPage);


route.post('/MyAppoitements/Parenting-advice',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,DoctorController.postParentingAdviceBlogsPage);


/*********************** Others Blogs *************/


route.get('/MyAppoitements/Others',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getOthersBlogsPage);


route.post('/MyAppoitements/Others',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,DoctorController.postOthersBlogsPage);





/**************** details Blog *****************/

route.get('/MyAppoitements/blog-details/:blogID',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"),DoctorController.getblogDetailsPage);


/**************** Comment Blog ***************/

route.post('/MyAppoitements/blog/:id/comment',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,DoctorController.postComment);


/************** sous commentaire *************/


route.post('/MyAppoitements/blog/:blogId/comment/:commentId/reply',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,DoctorController.postReplyComment);


/*********** supprimer un commentaire ********/

route.post('/MyAppoitements/blog/:blogId/comment/:commentId/delete',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,DoctorController.deleteComment);


/*********** supprimer une réponse **********/

route.post('/MyAppoitements/blog/:blogId/comment/:commentId/reply/:replyId/delete',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,DoctorController.deleteReply);



/*-------------------------------------- My Blogs --------------------------------------*/








/*-------------------------------------- Contact --------------------------------------*/

/*********************** Contact Admin From Doctor ***************/

// /ContactAdminFromDoctor → if req.session.userID(user connexté) then vous pouvez consulter ContactAdminFromDoctor else (i.e vous étes pas connectées) redirect('/home)

route.get('/ContactAdminFromDoctor',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // ← immédiatement après csrfProtection
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("doctor"), DoctorController.getContactAdminFromDoctorPage)



//Ordre : body → cleanbody → csrf → controller
route.post('/ContactAdminFromDoctor',body,cleanInjNosql,mongoEscapeMiddleware, csrfProtection, DoctorController.postContactAdminFromDoctorPage);



module.exports = route;