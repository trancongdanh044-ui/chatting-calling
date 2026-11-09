const User = require('../model/user.model');

module.exports = async (req, res, data) => {
  _io.once('connection', async (socket) => {
    socket.broadcast.emit("CLIENT_CHANGE_STATUS", data);
  });
}