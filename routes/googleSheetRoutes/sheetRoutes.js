const express = require("express");
const router = express.Router();
const SheetController = require("../../controller/googleSheetController");

router.post("/upload-data-sheet", SheetController.exportPaymentsToGoogleSheet);

module.exports = router;
