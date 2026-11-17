const User = require('../model/user.model');

// [GET] /profile/me
module.exports.me = async(req, res) =>{
  res.render('client/pages/profile/me.pug',{
    pageTitle: "Trang cá nhân"
  });
}

// [GET] /profile/me/edit
module.exports.edit = async(req, res) =>{
  res.render('client/pages/profile/edit.pug');
}

// [PATCH] /profile/me/edit
module.exports.editPatch = async(req, res) =>{
  try{
    const body = req.body;
    console.log(body);
    const myUser = res.locals.myUser;
    const result = await User.updateOne({
      _id: myUser.id,
    }, body);
    console.log(result);
    res.redirect(req.get("Referrer") || "/chat");
  }catch(error){
    console.log(error);
    res.redirect(req.get("Referrer") || "/chat");
  }
}

module.exports.detail = async(req, res) =>{
  try{
    const userId = req.params.userId;
    const profileUser = await User.findOne({
      _id: userId,
    }).select("-password -tokenUser");
    res.render('client/pages/profile/detail.pug', {
      pageTitle: `Trang cá nhân - ${profileUser.fullName}`,
      profileUser: profileUser
    });
  }catch(error){
    console.log(error);
    res.redirect("/chat");
  }
}