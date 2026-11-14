const test = require('node:test');
const assert = require('node:assert/strict');

class FakeSocket {
  constructor(id, userId) {
    this.id = id;
    this.userId = userId;
    this.userName = userId.toUpperCase();
    this.userAvatar = '/avatar.png';
    this.handlers = new Map();
    this.received = [];
    this.rooms = new Set();
  }
  on(event, handler) {
    const list = this.handlers.get(event) || [];
    list.push(handler);
    this.handlers.set(event, list);
  }
  emit(event, payload) { this.received.push({ event, payload }); }
  async join(room) { this.rooms.add(room); }
  async clientEmit(event, payload) {
    for (const handler of this.handlers.get(event) || []) await handler(payload);
  }
  signals(type) { return this.received.filter(i => i.event === 'GROUP_CALL_SIGNAL' && i.payload.type === type).map(i => i.payload); }
  last(type) { return this.signals(type).at(-1); }
}

class FakeIO {
  constructor() { this.connectionHandler = null; this.sockets = new Map(); }
  on(event, handler) { if (event === 'connection') this.connectionHandler = handler; }
  async connect(socket) {
    this.sockets.set(socket.id, socket);
    await socket.join(`user:${socket.userId}`);
    await this.connectionHandler(socket);
  }
  to(target) {
    return { emit: (event, payload) => {
      const exact = this.sockets.get(target);
      if (exact) return exact.emit(event, payload);
      for (const socket of this.sockets.values()) {
        if (socket.rooms.has(target)) socket.emit(event, payload);
      }
    } };
  }
}

// Model RoomChat giả: không cần MongoDB khi chạy test
const modelPath = require.resolve('../source/server/model/room-chat.model');
const rooms = {
  room1: { typeRoom: 'group', title: 'Nhóm A', avatar: '', users: ['alice', 'bob', 'charlie', 'dave', 'eve'].map(id => ({ user_id: id, role: 'member' })) },
  friend1: { typeRoom: 'friend', title: 'Bạn', avatar: '', users: [{ user_id: 'alice' }, { user_id: 'bob' }] }
};
require.cache[modelPath] = {
  id: modelPath, filename: modelPath, loaded: true,
  exports: {
    findOne: async (query) => {
      const room = rooms[query._id];
      const ok = room && room.typeRoom === query.typeRoom && room.users.some(u => u.user_id === query['users.user_id']);
      return ok ? room : null;
    }
  }
};

async function setup(names) {
  const modulePath = require.resolve('../source/server/socket/group-call.socket');
  delete require.cache[modulePath];
  const io = new FakeIO();
  require(modulePath)(io);
  const sockets = {};
  for (const name of names) {
    sockets[name] = new FakeSocket(`socket-${name}`, name);
    await io.connect(sockets[name]);
  }
  return sockets;
}

test('GROUP_CALL: người đầu tiên vào thì cả nhóm nhận lời mời, người sau vào thì được báo cho nhau', async () => {
  const s = await setup(['alice', 'bob', 'charlie', 'frank']);

  await s.alice.clientEmit('GROUP_CALL_SIGNAL', { type: 'join', roomChatId: 'room1', callType: 'audio', fromUserId: 'forged' });
  assert.deepEqual(s.alice.last('joined').participants, []);
  assert.equal(s.alice.last('joined').callType, 'audio');
  assert.equal(s.bob.last('invite').fromUserId, 'alice', 'fromUserId phải lấy từ socket đã xác thực');
  assert.equal(s.bob.last('invite').roomName, 'Nhóm A');
  assert.equal(s.charlie.last('invite').callType, 'audio');
  assert.equal(s.alice.last('invite'), undefined, 'người gọi không tự nhận lời mời');

  await s.bob.clientEmit('GROUP_CALL_SIGNAL', { type: 'join', roomChatId: 'room1' });
  assert.deepEqual(s.bob.last('joined').participants.map(p => p.userId), ['alice']);
  assert.equal(s.alice.last('participant-joined').userId, 'bob');
  assert.equal(s.bob.signals('invite').length, 1, 'vào cuộc gọi đang có thì không đổ chuông lại cả nhóm');

  // Người ngoài nhóm không vào được; không vào được phòng chat 1-1
  await s.frank.clientEmit('GROUP_CALL_SIGNAL', { type: 'join', roomChatId: 'room1' });
  assert.equal(s.frank.last('error').reason, 'not-member');
  await s.alice.clientEmit('GROUP_CALL_SIGNAL', { type: 'join', roomChatId: 'friend1' });
  assert.equal(s.alice.last('error').reason, 'busy');
});

