const mongoose = require("mongoose");

const UsersSchema = new mongoose.Schema(
  {
    /* =========================
       UNIQUE USER ID
    ========================= */
    userId: {
      type: String, // 6-digit string
      required: true,
      unique: true,
      index: true,
    },

    /* =========================
       COMPANY DETAILS
    ========================= */
    companyName: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    proprietors: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    /* =========================
       ADDRESS DETAILS
    ========================= */
    address: {
      street: { type: String, trim: true, uppercase: true },
      pin: { type: String, required: true, length: 6 },
      state: { type: String, required: true, uppercase: true },
      district: { type: String, required: true, uppercase: true },
      taluk: { type: String, uppercase: true },
    },

    /* =========================
       CONTACT DETAILS
    ========================= */
    mobileNumber: { type: String, required: true, length: 10 },
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },

    /* =========================
       BUSINESS DETAILS
    ========================= */
    businessCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessCategory",
      required: true,
    },

    businessType: {
      type: [String],
      enum: ["WHOLESALE", "RETAIL"],
      required: true,
    },

    /* 🔥 Referral System */
    referral: {
      source: {
        type: String,
        enum: ["ADMIN", "USER"],
        default: "ADMIN",
      },
      referredByUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
        default: null,
      },
      referredByUserId: {
        type: String,
        default: null,
      },
    },
    /* =========================
   BANK DETAILS
========================= */
    bankDetails: {
      bankName: {
        type: String,
        trim: true,
        uppercase: true,
      },
      accountNumber: {
        type: String,
        trim: true,
      },
      ifscCode: {
        type: String,
        trim: true,
        uppercase: true,
      },
    },
    majorCommodities: {
      type: [String],
      uppercase: true,
      default: [],
    },

    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: 15,
      maxlength: 15,
    },

    /* =========================
       MEMBERSHIP DETAILS
    ========================= */
    membershipFee: { type: Number, default: 3000 },
    membershipStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Users", UsersSchema);
