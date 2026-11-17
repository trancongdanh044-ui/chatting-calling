const express = require('express');
const router = express.Router();

const controller = require('../controller/group.controller.js');

router.get("/", controller.index);

router.get("/create", controller.create);

router.post("/create", controller.createPost);

router.get("/:roomChatId/add-member", controller.addMember);

router.patch("/:roomChatId/add-member", controller.addMemberPatch);

router.get("/:roomChatId/delete-member/:userId", controller.deleteMember);

router.patch("/leave/:roomChatId", controller.leave);

router.patch("/disband/:roomChatId", controller.dissolve);

module.exports = router;