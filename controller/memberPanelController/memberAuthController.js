const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../../Models/Users");
const { decrypt } = require("../../utils/encryption"); // same util you already use
const { encrypt } = require("../../utils/encryption");
const sendOtpMail = require("../../utils/sendOtpMail");
const { generateOTP } = require("../../utils/generateOtp");
const sendPasswordResetSuccessMail = require("../../utils/sendPasswordResetSuccessMail");

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
      { expiresIn: "7d" }
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
      user.companyName
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

module.exports = {
  memberLogin,
  forgotPassword,
  resetPassword,
};
