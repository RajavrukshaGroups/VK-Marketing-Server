const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },

    membershipPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MembershipPlan",
      required: true,
    },

    amount: Number,

    paymentSource: {
      type: String,
      enum: ["RAZORPAY", "UPI", "NEFT", "IMPS", "CASH", "CHEQUE", "ADMIN"],
      required: true,
      default: "ADMIN",
    },
    transactionId: {
      type: String,
      trim: true,
      index: true,
    },

    registrationSnapshot: {
      type: Object, // 🔥 STORE FORM DATA HERE
      required: true,
    },

    razorpay: {
      orderId: { type: String },
      paymentId: String,
      signature: String,
    },

    status: {
      type: String,
      enum: ["CREATED", "SUCCESS", "FAILED"],
      default: "CREATED",
    },

    paidAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema);
