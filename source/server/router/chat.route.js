const express = require('express');
const router = express.Router();

const controller = require('../controller/chat.controller');

router.get("/", controller.index);

router.get("/:roomChatId", controller.detail);

module.exports = router;