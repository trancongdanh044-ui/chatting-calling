const Chat = require('../model/chat.model');
const RoomChat = require('../model/room-chat.model');
const uploadImage = require('../helper/uploadImage');

module.exports = (io) => {
  io.on('connection', (socket) => {
    if (!socket.userId) return;

    const reportError = (message) => socket.emit('SERVER_CHAT_ERROR', { message });

    socket.on('CLIENT_JOIN_ROOM', async (data = {}) => {
      try {
        const roomChatId = String(data.roomChatId || '');
        if (!roomChatId) return;
        const room = await RoomChat.findOne({
          _id: roomChatId,
          deleted: false,
          'users.user_id': socket.userId
        }).select('_id');
        if (!room) return reportError('Bạn không có quyền truy cập cuộc trò chuyện này');

        if (socket.data.chatRoomId) socket.leave(`chat:${socket.data.chatRoomId}`);
        socket.data.chatRoomId = roomChatId;
        await socket.join(`chat:${roomChatId}`);
      } catch (error) {
        console.error('CLIENT_JOIN_ROOM error:', error);
        reportError('Không thể mở cuộc trò chuyện');
      }
    });

    socket.on('CLIENT_SEND_MESSAGE', async (data = {}) => {
      try {
        const roomChatId = String(data.roomChatId || '');
        if (!roomChatId || socket.data.chatRoomId !== roomChatId) {
          return reportError('Vui lòng tải lại cuộc trò chuyện trước khi gửi tin nhắn');
        }

        const room = await RoomChat.findOne({
          _id: roomChatId,
          deleted: false,
          'users.user_id': socket.userId
        });
        if (!room) return reportError('Bạn không có quyền gửi tin nhắn vào cuộc trò chuyện này');

        const content = typeof data.content === 'string' ? data.content.trim().slice(0, 10000) : '';
        const images = Array.isArray(data.images) ? data.images.slice(0, 6) : [];
        if (!content && images.length === 0) return;

        const imageUrls = [];
        try {
          for (const image of images) imageUrls.push(await uploadImage(image));
        } catch (error) {
          console.error('Lỗi upload ảnh:', error);
          return reportError('Không tải được ảnh lên. Hãy kiểm tra cấu hình Cloudinary.');
        }

        const message = await Chat.create({
          user_id: socket.userId,
          content,
          images: imageUrls,
          room_chat_id: roomChatId
        });
        const preview = content || `Đã gửi ${imageUrls.length} ảnh mới`;
        room.latestMessage = {
          user_id: socket.userId,
          content: preview,
          user_name: socket.userName
        };
        await room.save();

        io.to(`chat:${roomChatId}`).emit('SERVER_RETURN_MESSAGE', {
          content,
          userId: socket.userId,
          fullName: socket.userName,
          avatar: socket.userAvatar,
          images: imageUrls,
          createdAt: message.createdAt
        });
      } catch (error) {
        console.error('CLIENT_SEND_MESSAGE error:', error);
        reportError('Không gửi được tin nhắn, vui lòng thử lại');
      }
    });
  });
};
