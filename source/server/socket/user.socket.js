// Phát trạng thái online/offline sau khi controller đã cập nhật MongoDB.
module.exports = (req, res, data) => {
  if (global._io && data) global._io.emit('CLIENT_CHANGE_STATUS', data);
};
