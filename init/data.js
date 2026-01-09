require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Login = require("../Models/Login");
const loginData = require("./loginCred");

const MONGO_URL = process.env.MONGO_URL;

const seedLogin = async () => {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("MongoDB connected");

    for (const user of loginData) {
      const exists = await Login.findOne({ email: user.email });
      if (exists) {
        console.log(`admin already exists:${user.email}`);
        continue;
      }
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await Login.create({
        email: user.email,
        password: hashedPassword,
        role: user.role,
      });
      console.log(`admin created:${user.email}`);
    }
    process.exit();
  } catch (error) {
    console.error("sending error:", error);
    process.exit(1);
  }
};

seedLogin();
