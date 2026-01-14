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
      message:
        "Payment completed successfully.Your membership will be activated shortly",
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
    console.log("🔔 Razorpay webhook HIT");

    console.log(
      "Webhook secret exists:",
      !!process.env.RAZORPAY_WEBHOOK_SECRET
    );

    const signature = req.headers["x-razorpay-signature"];

    // const expectedSignature = crypto
    //   .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    //   .update(JSON.stringify(req.body))
    //   .digest("hex");

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body)
      .digest("hex");

    console.log("Expected signature:", expectedSignature);

    if (signature !== expectedSignature) {
      console.log("signature mismatched");
      return res.status(400).send("Invalid signature");
    }

    console.log("✅ Signature verified");

    /* =========================
       HANDLE ONLY PAYMENT CAPTURE
    ========================= */
    const event = JSON.parse(req.body.toString());
    if (event.event !== "payment.captured") {
      return res.json({ received: true });
    }

    const paymentEntity = event.payload.payment.entity;

    /* =========================
       FIND PAYMENT RECORD
    ========================= */
    console.log("Looking for orderId:", paymentEntity.order_id);

    const payment = await Payment.findOne({
      "razorpay.orderId": paymentEntity.order_id,
    });

    console.log("Payment found:", !!payment, payment?.status);

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
    console.log("Creating user for:", snapshot.email);

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
    console.log("user created", newUser._id);

    /* =========================
       UPDATE PAYMENT RECORD
    ========================= */
    console.log("Creating user for:", snapshot.email);

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

const fetchPaymentRecords = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim();

    /* =========================
       SEARCH FILTER
    ========================= */
    let query = {};

    if (search) {
      query = {
        $or: [
          {
            "registrationSnapshot.companyName": {
              $regex: search,
              $options: "i",
            },
          },
          { "registrationSnapshot.email": { $regex: search, $options: "i" } },
          { "razorpay.orderId": { $regex: search, $options: "i" } },
          { "razorpay.paymentId": { $regex: search, $options: "i" } },
        ],
      };
    }

    /* =========================
       FETCH PAYMENTS
    ========================= */
    const [payments, totalPayments] = await Promise.all([
      Payment.find(query)
        .populate({
          path: "user",
          select: "userId companyName email mobileNumber",
        })
        .populate({
          path: "membershipPlan",
          select: "name amount durationInDays",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Payment.countDocuments(query),
    ]);

    /* =========================
       COLLECT REFERRER USER IDS
    ========================= */
    const referredUserIds = [
      ...new Set(
        payments
          .map(
            (p) => p.registrationSnapshot?.referral?.referredByUserId
          )
          .filter(Boolean)
      ),
    ];

    /* =========================
       FETCH REFERRER USERS
    ========================= */
    const referrers = referredUserIds.length
      ? await User.find(
          { userId: { $in: referredUserIds } },
          "userId companyName"
        ).lean()
      : [];

    const referrerMap = referrers.reduce((acc, r) => {
      acc[r.userId] = r;
      return acc;
    }, {});

    /* =========================
       FORMAT RESPONSE
    ========================= */
    const formattedPayments = payments.map((p) => {
      const referralSnapshot = p.registrationSnapshot?.referral;
      const referrer =
        referralSnapshot?.referredByUserId &&
        referrerMap[referralSnapshot.referredByUserId];

      return {
        _id: p._id,
        status: p.status,
        amount: p.amount,
        paidAt: p.paidAt,
        createdAt: p.createdAt,

        companyName: p.registrationSnapshot?.companyName,
        email: p.registrationSnapshot?.email,
        mobileNumber: p.registrationSnapshot?.mobileNumber,

        membershipPlan: p.membershipPlan
          ? {
              _id: p.membershipPlan._id,
              name: p.membershipPlan.name,
              amount: p.membershipPlan.amount,
              durationInDays: p.membershipPlan.durationInDays,
            }
          : null,

        user: p.user
          ? {
              _id: p.user._id,
              userId: p.user.userId,
              companyName: p.user.companyName,
              email: p.user.email,
              mobileNumber: p.user.mobileNumber,
            }
          : null,

        referral: {
          source: referralSnapshot?.source || "ADMIN",
          referredByUserId: referralSnapshot?.referredByUserId || null,
          referredByCompanyName: referrer?.companyName || null,
        },

        razorpay: {
          orderId: p.razorpay?.orderId,
          paymentId: p.razorpay?.paymentId,
        },
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedPayments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalPayments / limit),
        totalPayments,
        limit,
      },
    });
  } catch (err) {
    console.error("Fetch Payment Records Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment records",
    });
  }
};


module.exports = {
  createOrder,
  razorpayWebhook,
  fetchPaymentRecords,
};
