const User = require('../model/user.model');
const RoomChat = require('../model/room-chat.model');

module.exports = (io) => {
  io.on('connection', (socket) => {
    if (!socket.userId) return;

    const sendError = (message) => socket.emit('SERVER_FRIEND_ERROR', { message });
    const notifyUser = (userId, event, payload) => io.to(`user:${userId}`).emit(event, payload);
    const publicUser = (user) => ({
      _id: String(user.id),
      fullName: user.fullName || 'Người dùng',
      avatar: user.avatar || '/client/images/avatar.jpg'
    });
    const sendInvitationCount = async (userId, targetSocket = null) => {
      const user = await User.findById(userId).select('invitationFriends');
      const payload = {
        userId: String(userId),
        lengthOfInvitation: (user && user.invitationFriends ? user.invitationFriends.length : 0)
      };
      if (targetSocket) targetSocket.emit('SERVER_RETURN_LENGTH_INVITATION', payload);
      else notifyUser(userId, 'SERVER_RETURN_LENGTH_INVITATION', payload);
    };
    const on = (event, handler) => socket.on(event, async (data = {}) => {
      try { await handler(data); }
      catch (error) {
        console.error(`${event} error:`, error);
        sendError('Có lỗi xảy ra, vui lòng thử lại');
      }
    });

    // Gửi lời mời kết bạn.
    on('CLIENT_ADD_FRIEND', async (data) => {
      const targetId = String(data.reqUserId || '');
      if (!targetId || targetId === socket.userId) return;
      const [sender, target] = await Promise.all([
        User.findById(socket.userId),
        User.findOne({ _id: targetId, deleted: false }).select('fullName avatar friendsList requestFriends invitationFriends')
      ]);
      if (!sender || !target) return sendError('Không tìm thấy người dùng');
      if ((sender.friendsList || []).some(item => String(item.user_id) === targetId)) return;
      if ((sender.requestFriends || []).includes(targetId) || (sender.invitationFriends || []).includes(targetId)) return;

      await User.updateOne({ _id: socket.userId }, { $addToSet: { requestFriends: targetId } });
      await User.updateOne({ _id: targetId }, { $addToSet: { invitationFriends: socket.userId } });
      notifyUser(targetId, 'SERVER_RETURN_ADD_FRIEND', {
        user: publicUser(sender),
        myUserId: targetId
      });
      await sendInvitationCount(targetId);
    });

    // Huỷ lời mời đã gửi hoặc thu hồi lời mời trước khi người kia chấp nhận.
    const removeOutgoingRequest = async (targetId, eventName) => {
      if (!targetId || targetId === socket.userId) return;
      await User.updateOne({ _id: socket.userId }, { $pull: { requestFriends: targetId } });
      await User.updateOne({ _id: targetId }, { $pull: { invitationFriends: socket.userId } });
      notifyUser(targetId, eventName, { userId: socket.userId, myUserId: targetId });
      await sendInvitationCount(targetId);
    };
    on('CLIENT_CANCEL_REQUEST', data => removeOutgoingRequest(String(data.userId || ''), 'SERVER_RETURN_CANCEL_USER'));
    on('CLIENT_REVOKE_REQUEST', data => removeOutgoingRequest(String(data.userId || ''), 'SERVER_RETURN_REVOKE_USER'));

    // Từ chối lời mời nhận được.
    on('CLIENT_REFUSE_FRIEND', async (data) => {
      const requesterId = String(data.userId || '');
      if (!requesterId || requesterId === socket.userId) return;
      const [me, requester] = await Promise.all([
        User.findById(socket.userId),
        User.findById(requesterId).select('fullName avatar')
      ]);
      if (!me || !requester || !(me.invitationFriends || []).includes(requesterId) || !(requester.requestFriends || []).includes(socket.userId)) return;
      await User.updateOne({ _id: socket.userId }, { $pull: { invitationFriends: requesterId } });
      await User.updateOne({ _id: requesterId }, { $pull: { requestFriends: socket.userId } });
      notifyUser(requesterId, 'SERVER_RETURN_REFUSE_USER', {
        user: publicUser(me),
        myUserId: requesterId
      });
      await sendInvitationCount(socket.userId, socket);
    });

    // Chấp nhận lời mời và tạo phòng chat 1-1.
    on('CLIENT_ACCEPT_FRIEND', async (data) => {
      const requesterId = String(data.userId || '');
      if (!requesterId || requesterId === socket.userId) return;
      const [me, requester] = await Promise.all([
        User.findOne({ _id: socket.userId, invitationFriends: requesterId }),
        User.findOne({ _id: requesterId, requestFriends: socket.userId })
      ]);
      if (!me || !requester) return sendError('Lời mời kết bạn không còn hợp lệ');

      const room = await RoomChat.create({
        typeRoom: 'friend',
        users: [
          { user_id: requesterId, role: 'superAdmin' },
          { user_id: socket.userId, role: 'superAdmin' }
        ]
      });

      await Promise.all([
        User.updateOne({ _id: socket.userId }, {
          $pull: { invitationFriends: requesterId },
          $addToSet: { friendsList: { user_id: requesterId, room_chat_id: String(room.id) } }
        }),
        User.updateOne({ _id: requesterId }, {
          $pull: { requestFriends: socket.userId },
          $addToSet: { friendsList: { user_id: socket.userId, room_chat_id: String(room.id) } }
        })
      ]);
      await sendInvitationCount(socket.userId, socket);
      notifyUser(requesterId, 'SERVER_RETURN_FRIEND_ACCEPTED', {
        userId: socket.userId,
        roomChatId: String(room.id)
      });
    });
  });
};
