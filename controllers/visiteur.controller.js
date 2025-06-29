const VisiteurModel = require("../models/Visiteur");


/****************** oublie mot de passe ******************/   

exports.getForgotPasswordForm = (req, res) => {
  res.render("dashbordVisiteur/forgotPassword", {message: req.flash("msg")[0] || null,});
};

exports.postForgotPassword = (req, res) => {
  const { email } = req.body;
  const lang = req.body.lang || 'en';
  VisiteurModel.ForgotPasswordModel({lang, email, req })
    .then((msg) => {
      req.flash("msg", msg);
      res.redirect("/forgot-password");
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/forgot-password");
    });
};


/*********************** reset mot de passe ***********************/

exports.getResetPassword = (req, res) => {
  const { token } = req.params;

  VisiteurModel.GetResetPasswordModel({ token, req })
    .then(user => {
      res.render("dashbordVisiteur/reset-password", {
        csrfToken: req.csrfToken(),
        token,
        message: req.flash("msg")[0] || null,
      });
    })
    .catch(err => {
      req.flash("msg", err);
      res.redirect("/forgot-password");
    });
};


exports.postResetPassword = (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;
  const lang = req.body.lang || 'en';

  VisiteurModel.ResetPasswordModel({lang, token, password, confirmPassword, req })
    .then((message) => {
      req.flash("msg", message);
      res.redirect("/login");
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect(`/reset-password/${token}`);
    });
};



/************************ Register ***********************/

exports.getRegisterPage= (req,res,next)=>{

    res.render("dashbordVisiteur/inscription",{message:req.flash("msg")[0]})

}


// Fonction de nettoyage pour le nom du docteur
const cleanDoctorName = (name) => {
  return name.replace(/\./g, " ");
};

  
exports.PostRegisterData = (req, res, next) => {
    const diploma = req.file;
    const lang = req.body.lang || 'en';
    let {role, full_name, email, password, Speciality, medical_license, isAdmin = false  } = req.body; // Destructure data from the request body
    full_name = cleanDoctorName(full_name);
    VisiteurModel.RegisterUserModel({lang,role,full_name,email,password,Speciality,medical_license,diploma,isAdmin,req})
    .then((msg) => {
        req.flash('msg',msg)
        res.redirect("/register")
    })
    .catch((err) => {
        req.flash('msg',err)
        res.redirect("/register")
    });
};

/************************ login ***********************/
exports.getLoginPage = (req,res,next)=>{
    res.render("dashbordVisiteur/connexion",{message:req.flash("msg")[0]})
}

exports.PostLoginData = (req, res, next) => {
  const { email, password } = req.body;
  const lang = req.body.lang || 'en';


  // Appel du modèle avec email et mot de passe assaini
  VisiteurModel.LoginUserModel(lang,email, password,req)
    .then((user) => {
      //Connexion réussie Crée une session pour l'utilisateur
      req.session.userID = user._id;
      req.session.role = user.role;
      // Redirection vers la page d'accueil
      if(user.role ==="doctor"){
        res.redirect("/MyAppoitements");
      }
      else if(user.role ==="parent"){
        res.redirect("/MyApp");
      }else if(user.role ==="admin"){
        res.redirect("/PendingAccounts");
      }
    })
    .catch((err) => {
        req.flash('msg',err)
        //Toujours un message générique pour éviter de donner trop d'info à l'attaquant
        res.redirect("/login")
    });
};


/************************ Home ***********************/

exports.getHomePage = (req, res, next) => {
  VisiteurModel.getApprovedTestimonials(req)
    .then((testimonials) => {
      res.render("dashbordVisiteur/index", {
        message: req.flash("msg")[0],
        testimonials, // on envoie les témoignages approuvés à la vue
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dashbordVisiteur/index", {
        message: req.flash("msg")[0],
        testimonials: [], // tableau vide en cas d’erreur
      });
    });
};
  

exports.postContactFromHomeData = (req, res, next) => {
    const { name, email, phone, subject, message } = req.body;
    const lang = req.body.lang || 'en';

    // Envoi au modèle
    VisiteurModel.ContactFormModel({lang, name, email, phone, subject, message, req})
        .then((msg) => {
            req.flash("msg", msg);
            res.redirect("/home");
        })
        .catch((err) => {
            req.flash("msg", err);
            res.redirect("/home");
        });
};



