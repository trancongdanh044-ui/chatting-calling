const express = require('express');
require('dotenv').config();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('express-flash');

const route = require('./source/server/router/index.route');
const database = require('./source/server/config/database');

// Không để server bị tắt âm thầm khi có lỗi bất đồng bộ chưa được bắt.
process.on('unhandledRejection', (reason) => {
  console.error('Lỗi chưa được xử lý:', reason);
});

const app = express();
const http = require('http');
const server = http.createServer(app);
const {Server} = require("socket.io");
const io = new Server(server, {
  maxHttpBufferSize: 12 * 1024 * 1024
});
const port = Number(process.env.PORT) || 3000;
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.set("views", "./source/client/view");
app.set("view engine", "pug");

app.use(express.static("./source/client/public"));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// express-flash
app.use(cookieParser(process.env.COOKIE_SECRET || process.env.SESSION_SECRET || 'change-this-secret'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
}));
app.use(flash());

// Socket io
global._io = io;
require('./source/server/socket/auth.socket')(io);
require('./source/server/socket/chat.socket')(io);
require('./source/server/socket/friend.socket')(io);
require('./source/server/socket/call.socket')(io);
require('./source/server/socket/info.socket')(io);

route(app);

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

async function startServer() {
  try {
    await database.connect();
    server.listen(port, () => {
      console.log(`Chatting & Calling đang chạy tại http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Không thể khởi động ứng dụng vì kết nối MongoDB thất bại:', error.message);
    process.exit(1);
  }
}

startServer();