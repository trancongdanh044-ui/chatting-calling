const homeRoute = require('./home.route');
const authRoute = require('./auth.route');
const friendRoute = require('./friend.route');
const chatRoute = require('./chat.route');
const groupRoute = require('./group.route');
const profileRoute = require('./profile.route');
const forgotPasswordRoute = require('./forgot-password.route');

const authMiddleware = require('../middleware/auth.middleware');

module.exports = (app) =>{
  app.use("/auth", authRoute);

  app.get("/", (req, res) =>{
    return res.redirect("/chat");
  });

  app.use("/forgot", forgotPasswordRoute);

  app.use("/friend", authMiddleware.requireAuth, friendRoute);

  app.use("/chat", authMiddleware.requireAuth, chatRoute);
  
  app.use("/group", authMiddleware.requireAuth, groupRoute);
  
  app.use("/profile", authMiddleware.requireAuth, profileRoute);
}