const User = require('../model/user.model');
const ForgotPassword = require('../model/forgot-password.model');
const generateHepler = require('../helper/generate');
const sendMailHelper = require('../helper/sendMail');

// [GET] /forgot
module.exports.index = async(req, res) =>{
  res.render("client/pages/forgot-password/index.pug", {
    pageTitle: "Quên mật khẩu"
  });
}

// [POST] /forgot
module.exports.forgotPasswordPost = async(req, res) =>{
  try{
    const email = req.body.email;

    const existedUser = await User.findOne({
      email: email,
      deleted: false,
    });

    if(!existedUser){
      req.flash("error", "Email không hợp lệ !");
      return res.redirect(req.get("Referrer") || "/auth/login");
    }
    
    const recivedEmail = email;
    const subject = "Vui lòng nhập mã OTP";
    const otp = generateHepler.generateOTP(8);
    let htmlText = `Vui lòng nhập mã OTP sau <b>${otp}</b>. OTP chỉ tồn tại trong 3 phút`;

    const objectForgotPassword = new ForgotPassword({
      email: email,
      otp: otp
    });
    const result = await objectForgotPassword.save();

    // console.log(result);
    sendMailHelper(recivedEmail, subject, htmlText);
    req.flash("success", "Vui lòng kiểm tra email để lấy mã OTP !")
    res.redirect(`/forgot/otp?email=${email}`);
  }catch(error){
    req.flash("error", "Gặp sự cố vui lòng thử lại !");
    res.redirect(req.get("Referrer") || "/forgot");
  }
}

// [GET] /forgot/otp
module.exports.otp = async(req, res) =>{
  const email = req.query.email;
  res.render("client/pages/forgot-password/otp.pug", {
    pageTitle: "Nhập OTP",
    email: email
  });
}

// [POST] /forgot/otp
module.exports.otpPost = async(req, res) =>{
  try{
    const email = req.body.email;
    const otp = req.body.otp;
    const objectExisted = await ForgotPassword.findOne({
      email: email,
      otp: otp
    });

    if(!objectExisted){
      req.flash("error", "Email hoặc mã OTP bị sai !");
      return res.redirect(req.get("Referrer") || `/forgot/otp?email=${email}`);
    }
    res.cookie("email", email);
    res.redirect(`/forgot/reset`);
  }catch(error){
    console.log(error);
    res.redirect(req.get("Referrer") || "/forgot/otp");
  }
}

// [GET] /forgot/reset
module.exports.reset = async(req, res) =>{
  res.render("client/pages/forgot-password/reset-password.pug", {
    pageTitle: "Đổi mật khẩu"
  })
}

// [PATCH] /forgot/reset
module.exports.resetPatch = async(req, res) =>{
  try{
    const email = req.cookies.email;
    const password = req.body.password;
    const confirmPassword = req.body.confirmPassword;
    console.log(email);
    const emailExisted = await User.findOne({
      email: email,
      deleted: false
    });

    if(!emailExisted){
      req.flash("error", "Email không tồn tại !");
      return res.redirect(req.get("Referrer") || `/forgot/reset`);
    }

    if(password !== confirmPassword){
      req.flash("error", "Mật khẩu xác nhận lại không khớp vui lòng thử lại !");
      return res.redirect(req.get("Referrer") || `/forgot/reset`);
    }

    const result = await User.updateOne({
      email: email
    }, {password: password});
    console.log(result);
    res.clearCookie("email");
    req.flash("success", "Đổi mật khẩu thành công !");
    res.redirect("/auth/login");
  }catch(error){
    console.log(error);
    res.redirect(req.get("Referrer") || "/forgot/reset");
  }
}