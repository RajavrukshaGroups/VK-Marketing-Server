const express = require("express");
const router = express.Router();
const UserController = require("../controller/userController");

router.post("/create-user", UserController.createUser);
router.get("/fetch-user-details", UserController.fetchAllUsers);
router.get("/referral/:userId", UserController.fetchReferrerByUserId);
router.patch("/edit-user/:id", UserController.editUsersDetails);
router.get("/user/:id", UserController.fetchUserById);

module.exports = router;
