const AdminModel = require("../models/Admin")


/*-------------------------------------- All Accounts --------------------------------*/

/*********************** Pending Accounts ***************/

//Afficher tous les comptes en attente (avec filtrage par date)

exports.getPendingAccountsPage = (req, res, next) => {
  const userId = req.session.userID;
  let { startDate, endDate } = req.body || {};

  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  AdminModel.getPendingAccountsModel({ userId, startDate, endDate, req })
    .then((accounts) => {
      res.render("dashbordAdmin/Accounts/PendingAccount", {
        accounts,
        startDate,
        endDate,
        message: null
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dashbordAdmin/Accounts/PendingAccount", {
        accounts: [],
        startDate,
        endDate,
        message: req.flash("msg")[0]
      });
    });
};

//chercher des comptes en attente par date

exports.postPendingAccountsPage = (req, res, next) => {
  const userId = req.session.userID;
  const { startDate, endDate } = req.body;

  AdminModel.getPendingAccountsModel({ userId, startDate, endDate, req })
    .then((accounts) => {
      res.render("dashbordAdmin/Accounts/PendingAccount", {
        accounts,
        startDate,
        endDate,
        message: req.flash("msg")[0] || null,
        csrfToken: req.csrfToken(),
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/PendingAccounts");
    });
};

// Approuver un compte utilisateur en attente

exports.ApprovePendingAccount = (req, res, next) => {
  const AccountID = req.params.AccountID;
  const adminId = req.session.userID;

  if (!AccountID || !adminId) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  AdminModel.ApprovePendingAccountModel({ AccountID, adminId, req })
    .then(msg => res.json({ success: true, message: msg }))
    .catch(err => res.json({ success: false, message: err.message || err }));
};

// supprimer un compte utilisateur en attente 

exports.DeletePendingAccount = (req, res, next) => {
  const AccountID = req.params.AccountID;
  const adminId = req.session.userID;


  if (!AccountID || !adminId) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  AdminModel.DeletePendingAccountModel({ AccountID, adminId, req })
    .then(msg => res.json({ success: true, message: msg }))
    .catch(err => res.json({ success: false, message: err.message || err }));
};



/*********************** Active Accounts ****************/

//Afficher tous les comptes actives (avec filtrage par date)

exports.getActiveAccountsPage = (req, res, next) => {
  const userId = req.session.userID;
  const { startDate, endDate } = req.query;

  AdminModel.getActiveAccountsModel({ userId, startDate, endDate, req })
    .then(({ accounts }) => { // ici on récupère uniquement 'accounts', pas 'stats'
      res.render("dashbordAdmin/Accounts/ActiveAccount", {
        accounts,
        startDate,
        endDate,
        message: null
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dashbordAdmin/Accounts/ActiveAccount", {
        accounts: [],
        startDate,
        endDate,
        message: req.flash("msg")[0]
      });
    });
};

//chercher des comptes actives par date

exports.postActiveAccountsPage = (req, res, next) => {
  const userId = req.session.userID;
  const { startDate, endDate } = req.body;

  AdminModel.getActiveAccountsModel({ userId, startDate, endDate, req })
    .then(({ accounts }) => {
      res.render("dashbordAdmin/Accounts/ActiveAccount", {
        accounts,
        startDate,
        endDate,
        message: req.flash("msg")[0] || null,
        csrfToken: req.csrfToken(),
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/ActiveAccounts");
    });
};

// supprimer un compte utilisateur active 

exports.DeleteActiveAccount = (req, res, next) => {
  const AccountID = req.params.AccountID;
  const adminId = req.session.userID;

  if (!AccountID || !adminId) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  AdminModel.DeleteActiveAccountModel({ AccountID, adminId, req })
    .then(msg => res.json({ success: true, message: msg }))
    .catch(err => res.json({ success: false, message: err.message || err }));
};



/*-------------------------------------- All Accounts --------------------------------*/





/*-------------------------------------- All Blogs --------------------------------*/

/*********************** Pending Blogs ***************/

// afficher tout les Blogs en attente

exports.getPendingBlogsPage = (req, res, next) => {
  const userId = req.session.userID;
  let { startDate, endDate } = req.body || {};

  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  AdminModel.getPendingBlogsModel({ userId, startDate, endDate, req })
    .then((blogs) => {
      res.render("dashbordAdmin/Blogs/PendingBlogs", {
        blogs,
        startDate,
        endDate,
        message: null
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dashbordAdmin/Blogs/PendingBlogs", {
        blogs: [],
        startDate,
        endDate,
        message: req.flash("msg")[0]
      });
    });
};


//chercher des Blogs en attente par date

exports.postPendingBlogsPage = (req, res, next) => {
  const userId = req.session.userID;
  const { startDate, endDate } = req.body;

  AdminModel.getPendingBlogsModel({ userId, startDate, endDate, req })
    .then((blogs) => {
      res.render("dashbordAdmin/Blogs/PendingBlogs", {
        blogs,
        startDate,
        endDate,
        message: req.flash("msg")[0] || null,
        csrfToken: req.csrfToken(),
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/PendingBlogs");
    });
};


// approuver un Blog en attente 

exports.ApprovePendingBlog = (req, res, next) => {
  const BlogID = req.params.BlogID;
  const adminId = req.session.userID;

  if (!BlogID || !adminId) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  AdminModel.ApprovePendingBlogModel({ BlogID, adminId, req })
    .then(msg => res.json({ success: true, message: msg }))
    .catch(err => res.json({ success: false, message: err.message || err }));
};

// supprimer un Blog en attente  


exports.DeletePendingBlog = (req, res, next) => {
  const BlogID = req.params.BlogID;
  const adminId = req.session.userID;

  if (!BlogID || !adminId) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  AdminModel.DeletePendingBlogModel({ BlogID, adminId, req })
    .then(msg => res.json({ success: true, message: msg }))
    .catch(err => res.json({ success: false, message: err.message || err }));
};



/*********************** Active Blogs ****************/

// afficher tout les Blogs accéptés

exports.getActiveBlogsPage = (req, res, next) => {
  const userId = req.session.userID;
  let { startDate, endDate } = req.body || {};

  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  AdminModel.getApprovedBlogsModel({ userId, startDate, endDate, req })
    .then((blogs) => {
      res.render("dashbordAdmin/Blogs/ActiveBlogs", {
        blogs,
        startDate,
        endDate,
        currentUser: userId, // très important pour vérifier dans la vue EJS
        message: null
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dashbordAdmin/Blogs/ActiveBlogs", {
        blogs: [],
        startDate,
        endDate,
        currentUser: userId, // toujours utile même si erreur
        message: req.flash("msg")[0]
      });
    });
};

//chercher des Blogs accéptés par date

exports.postActiveBlogsPage = (req, res, next) => {
  const userId = req.session.userID;
  const { startDate, endDate } = req.body;

  AdminModel.getApprovedBlogsModel({ userId, startDate, endDate, req })
    .then((blogs) => {
      res.render("dashbordAdmin/Blogs/ActiveBlogs", {
        blogs,
        startDate,
        endDate,
        message: req.flash("msg")[0] || null,
        csrfToken: req.csrfToken(),
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/ActiveBlogs");
    });
};


// supprimer un Blog accépté


exports.DeleteActiveBlog = (req, res, next) => {
  const BlogID = req.params.BlogID;
  const adminId = req.session.userID;

  if (!BlogID || !adminId) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  AdminModel.DeleteActiveBlogModel({ BlogID, adminId, req })
    .then(msg => res.json({ success: true, message: msg }))
    .catch(err => res.json({ success: false, message: err.message || err }));
};


/************ supprimer commentaire **********/

exports.deleteComment = (req, res) => {
  const { blogId, commentId } = req.params;
  const userId = req.session.userID;

  if (!blogId || !commentId) {
    return res.status(400).json({ success: false, message: "Missing blog or comment ID." });
  }

  AdminModel.deleteCommentModel({userId, blogId, commentId, req })
    .then((msg) => {
      res.json({ success: true, message: msg });
    })
    .catch((err) => {
      res.status(500).json({ success: false, message: typeof err === "string" ? err : "Error deleting comment." });
    });
};


/******* supprimer une réponse (sous-commentaire) *******/

exports.deleteReply = (req, res) => {
  const { blogId, commentId, replyId } = req.params;
  const userId = req.session.userID;

  if (!blogId || !commentId || !replyId) {
    return res.status(400).json({ success: false, message: "Missing blog, comment or reply ID." });
  }

  AdminModel.deleteReplyModel({ userId, blogId, commentId, replyId, req })
    .then((msg) => {
      res.json({ success: true, message: msg });
    })
    .catch((err) => {
      res.status(500).json({ success: false, message: typeof err === "string" ? err : "Error deleting reply." });
    });
};






/*-------------------------------------- All Blogs --------------------------------*/




/*-------------------------------------- All Testimonials --------------------------*/

/*********************** Pending Testimonials ***************/

// afficher tout les témoignages en attente

exports.getPendingTestimonialsPage = (req, res, next) => {
  const userId = req.session.userID;
  let { startDate, endDate } = req.body || {};

  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  AdminModel.getPendingTestimonialsModel({ userId, startDate, endDate, req })
    .then((testimonials) => {
      res.render("dashbordAdmin/Testimonials/PendingTestimonials", {
        testimonials,
        startDate,
        endDate,
        message: null
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dashbordAdmin/Testimonials/PendingTestimonials", {
        testimonials: [],
        startDate,
        endDate,
        message: req.flash("msg")[0]
      });
    });
};

//chercher des témoignages en attente par date

exports.postPendingTestimonialsPage = (req, res, next) => {
    const userId = req.session.userID;
  const { startDate, endDate } = req.body;

  AdminModel.getPendingTestimonialsModel({userId, startDate, endDate, req })
    .then((testimonials) => {
      res.render("dashbordAdmin/Testimonials/PendingTestimonials", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        testimonials,
        startDate,
        endDate,
        message: req.flash("msg")[0] || null,
        csrfToken: req.csrfToken(),
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/PendingTestimonials"); // Redirection vers elle-même avec message flash
    });
};


// approuver un témoignage en attente

exports.ApprovePendingTestimonial = (req, res, next) => {
  const  TestimonialID = req.params.TestimonialID;
  const adminId = req.session.userID;


  if (!TestimonialID || !adminId) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  AdminModel.ApprovePendingTestimonialModel({ TestimonialID, adminId, req })
    .then(msg => res.json({ success: true, message: msg }))
    .catch(err => res.json({ success: false, message: err.message || err }));
};


// supprimer un témoignage en attente


exports.DeletePendingTestimonial = (req, res, next) => {
  const TestimonialID = req.params.TestimonialID;
  const adminId = req.session.userID;

  if (!TestimonialID || !adminId) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  AdminModel.DeletePendingTestimonialModel({ TestimonialID, adminId, req })
    .then(msg => res.json({ success: true, message: msg }))
    .catch(err => res.json({ success: false, message: err.message || err }));
};





/*********************** Active Testimonials ****************/

// afficher tout les témoignages accéptées

exports.getActiveTestimonialsPage = (req, res, next) => {
  const userId = req.session.userID;
  let { startDate, endDate } = req.body || {};

  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  AdminModel.getApprovedTestimonialsModel({ userId, startDate, endDate, req })
    .then((testimonials) => {
      res.render("dashbordAdmin/Testimonials/ActiveTestimonials", {
        testimonials,
        startDate,
        endDate,
        message: null
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dashbordAdmin/Testimonials/ActiveTestimonials", {
        testimonials: [],
        startDate,
        endDate,
        message: req.flash("msg")[0]
      });
    });
};


//chercher des témoignages accéptées par date

exports.postActiveTestimonialsPage = (req, res, next) => {
    const userId = req.session.userID;
  const { startDate, endDate } = req.body;

  AdminModel.getApprovedTestimonialsModel({userId, startDate, endDate, req })
    .then((testimonials) => {
      res.render("dashbordAdmin/Testimonials/ActiveTestimonials", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        testimonials,
        startDate,
        endDate,
        message: req.flash("msg")[0] || null,
        csrfToken: req.csrfToken(),
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/ActiveTestimonials"); // Redirection vers elle-même avec message flash
    });
};

// supprimer un témoignage accépté


exports.DeleteActiveTestimonial = (req, res, next) => {
  const TestimonialID = req.params.TestimonialID;
  const adminId = req.session.userID;

  if (!TestimonialID || !adminId) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  AdminModel.DeleteActiveTestimonialModel({ TestimonialID, adminId, req })
    .then(msg => res.json({ success: true, message: msg }))
    .catch(err => res.json({ success: false, message: err.message || err }));
};




/*-------------------------------------- All Testimonials --------------------------*/




/*-------------------------------------- All Messages --------------------------*/

// afficher tout les messages de contact

exports.getContactMessagesPage = (req, res, next) => {
  const userId = req.session.userID;
  let { startDate, endDate } = req.body || {};

  if (!startDate || !endDate) {
    startDate = null;
    endDate = null;
  }

  AdminModel.getAllContactMessagesModel({ userId, startDate, endDate, req })
    .then((contacts) => {
      res.render("dashbordAdmin/Messeges/AllMesseges", {
        contacts,
        startDate,
        endDate,
        message: null
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.render("dashbordAdmin/Messeges/AllMesseges", {
        contacts: [],
        startDate,
        endDate,
        message: req.flash("msg")[0]
      });
    });
};


//chercher les messages de contact par date


exports.postContactMessagesPage = (req, res, next) => {
  const userId = req.session.userID;
  const { startDate, endDate } = req.body;

  AdminModel.getAllContactMessagesModel({ userId, startDate, endDate, req })
    .then((contacts) => {
      res.render("dashbordAdmin/Messeges/AllMesseges", { // cas spécial sinon on va pas utiliser redirect et non pas regénérer le jeton
        contacts,
        startDate,
        endDate,
        csrfToken: req.csrfToken(),
        message: req.flash("msg")[0] || null,
      });
    })
    .catch((err) => {
      req.flash("msg", err);
      res.redirect("/ContactMessages");
    });
};


// supprimer un message de contact

exports.DeleteContactMessage = (req, res, next) => {
  const ContactID = req.params.ContactID;
  const adminId = req.session.userID;

  if (!ContactID || !adminId) {
    return res.status(400).json({ success: false, message: "Missing required fields." });
  }

  AdminModel.DeleteContactMessageModel({ ContactID, adminId, req })
    .then(msg => res.json({ success: true, message: msg }))
    .catch(err => res.json({ success: false, message: err.message || err }));
};


/*-------------------------------------- All Messages --------------------------*/