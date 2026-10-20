const Chat = require('../model/chat.model');

module.exports = async(req, res) =>{
  const myUser = res.locals.myUser;
  _io.once('connection', (socket) => {
    // const roomChatId = req.params.roomChatId
    socket.on("CLIENT_SEND_MESSAGE", async (data) => {
      // console.log(data);
      const objectChat = new Chat({
        user_id: myUser.id,
        content: data,
        // room_chat_id: roomChatId
      });
      await objectChat.save();
      const images = [];

      _io.emit("SERVER_RETURN_MESSAGE", {
        content: data,
        userId: myUser.id,
        fullName: myUser.fullName,
        images:  images
      });
    });
  });
}