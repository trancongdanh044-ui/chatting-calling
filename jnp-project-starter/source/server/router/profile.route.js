const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();

const controller = require('../controller/profile.controller');
const uploadToCloudinary = require('../middleware/uploadToCloudinary.middleware');

router.get("/me", controller.me);

router.get('/me/edit', controller.edit);

router.patch(
  '/me/edit', 
  upload.fields([{name: "avatar", maxCount: 1}, {name: "cover", maxCount: 1}]),
  uploadToCloudinary,
  controller.editPatch
);

router.get('/detail/:userId', controller.detail);

module.exports = router;