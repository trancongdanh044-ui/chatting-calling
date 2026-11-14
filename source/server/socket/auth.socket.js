const User = require('../model/user.model');

// Xác thực danh tính Socket.IO trước khi các module chat/friend/call đăng ký handler.
module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie || '';
      const tokenCookie = cookieHeader.split(';').map(v => v.trim()).find(v => v.startsWith('tokenUser='));
      if (!tokenCookie) return next(); // cho phép socket ở trang đăng nhập, nhưng không có quyền thao tác

      const tokenUser = decodeURIComponent(tokenCookie.slice('tokenUser='.length));
      const user = await User.findOne({ tokenUser, deleted: false }).select('fullName avatar');
      if (user) {
        socket.userId = String(user.id);
        socket.userName = user.fullName || 'Người dùng';
        socket.userAvatar = user.avatar || '/client/images/avatar.jpg';
        await socket.join(`user:${socket.userId}`);
      }
      return next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      return next(error);
    }
  });
};
