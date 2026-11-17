const User = require('../model/user.model');
const RoomChat = require('../model/room-chat.model');

// [GET] /group
module.exports.index = async (req, res) => {
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
module.exports.create = async (req, res) => {
  const myUser = res.locals.myUser;
  const friendIds = myUser.friendsList.map((friend) => friend.user_id);
  const friendsList = await User.find({
    _id: {
      $in: friendIds
    }
  }).select("_id fullName email avatar");
  // console.log(friendsList);
  res.render("client/pages/group/create.pug", {
    pageTitle: "Tạo nhóm",
    friendsList: friendsList
  });
}

// [POST] /group/create
module.exports.createPost = async (req, res) => {
  const myUser = res.locals.myUser;
  const groupName = req.body.groupName;
  const members = req.body.members || [];
  if (typeof members === "string" || members.length < 2) {
    req.flash("error", "Chỉ cho phép tạo nhóm từ 3 người trở lên !");
    return res.redirect(req.get("Referrer" || "/chat"));
  }
  let users = [];
  for (const id of members) {
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
  if (result) {
    req.flash("success", "Tạo nhóm thành công !");
    res.redirect("/group");
  } else {
    req.flash("error", "Tạo nhóm thất bại !");
    res.redirect(req.get("Referrer") || "/");
  }
}

// [GET] /group/:roomChatId/add-member
module.exports.addMember = async (req, res) => {
  const roomChatId = req.params.roomChatId;
  const myRoomChat = await RoomChat.findOne({
    _id: roomChatId,
  });
  const myUser = res.locals.myUser;
  const friendIds = myUser.friendsList.map((friend) => friend.user_id);
  const friendIdsInMyRoomChat = myRoomChat.users.map((user) => user.user_id);
  const myFriends = await User.find({
    $and: [{
        _id: {
          $in: friendIds
        }
      },
      {
        _id: {
          $nin: friendIdsInMyRoomChat
        }
      }
    ],
  }).select("-password -tokenUser");
  // console.log(myFriends);

  res.render("client/pages/group/add-member.pug", {
    pageTitle: "Thêm thành viên",
    myRoomChatId: roomChatId,
    candidates: myFriends
  });
}

// [PATCH] /group/:roomChatId/add-members
module.exports.addMemberPatch = async (req, res) => {
  try {
    const roomChatId = req.params.roomChatId;
    const members = req.body.members;
    if (!members) {
      return res.redirect(`/chat/${roomChatId}`);
    }
    const memberIds = Array.isArray(members) ? members : [members];
    await RoomChat.updateOne({
      _id: roomChatId
    }, {
      $push: {
        users: {
          $each: memberIds.map(userId => ({
            user_id: userId,
            role: "member"
          }))
        }
      }
    });
    return res.redirect(`/chat/${roomChatId}`);
  } catch (error) {
    console.error(error);
    return res.redirect("/chat");
  }
};

// [GET] /group/:roomChatId/change-role/:userId
module.exports.changeRole = async (req, res) => {
  try {
    const myUser = res.locals.myUser;
    const userId = req.params.userId;
    const roomChatId = req.params.roomChatId;
    // Không cho chuyển quyền cho chính mình
    if (String(myUser.id) === String(userId)) {
      req.flash("error", "Không thể chuyển quyền cho chính mình");
      return res.redirect(req.get("Referrer") || "/chat")
    }

    const result = await RoomChat.updateOne({
      _id: roomChatId,
      deleted: false,
      typeRoom: "group",
      $and: [{
          users: {
            $elemMatch: {
              user_id: myUser.id,
              role: "superAdmin",
            },
          },
        },
        {
          "users.user_id": userId
        },
      ],
    }, {
      $set: {
        "users.$[target].role": "superAdmin",
        "users.$[current].role": "member",
      },
    }, {
      arrayFilters: [{
          "target.user_id": userId
        },
        {
          "current.user_id": myUser.id
        },
      ],
    });

    if (result.matchedCount === 0) {
      req.flash("error", "Chuyển quyền thất bại !");
      return res.redirect(req.get("Referrer") || "/chat");
    }
    req.flash("success", "Chuyển quyển thành công !");
    return res.redirect(req.get("Referrer") || "/chat");
  } catch (error) {
    console.log(error);
    res.redirect("/chat");
  }
}

// [GET] /group/:roomChatId/delete-member/:userId
module.exports.deleteMember = async (req, res) => {
  try {
    const { userId, roomChatId } = req.params;
    const myUser = res.locals.myUser;

    if (String(myUser.id) === String(userId)) {
      req.flash("error", "Bạn cần chuyển quyền trước khi rời nhóm!");
      return res.redirect(req.get("Referrer") || "/chat");
    }

    const result = await RoomChat.updateOne(
      {
        _id: roomChatId,
        deleted: false,
        typeRoom: "group",
        $and: [
          {
            users: {
              $elemMatch: {
                user_id: myUser.id,
                role: "superAdmin",
              },
            },
          },
          { "users.user_id": userId },
        ],
      },
      {
        $pull: {
          users: { user_id: userId },
        },
      }
    );

    if (result.modifiedCount === 0) {
      req.flash("error", "Xóa không thành công!");
      return res.redirect(req.get("Referrer") || "/chat");
    }

    req.flash("success", "Xóa thành công!");
    return res.redirect(req.get("Referrer") || "/chat");
  } catch (error) {
    console.error(error);
    req.flash("error", "Đã xảy ra lỗi khi xóa thành viên!");
    return res.redirect(req.get("Referrer") || "/chat");
  }
};

// [PATCH] /group/leave/:roomChatId
module.exports.leave = async (req, res) => {
  try {
    const roomChatId = req.params.roomChatId;
    const userId = res.locals.myUser.id;

    console.log(roomChatId);
    console.log(userId);

    const result = await RoomChat.updateOne({
      _id: roomChatId,
      deleted: false,
      typeRoom: "group",
      users: {
        $elemMatch: {
          user_id: userId,
          role: "member"
        }
      }
    }, {
      $pull: {
        users: {
          user_id: userId
        }
      }
    });

    console.log(result);

    if (result.modifiedCount === 0) {
      req.flash("error", "Không thể rời nhóm.");
      return res.redirect("/chat");
    }

    req.flash("success", "Đã rời khỏi nhóm.");
    return res.redirect("/chat");
  } catch (error) {
    console.log(error);
    return res.redirect("/chat");
  }
};

// [DELETE] /group/disband/:roomChatId
module.exports.disband = async (req, res) => {
  res.send('ok');
}