test('GROUP_CALL: relay offer/answer/ice chỉ giữa những người cùng trong cuộc gọi', async () => {
  const s = await setup(['alice', 'bob', 'charlie']);
  await s.alice.clientEmit('GROUP_CALL_SIGNAL', { type: 'join', roomChatId: 'room1', callType: 'video' });
  await s.bob.clientEmit('GROUP_CALL_SIGNAL', { type: 'join', roomChatId: 'room1' });

  await s.bob.clientEmit('GROUP_CALL_SIGNAL', {
    type: 'offer', roomChatId: 'room1', toUserId: 'alice', fromUserId: 'forged', sdp: { type: 'offer', sdp: 'fake-sdp' }
  });
  assert.deepEqual(s.alice.last('offer').sdp, { type: 'offer', sdp: 'fake-sdp' });
  assert.equal(s.alice.last('offer').fromUserId, 'bob');
  assert.equal(s.alice.last('offer').fromName, 'BOB');

  await s.alice.clientEmit('GROUP_CALL_SIGNAL', { type: 'ice', roomChatId: 'room1', toUserId: 'bob', candidate: { candidate: 'c' } });
  assert.deepEqual(s.bob.last('ice').candidate, { candidate: 'c' });

  // charlie chưa vào cuộc gọi: không gửi/nhận được tín hiệu
  const before = s.alice.received.length;
  await s.charlie.clientEmit('GROUP_CALL_SIGNAL', { type: 'ice', roomChatId: 'room1', toUserId: 'alice', candidate: { candidate: 'x' } });
  await s.alice.clientEmit('GROUP_CALL_SIGNAL', { type: 'offer', roomChatId: 'room1', toUserId: 'charlie', sdp: { type: 'offer', sdp: 'y' } });
  assert.equal(s.alice.received.length, before);
  assert.equal(s.charlie.last('offer'), undefined);

  // sdp sai loại bị bỏ qua
  await s.bob.clientEmit('GROUP_CALL_SIGNAL', { type: 'answer', roomChatId: 'room1', toUserId: 'alice', sdp: { type: 'offer', sdp: 'z' } });
  assert.equal(s.alice.last('answer'), undefined);
});

test('GROUP_CALL: giới hạn 4 người, rời/đóng tab thì báo cho người còn lại và kết thúc khi hết người', async () => {
  const s = await setup(['alice', 'bob', 'charlie', 'dave', 'eve']);
  for (const name of ['alice', 'bob', 'charlie', 'dave']) {
    await s[name].clientEmit('GROUP_CALL_SIGNAL', { type: 'join', roomChatId: 'room1', callType: 'video' });
  }
  await s.eve.clientEmit('GROUP_CALL_SIGNAL', { type: 'join', roomChatId: 'room1' });
  assert.equal(s.eve.last('full').max, 4);

  // bob bấm rời, charlie đóng tab
  await s.bob.clientEmit('GROUP_CALL_SIGNAL', { type: 'leave', roomChatId: 'room1' });
  assert.equal(s.alice.last('participant-left').userId, 'bob');
  await s.charlie.clientEmit('disconnect');
  assert.equal(s.dave.last('participant-left').userId, 'charlie');

  // Có chỗ trống thì eve vào được
  await s.eve.clientEmit('GROUP_CALL_SIGNAL', { type: 'join', roomChatId: 'room1' });
  assert.deepEqual(s.eve.last('joined').participants.map(p => p.userId).sort(), ['alice', 'dave']);

  // Mọi người rời hết thì cuộc gọi kết thúc, cả nhóm nhận "ended"
  for (const name of ['alice', 'dave', 'eve']) {
    await s[name].clientEmit('GROUP_CALL_SIGNAL', { type: 'leave', roomChatId: 'room1' });
  }
  assert.equal(s.bob.last('ended').roomChatId, 'room1');

  // Gọi lại sau khi kết thúc: lại là cuộc gọi mới, cả nhóm nhận lời mời mới
  await s.bob.clientEmit('GROUP_CALL_SIGNAL', { type: 'join', roomChatId: 'room1', callType: 'video' });
  assert.deepEqual(s.bob.last('joined').participants, []);
  assert.equal(s.alice.signals('invite').length, 1);   // alice là người bắt đầu cuộc gọi đầu nên chỉ nhận lời mời của bob
  assert.equal(s.alice.last('invite').fromUserId, 'bob');
});
