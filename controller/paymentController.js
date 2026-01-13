require("dotenv").config();
const mongoose = require("mongoose");
const crypto = require("crypto");
const razorpay = require("../config/razorpay");
const Payment = require("../Models/Payment");
const User = require("../Models/Users");
const MembershipPlan = require("../Models/MembershipPlan");
const { generateUserId } = require("../utils/generateUserId");
const { generatePassword } = require("../utils/password");
const { encrypt } = require("../utils/encryption");
const { sendWelcomeMail } = require("../utils/mailer");

const MAX_REFERRALS_PER_USER = 4;

/* =========================
   CREATE RAZORPAY ORDER
========================= */
const createOrder = async (req, res) => {
  try {
    const { membershipPlanId, registrationData } = req.body;

    if (!membershipPlanId || !registrationData) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
      });
    }

    const {
      companyName,
      proprietors,
      address,
      mobileNumber,
      email,
      businessCategory,
      businessType,
      majorCommodities,
      gstNumber,
      bankDetails,
    } = registrationData;

    /* =========================
       BASIC REQUIRED VALIDATIONS
    ========================= */
    if (!companyName)
      return res
        .status(400)
        .json({ success: false, message: "Company name is required" });

    if (!proprietors)
      return res
        .status(400)
        .json({ success: false, message: "Proprietor name is required" });

    if (!address?.pin)
      return res
        .status(400)
        .json({ success: false, message: "PIN code is required" });

    if (!address?.state)
      return res
        .status(400)
        .json({ success: false, message: "State is required" });

    if (!address?.district)
      return res
        .status(400)
        .json({ success: false, message: "District is required" });

    if (!mobileNumber || mobileNumber.length !== 10)
      return res
        .status(400)
        .json({ success: false, message: "Valid mobile number is required" });

    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });

    if (!businessCategory)
      return res
        .status(400)
        .json({ success: false, message: "Business category is required" });

    if (!businessType?.length)
      return res
        .status(400)
        .json({ success: false, message: "Business type is required" });

    if (!majorCommodities || !majorCommodities.some((c) => c.trim()))
      return res.status(400).json({
        success: false,
        message: "At least one major commodity is required",
      });

    /* =========================
       FORMAT VALIDATIONS
    ========================= */
    if (!mongoose.Types.ObjectId.isValid(businessCategory)) {
      return res.status(400).json({
        success: false,
        message: "Invalid business category",
      });
    }

    if (gstNumber) {
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstNumber)) {
        return res.status(400).json({
          success: false,
          message: "Invalid GST number format",
        });
      }
    }

    /* =========================
       BANK DETAILS (GROUPED)
    ========================= */
    if (bankDetails) {
      const { bankName, accountNumber, ifscCode } = bankDetails;

      if (!bankName || !accountNumber || !ifscCode) {
        return res.status(400).json({
          success: false,
          message: "Complete bank details are required",
        });
      }

      if (accountNumber.length < 9) {
        return res.status(400).json({
          success: false,
          message: "Invalid bank account number",
        });
      }

      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
        return res.status(400).json({
          success: false,
          message: "Invalid IFSC code format",
        });
      }
    }

    /* =========================
       🔒 DUPLICATE USER CHECK
    ========================= */
    const existingUser = await User.findOne({
      $or: [{ email }, { mobileNumber }],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email or mobile number",
      });
    }

    /* =========================
       VALIDATE MEMBERSHIP PLAN
    ========================= */
    const plan = await MembershipPlan.findById(membershipPlanId);
    if (!plan || !plan.isActive) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive membership plan",
      });
    }

    /* =========================
       CREATE RAZORPAY ORDER
    ========================= */
    const order = await razorpay.orders.create({
      amount: plan.amount * 100,
      currency: "INR",
      receipt: `membership_${Date.now()}`,
    });

    /* =========================
       SAVE PAYMENT SNAPSHOT
    ========================= */
    await Payment.create({
      membershipPlan: plan._id,
      amount: plan.amount,
      registrationSnapshot: registrationData,
      razorpay: { orderId: order.id },
      status: "CREATED",
    });

    return res.json({
      success: true,
      message:"Payment completed successfully.Your membership will be activated shortly",
      orderId: order.id,
      amount: plan.amount,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Create Order Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to initiate payment",
    });
  }
};

