const express = require("express");
const router = express.Router();
const LoginController = require("../controller/loginController");

router.post("/login", LoginController.loginDetails);
router.post("/logout", LoginController.logoutDetails);

module.exports = router;
