const User = require('../model/user.model.js');
const userSocket = require('../socket/user.socket.js');
const md5 = require('md5');
const generateHepler = require('../helper/generate.js');
const timeHelper = require('../helper/time.js');

// [GET] /auth/login
module.exports.login = async (req, res) => {
  res.render("client/pages/user-auth/login.pug", {
    pageTitle: "Đăng nhập",
  });
};

// [POST] /auth/login
module.exports.loginPost = async (req, res) => {
  try {
    // console.log(req.body);
    const email = req.body.email;
    const password = md5(req.body.password);

    const userExist = await User.findOne({
      email: email,
      password: password,
      deleted: false
    });

    if (userExist) {
      // console.log(userExist);
      res.cookie("tokenUser", userExist.tokenUser, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
      await User.updateOne({
        _id: userExist.id
      }, {
        statusOnline: "online"
      });

      const data = {
        userId:userExist.id,
        statusOnline: "online"
      };

      userSocket(req, res, data);
      
      req.flash("success", "Đăng nhập thành công!");
      res.redirect("/chat");
    } else {
      req.flash("error", "Tài khoản không tồn tại hoặc sai mật khẩu!");
      res.redirect("/auth/login");
    }
  } catch (error) {
    console.log(error);
    res.redirect("/auth/login");
  }
}

// [GET] /auth/sign-up
module.exports.signUp = async (req, res) => {
  res.render("client/pages/user-auth/sign-up.pug", {
    pageTitle: "Đăng ký tài khoản",
  });
}

// [POST] /auth/sign-up
module.exports.signUpPost = async (req, res) => {
  try {
    const email = req.body.email;

    const emailExist = await User.findOne({
      email: email
    });

    if (emailExist) {
      req.flash("error", "Email này đã được dùng làm tài khoản!");
      res.redirect(req.get("Referrer") || "/auth/sign-up");
    } else {
      const fullName = req.body.fullName;
      const password = md5(req.body.password);
      const phone = req.body.phone;
      const tokenUser = generateHepler.generateRandomString(20);
      const objectUser = new User({
        email: email,
        fullName: fullName,
        password: password,
        phone: phone,
        tokenUser: tokenUser
      });
      const result = await objectUser.save();
      req.flash("success", "Đăng ký thành công!");
      res.redirect("/");
    }
  } catch (error) {
    console.log(error);
    req.flash("error", "Đăng ký không thành công!");
    res.redirect("/auth/sign-up");
  }
}

// [GET] /auth/logout
module.exports.logOut = async (req, res) => {
  const myUser = res.locals.myUser;
  await User.updateOne({
    _id: myUser.id
  }, {
    statusOnline: "offline",
    lastOnlineAt: Date.now()
  });

  const data = {
    userId: myUser.id,
    statusOnline: "offline",
    friendLastOnline: timeHelper.getLastActiveText(myUser.lastOnlineAt)
  };
  // User Socket
  userSocket(req, res, data);
  // End User Socket

  res.clearCookie("tokenUser", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  res.redirect("/auth/login");
}