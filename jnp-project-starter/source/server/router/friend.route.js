const express = require('express');
const router = express.Router();

const controller = require('../controller/friend.controller.js');

router.get("/", controller.index);

router.get("/hint", controller.hint);

router.get("/request", controller.request);

router.get("/invitation", controller.invitation);

module.exports = router;