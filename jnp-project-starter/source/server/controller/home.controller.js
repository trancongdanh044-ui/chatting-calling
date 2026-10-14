module.exports.index = async(req, res) =>{
  res.render("../../client/view/client/pages/home/index.pug", {
    pageTitle: "Trang chủ"
  });
}