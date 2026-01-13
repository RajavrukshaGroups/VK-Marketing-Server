require("dotenv").config();
const mongoose = require("mongoose");
const Payment = require("../Models/Payment");

const MONGO_URL = process.env.MONGO_URL;

const deleteAllPayments = async () => {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("MongoDB connected");

    const result = await Payment.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} payments successfully`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error deleting categories:", error);
    process.exit(1);
  }
};

deleteAllPayments();
