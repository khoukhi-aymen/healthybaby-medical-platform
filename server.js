require('dotenv').config();
const express = require('express')
const mongoose = require("mongoose");
const app = express()
const path = require("path")
const session = require("express-session")
const MongoDBStore = require("connect-mongodb-session")(session)
const helmet = require('helmet');
var flash = require('connect-flash');
const crypto = require("crypto");
const RouterVisiteur = require("./routers/visiteur.route")
const RouterDoctor = require("./routers/doctor.route")
const RouterParent = require("./routers/parent.route")
const RouterAdmin = require("./routers/admin.route")
const logAttack = require("./helpers/logger");




app.use(express.static(path.join(__dirname,"assets")))
app.set('view engine','ejs')
app.set('views','views')

var store = new MongoDBStore({
    uri: process.env.MONGO_URI,
    collection: 'mySessions'
});

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    store: store,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 semaine
      httpOnly: true, // empêche l'accès aux cookies depuis JavaScript
      secure: process.env.NODE_ENV === "production", // en prod seulement via HTTPS
      sameSite: "lax", // protection CSRF tout en gardant une bonne UX
    },
  })
);


  
  


// Middleware pour Rendre le token accessible dans toutes les vues EJS
app.use((req, res, next) => {
  if (req.csrfToken) {
    res.locals.csrfToken = req.csrfToken();
  } else {
    res.locals.csrfToken = null;
  }
  next();
});

// Middleware pour générer un nonce pour chaque requête
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString("base64");
  next();
});
  
  
//Middleware Utilisation de helmet pour sécuriser les en-têtes HTTP
app.use(
  helmet.contentSecurityPolicy({
    directives: {

      //Par défaut, seules les ressources du même domaine (localhost ou ton domaine) sont autorisées
      defaultSrc: [
        "'self'"
      ],

      //Scripts JS inline ou externes autorisés uniquement depuis ces sources :
      scriptSrc: [
        "'self'",                            // Scripts locaux (ex: fichiers .js dans /public)
        "https://cdn.jsdelivr.net",         // SweetAlert2, Bootstrap, etc.
        "https://cdnjs.cloudflare.com",     // FontAwesome, autres librairies JS
        "https://code.jquery.com",          // jQuery
        "https://cdn.datatables.net",       // DataTables
        "https://unpkg.com",                // Pour AOS JS
        (req, res) => `'nonce-${res.locals.nonce}'` // Scripts inline sécurisés avec un nonce dynamique
      ],

      //Pareil que `scriptSrc`, mais pour les balises <script> directement dans le HTML
      scriptSrcElem: [
        "'self'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://code.jquery.com",
        "https://cdn.datatables.net",
        "https://unpkg.com",
        (req, res) => `'nonce-${res.locals.nonce}'`
      ],

      //Feuilles de style CSS autorisées depuis :
      styleSrc: [
        "'self'",                            // Fichiers CSS locaux
        "https://fonts.googleapis.com",     // Google Fonts
        "https://cdn.jsdelivr.net",         // Bootstrap, etc.
        "https://cdn.datatables.net",       // DataTables CSS
        "https://unpkg.com",                // pour AOS CSS
        "'unsafe-inline'"                   // Styles inline autorisés (à utiliser avec précaution)
      ],

      //<link rel="stylesheet"> autorisés depuis ces sources :
      styleSrcElem: [
        "'self'",
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://cdn.datatables.net",
        "https://unpkg.com",
        "'unsafe-inline'"
      ],

      //Images autorisées depuis :
      imgSrc: [
        "'self'",                            // Images locales
        "data:",                             // Images encodées en base64
        "https://www.example.com",           // Ton domaine personnalisé (à adapter selon ton besoin)
        "https://images.unsplash.com"        // Pour les images Unsplash
      ],

      //Connexions fetch / XHR autorisées uniquement vers :
      connectSrc: [
        "'self'"                             // Seulement vers ton propre backend (évite les fuites)
      ],

      //Polices autorisées depuis :
      fontSrc: [
        "'self'",                            // Polices locales
        "https://fonts.gstatic.com",         // Google Fonts
        "https://cdn.jsdelivr.net",          // Bootstrap Icons par exemple
        "https://cdnjs.cloudflare.com"       // Polices hébergées via CDNJS
      ],

      //Empêche les plugins comme Flash, Silverlight, etc.
      objectSrc: [
        "'none'"
      ],
      frameSrc: [
        "'self'",
        "https://www.google.com",         // Pour Google Maps
        "https://maps.googleapis.com"     // API Google Maps JS ou embed
      ],

      //Force automatiquement les contenus à utiliser HTTPS
      upgradeInsecureRequests: []
    },
  })
);



//Middleware Utilisation de flash pour l'affichage des erreurs
app.use(flash())



app.use('/',RouterVisiteur);
app.use('/',RouterDoctor);
app.use('/',RouterParent);
app.use('/',RouterAdmin);


//Middleware global pour gérer les erreurs CSRF(toujours à la fin des routes)

app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    const msg = "❌ Jeton CSRF invalide ou manquant détecté.";
    console.error(msg);

    // Log l'attaque CSRF
    logAttack(msg, req, "csrf");

    // Détection si la requête vient d'AJAX (ex: fetch, axios, XMLHttpRequest)
    const isAjax = req.xhr || req.headers.accept?.includes("json");

    if (req.session.userID) {
      delete req.session.userID;
      delete req.session.role;
        // Si c'est AJAX on envoie un JSON
        if (isAjax) {
          return res.status(403).json({ redirectTo: "/home" });
        }

        // Sinon on fait une redirection classique
        return res.redirect("/home");
    } else {
      // Si l'utilisateur n'est pas connecté
      if (isAjax) {
        return res.status(403).json({ error: "Invalid CSRF token", redirectTo: "/home" });
      }

      return res.redirect("/home");
    }
  }

  // Autres erreurs
  return next(err);
});





mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log("✅ MongoDB connected successfully");

  // Lancer le serveur SEULEMENT après que la DB soit prête
  app.listen(8000, () => {
    console.log("🚀 Server is running on port 8000...");
  });
})
.catch((err) => {
  console.error("❌ Failed to connect to MongoDB:", err.message);
  process.exit(1); // Quitter si échec
});
