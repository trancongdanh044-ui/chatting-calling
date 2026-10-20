const User = require('../model/user.model');
const friendSocket = require("../socket/friend.socket");

// [GET] /friend
module.exports.index = async (req, res) => {
  const myUser = res.locals.myUser;
  const friendIds = myUser.friendsList.map((friend) => friend.user_id);
  console.log(friendIds);
  let friendsList = await User.find({
    _id: {$in : friendIds}
  }).select("-password -tokenUser");
  console.log(friendsList);
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