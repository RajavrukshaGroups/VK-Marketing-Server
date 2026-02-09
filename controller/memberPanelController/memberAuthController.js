const crypto = require("crypto");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../../Models/Users");
const { decrypt } = require("../../utils/encryption"); // same util you already use
const { encrypt } = require("../../utils/encryption");
const sendOtpMail = require("../../utils/sendOtpMail");
const { generateOTP } = require("../../utils/generateOtp");
const sendPasswordResetSuccessMail = require("../../utils/sendPasswordResetSuccessMail");
const Notification = require("../../Models/Notification");
const Payment = require("../../Models/Payment");

const memberLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/User ID and password are required",
      });
    }

    /* =========================
       FIND USER (EMAIL OR USERID)
    ========================= */
    const user = await User.findOne({
      $or: [{ email: identifier }, { userId: identifier }],
      isActive: true,
    })
      .populate("membership.plan", "name")
      .lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid User Id or Password",
      });
    }

    /* =========================
       PASSWORD VERIFY
    ========================= */
    const decryptedPassword = decrypt(user.password);

    if (decryptedPassword !== password) {
      return res.status(401).json({
        success: false,
        message: "Invalid User Id or Password",
      });
    }

    /* =========================
       MEMBERSHIP CHECK
    ========================= */
    if (user.membership?.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Membership is not active",
      });
    }

    /* =========================
       JWT TOKEN
    ========================= */
    const token = jwt.sign(
      {
        userId: user._id,
        role: "MEMBER",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: {
        _id: user._id,
        userId: user.userId,
        companyName: user.companyName,
        email: user.email,
        membershipPlan: user.membership.plan?.name || null,
      },
    });
  } catch (err) {
    console.error("Member Login Error:", err);
    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "Email or User ID is required",
      });
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { userId: identifier }],
      isActive: true,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User with this Email or User ID not found",
      });
    }

    const otp = generateOTP();

    if (!otp) {
      throw new Error("OTP generation failed");
    }

    const hashedOtp = crypto
      .createHash("sha256")
      .update(String(otp))
      .digest("hex");

    user.forgotPassword = {
      otp: hashedOtp,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };

    await user.save();
    await sendOtpMail(user.email, otp);

    return res.json({
      success: true,
      message: "OTP sent to registered email",
    });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body;

    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { userId: identifier }],
      isActive: true,
    });

    if (!user || !user.forgotPassword?.otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
      });
    }

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    if (
      user.forgotPassword.otp !== hashedOtp ||
      user.forgotPassword.otpExpiresAt < new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    user.password = encrypt(newPassword);
    user.forgotPassword = undefined;

    await user.save();

    await sendPasswordResetSuccessMail(
      user.email,
      user.userId,
      user.companyName,
    );

    return res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (err) {
    console.error("Reset Password Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};

const getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await User.findById(userId).select(
      "_id companyName businessCategory",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const filter = {
      isActive: true,
      $or: [
        { targetType: "ALL" },
        {
          targetType: "BUSINESS_CATEGORY",
          businessCategories: user.businessCategory,
        },
        {
          targetType: "SELECTED_COMPANIES",
          targetUsers: user._id,
        },
      ],
    };

    const total = await Notification.countDocuments(filter);

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      company: user.companyName,
      data: notifications.map((n) => ({
        _id: n._id,
        title: n.title,
        message: n.message,
        type: n.type,
        url: n.url,
        sentAt: n.sentAt,
      })),
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + notifications.length < total,
      },
    });
  } catch (err) {
    console.error("Get User Notifications Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

const getCertificateOnPayment = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("user Id", userId);

    // 1️⃣ Validate Mongo ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send("Invalid user id");
    }

    // 2️⃣ Fetch User
    const user = await User.findById(userId)
      .populate("membership.plan")
      .populate("businessCategory");

    if (!user) {
      return res.status(404).send("User not found");
    }

    // 3️⃣ Membership must be ACTIVE
    if (user.membership.status !== "ACTIVE") {
      return res
        .status(403)
        .send("Certificate available only for active members");
    }

    // 4️⃣ Fetch latest successful payment
    const payment = await Payment.findOne({
      user: user._id,
      status: "SUCCESS",
    })
      .populate("membershipPlan")
      .sort({ paidAt: -1 });

    if (!payment) {
      return res
        .status(403)
        .send("No successful payment found for certificate");
    }

    // 5️⃣ Certificate issue date
    const issuedDate = new Date(
      user.membership.startedAt || payment.paidAt,
    ).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    console.log("user details", user);

    // 6️⃣ Render Certificate
    res.render("certificates/membershipCertificate", {
      // Dynamic data
      companyName: user.companyName,
      membershipType:
        user.membership.plan?.name?.toUpperCase() || "ORDINARY MEMBER",
      issuedDate,

      // Static Assets
      fkcciLogo: "/assets/FKCCI_IMAGE.png",
      sirMVLogo: "/assets/sirmv.jpg",
      // memberSign: "/assets/MEMBER_SIGN.jpeg",
      // presidentSign: "/assets/president_sign.jpeg",
      presidentSign: "/assets/president_sign_new-removebg-preview_new.webp",
      // secretarySign: "/assets/secretary_sign.jpg",
      secretarySign: "/assets/gen_sec-removebg-preview_new.webp",
      since2016Img: "/assets/since2016new1.webp",
      aitiflogo:"/assets/AITIF_new_logo.png",
    });
  } catch (error) {
    console.error("Certificate Generation Error:", error);
    res.status(500).send("Unable to generate certificate");
  }
};

module.exports = {
  memberLogin,
  forgotPassword,
  resetPassword,
  getUserNotifications,
  getCertificateOnPayment,
};
