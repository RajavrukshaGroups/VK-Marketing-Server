const razorpay = require("../config/razorpay");
const MayDayPayment = require("../Models/MayDayPayment");
const crypto = require("crypto");

const generateUniqueId = async () => {
  let unique;
  let exists = true;

  while (exists) {
    unique = Math.floor(100000 + Math.random() * 900000).toString();

    const existing = await MayDayPayment.findOne({ uniqueId: unique });
    if (!existing) exists = false;
  }

  return unique;
};

const createMayDayOrder = async (req, res) => {
  try {
    const { formData } = req.body;

    if (!formData || !formData.selectedPlans?.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid data",
      });
    }

    // 🔴 CHECK DUPLICATE MOBILE NUMBER
    const existingUser = await MayDayPayment.findOne({
      mobileNumber: formData.mobileNumber,
      status: "SUCCESS",
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "You are already registered.",
        uniqueId: existingUser.uniqueId,
      });
    }

    // ✅ Secure amount calculation
    const cleanPlans = formData.selectedPlans.map((p) => ({
      name: p.name,
      amount: Number(p.amount),
    }));

    const amount = cleanPlans.reduce((sum, p) => sum + p.amount, 0);

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `mayday_${Date.now()}`,
    });

    await MayDayPayment.create({
      companyName: formData.companyName,
      proprietors: formData.proprietors,
      mobileNumber: formData.mobileNumber,
      businessCategory: formData.businessCategory,
      selectedPlans: cleanPlans,
      formData,
      amount,
      razorpay: { orderId: order.id },
      status: "CREATED",
    });

    res.json({
      success: true,
      orderId: order.id,
      amount,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
    });
  }
};

const maydayWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body) // ✅ Buffer now
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).send("Invalid signature");
    }

    const event = JSON.parse(req.body.toString());

    if (event.event !== "payment.captured") {
      return res.json({ received: true });
    }

    const paymentEntity = event.payload.payment.entity;

    const payment = await MayDayPayment.findOne({
      "razorpay.orderId": paymentEntity.order_id,
    });

    if (!payment || payment.status === "SUCCESS") {
      return res.json({ received: true });
    }

    payment.status = "SUCCESS";
    payment.razorpay.paymentId = paymentEntity.id;
    payment.paidAt = new Date();

    // ✅ Generate unique ID only on success
    payment.uniqueId = await generateUniqueId();
    await payment.save();

    return res.json({ received: true });
  } catch (err) {
    console.error(err);
    return res.json({ received: true });
  }
};

const getMayDayPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 15;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";

    // 🔍 Search filter
    const searchQuery = search
      ? {
          $or: [
            { companyName: { $regex: search, $options: "i" } },
            { proprietors: { $regex: search, $options: "i" } },
            { mobileNumber: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [payments, total] = await Promise.all([
      MayDayPayment.find(searchQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      MayDayPayment.countDocuments(searchQuery),
    ]);

    res.json({
      success: true,
      data: payments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch MayDay payments",
    });
  }
};

const getMayDayByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log("order id", orderId);

    const payment = await MayDayPayment.findOne({
      "razorpay.orderId": orderId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    res.json({
      success: true,
      data: payment,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching payment",
    });
  }
};

module.exports = {
  createMayDayOrder,
  maydayWebhook,
  getMayDayPayments,
  getMayDayByOrderId,
};
