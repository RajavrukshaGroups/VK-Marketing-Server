const mongoose = require("mongoose");
const User = require("../Models/Users");
const { generatePassword } = require("../utils/password");
const { sendWelcomeMail } = require("../utils/mailer");
const { generateUserId } = require("../utils/generateUserId");
const { encrypt } = require("../utils/encryption");
const { decrypt } = require("../utils/encryption");
const Payment = require("../Models/Payment");
const MembershipPlan = require("../Models/MembershipPlan");
const MAX_REFERRALS_PER_USER = 4;

const createUser = async (req, res) => {
  try {
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
      bankName,
      accountNumber,
      ifscCode,
      referredByUserId,
    } = req.body;

    // if (
    //   !companyName ||
    //   !proprietors ||
    //   !address?.pin ||
    //   !address?.state ||
    //   !address?.district ||
    //   !mobileNumber ||
    //   !email ||
    //   !businessCategory ||
    //   !businessType?.length
    // ) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Required fields are missing",
    //   });
    // }

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

    if (!mobileNumber)
      return res
        .status(400)
        .json({ success: false, message: "Mobile number is required" });

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

    if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid IFSC code format",
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

    if (!mongoose.Types.ObjectId.isValid(businessCategory)) {
      return res.status(400).json({
        success: false,
        message: "Invalid business category",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { mobileNumber }],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email or Mobile Number is already registered",
      });
    }

    /* =========================
       USER ID + PASSWORD
    ========================= */
    const userId = await generateUserId();
    const plainPassword = generatePassword();
    const encryptedPassword = encrypt(plainPassword);

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
          message:
            "This referral link is invalid or expired. Please register normally.",
        });
      }

      /* =========================
     🔒 REFERRAL LIMIT CHECK
  ========================= */
      const referralCount = await User.countDocuments({
        "referral.referredByUser": refUser._id,
      });

      if (referralCount >= MAX_REFERRALS_PER_USER) {
        return res.status(403).json({
          success: false,
          message:
            "Referral limit reached. This member cannot refer more users.",
        });
      }

      referralData = {
        source: "USER",
        referredByUser: refUser._id,
        referredByUserId: refUser.userId,
      };
    }

    const newUser = await User.create({
      userId,
      companyName,
      proprietors,
      address,
      mobileNumber,
      email,
      password: encryptedPassword,
      businessCategory,
      businessType,
      majorCommodities: majorCommodities || [],
      gstNumber,
      referral: referralData,
      bankDetails:
        bankName || accountNumber || ifscCode
          ? {
              bankName,
              accountNumber,
              ifscCode,
            }
          : undefined,
    });

    /* =========================
       SEND WELCOME EMAIL
    ========================= */
    await sendWelcomeMail({
      email,
      companyName,
      password: plainPassword,
      userId,
    });

    return res.status(201).json({
      success: true,
      message: "Membership registered successfully",
      data: {
        userId: newUser.userId,
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

// const fetchAllUsers = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = 15;
//     const skip = (page - 1) * limit;
//     const search = req.query.search?.trim();

//     /* =========================
//        SEARCH QUERY
//     ========================= */
//     let query = {};

//     if (search) {
//       query = {
//         $or: [
//           { companyName: { $regex: search, $options: "i" } },
//           { email: { $regex: search, $options: "i" } },
//           { mobileNumber: { $regex: search, $options: "i" } },
//           { userId: { $regex: search, $options: "i" } },
//         ],
//       };
//     }

//     /* =========================
//        FETCH USERS WITH REFERRER POPULATION
//     ========================= */
//     const [users, totalUsers] = await Promise.all([
//       User.find(query)
//         .populate("businessCategory", "name")
//         .populate("membership.plan", "name amount")
//         .populate({
//           path: "referral.referredByUser",
//           select: "userId companyName email mobileNumber", // Add more fields if needed
//         })
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limit)
//         .lean(),

//       User.countDocuments(query),
//     ]);

//     /* =========================
//        DECRYPT PASSWORD
//     ========================= */
//     const formattedUsers = users.map((u) => ({
//       ...u,
//       password: decrypt(u.password),
//     }));

//     return res.status(200).json({
//       success: true,
//       data: formattedUsers,
//       pagination: {
//         currentPage: page,
//         totalPages: Math.ceil(totalUsers / limit),
//         totalUsers,
//         limit,
//       },
//     });
//   } catch (err) {
//     console.error("Fetch Users Error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch users",
//     });
//   }
// };

//filters
// const fetchAllUsers = async (req, res) => {
//   try {
//     const {
//       page = 1,
//       limit = 15,
//       search,
//       businessCategory,
//       businessType,
//       state,
//       district,
//       taluk,
//       membershipPlan,
//     } = req.query;

//     const skip = (page - 1) * limit;

//     /* =========================
//        BASE QUERY
//     ========================= */
//     const query = {};

//     /* =========================
//        SEARCH
//     ========================= */
//     if (search) {
//       query.$or = [
//         { companyName: { $regex: search, $options: "i" } },
//         { email: { $regex: search, $options: "i" } },
//         { mobileNumber: { $regex: search, $options: "i" } },
//         { userId: { $regex: search, $options: "i" } },
//       ];
//     }

//     /* =========================
//        FILTERS
//     ========================= */
//     if (businessCategory) {
//       query.businessCategory = businessCategory;
//     }

//     if (businessType) {
//       query.businessType = businessType; // works with array field
//     }

//     if (state) {
//       query["address.state"] = state;
//     }

//     if (district) {
//       query["address.district"] = district;
//     }

//     if (taluk) {
//       query["address.taluk"] = taluk;
//     }

//     if (membershipPlan) {
//       query["membership.plan"] = membershipPlan;
//     }

//     /* =========================
//        FETCH USERS
//     ========================= */
//     const [users, totalUsers] = await Promise.all([
//       User.find(query)
//         .populate("businessCategory", "name")
//         .populate("membership.plan", "name amount")
//         .populate({
//           path: "referral.referredByUser",
//           select: "userId companyName email mobileNumber",
//         })
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(Number(limit))
//         .lean(),

//       User.countDocuments(query),
//     ]);

//     /* =========================
//        FORMAT RESPONSE
//     ========================= */
//     const formattedUsers = users.map((u) => ({
//       ...u,
//       password: decrypt(u.password),
//     }));

//     return res.status(200).json({
//       success: true,
//       data: formattedUsers,
//       pagination: {
//         currentPage: Number(page),
//         totalPages: Math.ceil(totalUsers / limit),
//         totalUsers,
//         limit: Number(limit),
//       },
//     });
//   } catch (err) {
//     console.error("Fetch Users Error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch users",
//     });
//   }
// };

const fetchAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 15,
      search,
      businessCategory,
      businessType,
      state,
      district,
      taluk,
      membershipPlan,
    } = req.query;

    const skip = (page - 1) * limit;

    /* =========================
       BASE QUERY
    ========================= */
    const query = {};

    /* =========================
       SEARCH
    ========================= */
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobileNumber: { $regex: search, $options: "i" } },
        { userId: { $regex: search, $options: "i" } },
      ];
    }

    /* =========================
       FILTERS
    ========================= */
    // if (businessCategory) {
    //   query.businessCategory = businessCategory;
    // }
    if (businessCategory) {
      // Handle both single value and array
      if (Array.isArray(businessCategory)) {
        query.businessCategory = { $in: businessCategory };
      } else {
        query.businessCategory = businessCategory;
      }
    }

    if (businessType) {
      if (Array.isArray(businessType)) {
        query.businessType = { $in: businessType };
      } else {
        query.businessType = businessType;
      }
    }

    if (state) {
      if (Array.isArray(state)) {
        query["address.state"] = { $in: state };
      } else {
        query["address.state"] = state;
      }
    }

    if (district) {
      if (Array.isArray(district)) {
        query["address.district"] = { $in: district };
      } else {
        query["address.district"] = district;
      }
    }

     if (taluk) {
      if (Array.isArray(taluk)) {
        query["address.taluk"] = { $in: taluk };
      } else {
        query["address.taluk"] = taluk;
      }
    }

     if (membershipPlan) {
      if (Array.isArray(membershipPlan)) {
        query["membership.plan"] = { $in: membershipPlan };
      } else {
        query["membership.plan"] = membershipPlan;
      }
    }


   

    /* =========================
       FETCH USERS
    ========================= */
    const [users, totalUsers] = await Promise.all([
      User.find(query)
        .populate("businessCategory", "name")
        .populate("membership.plan", "name amount")
        .populate({
          path: "referral.referredByUser",
          select: "userId companyName email mobileNumber",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),

      User.countDocuments(query),
    ]);

    /* =========================
       FORMAT RESPONSE
    ========================= */
    const formattedUsers = users.map((u) => ({
      ...u,
      password: decrypt(u.password),
    }));

    return res.status(200).json({
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
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

const fetchUserFilters = async (req, res) => {
  try {
    const users = await User.find(
      {},
      {
        businessCategory: 1,
        businessType: 1,
        address: 1,
        "membership.plan": 1,
      }
    )
      .populate("businessCategory", "name")
      .populate("membership.plan", "name")
      .lean();

    const categoriesMap = new Map();
    const businessTypesSet = new Set();
    const statesSet = new Set();
    const districtsSet = new Set();
    const taluksSet = new Set();
    const membershipPlansMap = new Map();

    users.forEach((u) => {
      if (u.businessCategory) {
        categoriesMap.set(
          u.businessCategory._id.toString(),
          u.businessCategory.name
        );
      }

      if (Array.isArray(u.businessType)) {
        u.businessType.forEach((t) => businessTypesSet.add(t));
      }

      if (u.address?.state) statesSet.add(u.address.state);
      if (u.address?.district) districtsSet.add(u.address.district);
      if (u.address?.taluk) taluksSet.add(u.address.taluk);

      if (u.membership?.plan) {
        membershipPlansMap.set(
          u.membership.plan._id.toString(),
          u.membership.plan.name
        );
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        businessCategories: Array.from(categoriesMap, ([_id, name]) => ({
          _id,
          name,
        })),
        businessTypes: [...businessTypesSet],
        states: [...statesSet],
        districts: [...districtsSet],
        taluks: [...taluksSet],
        membershipPlans: Array.from(membershipPlansMap, ([_id, name]) => ({
          _id,
          name,
        })),
      },
    });
  } catch (err) {
    console.error("Fetch User Filters Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user filters",
    });
  }
};

// GET /users/referral/:userId
const fetchReferrerByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    // 🔒 strict validation (6-digit userId)
    if (!/^\d{6}$/.test(userId)) {
      return res.status(400).json({ success: false });
    }

    const user = await User.findOne({ userId })
      .select("userId companyName")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (err) {
    return res.status(500).json({ success: false });
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
      businessType,
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
       FORMAT VALIDATIONS
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

    if (membershipPlan && !mongoose.Types.ObjectId.isValid(membershipPlan)) {
      return res.status(400).json({
        success: false,
        message: "Invalid membership plan id",
      });
    }

    /* =========================
       APPLY UPDATES (SAFE)
    ========================= */
    if (companyName !== undefined) user.companyName = companyName;
    if (proprietors !== undefined) user.proprietors = proprietors;
    if (address !== undefined) user.address = address;
    if (mobileNumber !== undefined) user.mobileNumber = mobileNumber;
    if (email !== undefined) user.email = email;
    if (businessCategory !== undefined)
      user.businessCategory = businessCategory;
    if (businessType !== undefined) user.businessType = businessType;
    if (majorCommodities !== undefined)
      user.majorCommodities = majorCommodities;
    if (gstNumber !== undefined) user.gstNumber = gstNumber;
    if (bankDetails !== undefined) user.bankDetails = bankDetails;
    if (isActive !== undefined) user.isActive = isActive;

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
      user.membership.plan = membershipPlan;
      user.membership.startedAt = new Date();
      user.membership.expiresAt = null;

      await Payment.findOneAndUpdate(
        {
          user: user._id,
          status: "SUCCESS",
        },
        {
          membershipPlan: plan._id,
          amount: plan.amount,
        },
        {
          sort: { createdAt: -1 },
        }
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

const fetchUserById = async (req, res) => {
  try {
    const { id } = req.params;

    /* =========================
       VALIDATE OBJECT ID
    ========================= */
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    /* =========================
       FETCH USER
    ========================= */
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

    /* =========================
       RESPONSE (SAFE DATA)
    ========================= */
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

        businessType: user.businessType,
        majorCommodities: user.majorCommodities,

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

module.exports = {
  createUser,
  fetchAllUsers,
  fetchReferrerByUserId,
  editUsersDetails,
  fetchUserById,
  fetchUserFilters,
};
