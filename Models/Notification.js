const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    /* =========================
       NOTIFICATION CONTENT
    ========================= */
    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["INFO", "WISH", "ALERT", "ANNOUNCEMENT"],
      default: "INFO",
    },

    /* =========================
       TARGETING LOGIC
    ========================= */
    targetType: {
      type: String,
      enum: ["ALL", "BUSINESS_CATEGORY", "SELECTED_COMPANIES"],
      required: true,
    },

    // Used when targetType === BUSINESS_CATEGORY
    businessCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BusinessCategory",
      },
    ],

    // 🔥 Used when targetType === SELECTED_COMPANIES
    targetUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
      },
    ],
    url: {
      type: String,
    },

    /* =========================
       DELIVERY META
    ========================= */
    isActive: {
      type: Boolean,
      default: true,
    },

    sentAt: {
      type: Date,
      default: Date.now,
    },

    createdBy: {
      type: String,
      default: "ADMIN",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", NotificationSchema);
