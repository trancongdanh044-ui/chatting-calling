module.exports.login = async (req, res) => {
  res.render("client/pages/user-auth/login.pug", {
    pageTitle: "Đăng nhập",
  });
};

module.exports.signUp = async (req, res) => {
  res.render("client/pages/user-auth/sign-up.pug", {
    pageTitle: "Đăng ký tài khoản",
  });
}