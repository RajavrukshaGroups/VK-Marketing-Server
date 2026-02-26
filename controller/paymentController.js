require("dotenv").config();
const mongoose = require("mongoose");
const crypto = require("crypto");
const razorpay = require("../config/razorpay");
const Payment = require("../Models/Payment");
const User = require("../Models/Users");
const Category = require("../Models/Category");
const MembershipPlan = require("../Models/MembershipPlan");
const { generateUserId } = require("../utils/generateUserId");
const { generatePassword } = require("../utils/password");
const { encrypt } = require("../utils/encryption");
const { sendWelcomeMail } = require("../utils/mailer");

// const MAX_REFERRALS_PER_USER = 4;

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
      customBusinessCategory,
      businessNature,
      majorCommodities,
      gstNumber,
      bankDetails,
      referral,
    } = registrationData;

    /* =========================
       BASIC VALIDATIONS
    ========================= */
    if (!companyName)
      return res
        .status(400)
        .json({ success: false, message: "Company name is required" });

    if (!proprietors)
      return res
        .status(400)
        .json({ success: false, message: "Proprietor name is required" });

    if (!address?.pin || !address?.state || !address?.district)
      return res
        .status(400)
        .json({ success: false, message: "Complete address is required" });

    if (!mobileNumber || mobileNumber.length !== 10)
      return res
        .status(400)
        .json({ success: false, message: "Valid mobile number is required" });

    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });

    // if (!businessCategory)
    //   return res
    //     .status(400)
    //     .json({ success: false, message: "Business category is required" });

    /* =========================
       BUSINESS NATURE VALIDATION
    ========================= */
    if (
      !businessNature ||
      (!businessNature.manufacturer?.isManufacturer &&
        !businessNature.trader?.isTrader)
    ) {
      return res.status(400).json({
        success: false,
        message: "Select Manufacturer and/or Trader",
      });
    }

    if (
      businessNature.manufacturer?.isManufacturer &&
      !businessNature.manufacturer.scale?.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Select Manufacturer scale (Large / MSME)",
      });
    }

    if (
      businessNature.trader?.isTrader &&
      !businessNature.trader.type?.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Select Trader type (Wholesale / Retail)",
      });
    }

    if (!majorCommodities || !majorCommodities.some((c) => c.trim())) {
      return res.status(400).json({
        success: false,
        message: "At least one major commodity is required",
      });
    }

    /* =========================
       FORMAT VALIDATIONS
    ========================= */

    let finalBusinessCategoryId = businessCategory;

    // If custom category provided
    if (!businessCategory && customBusinessCategory) {
      const name = customBusinessCategory.trim();

      let category = await Category.findOne({
        name: new RegExp(`^${name}$`, "i"),
      });

      if (!category) {
        category = await Category.create({
          name,
          isActive: true,
        });
      }

      finalBusinessCategoryId = category._id;
    }

    // ✅ VALIDATE AFTER resolving
    if (!finalBusinessCategoryId) {
      return res.status(400).json({
        success: false,
        message: "Business category is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(finalBusinessCategoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid business category",
      });
    }

    // if (!mongoose.Types.ObjectId.isValid(businessCategory)) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Invalid business category",
    //   });
    // }

    if (!mongoose.Types.ObjectId.isValid(finalBusinessCategoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid business category",
      });
    }

    if (gstNumber) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
      if (!gstRegex.test(gstNumber)) {
        return res.status(400).json({
          success: false,
          message: "Invalid GST number format",
        });
      }
    }

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
          message: "Invalid IFSC code",
        });
      }
    }

    /* =========================
       DUPLICATE USER CHECK
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
       MEMBERSHIP PLAN
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
      registrationSnapshot: {
        companyName,
        proprietors,
        address,
        mobileNumber,
        email,
        businessCategory: finalBusinessCategoryId,
        businessNature,
        majorCommodities,
        gstNumber,
        bankDetails,
        referral,
      },
      razorpay: { orderId: order.id },
      status: "CREATED",
    });

    return res.json({
      success: true,
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
    const signature = req.headers["x-razorpay-signature"];

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).send("Invalid signature");
    }

    const event = JSON.parse(req.body.toString());
    if (event.event !== "payment.captured") {
      return res.json({ received: true });
    }

    const paymentEntity = event.payload.payment.entity;

    const payment = await Payment.findOne({
      "razorpay.orderId": paymentEntity.order_id,
    });

    if (!payment || payment.status === "SUCCESS") {
      return res.json({ received: true });
    }

    const snapshot = payment.registrationSnapshot;
    const plan = await MembershipPlan.findById(payment.membershipPlan);

    if (
      !snapshot?.businessNature ||
      (!snapshot.businessNature.manufacturer?.isManufacturer &&
        !snapshot.businessNature.trader?.isTrader)
    ) {
      return res.status(400).json({ received: false });
    }

    /* =========================
       REFERRAL LOGIC
    ========================= */
    let referralData = {
      source: "ADMIN",
      referredByUser: null,
      referredByUserId: null,
    };

    const referredByUserId = snapshot?.referral?.referredByUserId;

    if (referredByUserId) {
      const refUser = await User.findOne({ userId: referredByUserId });

      if (!refUser) return res.json({ received: false });

      const referralCount = await User.countDocuments({
        "referral.referredByUser": refUser._id,
      });

      // if (referralCount >= MAX_REFERRALS_PER_USER) {
      //   return res.json({ received: false });
      // }

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
      businessNature: snapshot.businessNature,
      majorCommodities: snapshot.majorCommodities || [],
      gstNumber: snapshot.gstNumber,

      referral: referralData,
      bankDetails: snapshot.bankDetails,

      membership: {
        plan: plan._id,
        status: "ACTIVE",
        startedAt: new Date(),
        expiresAt: plan.durationInDays
          ? new Date(Date.now() + plan.durationInDays * 86400000)
          : null,
      },
    });

    payment.status = "SUCCESS";
    payment.user = newUser._id;
    payment.razorpay.paymentId = paymentEntity.id;
    payment.paidAt = new Date();
    await payment.save();

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

