const express = require("express");
const route = require("express").Router();
const AdminController = require("../controllers/admin.controller");
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


/*-------------------------------------- All Accounts --------------------------------*/

/*********************** Pending Accounts ***************/

route.get('/PendingAccounts',csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("admin"),AdminController.getPendingAccountsPage)


// Route pour chercher des Comptes en attente par date

route.post("/PendingAccounts",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.postPendingAccountsPage);


// Route pour approuver des Comptes en attente

route.post('/PendingAccounts/approve/:AccountID',express.json(),cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.ApprovePendingAccount);


// Route pour supprimer un blog en attente

route.post('/PendingAccounts/delete/:AccountID',express.json(),cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.DeletePendingAccount);


/*********************** Active Accounts ****************/

route.get('/ActiveAccounts',csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("admin"),AdminController.getActiveAccountsPage)


// Route pour chercher des comptes active par date

route.post("/ActiveAccounts",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.postActiveAccountsPage);


// Route pour supprimer un compte active

route.post('/ActiveAccounts/delete/:AccountID',express.json(),cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.DeleteActiveAccount);



/*-------------------------------------- All Accounts --------------------------------*/




/*-------------------------------------- All Blogs --------------------------------*/

/*********************** Pending Blogs ***************/

route.get('/PendingBlogs',csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("admin"),AdminController.getPendingBlogsPage)

// Route pour chercher des blogs en attente par date

route.post("/PendingBlogs",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.postPendingBlogsPage);

// Route pour approuver un blog en attente

route.post('/PendingBlogs/approve/:BlogID',express.json(),cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.ApprovePendingBlog);


// Route pour supprimer un blog en attente

route.post('/PendingBlogs/delete/:BlogID',express.json(),cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.DeletePendingBlog);



/*********************** Active Blogs ****************/

route.get('/ActiveBlogs',csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("admin"),AdminController.getActiveBlogsPage)


// Route pour chercher des témoignages en attente par date

route.post("/ActiveBlogs",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.postActiveBlogsPage);


// Route pour supprimer un blog accépté

route.post('/ActiveBlogs/delete/:BlogID',express.json(),cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.DeleteActiveBlog);


// Route pour supprimer un commentaire

route.post('/ActiveBlogs/:blogId/comment/:commentId/delete',express.json(),cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.deleteComment);

// Route pour supprimer une réponse (sous-commentaire)

route.post('/ActiveBlogs/:blogId/comment/:commentId/reply/:replyId/delete',express.json(), cleanInjNosql, mongoEscapeMiddleware, csrfProtection,AdminController.deleteReply);




/*-------------------------------------- All Blogs --------------------------------*/




/*-------------------------------------- All Testimonials --------------------------*/


/*********************** Pending Testimonials ***************/

route.get('/PendingTestimonials',csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("admin"),AdminController.getPendingTestimonialsPage)

// Route pour chercher des témoignages en attente par date


route.post("/PendingTestimonials",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.postPendingTestimonialsPage);


// Route pour approuver un témoignage en attente

route.post('/PendingTestimonials/approve/:TestimonialID',express.json(),cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.ApprovePendingTestimonial);


// Route pour supprimer un témoignage en attente

route.post('/PendingTestimonials/delete/:TestimonialID',express.json(),cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.DeletePendingTestimonial);


/*********************** Active Testimonials ****************/

route.get('/ActiveTestimonials',csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère et stocke dans req.session des vues
  next();
},gaurdAuth.isAuth,gaurdAuth.hasRole("admin"),AdminController.getActiveTestimonialsPage)


// Route pour chercher des témoignages acceptés par date


route.post("/ActiveTestimonials",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.postActiveTestimonialsPage);


// Route pour supprimer un témoignage accepté

route.post('/ActiveTestimonials/delete/:TestimonialID',express.json(),cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.DeleteActiveTestimonial);


/*-------------------------------------- All Testimonials --------------------------*/




/*-------------------------------------- All Messages --------------------------*/


route.get('/ContactMessages', csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Génère un token CSRF pour le formulaire ou les actions
  next();
}, gaurdAuth.isAuth, gaurdAuth.hasRole("admin"), AdminController.getContactMessagesPage);


// Route pour chercher des témoignages acceptés par date


route.post("/ContactMessages",body,cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.postContactMessagesPage);


// Route pour supprimer un message de contact

route.post('/ContactMessages/delete/:ContactID',express.json(),cleanInjNosql,mongoEscapeMiddleware,csrfProtection,AdminController.DeleteContactMessage);


/*-------------------------------------- All Messages --------------------------*/






module.exports = route;