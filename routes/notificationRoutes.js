const express = require("express");
const router = express.Router();
const notificationController = require("../controller/notificationController");

router.post("/post-notification", notificationController.postNotification);
router.get(
  "/business-categories",
  notificationController.getBusinessCategories
);
router.get("/companies", notificationController.getCompanies);
router.post(
  "/companies-by-category",
  notificationController.getCompaniesByCategory
);

module.exports = router;
