const express = require("express");
const route = require("express").Router();
const VisiteurController = require("../controllers/visiteur.controller");
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
    // console.log("Avant nettoyage:", req.body);
    sanitize(req.body,req);
    // console.log("Après nettoyage:", req.body);
  }
  if (req.query){
    //console.log("Avant nettoyage:", req.query);
    sanitize(req.query,req);
   // console.log("Avant nettoyage:", req.query); 
  }
  if (req.params){
    //console.log("Avant nettoyage:", req.params);
    sanitize(req.params,req);
    //console.log("Avant nettoyage:", req.params);
  } 
  next();
};



// 2eme cauche de Protèction contre les attaques NoSQL
// Middleware qui échappe les données contre les attaques NoSQL
const mongoEscapeMiddleware = (req, res, next) => {
  if (req.body) {
    // console.log("Avant échappement:", req.body);
    req.body = escape(req.body);
    // console.log("Après échappement:", req.body);
  }
  if (req.query) {
    //console.log("Avant échappement:", req.query);
    req.query = escape(req.query);
    // console.log("Avant échappement:", req.query);
  }
  if (req.params) {
    //console.log("Avant échappement:", req.params);
    req.params = escape(req.params);
    //console.log("Avant échappement:", req.params);
  }
  next();
};

/*********************** oublie mot de passe ***********************/    

route.get('/forgot-password',csrfProtection,(req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
},gaurdAuth.nonAuth,VisiteurController.getForgotPasswordForm);

//Ordre : body → cleanbody → csrf → controller

route.post('/forgot-password',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection, VisiteurController.postForgotPassword);


/*********************** reset mot de passe ***********************/

route.get('/reset-password/:token',csrfProtection,(req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
},gaurdAuth.nonAuth,VisiteurController.getResetPassword);


// Ordre : body  → nettoyage NoSQL → échappement Mongo → CSRF → Controller

route.post('/reset-password/:token',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,VisiteurController.postResetPassword);


/*********************** REGISTER ***********************/

// /register → if !req.session.userID(user non connecté) then vous pouvez consulter /register( next()<== getRegisterPage) 
//             else (i.e vous étes pas connectées) fait rien et rester dans la meme page (vous ne pouvez pas accéder à /register)

route.get('/register', csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
}, gaurdAuth.nonAuth, VisiteurController.getRegisterPage);



//Ordre : upload → cleanbody → csrf → controller
route.post('/register', upload.single("diploma"), cleanInjNosql,mongoEscapeMiddleware,csrfProtection, VisiteurController.PostRegisterData);

/*********************** LOGIN **************************/


// /login → if !req.session.userID(user non connecté) then vous pouvez consulter /login( next()<== getLoginPage) 
//             else (i.e vous étes pas connectées) fait rien et rester dans la meme page (vous ne pouvez pas accéder à /login)

route.get('/login', csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.nonAuth, VisiteurController.getLoginPage);


//Ordre : body → cleanbody → csrf → controller
route.post('/login', body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection, VisiteurController.PostLoginData);


/*********************** HOME **************************/

// /home → if !req.session.userID(user non connecté) then vous pouvez consulter /home ( next()<== getHomePage) 
//             else (i.e vous étes pas connectées) fait rien et rester dans la meme page (vous ne pouvez pas accéder à /home)
route.get('/home',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.nonAuth, VisiteurController.getHomePage);


//Ordre : body → cleanbody → csrf → controller
route.post('/home',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection, VisiteurController.postContactFromHomeData);


/********************************* Blogs *********************************/


/**************** Nutrition Blogs ******************/


route.get('/Nutrition',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.nonAuth, VisiteurController.getNutritionBlogsPage);


route.post("/Nutrition",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,VisiteurController.postNutritionBlogsPage);


/****************** General Blogs ******************/


route.get('/General',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.nonAuth, VisiteurController.getGeneralBlogsPage);


route.post("/General",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,VisiteurController.postGeneralBlogsPage);



/*************** mental-health Blogs ***************/


route.get('/mental-health',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.nonAuth, VisiteurController.getMentalHealthBlogsPage);


route.post("/mental-health",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,VisiteurController.postmentalHealthBlogsPage);


/*************** breastfeeding Blogs ***************/


route.get('/Breastfeeding',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.nonAuth, VisiteurController.getBreastfeedingBlogsPage);


route.post("/Breastfeeding",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,VisiteurController.postBreastfeedingBlogsPage);


/*************** Pediatrics Blogs ***************/


route.get('/Pediatrics',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.nonAuth, VisiteurController.getPediatricsBlogsPage);


route.post("/Pediatrics",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,VisiteurController.postPediatricsBlogsPage);


/*********** Parenting-advice Blogs ************/


route.get('/Parenting-advice',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.nonAuth, VisiteurController.getParentingAdviceBlogsPage);


route.post("/Parenting-advice",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,VisiteurController.postParentingAdviceBlogsPage);


/**************** other Blogs *****************/


route.get('/Others',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.nonAuth, VisiteurController.getOtherBlogsPage);


route.post("/Others",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,VisiteurController.postOtherBlogsPage);



/**************** details Blog *****************/


route.get('/blog-details/:blogID',csrfProtection,(req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.nonAuth, VisiteurController.getblogDetailsPage);


/*********************** CONTACT ***********************/

// /contact → if !req.session.userID(user non connecté) then vous pouvez consulter /contact ( next()<== getcontactPage) 
//             else (i.e vous étes pas connectées) fait rien et rester dans la meme page (vous ne pouvez pas accéder à /contact)

route.get('/contact',csrfProtection,(req, res, next) => {
    res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
    next();
},gaurdAuth.nonAuth, VisiteurController.getContactPage);


//Ordre : body → cleanbody → csrf → controller
route.post('/contact',body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection, VisiteurController.postContactFromContactData);

/*********************** About Us ***********************/

// /AboutUs → if !req.session.userID(user non connecté) then vous pouvez consulter /AboutUs ( next()<== getAboutUsPage) 
//             else (i.e vous étes pas connectées) fait rien et rester dans la meme page (vous ne pouvez pas accéder à /AboutUs)

route.get('/AboutUs',csrfProtection,(req, res, next) => {
    res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
    next();
},gaurdAuth.nonAuth, VisiteurController.getAboutUsPage);

module.exports = route;
