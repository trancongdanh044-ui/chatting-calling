const express = require('express');
const router = express.Router();

const controller = require('../controller/auth.controller');

router.get("/login", controller.login);

router.get("/sign-up", controller.signUp)

module.exports = router;