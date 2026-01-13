require("dotenv").config();
const mongoose = require("mongoose");
const Users = require("../Models/Users");

const MONGO_URL = process.env.MONGO_URL;

const deleteAllUsers = async () => {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("MongoDB connected");

    const result = await Users.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} users successfully`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error deleting categories:", error);
    process.exit(1);
  }
};

deleteAllUsers();
