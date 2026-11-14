const User = require('../model/user.model');

module.exports.requireAuth = async(req, res, next) =>{
  if(!req.cookies.tokenUser){
    return res.redirect("/auth/login");
  }
  else{
    const user = await User.findOne({
      tokenUser: req.cookies.tokenUser,
    }).select("-password -tokenUser");

    res.locals.myUser = user;
    
    if(!user){
      return res.redirect("/auth/login");
    }
    else{
      return next();
    }
  }
}