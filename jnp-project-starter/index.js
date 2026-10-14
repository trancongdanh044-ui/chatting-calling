const express = require('express');
require('dotenv').config();

const route = require('./source/server/router/index.route');
const database = require('./source/server/config/database');

database.connect();

const app = express();
const port = process.env.PORT;

route(app);

app.set("views", "./source/client/view");
app.set("view engine", "pug");

app.use(express.static("./source/client/public"));

app.listen(port, () =>{
  console.log(`Example is listening on port ${port}`);
});