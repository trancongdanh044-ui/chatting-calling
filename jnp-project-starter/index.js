const express = require('express');
require('dotenv').config();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('express-flash');

const route = require('./source/server/router/index.route');
const database = require('./source/server/config/database');

database.connect();

const app = express();
const http = require('http');
const server = http.createServer(app);
const {Server} = require("socket.io");
const io = new Server(server);
const port = process.env.PORT;

app.set("views", "./source/client/view");
app.set("view engine", "pug");

app.use(express.static("./source/client/public"));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// express-flash
app.use(cookieParser('dhafdaodoadhadoajafdfohfflna'));
app.use(session({ cookie: { maxAge: 60000 }}));
app.use(flash());

// Socket io
global._io = io;

route(app);

server.listen(port, () =>{
  console.log(`Example is listening on port ${port}`);
});