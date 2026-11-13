const express = require('express');
const router = express.Router();

const controller = require('../controller/group.controller.js');

router.get("/", controller.index);

router.get("/create", controller.create);

router.post("/create", controller.createPost);

module.exports = router;