exports.isAuth = (req,res,next)=>{
    if(req.session.userID){
        next()
    }else{
        res.redirect("/home");
    }
}


exports.nonAuth = (req, res, next) => {
  if (!req.session.userID) {
    return next();
  }

  // Si l'utilisateur est connecté, redirige selon son rôle
  const role = req.session.role;

  if (role === "parent") {
    return res.redirect("/MyApp");
  } else if (role === "doctor") {
    return res.redirect("/MyAppoitements");
  }else if (role === "admin") {
    return res.redirect("/PendingAccounts");
  } else {
    // Redirection de secours pour les autres rôles ou incohérences
    return res.redirect("/home");
  }
};
  


exports.hasRole = (expectedRole) => {
  return (req, res, next) => {
    if (req.session.userID && req.session.role === expectedRole) {
      next();
    } else {
      res.redirect("/home");
    }
  };
};
  