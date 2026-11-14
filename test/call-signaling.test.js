const test = require('node:test');
const assert = require('node:assert/strict');

class FakeSocket {
  constructor(id, token) {
    this.id = id;
    this.userId = token.replace('token-', '');
    this.userName = this.userId.toUpperCase();
    this.userAvatar = '/avatar.png';
    this.handshake = { headers: { cookie: `tokenUser=${token}` } };
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
  disconnect() { this.disconnected = true; }
  async clientEmit(event, payload) {
    for (const handler of this.handlers.get(event) || []) await handler(payload);
  }
  last(event) { return this.received.filter(item => item.event === event).at(-1); }
}

class FakeIO {
  constructor() { this.connectionHandler = null; this.sockets = new Map(); }
  on(event, handler) { if (event === 'connection') this.connectionHandler = handler; }
  async connect(socket) {
    this.sockets.set(socket.id, socket);
    await socket.join(`user:${socket.userId}`);
    await this.connectionHandler(socket);
  }
  in(room) {
    return { fetchSockets: async () => [...this.sockets.values()].filter(s => s.rooms.has(room)) };
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

test('CALL_SIGNAL authenticates sender, relays WebRTC signals and blocks busy users', async () => {
  const socketModulePath = require.resolve('../source/server/socket/call.socket');
  delete require.cache[socketModulePath];
  const registerCallSocket = require(socketModulePath);

  const io = new FakeIO();
  registerCallSocket(io);
  const alice = new FakeSocket('socket-alice', 'token-alice');
  const bob = new FakeSocket('socket-bob', 'token-bob');
  const charlie = new FakeSocket('socket-charlie', 'token-charlie');
  await io.connect(alice);
  await io.connect(bob);
  await io.connect(charlie);

  await alice.clientEmit('CALL_SIGNAL', {
    toUserId: 'bob', type: 'invite', fromUserId: 'forged-user', callType: 'video'
  });
  assert.equal(bob.last('CALL_SIGNAL').payload.type, 'invite');
  assert.equal(bob.last('CALL_SIGNAL').payload.fromUserId, 'alice');

  await charlie.clientEmit('CALL_SIGNAL', { toUserId: 'bob', type: 'invite', callType: 'audio' });
  assert.equal(charlie.last('CALL_SIGNAL').payload.type, 'reject');
  assert.equal(charlie.last('CALL_SIGNAL').payload.reason, 'busy');

  await bob.clientEmit('CALL_SIGNAL', { toUserId: 'alice', type: 'accept' });
  assert.equal(alice.last('CALL_SIGNAL').payload.type, 'accept');
  assert.equal(alice.last('CALL_SIGNAL').payload.fromUserId, 'bob');

  await alice.clientEmit('CALL_SIGNAL', {
    toUserId: 'bob', type: 'offer', fromUserId: 'forged-user',
    sdp: { type: 'offer', sdp: 'fake-sdp' }
  });
  assert.deepEqual(bob.last('CALL_SIGNAL').payload.sdp, { type: 'offer', sdp: 'fake-sdp' });
  assert.equal(bob.last('CALL_SIGNAL').payload.fromUserId, 'alice');

  await bob.clientEmit('CALL_SIGNAL', { toUserId: 'alice', type: 'end' });
  assert.equal(alice.last('CALL_SIGNAL').payload.type, 'end');

  const before = bob.received.length;
  await alice.clientEmit('CALL_SIGNAL', {
    toUserId: 'bob', type: 'ice', candidate: { candidate: 'candidate' }
  });
  assert.equal(bob.received.length, before, 'signals after call teardown must be ignored');
});
