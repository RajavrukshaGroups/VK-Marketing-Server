const express = require("express");
const router = express.Router();
const categoryController = require("../controller/categoryController");

router.post("/create", categoryController.createCategory);
router.get("/fetch", categoryController.fetchCategories);
router.patch("/toggle/:id", categoryController.toggleCategoryStatus);
router.put("/edit/:id", categoryController.editCategory);
router.get("/getCategories", categoryController.getAllTheCategories);

module.exports = router;
