const Chat = require('../model/chat.model');
const User = require('../model/user.model');
const RoomChat = require('../model/room-chat.model.js');
const chatSocket = require('../socket/chat.socket');
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
      roomChatList = searchHelper.searchRoomChat(req.query, roomChatList);
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
    // Chat socket
    chatSocket(req, res);
    // End chat socket

    // Room Chat List
    const myUser = res.locals.myUser;
    let roomChatList = await roomChatHepler.getRoomChatList(myUser);
    // End Room Chat List

    // Search
     if (req.query) {
      roomChatList = searchHelper.searchRoomChat(req.query, roomChatList);
    }
    // End Search

    const roomChatId = req.params.roomChatId;
    // Lấy ra Room Chat theo id
    const myRoomChat = await RoomChat.findOne({
      _id: roomChatId,
      deleted: false
    });

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
    } else if (myRoomChat.typeRoom === "group") {
      if (!myRoomChat.avatar) {
        myRoomChat.avatar = "/client/images/group-avatar.png"
      }
      myRoomChat.myRole = myRoomChat.users.find((user) => myUser.id === user.user_id)?.role;
      myUser.myRole =  myRoomChat.myRole;
      const memberProfiles = await User.find({
        _id: { $in: myRoomChat.users.map(user => user.user_id) }
      }).select("fullName avatar").lean();
      const profilesById = new Map(memberProfiles.map(user => [String(user._id), user]));
      myRoomChat.members = myRoomChat.users.map(member => {
        const profile = profilesById.get(member.user_id);
        return {
          userId: member.user_id,
          fullName: profile?.fullName || "Người dùng không còn tồn tại",
          avatar: profile?.avatar || "/client/images/avatar.jpg",
          role: member.role,
          isMe: member.user_id === myUser.id,
          hasProfile: Boolean(profile)
        };
      });
    }
    // Hết lấy ra Room Chat theo id

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

    res.render("client/pages/chat/index.pug", {
      pageTitle: myRoomChat.title,
      roomChatList: roomChatList,
      chats: chats,
      myRoomChat: myRoomChat
    });
  } catch (error) {
    console.log(error);
    res.redirect("/chat");
  }
}
