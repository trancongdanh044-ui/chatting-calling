# Frontend – Messenger Clone

Giao diện web của hệ thống nhắn tin / gửi tài liệu / gọi video. Viết bằng **Pug + CSS + JavaScript thuần**
(không dùng Bootstrap hay jQuery), chạy trên backend Express + Socket.IO có sẵn.
Hỗ trợ **chế độ sáng / tối** (nút ◐ ở thanh trái hoặc trong hộp thoại Tài khoản) và hiển thị tốt trên điện thoại.

## Cấu trúc thư mục

```
client/
├── view/client/
│   ├── layouts/        auth.pug (khung đăng nhập) · default.pug (khung ứng dụng)
│   ├── partials/       head, sidebar-nav, account-modal, call-overlay, flash,
│   │                   chat-list, chat-room, chat-info
│   ├── mixins/         friend.pug (tab, thẻ người dùng, ô tìm kiếm)
│   └── pages/          user-auth/ · friend/ · group/ · chat/   (đúng tên file mà controller render)
└── public/
    ├── index.html      "/" → chuyển về /chat (vì server không có route "/")
    └── client/
        ├── css/        base · auth · layout · friends · chat · call
        ├── js/         config · socket · ui · auth · friend · group-create · chat · call
        └── images/
```

## Chức năng nào nằm ở đâu

| Chức năng | Giao diện (Pug) | CSS | JavaScript |
|---|---|---|---|
| Đăng nhập, đăng ký, quên mật khẩu (demo) | `pages/user-auth/*` | `auth.css` | `auth.js`, `ui.js` |
| Kết bạn (gợi ý, gửi, thu hồi, chấp nhận, từ chối) | `pages/friend/*`, `mixins/friend.pug` | `friends.css` | `friend.js` |
| Nhóm, tạo nhóm | `pages/group/*` | `friends.css` | `group-create.js` |
| Nhắn tin, ảnh, emoji | `pages/chat`, `partials/chat-*` | `chat.css` | `chat.js` |
| Gửi tài liệu | `partials/chat-room.pug` | `chat.css` | `chat.js` (mục D, E) |
| Gọi thoại / video call | `partials/call-overlay.pug` | `call.css` | `call.js` |
| Sáng/tối, toast, modal, trạng thái online | `layouts/*`, `partials/*` | `base.css` | `ui.js` |

Mỗi file CSS/JS đều có mục lục ở đầu file và các đoạn được chú thích bằng tiếng Việt.

## Chế độ DEMO (khi backend chưa xong)

Hai công tắc trong `public/client/js/config.js`:

```js
FEATURES: { sendDocuments: false, videoCall: false }
```

- `sendDocuments: false` – chọn / kéo thả / dán tệp vẫn hoạt động, tin nhắn tài liệu chỉ hiện trên máy bạn
  (có ghi chú "Demo").
- `videoCall: false` – bấm gọi sẽ mở camera/micro thật và hiện đủ giao diện (đang gọi, đã kết nối, tắt mic/camera,
  chia sẻ màn hình, cuộc gọi đến) nhưng không nối với ai. Có nút "Xem thử: cuộc gọi đến" trong hộp thoại Tài khoản.

Làm xong backend thì đổi `false` → `true`.

## Sự kiện Socket.IO

**Đã có sẵn ở backend (frontend dùng lại nguyên tên):** `CLIENT_SEND_MESSAGE`, `SERVER_RETURN_MESSAGE`,
`CLIENT_ADD_FRIEND`, `CLIENT_CANCEL_REQUEST`, `CLIENT_REVOKE_REQUEST`, `CLIENT_REFUSE_FRIEND`, `CLIENT_ACCEPT_FRIEND`,
`SERVER_RETURN_ADD_FRIEND`, `SERVER_RETURN_CANCEL_USER`, `SERVER_RETURN_REVOKE_USER`, `SERVER_RETURN_REFUSE_USER`,
`SERVER_RETURN_LENGTH_INVITATION`, `CLIENT_CHANGE_STATUS`.

**Frontend đã gửi sẵn, backend cần làm thêm:**

| Sự kiện | Dữ liệu | Việc backend cần làm |
|---|---|---|
| `CLIENT_SEND_MESSAGE` (thêm trường `files`) | `files: [{ name, type, size, data: Buffer }]` | Lưu tệp (vd. Cloudinary `resource_type: "raw"`), lưu vào Chat (thêm `files: [{name, size, url}]` vào schema), rồi trả `SERVER_RETURN_MESSAGE` kèm `files: [{name, size, url}]`. Nhớ tăng `maxHttpBufferSize` khi tạo `new Server(server, {...})`. |
| `CALL_REGISTER` | `{ userId }` | `socket.join("user:" + userId)` |
| `CALL_SIGNAL` | `{ toUserId, type, ... }` | Chuyển tiếp tới phòng `user:<toUserId>` và thêm `fromUserId` |

Mẫu server tín hiệu cho cuộc gọi (khoảng 10 dòng):

```js
// source/server/socket/call.socket.js  →  trong index.js: require("./source/server/socket/call.socket")(io);
module.exports = (io) => {
  io.on("connection", (socket) => {
    socket.on("CALL_REGISTER", ({ userId }) => {
      socket.data.userId = userId;               // nên lấy từ phiên đăng nhập thay vì tin dữ liệu client
      socket.join("user:" + userId);
    });
    socket.on("CALL_SIGNAL", (data) => {
      io.to("user:" + data.toUserId).emit("CALL_SIGNAL", { ...data, fromUserId: socket.data.userId });
    });
  });
};
```

## Lưu ý khi chạy

- Camera/micro chỉ hoạt động qua **HTTPS hoặc `localhost`**. Thử giữa hai máy trong mạng LAN cần HTTPS.
- Khi triển khai thật nên thêm máy chủ **TURN** vào `ICE_SERVERS` (trong `config.js`) để gọi được qua mọi loại mạng.
- Mỗi trang chỉ tạo **một** kết nối socket (`socket.js`). Server xác thực socket bằng cookie `tokenUser` và đăng ký handler tập trung khi khởi động.
  Trang đăng nhập/đăng ký cũng cần nạp socket.io để trạng thái online/offline được phát sau khi đăng nhập/đăng xuất.
- Ảnh lớn được tự nén xuống dưới ~900 KB trước khi gửi, vì Socket.IO mặc định chỉ nhận gói khoảng 1 MB.
- Nội dung tin nhắn được hiển thị bằng `textContent`, nên không bị chèn mã HTML/JS.
