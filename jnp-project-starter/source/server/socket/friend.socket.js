const User = require('../model/user.model');
const sizeAlert = require('../helper/size-alert');
const RoomChat = require('../model/room-chat.model');

module.exports = async (req, res) => {
  const myUser = res.locals.myUser;
  _io.once('connection', (socket) => {
    // Tính năng gửi yêu cầu kết bạn
    socket.on("CLIENT_ADD_FRIEND", async (data) => {
      const myUserId = myUser.id; // userAId - người gửi yêu cầu kết bạn
      const reqUserId = data.reqUserId; // userBId - người nhận yêu cầu kết bạn

      // Thêm B vào requestFriends của A
      await User.updateOne({
        _id: myUserId,
        requestFriends: {
          $ne: reqUserId
        }
      }, {
        $push: {
          requestFriends: reqUserId
        }
      });
      // Thêm A vào inviationFriends của B
      await User.updateOne({
        _id: reqUserId,
        invitationFriends: {
          $ne: myUserId
        }
      }, {
        $push: {
          invitationFriends: myUserId
        }
      });

      // SERVER trả về thông tin của người gửi yêu cầu kết bạn
      socket.broadcast.emit("SERVER_RETURN_ADD_FRIEND", {
        user: myUser,
        myUserId: reqUserId
      });

      sizeAlert.lengthOfInviation(reqUserId, socket);
    });

    // Tính năng huỷ yêu kết bạn
    socket.on("CLIENT_CANCEL_REQUEST", async (data) => {
      const myUserId = myUser.id; // userAId - người (chủ động) huỷ yêu cầu kết bạn
      const userId = data.userId; // userBId - người được gửi yêu cầu kết bạn

      // Xoá B khỏi requestFriends của A
      await User.updateOne({
        _id: myUserId,
        requestFriends: userId
      }, {
        $pull: {
          requestFriends: userId
        }
      });
      // Xoá A khỏi invitationFriends của B
      await User.updateOne({
        _id: userId,
        invitationFriends: myUserId
      }, {
        $pull: {
          invitationFriends: myUserId
        }
      });

      // SERVER trả về người dùng huỷ yều A cầu cho B
      socket.broadcast.emit("SERVER_RETURN_CANCEL_USER", {
        userId: myUserId,
        myUserId: userId
      });

      // Trả về số lời mời kết bạn
      sizeAlert.lengthOfInviation(userId, socket);
      // Hết trả về số lời mời kết bạn
    });


    // Tính năng thu hồi kết bạn
    socket.on("CLIENT_REVOKE_REQUEST", async (data) => {
      const myUserId = myUser.id; // userAId - người (chủ động) huỷ yêu cầu kết bạn
      const userId = data.userId; // userBId - người được gửi yêu cầu kết bạn

      // Xoá B khỏi requestFriends của A
      await User.updateOne({
        _id: myUserId,
        requestFriends: userId
      }, {
        $pull: {
          requestFriends: userId
        }
      });
      // Xoá A khỏi invitationFriends của B
      await User.updateOne({
        _id: userId,
        invitationFriends: myUserId
      }, {
        $pull: {
          invitationFriends: myUserId
        }
      });

      // SERVER trả về người dùng huỷ yều A cầu cho B
      socket.broadcast.emit("SERVER_RETURN_REVOKE_USER", {
        userId: myUserId,
        myUserId: userId
      });
    });


    // Tính năng từ chối kết bạn
    socket.on("CLIENT_REFUSE_FRIEND", async (data) => {
      const myUserId = myUser.id; // userAId
      const userId = data.userId; // userBId

      // Xoá B khỏi invitationFriends của A
      await User.updateOne({
        _id: myUserId,
        invitationFriends: userId
      }, {
        $pull: {
          invitationFriends: userId
        }
      });
      // Xoá A khỏi requestFriends của B
      await User.updateOne({
        _id: userId,
        requestFriends: myUserId
      }, {
        $pull: {
          requestFriends: myUserId
        }
      })

      // SERVER trả về người từ chối kết bạn
      socket.broadcast.emit("SERVER_RETURN_REFUSE_USER", {
        user: myUser,
        myUserId: userId
      });

      // SERVER trả về số lời mời kết bạn
      sizeAlert.lengthOfInviationWithEmit(myUserId, socket);
    });


    // Tính năng chấp nhận kết bạn
    socket.on("CLIENT_ACCEPT_FRIEND", async (data) => {
      const myUserId = myUser.id; // userAId - người chấp nhận
      const userId = data.userId; // userBId - người gửi yêu cầu kết bạn

      // Thêm B vào friendsList của A và xoá B khỏi invitationFriends của A
      const userAInB = await User.findOne({
        _id: myUserId,
        invitationFriends: userId
      });

      const userBInA = await User.findOne({
        _id: userId,
        requestFriends: myUserId
      });
      let roomChat;
      if(userAInB && userBInA){
        roomChat = new RoomChat({
          typeRoom: "friend",
          users:[
            {
              user_id: userId,
              role: "superAdmin"
            },
            {
              user_id: myUser.id,
              role: "superAdmin"
            }
          ]
        });
        await roomChat.save();
      }
      await User.updateOne({
        _id: myUserId,
        invitationFriends: userId,
      }, {
        $pull: {
          invitationFriends: userId
        },
        $push: {
          friendsList: {
            user_id: userId,
            room_chat_id: roomChat.id
          }
        }
      });
      // Thêm A vào friendsList của B và xoá A khỏi requestFriends của B
      await User.updateOne({
        _id: userId,
        requestFriends: myUserId,
      }, {
        $pull: {
          requestFriends: myUserId
        },
        $push: {
          friendsList: {
            user_id: myUserId,
            room_chat_id: roomChat.id
          }
        }
      });
      // SERVER trả về số lời mời kết bạn
      sizeAlert.lengthOfInviationWithEmit(myUserId, socket);
    });
  });
}