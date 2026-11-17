const Chat = require("../model/chat.model"); // <-- 1. THÊM IMPORT MODEL

const SIGNAL_TYPES = new Set([
  'invite', 'accept', 'reject', 'cancel', 'end',
  'offer', 'answer', 'ice'
]);

// WebRTC signaling: danh tính luôn lấy từ middleware xác thực Socket.IO.
module.exports = (io = global._io) => {
  const activeCalls = new Map(); // userId -> peerId
  const callSocketIds = new Map(); // userId -> socket.id (mỗi tài khoản một tab gọi)
  const callSessions = new Map(); // <-- 2. THÊM MAP LƯU THÔNG TIN PHIÊN GỌI (callerId, roomChatId, callType, acceptedAt)

  // <-- 3. THÊM HÀM LƯU LOG & BẮN SOCKET REALTIME
  const saveCallLog = async (session, status) => {
    if (!session || !session.roomChatId) return;
    try {
      const duration = (status === 'completed' && session.acceptedAt)
        ? Math.max(1, Math.floor((Date.now() - session.acceptedAt) / 1000))
        : 0;

      const newCallLog = new Chat({
        user_id: session.callerId,
        room_chat_id: session.roomChatId,
        type: 'call',
        callInfo: {
          callType: session.callType,
          status: status, // 'completed' | 'missed' | 'rejected'
          duration: duration
        }
      });
      await newCallLog.save();

      io.to(session.roomChatId).emit('SERVER_RETURN_CALL_LOG', {
        userId: session.callerId,
        callInfo: newCallLog.callInfo,
        createdAt: newCallLog.createdAt
      });
    } catch (error) {
      console.error('Lỗi lưu lịch sử cuộc gọi:', error);
    }
  };

  const releaseCall = (userId, peerId) => {
    if (activeCalls.get(userId) === peerId) activeCalls.delete(userId);
    if (activeCalls.get(peerId) === userId) activeCalls.delete(peerId);
    callSocketIds.delete(userId);
    callSocketIds.delete(peerId);
    // <-- 4. XÓA SESSION KHI KẾT THÚC
    callSessions.delete(userId);
    callSessions.delete(peerId);
  };

  io.on('connection', (socket) => {
    if (!socket.userId) return;
    const userId = socket.userId;

    socket.on('CALL_SIGNAL', async (raw = {}) => {
      try {
        const type = raw.type;
        const peerId = raw.toUserId ? String(raw.toUserId) : '';
        if (!SIGNAL_TYPES.has(type) || !peerId || peerId === userId) return;

        const targetRoom = `user:${peerId}`;
        const targetSockets = await io.in(targetRoom).fetchSockets();

        if (type === 'invite') {
          if (activeCalls.has(userId)) {
            return socket.emit('CALL_SIGNAL', { type: 'reject', fromUserId: peerId, reason: 'busy' });
          }
          if (targetSockets.length === 0) {
            return socket.emit('CALL_SIGNAL', { type: 'unavailable', fromUserId: peerId });
          }
          if (activeCalls.has(peerId)) {
            return socket.emit('CALL_SIGNAL', { type: 'reject', fromUserId: peerId, reason: 'busy' });
          }

          const targetSocketId = targetSockets[0].id;
          const roomChatId = typeof raw.roomChatId === 'string' ? raw.roomChatId : '';
          const callType = raw.callType === 'audio' ? 'audio' : 'video';

          activeCalls.set(userId, peerId);
          activeCalls.set(peerId, userId);
          callSocketIds.set(userId, socket.id);
          callSocketIds.set(peerId, targetSocketId);

          // <-- 5. KHỞI TẠO SESSION KHI BẮT ĐẦU GỌI
          const session = {
            callerId: userId,
            receiverId: peerId,
            roomChatId: roomChatId,
            callType: callType,
            acceptedAt: null
          };
          callSessions.set(userId, session);
          callSessions.set(peerId, session);

          io.to(targetSocketId).emit('CALL_SIGNAL', {
            type: 'invite',
            fromUserId: userId,
            fromName: socket.userName,
            fromAvatar: socket.userAvatar,
            roomChatId: roomChatId,
            callType: callType
          });
          return;
        }

        // Chỉ đúng socket đã nhận/gửi lời mời mới được trao đổi signaling.
        if (activeCalls.get(userId) !== peerId || activeCalls.get(peerId) !== userId) return;
        if (callSocketIds.get(userId) !== socket.id) return;
        const targetSocketId = callSocketIds.get(peerId);

        // <-- 6. GHI NHẬN THỜI ĐIỂM NGHE MÁY (ACCEPT)
        if (type === 'accept') {
          const session = callSessions.get(userId);
          if (session && !session.acceptedAt) {
            session.acceptedAt = Date.now();
          }
        }

        // <-- 7. XÁC ĐỊNH TRẠNG THÁI VÀ LƯU LOG KHI KẾT THÚC / TỪ CHỐI / HỦY
        if (type === 'reject' || type === 'cancel' || type === 'end') {
          const session = callSessions.get(userId);
          let status = 'missed';

          if (type === 'reject') {
            status = raw.reason === 'timeout' ? 'missed' : 'rejected';
          } else if (type === 'cancel') {
            status = 'missed';
          } else if (type === 'end') {
            status = session && session.acceptedAt ? 'completed' : 'missed';
          }

          await saveCallLog(session, status);
          releaseCall(userId, peerId);
        }

        const payload = { type, fromUserId: userId };
        if (type === 'reject' && ['busy', 'declined', 'error', 'timeout'].includes(raw.reason)) {
          payload.reason = raw.reason;
        }
        if (type === 'offer' || type === 'answer') {
          if (!raw.sdp || typeof raw.sdp.sdp !== 'string' || !['offer', 'answer'].includes(raw.sdp.type)) return;
          payload.sdp = { type: raw.sdp.type, sdp: raw.sdp.sdp };
        }
        if (type === 'ice') {
          if (!raw.candidate || typeof raw.candidate !== 'object') return;
          payload.candidate = raw.candidate;
        }
        if (targetSocketId) io.to(targetSocketId).emit('CALL_SIGNAL', payload);
      } catch (error) {
        console.error('CALL_SIGNAL error:', error);
        socket.emit('CALL_SIGNAL_ERROR', { message: 'Không thể xử lý tín hiệu cuộc gọi.' });
      }
    });

    // <-- 8. LƯU LOG NẾU MỘT TRONG HAI NGƯỜI TẮT TAB ĐỘT NGỘT (DISCONNECT)
    socket.on('disconnect', async () => {
      const peerId = activeCalls.get(userId);
      if (!peerId || callSocketIds.get(userId) !== socket.id) return;
      const peerSocketId = callSocketIds.get(peerId);
      const session = callSessions.get(userId);

      const status = session && session.acceptedAt ? 'completed' : 'missed';
      await saveCallLog(session, status);

      releaseCall(userId, peerId);
      if (peerSocketId) io.to(peerSocketId).emit('CALL_SIGNAL', { type: 'end', fromUserId: userId });
    });
  });
};