# Chatting & Calling

**Bài tập lớn môn Lập trình mạng**

Chatting & Calling là ứng dụng web nhắn tin và gọi thoại, video giữa hai người hoặc trong nhóm. Người dùng có thể tạo tài khoản, kết bạn, tham gia phòng chat và cập nhật hồ sơ cá nhân.

## Thông tin nhóm
| Họ và tên | MSSV | Email | Đóng góp |
| --- | --- | --- | --- |
| Trần Công Danh | B23DCCN122| danhtc.b23cn122@stu.ptit.edu.vn | Thiết kế cơ sở dữ liệu, xây dựng tính năng nhắn tin và kết bạn|
| Nguyễn Văn Du | B23DCCN164| dunv.b23cn164@stu.ptit.edu.vn | Thiết kế giao diện, xây dựng tính năng đăng nhập, đăng ký, trang cá nhân của người dùng|
| Nguyễn Khả Luận | B23DCCN514| luannk.b23cn514@stu.ptit.edu.vn | Thiết kế cơ sở dữ liệu, xây dựng tính năng gọi thoại và gọi video|

## Chức năng

- Đăng ký, đăng nhập, đăng xuất và bật/tắt hiển thị mật khẩu trên form đăng nhập, đăng ký.
- Gửi, chấp nhận, từ chối và thu hồi lời mời kết bạn.
- Nhắn tin văn bản và hình ảnh trong cuộc trò chuyện riêng hoặc phòng nhóm.
- Tạo nhóm, thêm thành viên và quản lý vai trò trong nhóm.
- Gọi thoại hoặc video giữa hai người và trong nhóm.
- Cập nhật hồ sơ cá nhân, ảnh đại diện và ảnh bìa.

## Kiến trúc và công nghệ

Express xử lý yêu cầu HTTP, kết xuất giao diện Pug và phục vụ JavaScript, CSS và tài nguyên tĩnh. Socket.IO truyền tin nhắn, sự kiện kết bạn và tín hiệu thiết lập cuộc gọi. WebRTC truyền âm thanh và video giữa các trình duyệt. MongoDB lưu tài khoản, phòng chat và tin nhắn. Cloudinary lưu ảnh tải lên.

```text
Trình duyệt A <-------- WebRTC (âm thanh, video) --------> Trình duyệt B
       \                                                   /
        +--------------- HTTP và Socket.IO ---------------+
                                 |
                       Node.js / Express
                     /                   \
           MongoDB / Mongoose         Cloudinary
```

Giao diện dùng Pug, Bootstrap và JavaScript. Các form tải ảnh lên dùng Multer. Client và server chạy chung từ `index.js`.

## Chạy trên máy

Chuẩn bị Node.js từ **20.19.0**, npm và một MongoDB đang chạy hoặc một URI MongoDB Atlas. Để thử gửi ảnh và cập nhật ảnh hồ sơ, chuẩn bị thêm thông tin tài khoản Cloudinary.

### 1. Cài thư viện

Từ thư mục `chatting-calling`, chạy:

```sh
cd jnp-project-starter
npm ci
```

### 2. Cấu hình môi trường

Tạo hoặc cập nhật tệp `.env` trong thư mục chứa `package.json`. Thay các giá trị Cloudinary bằng thông tin của tài khoản dùng cho dự án.

```dotenv
PORT=3000
MONGO_URL=mongodb://127.0.0.1:27017/chatting-calling
CLOUD_NAME=your_cloud_name
CLOUD_KEY=your_api_key
CLOUD_SECRET=your_api_secret
```

### 3. Khởi động

```sh
npm start
```

Khi terminal báo `Connect success!`, mở `http://localhost:3000`. Nếu log báo `Connect failed!`, kiểm tra dịch vụ MongoDB và giá trị `MONGO_URL`.

## Giao tiếp giữa client và server

### Các tuyến HTTP chính

| Phương thức | Đường dẫn | Chức năng |
| --- | --- | --- |
| GET, POST | `/auth/login` | Mở form và đăng nhập |
| GET, POST | `/auth/sign-up` | Mở form và đăng ký |
| GET | `/auth/logout` | Đăng xuất |
| GET | `/chat`, `/chat/:roomChatId` | Mở danh sách và chi tiết cuộc trò chuyện |
| GET | `/friend`, `/friend/request`, `/friend/invitation` | Xem bạn bè và lời mời kết bạn |
| GET, POST | `/group/create` | Mở form và tạo nhóm |
| GET | `/profile/me` | Xem hồ sơ cá nhân |
| GET, PATCH | `/profile/me/edit` | Mở form và cập nhật hồ sơ |

### Sự kiện Socket.IO

| Sự kiện | Chức năng |
| --- | --- |
| `CLIENT_SEND_MESSAGE` | Client gửi nội dung và hình ảnh của tin nhắn |
| `SERVER_RETURN_MESSAGE` | Server phát tin nhắn đã lưu đến phòng chat |
| `CLIENT_ADD_FRIEND`, `CLIENT_ACCEPT_FRIEND` | Client gửi hoặc chấp nhận lời mời kết bạn |
| `CALL_SIGNAL`, `GROUP_CALL_SIGNAL` | Trao đổi tín hiệu để thiết lập cuộc gọi WebRTC |

## Kiểm thử thủ công

1. Mở ứng dụng trong hai phiên trình duyệt độc lập, ví dụ một cửa sổ thường và một cửa sổ ẩn danh. Đăng ký và đăng nhập bằng hai tài khoản.
2. Tích rồi bỏ tích ô **Hiển thị mật khẩu** trên form đăng nhập hoặc đăng ký. Xác nhận nội dung đã nhập được giữ nguyên.
3. Gửi lời mời kết bạn từ tài khoản thứ nhất, chấp nhận ở tài khoản thứ hai rồi mở cùng cuộc trò chuyện ở cả hai phiên.
4. Gửi một tin nhắn văn bản và kiểm tra nội dung ở phiên còn lại. Sau khi cấu hình Cloudinary, thử gửi thêm một ảnh.
5. Gọi thoại hoặc video và chấp nhận ở phiên còn lại. Cấp quyền microphone và camera theo loại cuộc gọi. Dùng `localhost` khi thử trên cùng máy hoặc HTTPS khi mở ứng dụng trên thiết bị khác.

## Cấu trúc dự án

```text
jnp-project-starter/
├── index.js             # Khởi động HTTP server và Socket.IO
├── package.json         # Thư viện và lệnh npm
├── package-lock.json    # Phiên bản thư viện dùng bởi npm ci
├── INSTRUCTION.md      # Hướng dẫn bài tập lớn
├── statics/            # Tài nguyên của dự án
└── source/
    ├── client/
    │   ├── public/      # JavaScript, CSS và tài nguyên tĩnh
    │   └── view/        # Giao diện Pug
    └── server/
        ├── config/      # Cấu hình kết nối MongoDB
        ├── controller/  # Xử lý yêu cầu HTTP
        ├── helper/      # Hàm hỗ trợ
        ├── middleware/  # Xác thực và xử lý tải ảnh
        ├── model/       # Mô hình dữ liệu Mongoose
        ├── router/      # Định tuyến Express
        ├── socket/      # Xử lý sự kiện Socket.IO
        └── validate/    # Kiểm tra dữ liệu đầu vào
```
