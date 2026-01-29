const User = require("../Models/Users");
const Payment = require("../Models/Payment");

const fetchDetails = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    /* =========================
       USERS
    ========================= */
    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      approvedMembers,
      pendingMembers,
      rejectedMembers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      User.countDocuments({ "membership.status": "ACTIVE" }),
      User.countDocuments({ "membership.status": "PENDING" }),
      User.countDocuments({ "membership.status": "CANCELLED" }),
    ]);

    /* =========================
       BUSINESS NATURE
    ========================= */
    const manufacturers = await User.countDocuments({
      "businessNature.manufacturer.isManufacturer": true,
    });

    const traders = await User.countDocuments({
      "businessNature.trader.isTrader": true,
    });

    const statesCovered = await User.distinct("address.state").then(
      (states) => states.length,
    );

    /* =========================
       PAYMENTS
    ========================= */
    const paymentStats = await Payment.aggregate([
      {
        $group: {
          _id: "$status",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    let totalAmountReceived = 0;
    let totalSuccessfulPayments = 0;
    let pendingPayments = 0;

    paymentStats.forEach((p) => {
      if (p._id === "SUCCESS") {
        totalAmountReceived = p.totalAmount;
        totalSuccessfulPayments = p.count;
      }
      if (p._id === "CREATED") {
        pendingPayments = p.count;
      }
    });

    const averagePayment =
      totalSuccessfulPayments > 0
        ? Math.round(totalAmountReceived / totalSuccessfulPayments)
        : 0;

    const monthlyRevenueAgg = await Payment.aggregate([
      {
        $match: {
          status: "SUCCESS",
          paidAt: { $gte: monthStart },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const monthlyRevenue = monthlyRevenueAgg[0]?.total || 0;

    const paymentSuccessRate =
      totalSuccessfulPayments + pendingPayments > 0
        ? Math.round(
            (totalSuccessfulPayments /
              (totalSuccessfulPayments + pendingPayments)) *
              100,
          )
        : 0;

    /* =========================
       RESPONSE
    ========================= */
    return res.status(200).json({
      success: true,
      data: {
        // Users
        totalUsers,
        activeUsers,
        newUsersToday,

        // Membership
        approvedMembers,
        pendingMembers,
        rejectedMembers,

        // Business
        manufacturers,
        traders,
        statesCovered,

        // Payments
        totalAmountReceived,
        totalSuccessfulPayments,
        pendingPayments,
        averagePayment,
        monthlyRevenue,
        paymentSuccessRate,
      },
    });
  } catch (err) {
    console.error("Dashboard Fetch Details Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard details",
    });
  }
};

module.exports = {
  fetchDetails,
};
