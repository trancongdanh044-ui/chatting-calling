const Chat = require('../model/chat.model');
const RoomChat = require('../model/room-chat.model');
const uploadImage = require('../helper/uploadImage');

module.exports = async(req, res) =>{
  const myUser = res.locals.myUser;
  const roomChatId = req.params.roomChatId;
  _io.once('connection', (socket) => {
    socket.join(roomChatId);
    socket.on("CLIENT_SEND_MESSAGE", async (data) => {
      // console.log(data);
      const images = data.images;
      let urlImages = [];
      for(const image of images){
        const url = await uploadImage(image);
        urlImages.push(url);
      }
      // console.log(urlImages);
      if(!data.content && images.length <= 0){
        return;
      }
      const objectChat = new Chat({
        user_id: myUser.id,
        content: data.content,
        images: urlImages,
        room_chat_id: roomChatId
      });
      await objectChat.save();
      let latestMessage = {};
      if(data.content){
        latestMessage.content = data.content;
      }
      if(!data.content && images.length > 0){
        latestMessage.content = `Đã gửi ${images.length} ảnh mới`;
      }
      latestMessage.user_id = data.myUserId;
      latestMessage.user_name = data.myUserName;

      await RoomChat.updateOne({
        _id: roomChatId,
      }, {latestMessage: latestMessage});
      _io.to(roomChatId).emit("SERVER_RETURN_MESSAGE", {
        content: data.content,
        userId: myUser.id,
        fullName: myUser.fullName,
        avatar: myUser.avatar,
        images:  urlImages
      });
    });
  });
}