const express = require("express");
const router = express.Router();
const UserController = require("../controller/userController");

router.post("/create-user", UserController.createUser);
router.get("/fetch-user-details", UserController.fetchAllUsers);
router.get("/referral/:userId", UserController.fetchReferrerByUserId);

module.exports = router;
