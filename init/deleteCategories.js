require("dotenv").config();
const mongoose = require("mongoose");
const Category = require("../Models/Category");

const MONGO_URL = process.env.MONGO_URL;

const deleteAllCategories = async () => {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("MongoDB connected");

    const result = await Category.deleteMany({});
    console.log(
      `✅ Deleted ${result.deletedCount} business categories successfully`
    );

    process.exit(0);
  } catch (error) {
    console.error("❌ Error deleting categories:", error);
    process.exit(1);
  }
};

deleteAllCategories();
