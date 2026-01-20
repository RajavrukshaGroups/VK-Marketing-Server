const express = require("express");
const router = express.Router();
const MemberAuthController = require("../../controller/memberPanelController/memberAuthController");

router.post("/login", MemberAuthController.memberLogin);
router.post("/forgot-password", MemberAuthController.forgotPassword);
router.post("/reset-password", MemberAuthController.resetPassword);

module.exports = router;
