const User = require('../model/user.model');
const RoomChat = require('../model/room-chat.model');
const friendSocket = require("../socket/friend.socket");

// [GET] /friend
module.exports.index = async (req, res) => {
  const myUser = res.locals.myUser;
  const friendIds = myUser.friendsList.map((friend) => friend.user_id);
  // console.log(friendIds);
  let friendsList = await User.find({
    _id: {$in : friendIds}
  }).select("-password -tokenUser");

  for(const friend of friendsList){
    // console.log(friend);
    const roomChat = await RoomChat.findOne({
      "users.user_id": {
        $all: [myUser.id, friend.id]
      }
    }).select("id");
    friend.roomChatId = roomChat.id
    // console.log(friend.roomChatId);
  }
  // console.log(friendsList);
  res.render("client/pages/friend/index.pug", {
    pageTitle: "Trang danh sách bạn bè",
    friendsList: friendsList
  });
}

// [GET] /friend/hint
module.exports.hint = async (req, res) => {
  // Friend Socket
  friendSocket(req, res);
  // End Friend Socket
  
  const myUser = res.locals.myUser;
  const friendIds = myUser.friendsList.map((friend) => friend.user_id)
  const userList = await User.find({
    $and: [{
        _id: {
          $ne: myUser.id
        }
      },
      {
        _id: {
          $nin: myUser.requestFriends
        }
      },{
        _id: {
          $nin : myUser.invitationFriends
        }
      },{
        _id:{
          $nin: friendIds
        }
      }
    ]
  }).select("-password -tokenUser");
  // console.log(userList);
  res.render("client/pages/friend/hint.pug", {
    pageTitle: "Trang gợi ý bạn bè",
    userHintList: userList
  })
}

// [GET] /friend/request
module.exports.request = async(req, res) =>{
  // Friend Socket
  friendSocket(req, res);
  // End Friend Socket
  const myUser = res.locals.myUser;
  const requestIds = myUser.requestFriends;
  const requestFriends = await User.find({
    _id : {$in: requestIds}
  }).select("-password -tokenUser");
  res.render("client/pages/friend/request.pug", {
    pageTitle: "Trang yêu cầu kết bạn đã gửi",
    requestFriends: requestFriends
  });
}

// [GET] /friend/invitation
module.exports.invitation = async(req, res) =>{
  // Friend Socket
  friendSocket(req, res);
  // End Friend Socket
  const myUser = res.locals.myUser;
  const invitationIds = myUser.invitationFriends;
  const invitationFriends = await User.find({
    _id: {$in: invitationIds}
  });
  res.render("client/pages/friend/invitation.pug", {
    pageTitle: "Trang lời mời kết bạn",
    invitationFriends: invitationFriends
  });
}

// [GET] /friend/delete/:friendId
module.exports.deleteFriend = async(req, res) =>{
  try{
    const myUser = res.locals.myUser;
    const friendId = req.params.friendId;

    // Xoá kết bạn ở phía mình
    const resultFriend1 = await User.updateOne({
      _id: myUser.id,
      deleted: false,
    }, {
      $pull: {friendsList: {user_id :friendId}}
    });
    
    // Xoá kết bạn ở phía người còn lại
    const resultFriend2 = await User.updateOne({
      _id: friendId,
    }, {
      $pull: {friendsList: {user_id: myUser.id}}
    })
    console.log(resultFriend1);
    console.log(resultFriend2);

    // Chuyển trạng thái phòng chat sang deleted: true
    const resultRoomChat = await RoomChat.updateOne({
      typeRoom: "friend",
      deleted: false,
      $and:[
        {users: {
          $elemMatch: {
            user_id: myUser.id,
            role: "superAdmin"
          }
        }},
        {users: {
          $elemMatch: {
            user_id: friendId,
            role: "superAdmin"
          }
        }}
      ]
    }, {deleted: true});
    console.log(resultRoomChat);
    res.redirect(req.get("Referrer") || "/friend");
  }catch(error){
    console.log(error);
    res.redirect(req.get("Referrer") || "/friend");
  }
}