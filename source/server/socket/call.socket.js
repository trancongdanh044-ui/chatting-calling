const SIGNAL_TYPES = new Set([
  'invite', 'accept', 'reject', 'cancel', 'end',
  'offer', 'answer', 'ice'
]);

// WebRTC signaling: danh tính luôn lấy từ middleware xác thực Socket.IO.
module.exports = (io) => {
  const activeCalls = new Map(); // userId -> peerId
  const callSocketIds = new Map(); // userId -> socket.id (mỗi tài khoản một tab gọi)

  const releaseCall = (userId, peerId) => {
    if (activeCalls.get(userId) === peerId) activeCalls.delete(userId);
    if (activeCalls.get(peerId) === userId) activeCalls.delete(peerId);
    callSocketIds.delete(userId);
    callSocketIds.delete(peerId);
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
          activeCalls.set(userId, peerId);
          activeCalls.set(peerId, userId);
          callSocketIds.set(userId, socket.id);
          callSocketIds.set(peerId, targetSocketId);
          io.to(targetSocketId).emit('CALL_SIGNAL', {
            type: 'invite',
            fromUserId: userId,
            fromName: socket.userName,
            fromAvatar: socket.userAvatar,
            roomChatId: typeof raw.roomChatId === 'string' ? raw.roomChatId : '',
            callType: raw.callType === 'audio' ? 'audio' : 'video'
          });
          return;
        }

        // Chỉ đúng socket đã nhận/gửi lời mời mới được trao đổi signaling.
        if (activeCalls.get(userId) !== peerId || activeCalls.get(peerId) !== userId) return;
        if (callSocketIds.get(userId) !== socket.id) return;
        const targetSocketId = callSocketIds.get(peerId);

        if (type === 'reject' || type === 'cancel' || type === 'end') {
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

    socket.on('disconnect', () => {
      const peerId = activeCalls.get(userId);
      if (!peerId || callSocketIds.get(userId) !== socket.id) return;
      const peerSocketId = callSocketIds.get(peerId);
      releaseCall(userId, peerId);
      if (peerSocketId) io.to(peerSocketId).emit('CALL_SIGNAL', { type: 'end', fromUserId: userId });
    });
  });
};
