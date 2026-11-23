const express = require('express');
const router = express.Router();

const controller = require('../controller/forgot-password.controller');

router.get("/", controller.index);

router.post("/", controller.forgotPasswordPost);

router.get("/otp", controller.otp);

router.post("/otp", controller.otpPost);

router.get("/reset", controller.reset);

router.patch("/reset", controller.resetPatch);

module.exports = router;