/************************ Blogs ***********************/


/*************** Nutrition Blogs ****************/

exports.getNutritionBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate,lang } = req.body || {};

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  VisiteurModel.getNutritionBlogsModel(lang,startDate, endDate, req)
    .then((blogs) => {
      res.render("dashbordVisiteur/blogs/nutrition.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dashbordVisiteur/blogs/nutrition.ejs", {
        blogs: [],
        startDate,
        endDate,
        message: req.flash("msg")[0],
      });
    });
};

exports.postNutritionBlogsPage = (req, res, next) => {
  const { startDate, endDate } = req.body;
  const lang = req.body.lang || 'en';

  // Appel du modèle avec ou sans plage de dates
  VisiteurModel.getNutritionBlogsModel(lang,startDate, endDate,req)
    .then((blogs) => {
      res.render("dashbordVisiteur/blogs/nutrition.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/Nutrition"); // Redirection vers elle-même avec message flash
    });
};


/*************** General Blogs ****************/


exports.getGeneralBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate,lang } = req.body || {};

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  VisiteurModel.getGeneralBlogsModel(lang,startDate, endDate, req)
    .then((blogs) => {
      res.render("dashbordVisiteur/blogs/general.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dashbordVisiteur/blogs/general.ejs", {
        blogs: [],
        startDate,
        endDate,
        message: req.flash("msg")[0],
      });
    });
};


exports.postGeneralBlogsPage = (req, res, next) => {
  const { startDate, endDate } = req.body;
  const lang = req.body.lang || 'en';

  // Appel du modèle avec ou sans plage de dates
  VisiteurModel.getGeneralBlogsModel(lang,startDate, endDate,req)
    .then((blogs) => {
      res.render("dashbordVisiteur/blogs/general.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/General"); // Redirection vers elle-même avec message flash
    });
};


/*************** Mental-health Blogs ***********/


exports.getMentalHealthBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate,lang } = req.body || {};

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  VisiteurModel.getMentalHealthBlogsModel(lang,startDate, endDate, req)
    .then((blogs) => {
      res.render("dashbordVisiteur/blogs/mental-health.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dashbordVisiteur/blogs/mental-health.ejs", {
        blogs: [],
        startDate,
        endDate,
        message: req.flash("msg")[0],
      });
    });
};

exports.postmentalHealthBlogsPage = (req, res, next) => {
  const { startDate, endDate } = req.body;
  const lang = req.body.lang || 'en';

  // Appel du modèle avec ou sans plage de dates
  VisiteurModel.getMentalHealthBlogsModel(lang,startDate, endDate,req)
    .then((blogs) => {
      res.render("dashbordVisiteur/blogs/mental-health.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/mental-health"); // Redirection vers elle-même avec message flash
    });
};



/*************** Breastfeeding Blogs ***********/


exports.getBreastfeedingBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate,lang } = req.body || {};

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  VisiteurModel.getBreastFeedingBlogsModel(lang,startDate, endDate, req)
    .then((blogs) => {
      res.render("dashbordVisiteur/blogs/breastfeeding.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dashbordVisiteur/blogs/breastfeeding.ejs", {
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

  // Appel du modèle avec ou sans plage de dates
  VisiteurModel.getBreastFeedingBlogsModel(lang,startDate, endDate,req)
    .then((blogs) => {
      res.render("dashbordVisiteur/blogs/breastfeeding.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/Breastfeeding"); // Redirection vers elle-même avec message flash
    });
};


/*************** Pediatrics Blogs **************/


exports.getPediatricsBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate,lang } = req.body || {};

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  VisiteurModel.getPediatricsBlogsModel(lang,startDate, endDate, req)
    .then((blogs) => {
      res.render("dashbordVisiteur/blogs/Pediatrics.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dashbordVisiteur/blogs/Pediatrics.ejs", {
        blogs: [],
        startDate,
        endDate,
        message: req.flash("msg")[0],
      });
    });
};

exports.postPediatricsBlogsPage = (req, res, next) => {
  const { startDate, endDate } = req.body;
  const lang = req.body.lang || 'en';

  // Appel du modèle avec ou sans plage de dates
  VisiteurModel.getPediatricsBlogsModel(lang,startDate, endDate,req)
    .then((blogs) => {
      res.render("dashbordVisiteur/blogs/Pediatrics.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/Pediatrics"); // Redirection vers elle-même avec message flash
    });
};



/************ parenting-advice Blogs ************/


exports.getParentingAdviceBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate,lang } = req.body || {};

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  VisiteurModel.getParentingAdviceBlogsModel(lang,startDate, endDate, req)
    .then((blogs) => {
      res.render("dashbordVisiteur/blogs/parenting-advice.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dashbordVisiteur/blogs/parenting-advice.ejs", {
        blogs: [],
        startDate,
        endDate,
        message: req.flash("msg")[0],
      });
    });
};

