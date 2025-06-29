const express = require("express");
const route = require("express").Router();
const ParentController = require("../controllers/parent.controller");
const body = require("express").urlencoded({ extended: true });
const multer = require("multer");
const csrf = require("csurf");
const csrfProtection = csrf();
const { escape } = require('mongo-escape');
const logAttack = require("../helpers/logger");
const gaurdAuth = require("./auth.route");


//Config Multer
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "assets/uploads");
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, file.originalname + "-" + uniqueSuffix);
    },
  }),
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
    //console.log("Avant nettoyage:", JSON.stringify(req.body,null, 2));
      sanitize(req.body,req);
    //console.log("Après nettoyage:", JSON.stringify(req.body,null, 2));
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


/*-------------------------------------- My Appoitmetns --------------------------------*/


// /MyApp → if req.session.userID(user connexté) then vous pouvez consulter MyApp else (i.e vous étes pas connectées) redirect('/home)

/*********************** My Appoitmetns ***************/

route.get('/MyApp',csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("parent"),ParentController.getMyAppoitementsPage)


route.post("/MyApp",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,ParentController.postMyAppointmentsPage);

// Route pour afficher le details d'un Appoitment
//Ordre : body → cleanbody → csrf → controller
route.post('/MyApp/PreappointmentDetails/:id', express.json(), cleanInjNosql,mongoEscapeMiddleware, csrfProtection, ParentController.PreAppointmentDetails);


// Route pour supprimer un Appoitment
//Ordre : body → cleanbody → csrf → controller
route.post("/MyApp/delete/:appointmentId",express.json(),cleanInjNosql,mongoEscapeMiddleware,csrfProtection, ParentController.DeleteAppoitment);



// /LeaveTestimonial → if req.session.userID(user connexté) then vous pouvez consulter LeaveTestimonial else (i.e vous étes pas connectées) redirect('/home)

/*********************** Leave Testimonial ***************/

route.get('/LeaveTestimonial/:appointmentId',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // ← immédiatement après csrfProtection
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("parent"),ParentController.getLeaveTestimonialPage)



//Ordre : upload → cleanbody → csrf → controller
route.post('/LeaveTestimonial/:appointmentId', upload.single("image"), cleanInjNosql,mongoEscapeMiddleware,csrfProtection, ParentController.PostLeaveTestimonial);


// /UpdateAppoitement → if req.session.userID(user connexté) then vous pouvez consulter UpdateAppoitement else (i.e vous étes pas connectées) redirect('/home)

/*********************** Update Testimonial ***************/

route.get('/MyApp/update_testimonial/:appointmentId',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // ← immédiatement après csrfProtection
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("parent"),ParentController.getUpdateTestimonialPage)


//Ordre : upload → cleanbody → csrf → controller


route.post('/MyApp/update_testimonial/:appointmentId', upload.single("image"), cleanInjNosql,mongoEscapeMiddleware,csrfProtection, ParentController.PostUpdateTestimonial);


// /UpdateQuestionnaire → if req.session.userID(user connexté) then vous pouvez consulter UpdateQuestionnaire else (i.e vous étes pas connectées) redirect('/home)

/*********************** Update Pre-appoitement ***************/


route.get('/UpdatePre-Appointment/:id',csrfProtection,(req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("parent"),ParentController.getUpdatePreAppointmentPage);


route.post("/UpdatePre-Appointment/:id",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,ParentController.PostUpdatePreAppointment);


/*-------------------------------------- My Appoitmetns --------------------------------*/












/*----------------------------------------- Book Appoitement ---------------------------------------*/

// /BookAppoitement → if req.session.userID(user connexté) then vous pouvez consulter BookAppoitement else (i.e vous étes pas connectées) redirect('/home)

/*********************** Book Appoitement ***************/

route.get('/BookAppoitement',csrfProtection, (req, res, next) => {
    res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
    next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("parent"),ParentController.getBookAppoitementPage)

//Ordre : upload → cleanbody → csrf → controller
route.post("/PreAppointment",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection, ParentController.postPreAppointment);


//Ordre : upload → cleanbody → csrf → controller
route.post("/BookAppoitement",express.json({ limit: '5mb' }),cleanInjNosql,mongoEscapeMiddleware,csrfProtection, ParentController.postAppointment);


/*----------------------------------------- Book Appoitement ---------------------------------------*/



/*------------------------------------------- All Blogs --------------------------------------------*/


/**************** Nutrition Blogs ******************/


route.get('/MyApp/Nutrition',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("parent"),ParentController.getNutritionBlogsPage);


route.post("/MyApp/Nutrition",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,ParentController.postNutritionBlogsPage);


/**************** Breastfeeding Blogs ******************/


route.get('/MyApp/Breastfeeding',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("parent"),ParentController.getBreastfeedingBlogsPage);


route.post("/MyApp/Breastfeeding",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,ParentController.postBreastfeedingBlogsPage);



/**************** Pediatrics Blogs ******************/


route.get('/MyApp/Pediatrics',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("parent"),ParentController.getPediatricsBlogsPage);


route.post('/MyApp/Pediatrics',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,ParentController.postPediatricsBlogsPage);


/**************** General Blogs ******************/


route.get('/MyApp/General',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("parent"),ParentController.getGeneralBlogsPage);


route.post('/MyApp/General',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,ParentController.postGeneralBlogsPage);


/**************** Mental-health Blogs ******************/


route.get('/MyApp/Mental-health',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("parent"),ParentController.getMentalHealthBlogsPage);


route.post('/MyApp/Mental-health',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,ParentController.postMentalHealthBlogsPage);


/**************** Parenting-advice Blogs ******************/


route.get('/MyApp/Parenting-advice',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("parent"),ParentController.getParentingAdviceBlogsPage);


route.post('/MyApp/Parenting-advice',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,ParentController.postParentingAdviceBlogsPage);


/******************* Others Blogs ************************/


route.get('/MyApp/Others',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("parent"),ParentController.getOthersBlogsPage);


route.post('/MyApp/Others',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,ParentController.postOthersBlogsPage);




/**************** details Blog *****************/

route.get('/MyApp/blog-details/:blogID',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("parent"),ParentController.getblogDetailsPage);


/**************** Comment Blog ***************/

route.post('/MyApp/blog/:id/comment',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,ParentController.postComment);

/************** sous commentaire *************/

route.post('/MyApp/blog/:blogId/comment/:commentId/reply',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,ParentController.postReplyComment);


/*********** supprimer un commentaire ********/

route.post('/MyApp/blog/:blogId/comment/:commentId/delete',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,ParentController.deleteComment);


/*********** supprimer une réponse **********/

route.post('/MyApp/blog/:blogId/comment/:commentId/reply/:replyId/delete', body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,ParentController.deleteReply);



/*------------------------------------------- All Blogs --------------------------------------------*/




/*-------------------------------------------- Contact ---------------------------------------------*/

/*********************** Contact Admin From Parent ***************/

// /ContactAdminFromParent → if req.session.userID(user connexté) then vous pouvez consulter ContactAdminFromParent else (i.e vous étes pas connectées) redirect('/home)

route.get('/ContactAdminFromParent',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // ← immédiatement après csrfProtection
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("parent"), ParentController.getContactAdminFromParentPage)


//Ordre : body → cleanbody → csrf → controller
route.post('/ContactAdminFromParent',body,cleanInjNosql,mongoEscapeMiddleware, csrfProtection, ParentController.postContactAdminFromParentPage);



/*-------------------------------------------- Contact ---------------------------------------------*/








module.exports = route;