const mongoose = require("mongoose");
const User = require("../Models/Users");
const Payment = require("../Models/Payment");
const MembershipPlan = require("../Models/MembershipPlan");

const { generatePassword } = require("../utils/password");
const { sendWelcomeMail } = require("../utils/mailer");
const { generateUserId } = require("../utils/generateUserId");
const { encrypt, decrypt } = require("../utils/encryption");

const MAX_REFERRALS_PER_USER = 4;

/* =========================================================
   CREATE USER (ADMIN / DIRECT REGISTRATION)
========================================================= */
const createUser = async (req, res) => {
  try {
    const {
      companyName,
      proprietors,
      address,
      mobileNumber,
      email,
      businessCategory,
      businessNature,
      majorCommodities,
      gstNumber,
      bankName,
      accountNumber,
      ifscCode,
      referredByUserId,

      membershipPlan,
      paymentSource,
      transactionId,
      amount,
    } = req.body;

    /* =========================
       BASIC VALIDATIONS
    ========================= */
    if (
      !companyName ||
      !proprietors ||
      !address?.pin ||
      !address?.state ||
      !address?.district
    )
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });

    if (!mobileNumber || !email || !businessCategory)
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });

    if (!membershipPlan || !amount)
      return res.status(400).json({
        success: false,
        message: "Membership & payment details required",
      });

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
        message: "Please select Manufacturer and/or Trader",
      });
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
        message: "Email or Mobile Number already registered",
      });
    }

    /* =========================
       MEMBERSHIP PLAN
    ========================= */
    const plan = await MembershipPlan.findById(membershipPlan);
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Invalid membership plan",
      });
    }

    /* =========================
       REFERRAL HANDLING (SAME AS WEBHOOK)
    ========================= */
    let referralData = {
      source: "ADMIN",
      referredByUser: null,
      referredByUserId: null,
    };

    if (referredByUserId) {
      const refUser = await User.findOne({ userId: referredByUserId });
      if (!refUser) {
        return res.status(400).json({
          success: false,
          message: "Invalid referral user",
        });
      }

      const referralCount = await User.countDocuments({
        "referral.referredByUser": refUser._id,
      });

      if (referralCount >= MAX_REFERRALS_PER_USER) {
        return res.status(403).json({
          success: false,
          message: "Referral limit exceeded",
        });
      }

      referralData = {
        source: "USER",
        referredByUser: refUser._id,
        referredByUserId: refUser.userId,
      };
    }

    const registrationSnapshot = {
      companyName,
      proprietors,
      address,
      mobileNumber,
      email,
      businessCategory,
      businessNature,
      majorCommodities,
      gstNumber,

      bankDetails:
        bankName || accountNumber || ifscCode
          ? { bankName, accountNumber, ifscCode }
          : undefined,

      referral: referredByUserId
        ? {
            source: "USER",
            referredByUserId,
          }
        : {
            source: "ADMIN",
            referredByUserId: null,
          },
    };

    /* =========================
       CREATE PAYMENT (ADMIN FLOW)
    ========================= */
    const payment = await Payment.create({
      membershipPlan: plan._id,
      amount,
      paymentSource: paymentSource || "ADMIN",
      transactionId: transactionId || null,
      registrationSnapshot,
      status: "SUCCESS",
      paidAt: new Date(),
    });

    /* =========================
       CREATE USER (EXACT LIKE WEBHOOK)
    ========================= */
    const userId = await generateUserId();
    const plainPassword = generatePassword();

    const newUser = await User.create({
      userId,
      companyName,
      proprietors,
      address,
      mobileNumber,
      email,
      password: encrypt(plainPassword),

      businessCategory,
      businessNature,
      majorCommodities: majorCommodities || [],
      gstNumber,

      referral: referralData,

      bankDetails:
        bankName || accountNumber || ifscCode
          ? { bankName, accountNumber, ifscCode }
          : undefined,

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
       LINK PAYMENT → USER
    ========================= */
    payment.user = newUser._id;
    await payment.save();

    /* =========================
       SEND EMAIL
    ========================= */
    await sendWelcomeMail({
      email,
      companyName,
      userId,
      password: plainPassword,
    });

    return res.status(201).json({
      success: true,
      message: "Member registered successfully",
      data: {
        userId: newUser.userId,
        paymentId: payment._id,
      },
    });
  } catch (err) {
    console.error("Create User Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* =========================================================
   FETCH USERS (SEARCH + FILTERS)
========================================================= */
const fetchAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 15, search } = req.query;

    // ✅ HANDLE BOTH key styles
    const businessCategory =
      req.query.businessCategory || req.query["businessCategory[]"];

    const membershipPlan =
      req.query.membershipPlan || req.query["membershipPlan[]"];

    const state = req.query.state || req.query["state[]"];
    const district = req.query.district || req.query["district[]"];
    const taluk = req.query.taluk || req.query["taluk[]"];
    const manufacturerScale =
      req.query.manufacturerScale || req.query["manufacturerScale[]"];
    const traderType = req.query.traderType || req.query["traderType[]"];

    const skip = (page - 1) * limit;
    const query = {};

    /* ================= SEARCH ================= */
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobileNumber: { $regex: search, $options: "i" } },
        { userId: { $regex: search, $options: "i" } },
      ];
    }

    /* ================= FILTERS ================= */

    if (businessCategory) {
      query.businessCategory = {
        $in: []
          .concat(businessCategory)
          .map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    if (membershipPlan) {
      query["membership.plan"] = {
        $in: []
          .concat(membershipPlan)
          .map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    if (state) {
      query["address.state"] = { $in: [].concat(state) };
    }

    if (district) {
      query["address.district"] = { $in: [].concat(district) };
    }

    if (taluk) {
      query["address.taluk"] = { $in: [].concat(taluk) };
    }

    if (manufacturerScale) {
      query["businessNature.manufacturer.isManufacturer"] = true;
      query["businessNature.manufacturer.scale"] = {
        $in: [].concat(manufacturerScale),
      };
    }

    if (traderType) {
      query["businessNature.trader.isTrader"] = true;
      query["businessNature.trader.type"] = {
        $in: [].concat(traderType),
      };
    }

    /* ================= FETCH ================= */
    const [users, totalUsers] = await Promise.all([
      User.find(query)
        .populate("businessCategory", "name")
        .populate("membership.plan", "name amount")
        .populate(
          "referral.referredByUser",
          "userId companyName mobileNumber email"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),

      User.countDocuments(query),
    ]);

    const formattedUsers = users.map((u) => ({
      ...u,
      password: decrypt(u.password),
    }));

    return res.json({
      success: true,
      data: formattedUsers,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        limit: Number(limit),
      },
    });
  } catch (err) {
    console.error("Fetch Users Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch users" });
  }
};

