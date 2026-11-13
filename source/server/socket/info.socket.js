const RoomChat = require('../model/room-chat.model');
const uploadImage = require('../helper/uploadImage');

// Các màu chủ đề cho phép ("" = mặc định)
const THEMES = ["", "#fa3c4c", "#44bec7", "#ffc300", "#7646ff", "#e91e63", "#00a400"];

// Chức năng ở dấu i: đổi tên, đổi ảnh, đổi chủ đề, xóa thành viên, rời nhóm
module.exports = (io) => {
  io.on("connection", (socket) => {
    if (!socket.userId) return;
    // Lấy phòng chat mà người gửi hiện là thành viên (socket.userId do auth.socket.js gán).
    const getRoom = async (roomChatId) => {
      if (!socket.userId) {
        return null;
      }
      return await RoomChat.findOne({
        _id: roomChatId,
        deleted: false,
        "users.user_id": socket.userId
      });
    };

    // Báo cho các thành viên để cập nhật lại giao diện
    const notify = (userIds, data) => {
      userIds.forEach(id => io.to("user:" + id).emit("SERVER_ROOM_UPDATED", data));
    };

    const removeUserFromChatRoom = async (userId, roomChatId) => {
      const sockets = await io.in("user:" + userId).fetchSockets();
      sockets.forEach(userSocket => userSocket.leave("chat:" + roomChatId));
    };

    const sendError = (message) => {
      socket.emit("SERVER_ROOM_ERROR", { message: message });
    };

    // Bọc try/catch để lỗi không làm sập server
    const on = (event, handler) => {
      socket.on(event, async (data) => {
        try {
          await handler(data || {});
        } catch (error) {
          console.log("Lỗi " + event + ":", error);
          sendError("Có lỗi xảy ra, vui lòng thử lại");
        }
      });
    };

    // Đổi tên nhóm
    on("CLIENT_ROOM_RENAME", async (data) => {
      const room = await getRoom(data.roomChatId);
      const title = (data.title || "").trim();
      if (!room || room.typeRoom !== "group" || !title || title.length > 50) {
        return sendError("Không thể đổi tên đoạn chat");
      }
      room.title = title;
      await room.save();
      notify(room.users.map(user => user.user_id), { roomChatId: room.id });
    });

    // Đổi chủ đề (màu tin nhắn)
    on("CLIENT_ROOM_THEME", async (data) => {
      const room = await getRoom(data.roomChatId);
      if (!room || !THEMES.includes(data.theme)) {
        return sendError("Không thể đổi chủ đề");
      }
      room.theme = data.theme;
      await room.save();
      notify(room.users.map(user => user.user_id), { roomChatId: room.id, theme: data.theme });
    });

    // Đổi ảnh nhóm
    on("CLIENT_ROOM_AVATAR", async (data) => {
      const room = await getRoom(data.roomChatId);
      if (!room || room.typeRoom !== "group" || !data.file) {
        return sendError("Không thể đổi ảnh đoạn chat");
      }
      let url;
      try {
        url = await uploadImage(data.file);
      } catch (error) {
        console.log("Lỗi upload ảnh nhóm:", error);
        return sendError("Không tải được ảnh lên, vui lòng thử lại");
      }
      room.avatar = url;
      await room.save();
      notify(room.users.map(user => user.user_id), { roomChatId: room.id });
    });

    // Trưởng nhóm xóa thành viên
    on("CLIENT_ROOM_REMOVE_MEMBER", async (data) => {
      const room = await getRoom(data.roomChatId);
      if (!room || room.typeRoom !== "group") {
        return sendError("Không thể xóa thành viên");
      }
      const me = room.users.find(user => user.user_id == socket.userId);
      const target = room.users.find(user => user.user_id == data.userId);
      if (me.role !== "superAdmin" || !target || target.user_id == socket.userId) {
        return sendError("Bạn không có quyền xóa thành viên này");
      }
      const memberIds = room.users.map(user => user.user_id);
      await RoomChat.updateOne({ _id: room.id }, { $pull: { users: { user_id: data.userId } } });
      await removeUserFromChatRoom(data.userId, room.id);
      notify(memberIds, { roomChatId: room.id, removedUserId: data.userId });
    });

    // Rời nhóm
    on("CLIENT_ROOM_LEAVE", async (data) => {
      const room = await getRoom(data.roomChatId);
      if (!room || room.typeRoom !== "group") {
        return sendError("Không thể rời đoạn chat này");
      }
      const me = room.users.find(user => user.user_id == socket.userId);
      const remaining = room.users.filter(user => user.user_id != socket.userId);
      const memberIds = room.users.map(user => user.user_id);

      if (remaining.length === 0) {
        // Không còn ai thì xóa nhóm
        await RoomChat.updateOne({ _id: room.id }, { deleted: true });
      } else {
        await RoomChat.updateOne({ _id: room.id }, { $pull: { users: { user_id: socket.userId } } });
        // Trưởng nhóm rời đi mà không còn trưởng nhóm thì chuyển cho người kế tiếp
        if (me.role === "superAdmin" && !remaining.some(user => user.role === "superAdmin")) {
          await RoomChat.updateOne(
            { _id: room.id, "users.user_id": remaining[0].user_id },
            { $set: { "users.$.role": "superAdmin" } }
          );
        }
      }
      await removeUserFromChatRoom(socket.userId, room.id);
      notify(memberIds, { roomChatId: room.id, removedUserId: socket.userId });
    });
  });
};
