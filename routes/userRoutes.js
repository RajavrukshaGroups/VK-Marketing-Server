const express = require("express");
const router = express.Router();
const UserController = require("../controller/userController");
const PinCodeController = require("../controller/pinCodeController");

router.post("/create-user", UserController.createUser);
router.get("/fetch-user-details", UserController.fetchAllUsers);
router.get("/referral/:userId", UserController.fetchReferrerByUserId);
router.patch("/edit-user/:id", UserController.editUsersDetails);
router.get("/user/:id", UserController.fetchUserById);
router.get("/user-filters", UserController.fetchUserFilters);
router.get("/pincode/:pin", PinCodeController.getPincodeDetails);
module.exports = router;