/* =========================================================
   FETCH FILTER OPTIONS
========================================================= */
const fetchUserFilters = async (req, res) => {
  try {
    const users = await User.find(
      {},
      {
        businessCategory: 1,
        businessNature: 1,
        address: 1,
        "membership.plan": 1,
      }
    )
      .populate("businessCategory", "name")
      .populate("membership.plan", "name")
      .lean();

    const categories = new Map();
    const states = new Set();
    const districts = new Set();
    const taluks = new Set();
    const plans = new Map();
    const manufacturerScales = new Set();
    const traderTypes = new Set();

    users.forEach((u) => {
      if (u.businessCategory)
        categories.set(
          u.businessCategory._id.toString(),
          u.businessCategory.name
        );

      if (u.address?.state) states.add(u.address.state);
      if (u.address?.district) districts.add(u.address.district);
      if (u.address?.taluk) taluks.add(u.address.taluk);

      if (u.membership?.plan)
        plans.set(u.membership.plan._id.toString(), u.membership.plan.name);

      u.businessNature?.manufacturer?.scale?.forEach((s) =>
        manufacturerScales.add(s)
      );
      u.businessNature?.trader?.type?.forEach((t) => traderTypes.add(t));
    });

    return res.json({
      success: true,
      data: {
        businessCategories: [...categories].map(([id, name]) => ({
          _id: id,
          name,
        })),
        states: [...states].sort(),
        districts: [...districts].sort(),
        taluks: [...taluks].sort(),
        membershipPlans: [...plans].map(([id, name]) => ({ _id: id, name })),
        manufacturerScales: [...manufacturerScales].sort(),
        traderTypes: [...traderTypes].sort(),
        // Remove businessTypes since it's now handled by businessNature
      },
    });
  } catch (err) {
    console.error("Fetch User Filters Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch filters" });
  }
};
// GET /users/referral/:userId
const fetchReferrerByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    // strict 6-digit validation
    if (!/^\d{6}$/.test(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid referral user id",
      });
    }

    const user = await User.findOne({ userId })
      .select("userId companyName")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Referrer not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    console.error("Fetch Referrer Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch referrer details",
    });
  }
};

const fetchUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const user = await User.findById(id)
      .populate("businessCategory", "name")
      .populate({
        path: "referral.referredByUser",
        select: "userId companyName",
      })
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        userId: user.userId,

        companyName: user.companyName,
        proprietors: user.proprietors,

        address: user.address,

        mobileNumber: user.mobileNumber,
        email: user.email,

        businessCategory: user.businessCategory?._id || "",
        businessCategoryName: user.businessCategory?.name || "",

        businessNature: user.businessNature,

        majorCommodities: user.majorCommodities || [],

        gstNumber: user.gstNumber || "",

        bankDetails: user.bankDetails || {
          bankName: "",
          accountNumber: "",
          ifscCode: "",
        },

        referral: user.referral,

        membership: user.membership,
        isActive: user.isActive,

        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("Fetch User By ID Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user details",
    });
  }
};

const editUsersDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const {
      companyName,
      proprietors,
      address,
      mobileNumber,
      email,
      businessCategory,
      businessNature,
      majorCommodities,
      gstNumber,
      bankDetails,
      isActive,
      membershipPlan,
    } = req.body;

    /* =========================
       DUPLICATE EMAIL / MOBILE
    ========================= */
    if (email || mobileNumber) {
      const duplicateUser = await User.findOne({
        _id: { $ne: id },
        $or: [
          email ? { email } : null,
          mobileNumber ? { mobileNumber } : null,
        ].filter(Boolean),
      });

      if (duplicateUser) {
        return res.status(409).json({
          success: false,
          message: "Email or mobile number already exists",
        });
      }
    }

    /* =========================
       VALIDATIONS
    ========================= */
    if (
      businessCategory &&
      !mongoose.Types.ObjectId.isValid(businessCategory)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid business category",
      });
    }

    if (businessNature) {
      if (
        !businessNature.manufacturer?.isManufacturer &&
        !businessNature.trader?.isTrader
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
          message: "Select Manufacturer type (Large / MSME)",
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
          message: "Invalid account number",
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
       APPLY UPDATES
    ========================= */
    if (companyName !== undefined) user.companyName = companyName;
    if (proprietors !== undefined) user.proprietors = proprietors;
    if (address !== undefined) user.address = address;
    if (mobileNumber !== undefined) user.mobileNumber = mobileNumber;
    if (email !== undefined) user.email = email;
    if (businessCategory !== undefined)
      user.businessCategory = businessCategory;
    if (businessNature !== undefined) user.businessNature = businessNature;
    if (majorCommodities !== undefined)
      user.majorCommodities = majorCommodities;
    if (gstNumber !== undefined) user.gstNumber = gstNumber;
    if (bankDetails !== undefined) user.bankDetails = bankDetails;
    if (isActive !== undefined) user.isActive = isActive;

    /* =========================
       MEMBERSHIP CHANGE
    ========================= */
    if (
      membershipPlan &&
      membershipPlan.toString() !== user.membership.plan.toString()
    ) {
      const plan = await MembershipPlan.findById(membershipPlan);
      if (!plan) {
        return res.status(400).json({
          success: false,
          message: "Membership plan not found",
        });
      }

      user.membership.plan = plan._id;
      user.membership.startedAt = new Date();
      user.membership.expiresAt = plan.durationInDays
        ? new Date(Date.now() + plan.durationInDays * 86400000)
        : null;

      await Payment.findOneAndUpdate(
        { user: user._id, status: "SUCCESS" },
        { membershipPlan: plan._id, amount: plan.amount },
        { sort: { createdAt: -1 } }
      );
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Member details updated successfully",
    });
  } catch (err) {
    console.error("Edit User Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update member details",
    });
  }
};

module.exports = {
  createUser,
  fetchAllUsers,
  fetchUserFilters,
  fetchReferrerByUserId,
  fetchUserById,
  editUsersDetails,
};