exports.postParentingAdviceBlogsPage = (req, res, next) => {
  const { startDate, endDate } = req.body;
  const lang = req.body.lang || 'en';

  // Appel du modèle avec ou sans plage de dates
  VisiteurModel.getParentingAdviceBlogsModel(lang,startDate, endDate,req)
    .then((blogs) => {
      res.render("dashbordVisiteur/blogs/parenting-advice.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/Parenting-advice"); // Redirection vers elle-même avec message flash
    });
};


/***************** other Blogs ******************/


exports.getOtherBlogsPage = (req, res, next) => {
  // Récupère les dates depuis le body
  let { startDate, endDate,lang } = req.body || {};

  // Si les dates ne sont pas fournies, les définir à null
  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  VisiteurModel.getOthersBlogsModel(lang,startDate, endDate, req)
    .then((blogs) => {
      res.render("dashbordVisiteur/blogs/others.ejs", {
        blogs,
        startDate,
        endDate,
        message: null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dashbordVisiteur/blogs/others.ejs", {
        blogs: [],
        startDate,
        endDate,
        message: req.flash("msg")[0],
      });
    });
};

exports.postOtherBlogsPage = (req, res, next) => {
  const { startDate, endDate } = req.body;
  const lang = req.body.lang || 'en';

  // Appel du modèle avec ou sans plage de dates
  VisiteurModel.getOthersBlogsModel(lang,startDate, endDate,req)
    .then((blogs) => {
      res.render("dashbordVisiteur/blogs/others.ejs", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        blogs: blogs,
        startDate,
        endDate,
        message:req.flash("msg")[0] || null,
        csrfToken: req.csrfToken()
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/Others"); // Redirection vers elle-même avec message flash
    });
};



/**************** details Blog *****************/


exports.getblogDetailsPage = (req, res, next) => {
  const blogID = req.params.blogID;

  VisiteurModel.getBlogByblogIDModel(blogID, req)
    .then(({ blog, comments }) => {
      // Calcul du nombre total de commentaires + sous-commentaires
      let totalComments = 0;
      comments.forEach(comment => {
        totalComments += 1; // commentaire principal
        if (Array.isArray(comment.replies)) {
          totalComments += comment.replies.length; // sous-commentaires
        }
      });

      res.render("dashbordVisiteur/blogs/blog-details.ejs", {
        blog,
        comments,
        totalComments, //on passe le total ici
        message: req.flash("msg")[0],
        messageType: req.flash("msgType")[0] || "success"
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      req.flash("msgType", "error");
      res.render("dashbordVisiteur/blogs/blog-details.ejs", {
        blog: null,
        comments: [],
        totalComments: 0, //valeur par défaut
        message: req.flash("msg")[0],
        messageType: req.flash("msgType")[0]
      });
    });
};




/************************ Contact ***********************/

exports.getContactPage = (req,res,next)=>{
    res.render("dashbordVisiteur/contact",{message:req.flash("msg")[0]});
}


/*********************** View Testimonial ***************/
exports.getAboutUsPage = (req,res,next)=>{
    res.render("dashbordVisiteur/about-us");
}

exports.postContactFromContactData = (req, res, next) => {
    const { name, email, phone, subject, message } = req.body;
    const lang = req.body.lang || 'en';
    // Envoi au modèle
    VisiteurModel.ContactFormModel({lang,name, email, phone, subject, message, req})
        .then((msg) => {
            req.flash("msg", msg);
            res.redirect("/contact");
        })
        .catch((err) => {
            req.flash("msg", err);
            res.redirect("/contact");
        });
};




