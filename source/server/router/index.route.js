const authRoute = require('./auth.route');
const friendRoute = require('./friend.route');
const chatRoute = require('./chat.route');
const groupRoute = require('./group.route');

const authMiddleware = require('../middleware/auth.middleware');

module.exports = (app) =>{
  app.use("/auth", authRoute);

  app.get('/', (req, res) => {
    if (req.cookies && req.cookies.tokenUser) return res.redirect('/chat');
    return res.redirect('/auth/login');
  });

  app.use("/friend", authMiddleware.requireAuth, friendRoute);

  app.use("/chat", authMiddleware.requireAuth, chatRoute);
  
  app.use("/group", authMiddleware.requireAuth, groupRoute);
}