const User = require('../model/user.model');
const RoomChat = require('../model/room-chat.model');

// [GET] /group
module.exports.index = async(req, res) =>{
  const myUser = res.locals.myUser;
  const groupChatList = await RoomChat.find({
    deleted: false,
    typeRoom: "group",
    "users.user_id": myUser.id
  });
  res.render("client/pages/group/index.pug", {
    pageTitle: "Nhóm của bạn",
    groupChatList: groupChatList
  });
}

// [GET] /group/create
module.exports.create = async(req, res) =>{
  const myUser = res.locals.myUser;
  const friendIds = myUser.friendsList.map((friend) => friend.user_id);
  const friendsList = await User.find({
    _id: {$in: friendIds}
  }).select("_id fullName email avatar");
  // console.log(friendsList);
  res.render("client/pages/group/create.pug", {
    pageTitle: "Tạo nhóm",
    friendsList: friendsList
  });
}

// [POST] /group/create
module.exports.createPost = async(req, res) =>{
  const myUser = res.locals.myUser;
  const groupName = req.body.groupName;
  const members = req.body.members;
  console.log(members);
  let users = [];
  for(const id of members){
    users.push({
      user_id: id,
      role: "member"
    })
  }
  users.push({
    user_id: myUser.id,
    role: "superAdmin"
  })
  const objectRoomChat = new RoomChat({
    title: groupName,
    typeRoom: "group",
    users: users
  })

  const result = await objectRoomChat.save();
  if(result){
    req.flash("success", "Tạo nhóm thành công !");
    res.redirect("/group");
  }else{
    req.flash("error", "Tạo nhóm thất bại !");
    res.redirect(req.get("Referrer") || "/");
  }
}