/* =========================
   RAZORPAY WEBHOOK
========================= */
const razorpayWebhook = async (req, res) => {
  try {
    /* =========================
       VERIFY WEBHOOK SIGNATURE
    ========================= */
    const signature = req.headers["x-razorpay-signature"];

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).send("Invalid signature");
    }

    /* =========================
       HANDLE ONLY PAYMENT CAPTURE
    ========================= */
    if (req.body.event !== "payment.captured") {
      return res.json({ received: true });
    }

    const paymentEntity = req.body.payload.payment.entity;

    /* =========================
       FIND PAYMENT RECORD
    ========================= */
    const payment = await Payment.findOne({
      "razorpay.orderId": paymentEntity.order_id,
    });

    // 🔒 Webhook retry protection
    if (!payment || payment.status === "SUCCESS") {
      return res.json({ received: true });
    }

    /* =========================
       LOAD SNAPSHOT & PLAN
    ========================= */
    const snapshot = payment.registrationSnapshot;
    const plan = await MembershipPlan.findById(payment.membershipPlan);

    if (!snapshot || !plan) {
      console.error("Missing snapshot or membership plan");
      return res.status(500).json({ received: false });
    }

    /* =========================
       🔁 REFERRAL HANDLING (EXACT CREATE USER LOGIC)
    ========================= */
    let referralData = {
      source: "ADMIN",
      referredByUser: null,
      referredByUserId: null,
    };

    const referredByUserId = snapshot?.referral?.referredByUserId;

    if (referredByUserId) {
      const refUser = await User.findOne({ userId: referredByUserId });

      if (!refUser) {
        console.error("Invalid referral userId:", referredByUserId);
        return res.status(400).json({
          received: false,
          message: "Invalid referral user",
        });
      }

      const referralCount = await User.countDocuments({
        "referral.referredByUser": refUser._id,
      });

      if (referralCount >= MAX_REFERRALS_PER_USER) {
        console.error("Referral limit exceeded for:", refUser.userId);
        return res.status(403).json({
          received: false,
          message: "Referral limit exceeded",
        });
      }

      referralData = {
        source: "USER",
        referredByUser: refUser._id,
        referredByUserId: refUser.userId,
      };
    }

    /* =========================
       CREATE USER
    ========================= */
    const userId = await generateUserId();
    const plainPassword = generatePassword();

    const newUser = await User.create({
      userId,
      companyName: snapshot.companyName,
      proprietors: snapshot.proprietors,
      address: snapshot.address,
      mobileNumber: snapshot.mobileNumber,
      email: snapshot.email,
      password: encrypt(plainPassword),

      businessCategory: snapshot.businessCategory,
      businessType: snapshot.businessType,
      majorCommodities: snapshot.majorCommodities || [],
      gstNumber: snapshot.gstNumber,

      referral: referralData,

      bankDetails: snapshot.bankDetails || undefined,

      membership: {
        plan: plan._id,
        status: "ACTIVE",
        startedAt: new Date(),
        expiresAt: plan.durationInDays
          ? new Date(Date.now() + plan.durationInDays * 86400000)
          : null,
      },
    });

    /* =========================
       UPDATE PAYMENT RECORD
    ========================= */
    payment.status = "SUCCESS";
    payment.user = newUser._id;
    payment.razorpay.paymentId = paymentEntity.id;
    payment.razorpay.signature = signature;
    payment.paidAt = new Date();
    await payment.save();

    /* =========================
       SEND WELCOME EMAIL (ONCE)
    ========================= */
    await sendWelcomeMail({
      email: newUser.email,
      companyName: newUser.companyName,
      userId,
      password: plainPassword,
    });

    return res.json({ received: true });
  } catch (err) {
    console.error("Webhook Error:", err);
    return res.status(500).json({ received: false });
  }
};

module.exports = {
  createOrder,
  razorpayWebhook,
};
