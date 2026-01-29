const express = require("express");
const router = express.Router();
const DashboardController = require("../controller/dashboardController");

router.get("/view-details", DashboardController.fetchDetails);

module.exports = router;
