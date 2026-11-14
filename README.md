# Chatting & Calling — bản hợp nhất hoàn chỉnh

Ứng dụng chat realtime và gọi thoại/video 1-1, hợp nhất từ hai project được cung cấp.

## Công nghệ
- Node.js 22 LTS+, Express 5, Pug
- MongoDB + Mongoose
- Socket.IO 4 cho chat realtime và WebRTC signaling
- WebRTC cho audio/video peer-to-peer
- Cloudinary cho upload ảnh

Socket.IO authentication được thực hiện tập trung trước khi gắn handler. Các sự kiện chat, kết bạn, thông tin nhóm và gọi điện đều dùng chung danh tính đã xác thực; client không được tự khai báo user ID để giả mạo người gửi.

## Tính năng gọi thoại/video
Frontend và backend dùng chung giao thức `CALL_SIGNAL` với các loại tín hiệu:
`invite`, `accept`, `reject`, `cancel`, `end`, `offer`, `answer`, `ice`.
Server xác thực người dùng bằng cookie `tokenUser`, tự gán `fromUserId`, kiểm tra trạng thái bận và chỉ relay signaling giữa hai tài khoản đã ghép cặp. Không cần `CALL_REGISTER` từ trình duyệt.

### Gọi nhóm (thoại/video)
- Trong phòng chat **nhóm**, nút gọi thoại/video bắt đầu một cuộc gọi nhóm; các thành viên còn lại nhận hộp "nhóm đang gọi" ở mọi trang. Ai bấm Trả lời thì vào cuộc gọi; người bỏ lỡ có thể bấm nút gọi trong phòng để vào lại khi cuộc gọi còn diễn ra.
- Kiểu kết nối **mesh**: mỗi người nối trực tiếp (WebRTC) với từng người còn lại, server chỉ chuyển tiếp signaling. Tối đa **4 người** mỗi cuộc gọi (hằng `MAX_PARTICIPANTS` trong `source/server/socket/group-call.socket.js`); nhiều hơn cần SFU/MCU.
- Giao thức dùng sự kiện `GROUP_CALL_SIGNAL` với `type`: client gửi `join`, `leave`, `offer`, `answer`, `ice`; server gửi `invite`, `joined`, `participant-joined`, `participant-left`, `offer`, `answer`, `ice`, `ended`, `full`, `error`. Người vào sau là bên tạo offer tới những người đã có mặt.
- Server kiểm tra người gọi là thành viên của nhóm, tự gán `fromUserId` và chỉ relay giữa những người đang cùng trong cuộc gọi; đóng tab/mất kết nối được coi là rời cuộc gọi.
- Code: `source/server/socket/group-call.socket.js`, `source/client/public/client/js/group-call.js`, `source/client/view/client/partials/group-call-overlay.pug`, kiểm thử `test/group-call-signaling.test.js` (`npm test`).
- Chưa có: chia sẻ màn hình trong gọi nhóm, mời thêm người vào giữa cuộc gọi.

### Điều kiện mạng
- Camera/micro chỉ hoạt động trên HTTPS hoặc `localhost`.
- Cấu hình STUN mặc định trong `source/client/public/client/js/config.js` phù hợp thử nghiệm.
- Để gọi ổn định qua các mạng NAT/firewall khác nhau, cần triển khai TURN server (ví dụ coturn) và thêm URL/username/credential vào `ICE_SERVERS`, ví dụ `{ urls: "turn:turn.example.com:3478", username: "...", credential: "..." }`. STUN-only không đảm bảo mọi mạng đều kết nối được.
- Trình duyệt cần cấp quyền camera và micro. Chia sẻ màn hình cần thao tác người dùng và trình duyệt hỗ trợ `getDisplayMedia`.

## Cài đặt
1. Cài Node.js 22 LTS hoặc mới hơn và MongoDB (local hoặc Atlas).
2. Sao chép `.env.example` thành `.env`, rồi điền `MONGO_URL`, `SESSION_SECRET`, `COOKIE_SECRET`. Điền ba biến Cloudinary nếu cần upload ảnh.
3. Cài dependencies:
   ```bash
   npm install
   ```
4. Chạy chế độ phát triển:
   ```bash
   npm run dev
   ```
   Hoặc chạy bình thường:
   ```bash
   npm start
   ```
5. Truy cập `http://localhost:3000`. Endpoint kiểm tra server: `http://localhost:3000/health`.

## Kiểm tra
```bash
npm test
```
Lệnh trên chạy kiểm thử giao thức signaling trong thư mục `test`. Gửi tài liệu hiện vẫn tắt (`FEATURES.sendDocuments=false`); gửi ảnh cần cấu hình Cloudinary. Cần chạy thử thực tế bằng hai tài khoản/trình duyệt khác nhau để xác nhận camera, micro, signaling và điều kiện mạng/TURN.

## Lưu ý triển khai
- Không commit `.env` hoặc thông tin Cloudinary/MongoDB lên Git.
- Khi deploy, dùng HTTPS và đặt `NODE_ENV=production`.
- Thiết lập TURN trước khi coi gọi video là ổn định trên Internet công cộng.
- Server cần truy cập được MongoDB; nếu MongoDB không kết nối, ứng dụng chủ động dừng thay vì chạy trong trạng thái lỗi.