// const fetchPaymentRecords = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 15;
//     const skip = (page - 1) * limit;
//     const search = req.query.search?.trim();

//     /* =========================
//        SEARCH FILTER
//     ========================= */
//     let query = {};

//     if (search) {
//       query = {
//         $or: [
//           {
//             "registrationSnapshot.companyName": {
//               $regex: search,
//               $options: "i",
//             },
//           },
//           { "registrationSnapshot.email": { $regex: search, $options: "i" } },
//           { "razorpay.orderId": { $regex: search, $options: "i" } },
//           { "razorpay.paymentId": { $regex: search, $options: "i" } },
//         ],
//       };
//     }

//     /* =========================
//        FETCH PAYMENTS
//     ========================= */
//     // const [payments, totalPayments] = await Promise.all([
//     //   Payment.find(query)
//     //     .populate({
//     //       path: "user",
//     //       select: "userId companyName email mobileNumber",
//     //     })
//     //     .populate({
//     //       path: "membershipPlan",
//     //       select: "name amount durationInDays",
//     //     })
//     //     .sort({ createdAt: -1 })
//     //     .skip(skip)
//     //     .limit(limit)
//     //     .lean(),

//     //   Payment.countDocuments(query),
//     // ]);

//     const [payments, totalPayments, totalAmountResult] = await Promise.all([
//       Payment.find(query)
//         .populate({
//           path: "user",
//           select: "userId companyName email mobileNumber",
//         })
//         .populate({
//           path: "membershipPlan",
//           select: "name amount durationInDays",
//         })
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limit)
//         .lean(),

//       Payment.countDocuments(query),

//       Payment.aggregate([
//         { $match: query },
//         {
//           $group: {
//             _id: null,
//             totalAmount: { $sum: "$amount" },
//           },
//         },
//       ]),
//     ]);

//     const totalAmount = totalAmountResult[0]?.totalAmount || 0;

