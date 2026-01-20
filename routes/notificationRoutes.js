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
router.get(
  "/companies/notifications",
  notificationController.getAllNotifications
);
router.delete(
  "/delete/notification/:notificationId",
  notificationController.deleteIndividualNotification
);
router.patch(
  "/toggle/notification/:notificationId",
  notificationController.toggleNotificationStatus
);

module.exports = router;
