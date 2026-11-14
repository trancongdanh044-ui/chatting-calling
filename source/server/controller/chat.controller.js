const Chat = require('../model/chat.model');
const User = require('../model/user.model');
const RoomChat = require('../model/room-chat.model.js');
const timeHelper = require('../helper/time.js');
const roomChatHepler = require('../helper/room-chat.js');
const searchHelper = require('../helper/search.js');

// [GET] /chat
module.exports.index = async (req, res) => {
  try {
    // Room Chat List
    const myUser = res.locals.myUser;
    let roomChatList = await roomChatHepler.getRoomChatList(myUser);
    // End Room Chat List

    // Search
    if (req.query) {
      const keyword = req.query.keyword;
      roomChatList = searchHelper.searchRoomChatByTitle(keyword, roomChatList);
    }
    // End Search

    res.render("client/pages/chat/index.pug", {
      pageTitle: "Hãy bắt đầu trò chuyện",
      roomChatList: roomChatList
    });
  } catch (error) {
    console.log(error);
  }
}

// [GET] /chat/:roomChatId
module.exports.detail = async (req, res) => {
  try {
    // Room Chat List
    const myUser = res.locals.myUser;
    let roomChatList = await roomChatHepler.getRoomChatList(myUser);
    // End Room Chat List

    // Search
    // Search by title
    if (req.query.keyword) {
      const keyword = req.query.keyword;
      roomChatList = searchHelper.searchRoomChatByTitle(keyword, roomChatList);
    }
    // End search by title
    // End Search

    const roomChatId = req.params.roomChatId;
    // Lấy ra Room Chat theo id
    const myRoomChat = await RoomChat.findOne({
      _id: roomChatId,
      deleted: false,
      "users.user_id": myUser.id
    });
    if (!myRoomChat) return res.status(404).send("Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập.");

    if (myRoomChat.typeRoom === "friend") {
      const friendId = myRoomChat.users.find(user => user.user_id != myUser.id)?.user_id;
      const friend = await User.findOne({
        _id: friendId
      });
      myRoomChat.avatar = friend.avatar || "/client/images/avatar.jpg"
      myRoomChat.title = friend.fullName;
      myRoomChat.statusOnlineFriend = friend.statusOnline;
      myRoomChat.friendId = friendId;
      myRoomChat.friendLastOnline = timeHelper.getLastActiveText(friend.lastOnlineAt);
      myRoomChat.friendEmail = friend.email;
      myRoomChat.friendPhone = friend.phone;
    } else if (myRoomChat.typeRoom === "group") {
      if (!myRoomChat.avatar) {
        myRoomChat.avatar = "/client/images/group-avatar.png"
      }
    }
    // Hết lấy ra Room Chat theo id

    // Thông tin thành viên (hiển thị ở dấu i)
    const memberUsers = await User.find({
      _id: { $in: myRoomChat.users.map(user => user.user_id) }
    }).select("fullName avatar");

    const members = myRoomChat.users.map(user => {
      const info = memberUsers.find(item => item.id == user.user_id);
      return {
        id: user.user_id,
        fullName: info?.fullName || "Người dùng",
        avatar: info?.avatar || "/client/images/avatar.jpg",
        role: user.role
      };
    });
    // Hết thông tin thành viên

    // Chat
    let chats = await Chat.find({
      deleted: false,
      room_chat_id: roomChatId
    });

    // console.log(chats);
    for (const chat of chats) {
      const infoUser = await User.findOne({
        _id: chat.user_id
      }).select("fullName");
      chat.fullName = infoUser.fullName;
    }
    // End Chat

    // Dữ liệu cho phần thông tin (dấu i)
    const mediaImages = chats.flatMap(chat => chat.images);
    const createdAtText = new Date(myRoomChat.createdAt).toLocaleDateString("vi-VN");
    // Hết dữ liệu cho phần thông tin

    res.render("client/pages/chat/index.pug", {
      pageTitle: myRoomChat.title,
      roomChatList: roomChatList,
      chats: chats,
      myRoomChat: myRoomChat,
      members: members,
      mediaImages: mediaImages,
      createdAtText: createdAtText
    });
  } catch (error) {
    console.log(error);
    res.redirect("/chat");
  }
}