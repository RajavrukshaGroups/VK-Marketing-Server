// Models/MayDayPayment.js
const mongoose = require("mongoose");

const mayDayPaymentSchema = new mongoose.Schema(
  {
    companyName: String,
    proprietors: String,
    mobileNumber: String,
    businessCategory: String,

    selectedPlans: [
      {
        name: String,
        amount: Number,
      },
    ],

    formData: Object,

    amount: Number,

    razorpay: {
      orderId: String,
      paymentId: String,
    },
    isLuckyDraw: {
      type: Boolean,
      default: false,
    },

    uniqueId: {
      type: String,
      unique: true,
    },

    status: {
      type: String,
      enum: ["CREATED", "SUCCESS", "FAILED"],
      default: "CREATED",
    },

    paidAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("MayDayPayment", mayDayPaymentSchema);