//     /* =========================
//        COLLECT REFERRER USER IDS
//     ========================= */
//     const referredUserIds = [
//       ...new Set(
//         payments
//           .map((p) => p.registrationSnapshot?.referral?.referredByUserId)
//           .filter(Boolean),
//       ),
//     ];

//     /* =========================
//        FETCH REFERRER USERS
//     ========================= */
//     const referrers = referredUserIds.length
//       ? await User.find(
//           { userId: { $in: referredUserIds } },
//           "userId companyName",
//         ).lean()
//       : [];

//     const referrerMap = referrers.reduce((acc, r) => {
//       acc[r.userId] = r;
//       return acc;
//     }, {});

//     /* =========================
//        FORMAT RESPONSE
//     ========================= */
//     const formattedPayments = payments.map((p) => {
//       const referralSnapshot = p.registrationSnapshot?.referral;
//       const referrer =
//         referralSnapshot?.referredByUserId &&
//         referrerMap[referralSnapshot.referredByUserId];

//       return {
//         _id: p._id,
//         status: p.status,
//         amount: p.amount,
//         paidAt: p.paidAt,
//         createdAt: p.createdAt,

//         adminPanelPayment: {
//           source: p.paymentSource || "ADMIN",
//           transactionId: p.transactionId || null,
//         },
//         companyName: p.registrationSnapshot?.companyName,
//         businessNature: p.registrationSnapshot?.businessNature || null,
//         email: p.registrationSnapshot?.email,
//         mobileNumber: p.registrationSnapshot?.mobileNumber,

//         membershipPlan: p.membershipPlan
//           ? {
//               _id: p.membershipPlan._id,
//               name: p.membershipPlan.name,
//               amount: p.membershipPlan.amount,
//               durationInDays: p.membershipPlan.durationInDays,
//             }
//           : null,

//         user: p.user
//           ? {
//               _id: p.user._id,
//               userId: p.user.userId,
//               companyName: p.user.companyName,
//               email: p.user.email,
//               mobileNumber: p.user.mobileNumber,
//             }
//           : null,

//         referral: {
//           source: referralSnapshot?.source || "ADMIN",
//           referredByUserId: referralSnapshot?.referredByUserId || null,
//           referredByCompanyName: referrer?.companyName || null,
//         },

//         // razorpay: {
//         //   orderId: p.razorpay?.orderId,
//         //   paymentId: p.razorpay?.paymentId,
//         // },

//         /* ================= RAZORPAY (ONLY IF EXISTS) ================= */
//         razorpay: p.razorpay?.orderId
//           ? {
//               orderId: p.razorpay.orderId,
//               paymentId: p.razorpay.paymentId,
//             }
//           : null,
//       };
//     });

//     return res.status(200).json({
//       success: true,
//       data: formattedPayments,
//       pagination: {
//         currentPage: page,
//         totalPages: Math.ceil(totalPayments / limit),
//         totalPayments,
//         limit,
//       },
//       totalAmount,
//     });
//   } catch (err) {
//     console.error("Fetch Payment Records Error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch payment records",
//     });
//   }
// };

// const fetchPaymentFilters = async (req, res) => {
//   try {
//     const payments = await Payment.find(
//       { status: "SUCCESS" },
//       { registrationSnapshot: 1, membershipPlan: 1 }
//     )
//       .populate("membershipPlan", "name")
//       .lean();

//     const categoriesSet = new Set();
//     const businessTypesSet = new Set();
//     const statesSet = new Set();
//     const districtsSet = new Set();
//     const taluksSet = new Set();
//     const membershipPlansMap = new Map();

//     payments.forEach((p) => {
//       const snap = p.registrationSnapshot;

//       if (snap?.businessCategory) categoriesSet.add(snap.businessCategory);

//       if (Array.isArray(snap?.businessType)) {
//         snap.businessType.forEach((t) => businessTypesSet.add(t));
//       }

//       if (snap?.address?.state) statesSet.add(snap.address.state);
//       if (snap?.address?.district) districtsSet.add(snap.address.district);
//       if (snap?.address?.taluk) taluksSet.add(snap.address.taluk);

