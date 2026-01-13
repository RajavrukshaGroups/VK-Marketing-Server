const mongoose = require("mongoose");

const MembershipPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true, // STANDARD / PREMIUM / GOLD etc
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    durationInDays: {
      type: Number,
      default: null,
    },

    benefits: {
      type: [
        {
          title: {
            type: String,
            required: true,
            trim: true,
          },
        },
      ],
      default: [],
    },

    description: {
      type: String,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin", // optional
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MembershipPlan", MembershipPlanSchema);
