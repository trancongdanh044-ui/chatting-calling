const homeRoute = require('./home.route');
const authRoute = require('./auth.route');
const friendRoute = require('./friend.route');

const authMiddleware = require('../middleware/auth.middleware');

module.exports = (app) =>{
  app.use("/auth", authRoute);

  app.use("/", authMiddleware.requireAuth, homeRoute);

  app.use("/friend", authMiddleware.requireAuth, friendRoute);
}