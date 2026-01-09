const mongoose = require("mongoose");
const User = require("../Models/Users");
const { generatePassword } = require("../utils/password");
const { sendWelcomeMail } = require("../utils/mailer");
const { generateUserId } = require("../utils/generateUserId");
const { encrypt } = require("../utils/encryption");
const { decrypt } = require("../utils/encryption");
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
//        FETCH USERS
//     ========================= */
//     const [users, totalUsers] = await Promise.all([
//       User.find(query)
//         .populate("businessCategory", "name")
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

const fetchAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 15;
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim();

    /* =========================
       SEARCH QUERY
    ========================= */
    let query = {};

    if (search) {
      query = {
        $or: [
          { companyName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { mobileNumber: { $regex: search, $options: "i" } },
          { userId: { $regex: search, $options: "i" } },
        ],
      };
    }

    /* =========================
       FETCH USERS WITH REFERRER POPULATION
    ========================= */
    const [users, totalUsers] = await Promise.all([
      User.find(query)
        .populate("businessCategory", "name")
        .populate({
          path: "referral.referredByUser",
          select: "userId companyName email mobileNumber", // Add more fields if needed
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      User.countDocuments(query),
    ]);

    /* =========================
       DECRYPT PASSWORD
    ========================= */
    const formattedUsers = users.map((u) => ({
      ...u,
      password: decrypt(u.password),
    }));

    return res.status(200).json({
      success: true,
      data: formattedUsers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        limit,
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

module.exports = { createUser, fetchAllUsers, fetchReferrerByUserId };
