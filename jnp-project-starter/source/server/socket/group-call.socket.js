const RoomChat = require('../model/room-chat.model');
const Chat = require('../model/chat.model'); // <-- 1. THÊM IMPORT MODEL CHAT

// Số người tối đa trong một cuộc gọi nhóm (mesh: mỗi người nối trực tiếp với từng người còn lại)
const MAX_PARTICIPANTS = 4;
const PEER_SIGNALS = new Set(['offer', 'answer', 'ice']);

// Signaling gọi nhóm (WebRTC mesh). Server chỉ quản lý "ai đang ở trong cuộc gọi" và chuyển tiếp
// offer/answer/ice giữa từng cặp; hình và tiếng đi thẳng giữa các trình duyệt.
// Danh tính luôn lấy từ socket đã xác thực, client không tự khai báo.
module.exports = (io = global._io) => {
  const calls = new Map();     // roomChatId -> { callerId, connectedAt, callType, memberIds, participants: Map(userId -> { socketId, name, avatar }) }
  const userRoom = new Map();  // userId -> roomChatId (người đang ở trong một cuộc gọi nhóm)

  const send = (target, payload) => io.to(target).emit('GROUP_CALL_SIGNAL', payload);

  // <-- 2. THÊM HÀM LƯU LỊCH SỬ CUỘC GỌI NHÓM & BẮN REALTIME
  const saveGroupCallLog = async (roomChatId, call) => {
    if (!roomChatId || !call) return;
    try {
      const isCompleted = Boolean(call.connectedAt);
      const status = isCompleted ? 'completed' : 'missed';
      const duration = isCompleted
        ? Math.max(1, Math.floor((Date.now() - call.connectedAt) / 1000))
        : 0;

      const newCallLog = new Chat({
        user_id: call.callerId,
        room_chat_id: roomChatId,
        type: 'call',
        callInfo: {
          callType: call.callType,
          status: status,
          duration: duration
        }
      });
      await newCallLog.save();

      io.to(roomChatId).emit('SERVER_RETURN_CALL_LOG', {
        userId: call.callerId,
        callInfo: newCallLog.callInfo,
        createdAt: newCallLog.createdAt
      });
    } catch (error) {
      console.error('Lỗi lưu lịch sử cuộc gọi nhóm:', error);
    }
  };

  // Rời cuộc gọi: báo cho những người còn lại, hết người thì kết thúc cuộc gọi
  const leaveCall = async (userId, socketId) => { // <-- 3. CHUYỂN THÀNH ASYNC
    const roomChatId = userRoom.get(userId);
    const call = calls.get(roomChatId);
    const me = call && call.participants.get(userId);
    if (!me || me.socketId !== socketId) return;

    call.participants.delete(userId);
    userRoom.delete(userId);
    call.participants.forEach((p) => send(p.socketId, { type: 'participant-left', roomChatId, userId }));

    if (call.participants.size === 0) {
      calls.delete(roomChatId);
      // Báo cho cả nhóm để tắt hộp "cuộc gọi đến" nếu còn đang đổ chuông
      call.memberIds.forEach((id) => send(`user:${id}`, { type: 'ended', roomChatId }));

      // <-- 4. LƯU LOG KHI NGƯỜI CUỐI CÙNG RỜI CUỘC GỌI
      await saveGroupCallLog(roomChatId, call);
    }
  };

  io.on('connection', (socket) => {
    if (!socket.userId) return;
    const userId = socket.userId;

    socket.on('GROUP_CALL_SIGNAL', async (raw = {}) => {
      try {
        const type = raw.type;
        const roomChatId = typeof raw.roomChatId === 'string' ? raw.roomChatId : '';
        if (!roomChatId) return;

        // ----- Vào cuộc gọi (người đầu tiên vào = bắt đầu gọi, cả nhóm sẽ nhận lời mời) -----
        if (type === 'join') {
          if (userRoom.has(userId)) {
            return send(socket.id, { type: 'error', roomChatId, reason: 'busy' });
          }
          const room = await RoomChat.findOne({
            _id: roomChatId,
            deleted: false,
            typeRoom: 'group',
            'users.user_id': userId
          });
          if (!room) {
            return send(socket.id, { type: 'error', roomChatId, reason: 'not-member' });
          }

          let call = calls.get(roomChatId);
          const isNew = !call;
          if (isNew) {
            call = {
              callerId: userId, // <-- 5. LƯU ID NGƯỜI BẮT ĐẦU CUỘC GỌI NHÓM
              connectedAt: null, // <-- 6. THỜI ĐIỂM CÓ NGƯỜI THỨ 2 THAM GIA
              callType: raw.callType === 'audio' ? 'audio' : 'video',
              memberIds: room.users.map((u) => String(u.user_id)),
              participants: new Map()
            };
            calls.set(roomChatId, call);
          }
          if (call.participants.size >= MAX_PARTICIPANTS) {
            return send(socket.id, { type: 'full', roomChatId, max: MAX_PARTICIPANTS });
          }

          const others = [...call.participants].map(([id, p]) => ({ userId: id, name: p.name, avatar: p.avatar }));
          call.participants.set(userId, { socketId: socket.id, name: socket.userName, avatar: socket.userAvatar });
          userRoom.set(userId, roomChatId);

          // <-- 7. GHI NHẬN THỜI ĐIỂM BẮT ĐẦU NÓI CHUYỆN KHI CÓ TỪ 2 NGƯỜI TRỞ LÊN
          if (call.participants.size >= 2 && !call.connectedAt) {
            call.connectedAt = Date.now();
          }

          // Người đang trong cuộc gọi biết có người mới; người mới sẽ tạo offer tới từng người đó
          call.participants.forEach((p, id) => {
            if (id !== userId) {
              send(p.socketId, { type: 'participant-joined', roomChatId, userId, name: socket.userName, avatar: socket.userAvatar });
            }
          });
          send(socket.id, { type: 'joined', roomChatId, callType: call.callType, participants: others });

          if (isNew) {
            // Đổ chuông các thành viên còn lại (bỏ qua người đang trong cuộc gọi nhóm khác)
            call.memberIds.forEach((id) => {
              if (id === userId || userRoom.has(id)) return;
              send(`user:${id}`, {
                type: 'invite',
                roomChatId,
                roomName: room.title || 'Nhóm',
                roomAvatar: room.avatar || '/client/images/group-avatar.png',
                fromUserId: userId,
                fromName: socket.userName,
                fromAvatar: socket.userAvatar,
                callType: call.callType
              });
            });
          }
          return;
        }

        // ----- Rời cuộc gọi -----
        if (type === 'leave') {
          if (userRoom.get(userId) === roomChatId) await leaveCall(userId, socket.id); // <-- THÊM AWAIT
          return;
        }

        // ----- Chuyển tiếp offer / answer / ice giữa hai người cùng trong cuộc gọi -----
        if (!PEER_SIGNALS.has(type)) return;
        const peerId = raw.toUserId ? String(raw.toUserId) : '';
        if (!peerId || peerId === userId || userRoom.get(userId) !== roomChatId) return;
        const call = calls.get(roomChatId);
        const me = call && call.participants.get(userId);
        const target = call && call.participants.get(peerId);
        if (!me || !target || me.socketId !== socket.id) return;

        const payload = {
          type, roomChatId,
          fromUserId: userId, fromName: socket.userName, fromAvatar: socket.userAvatar
        };
        if (type === 'offer' || type === 'answer') {
          if (!raw.sdp || typeof raw.sdp.sdp !== 'string' || raw.sdp.type !== type) return;
          payload.sdp = { type: raw.sdp.type, sdp: raw.sdp.sdp };
        } else {
          if (!raw.candidate || typeof raw.candidate !== 'object') return;
          payload.candidate = raw.candidate;
        }
        send(target.socketId, payload);
      } catch (error) {
        console.error('GROUP_CALL_SIGNAL error:', error);
        socket.emit('GROUP_CALL_SIGNAL', { type: 'error', reason: 'server' });
      }
    });

    // Mất kết nối / đóng tab thì coi như rời cuộc gọi
    socket.on('disconnect', async () => { // <-- THÊM ASYNC/AWAIT
      await leaveCall(userId, socket.id);
    });
  });
};