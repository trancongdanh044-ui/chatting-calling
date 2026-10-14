const express = require('express');
require('dotenv').config();
const database = require('./jnp-project-starter/source/server/config/database');

database.connect();

const app = express();
const port = process.env.PORT;

app.set("views", "./jnp-project-starter/source/client/view");
app.set("view engine", "pug");

app.use(express.static("./jnp-project-starter/source/client/public"));


app.get("/", async (req, res) => {
  res.render("client/pages/home/index.pug", {
    pageTitle: "Trang chủ",
  });
});

app.listen(port, () =>{
  console.log(`Example is listening on port ${port}`);
});