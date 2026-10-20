const express = require('express');
const router = express.Router();

const controller = require('../controller/auth.controller');

const validate = require('../validate/auth.validate');

router.get("/login", controller.login);

router.post("/login", validate.loginValidate, controller.loginPost);

router.get("/sign-up", controller.signUp);

router.post("/sign-up", validate.signUpValidate, controller.signUpPost);

router.get("/logout", controller.logOut);

module.exports = router;