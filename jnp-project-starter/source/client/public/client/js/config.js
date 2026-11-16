// =====================================================================
// config.js – CẤU HÌNH CHUNG CỦA FRONTEND (sửa ở đây, không cần động vào code khác)
// =====================================================================
window.APP_CONFIG = {

  // ---- Công tắc bật/tắt chức năng theo tiến độ backend ----
  // false = chế độ DEMO: giao diện vẫn hoạt động nhưng chỉ chạy trên máy bạn.
  // Khi backend đã làm xong thì đổi thành true (xem hướng dẫn trong source/client/README.md).
  FEATURES: {
    sendDocuments: false, // true khi server đã xử lý mảng "files" trong sự kiện CLIENT_SEND_MESSAGE
    videoCall: true       // signaling WebRTC đã được tích hợp với server CALL_SIGNAL
  },

  // ---- Giới hạn khi gửi tệp ----
  MAX_IMAGES: 6,                 // số ảnh tối đa mỗi tin nhắn
  MAX_IMAGE_BYTES: 900 * 1024,   // ảnh lớn hơn sẽ tự nén xuống dưới mức này (socket.io mặc định chỉ nhận ~1MB/gói)
  MAX_DOCS: 5,                   // số tài liệu tối đa mỗi tin nhắn
  MAX_DOC_MB: 10,                // dung lượng tối đa mỗi tài liệu (MB)
  BLOCKED_EXTENSIONS: ["exe", "bat", "cmd", "sh", "msi", "com", "scr", "js", "vbs"],

  // ---- WebRTC: máy chủ giúp 2 trình duyệt tìm đường kết nối với nhau ----
  // STUN miễn phí đủ dùng khi thử nghiệm. Khi triển khai thật nên thêm TURN:
  //   { urls: "turn:ten-mien.com:3478", username: "user", credential: "pass" }
  ICE_SERVERS: [
    { urls: "stun:stun.l.google.com:19302" }
  ],

  CALL_RING_TIMEOUT_MS: 30000    // quá 30 giây không ai nghe máy thì tự huỷ cuộc gọi
};