//       if (p.membershipPlan) {
//         membershipPlansMap.set(
//           p.membershipPlan._id.toString(),
//           p.membershipPlan.name
//         );
//       }
//     });

//     return res.status(200).json({
//       success: true,
//       data: {
//         businessCategories: [...categoriesSet],
//         businessTypes: [...businessTypesSet],
//         states: [...statesSet],
//         districts: [...districtsSet],
//         taluks: [...taluksSet],
//         membershipPlans: Array.from(membershipPlansMap, ([id, name]) => ({
//           _id: id,
//           name,
//         })),
//       },
//     });
//   } catch (err) {
//     console.error("Fetch Payment Filters Error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch filter data",
//     });
//   }
// };

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
    const [payments, totalPayments, totalSuccessAmountResult] =
      await Promise.all([
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

        // Calculate total amount for SUCCESS payments only
        Payment.aggregate([
          { $match: { ...query, status: "SUCCESS" } },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
            },
          },
        ]),
      ]);

    const totalSuccessAmount = totalSuccessAmountResult[0]?.totalAmount || 0;

    /* =========================
       COLLECT REFERRER USER IDS
    ========================= */
    const referredUserIds = [
      ...new Set(
        payments
          .map((p) => p.registrationSnapshot?.referral?.referredByUserId)
          .filter(Boolean),
      ),
    ];

    /* =========================
       FETCH REFERRER USERS
    ========================= */
    const referrers = referredUserIds.length
      ? await User.find(
          { userId: { $in: referredUserIds } },
          "userId companyName",
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

        adminPanelPayment: {
          source: p.paymentSource || "ADMIN",
          transactionId: p.transactionId || null,
        },
        companyName: p.registrationSnapshot?.companyName,
        businessNature: p.registrationSnapshot?.businessNature || null,
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

        razorpay: p.razorpay?.orderId
          ? {
              orderId: p.razorpay.orderId,
              paymentId: p.razorpay.paymentId,
            }
          : null,
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
      totalSuccessAmount, // Renamed for clarity
    });
  } catch (err) {
    console.error("Fetch Payment Records Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment records",
    });
  }
};
const editPaymentRecord = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const { paymentSource, transactionId, amount, status } = req.body;

    /* =========================
       VALIDATE PAYMENT ID
    ========================= */
    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID",
      });
    }

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    /* =========================
       BLOCK RAZORPAY EDITS
    ========================= */
    if (payment.razorpay?.paymentId) {
      return res.status(403).json({
        success: false,
        message: "Razorpay payments cannot be edited",
      });
    }

    /* =========================
       UPDATE FIELDS
    ========================= */
    if (paymentSource) {
      payment.paymentSource = paymentSource;
      payment.registrationSnapshot.paymentSource = paymentSource;
    }

    if (transactionId !== undefined) {
      payment.transactionId = transactionId || null;
      payment.registrationSnapshot.transactionId = transactionId || null;
    }

    if (amount !== undefined) {
      payment.amount = Number(amount);
      payment.registrationSnapshot.amount = Number(amount);
    }

    if (status) {
      payment.status = status;

      if (status === "SUCCESS" && !payment.paidAt) {
        payment.paidAt = new Date();
      }

      if (status !== "SUCCESS") {
        payment.paidAt = null;
      }
    }

    await payment.save();

    return res.status(200).json({
      success: true,
      message: "Payment record updated successfully",
      data: {
        _id: payment._id,
        paymentSource: payment.paymentSource,
        transactionId: payment.transactionId,
        amount: payment.amount,
        status: payment.status,
        paidAt: payment.paidAt,
      },
    });
  } catch (err) {
    console.error("Edit Payment Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update payment record",
    });
  }
};

const viewIndPaymentRecord = async (req, res) => {
  try {
    const { id } = req.params;

    /* =========================
       VALIDATE ID
    ========================= */
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID",
      });
    }

    /* =========================
       FETCH PAYMENT
    ========================= */
    const payment = await Payment.findById(id)
      .populate({
        path: "user",
        select: "userId companyName email mobileNumber",
      })
      .populate({
        path: "membershipPlan",
        select: "name amount durationInDays",
      })
      .lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    /* =========================
       DETERMINE PAYMENT MODE
    ========================= */
    const isRazorpayPayment = !!payment.razorpay?.paymentId;

    /* =========================
       FORMAT RESPONSE (UI READY)
    ========================= */
    const response = {
      _id: payment._id,

      status: payment.status,
      amount: payment.amount,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      registrationSnapshot:payment.registrationSnapshot || null,

      /* =========================
         USER / COMPANY
      ========================= */
      user: payment.user
        ? {
            _id: payment.user._id,
            userId: payment.user.userId,
            companyName: payment.user.companyName,
            email: payment.user.email,
            mobileNumber: payment.user.mobileNumber,
          }
        : null,

      companyName:
        payment.registrationSnapshot?.companyName || payment.user?.companyName,

      /* =========================
         MEMBERSHIP PLAN
      ========================= */
      membershipPlan: payment.membershipPlan
        ? {
            _id: payment.membershipPlan._id,
            name: payment.membershipPlan.name,
            amount: payment.membershipPlan.amount,
            durationInDays: payment.membershipPlan.durationInDays,
          }
        : null,

      /* =========================
         PAYMENT INFO (ADMIN)
      ========================= */
      adminPanelPayment: !isRazorpayPayment
        ? {
            paymentSource: payment.paymentSource,
            transactionId: payment.transactionId,
          }
        : null,

      /* =========================
         RAZORPAY INFO
      ========================= */
      razorpay: isRazorpayPayment
        ? {
            orderId: payment.razorpay?.orderId,
            paymentId: payment.razorpay?.paymentId,
          }
        : null,

      /* =========================
         FORM CONTROL FLAGS
      ========================= */
      isEditable: !isRazorpayPayment,
      paymentType: isRazorpayPayment ? "RAZORPAY" : "ADMIN",
    };

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (err) {
    console.error("View Payment Record Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment record",
    });
  }
};

const getUserReferralDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    // 1️⃣ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    // 2️⃣ Fetch referrer info
    const referrer = await User.findById(userId).select(
      "userId companyName email",
    );

    if (!referrer) {
      return res.status(404).json({ message: "Referrer not found" });
    }

    // 3️⃣ Fetch referred users
    const referredUsers = await User.find({
      "referral.referredByUser": referrer._id,
    }).select("userId companyName email membership.status createdAt");

    const referredUserIds = referredUsers.map((u) => u._id);

    // 4️⃣ Fetch payments made by referred users
    const payments = await Payment.find({
      user: { $in: referredUserIds },
      status: "SUCCESS",
    }).select("user amount");

    // 5️⃣ Calculate total amount
    const totalReferralAmount = payments.reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0,
    );

    // 6️⃣ Map user-wise amount (optional but very useful)
    const amountByUser = {};
    payments.forEach((p) => {
      const key = p.user.toString();
      amountByUser[key] = (amountByUser[key] || 0) + (p.amount || 0);
    });

    // 7️⃣ Response
    res.status(200).json({
      referrer: {
        _id: referrer._id,
        userId: referrer.userId,
        companyName: referrer.companyName,
        email: referrer.email,
      },
      totalReferrals: referredUsers.length,
      // totalReferralAmount, // 💰 TOTAL AMOUNT GENERATED
      referredUsers: referredUsers.map((user) => ({
        _id: user._id,
        userId: user.userId,
        companyName: user.companyName,
        email: user.email,
        membershipStatus: user.membership?.status || "PENDING",
        joinedAt: user.createdAt,
        amountPaid: amountByUser[user._id.toString()] || 0, // 💰 PER USER
      })),
    });
  } catch (error) {
    console.error("Get User Referral Details Error:", error);
    res.status(500).json({ message: "Unable to fetch referral details" });
  }
};

module.exports = {
  getUserReferralDetails,
};

module.exports = {
  createOrder,
  razorpayWebhook,
  fetchPaymentRecords,
  editPaymentRecord,
  viewIndPaymentRecord,
  // fetchPaymentFilters,
  getUserReferralDetails,
};
