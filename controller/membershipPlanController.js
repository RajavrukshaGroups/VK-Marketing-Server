const MembershipPlan = require("../Models/MembershipPlan");
const createMembershipPlan = async (req, res) => {
  try {
    const { name, amount, durationDays, benefits, description, isActive } =
      req.body;

    if (!name || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: "Name and amount are required",
      });
    }

    if (amount < 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than or equal to 0",
      });
    }

    /* =========================
       DUPLICATE CHECK
    ========================= */
    const existingPlan = await MembershipPlan.findOne({
      name: name.toUpperCase(),
    });
    if (existingPlan) {
      return res.status(409).json({
        success: false,
        message: "Membership plan already exists",
      });
    }

    const plan = new MembershipPlan({
      name,
      amount,
      durationInDays: durationDays ?? null,
      benefits: benefits || [],
      description,
      isActive: isActive ?? true,
      createdBy: req.user?._id,
    });
    await plan.save();
    return res.status(200).json({
      success: true,
      message: "Membership plan created successfully",
      data: plan,
    });
  } catch (err) {
    console.error("Create Membership Plan Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const viewMembershipPlan = async (req, res) => {
  try {
    const plans = await MembershipPlan.find({}).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      count: plans.length,
      data: plans,
    });
  } catch (err) {
    console.error("View Membership Plan Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const editMembershipPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, amount, durationDays, benefits, description, isActive } =
      req.body;

    /* =========================
       FIND PLAN
    ========================= */
    const plan = await MembershipPlan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Membership plan not found",
      });
    }

    /* =========================
       DUPLICATE NAME CHECK
    ========================= */
    if (name) {
      const existingPlan = await MembershipPlan.findOne({
        name: name.toUpperCase(),
        _id: { $ne: id },
      });

      if (existingPlan) {
        return res.status(409).json({
          success: false,
          message: "Another membership plan with this name already exists",
        });
      }

      plan.name = name;
    }

    /* =========================
       FIELD UPDATES
    ========================= */
    if (amount !== undefined) {
      if (amount < 0) {
        return res.status(400).json({
          success: false,
          message: "Amount must be greater than or equal to 0",
        });
      }
      plan.amount = amount;
    }

    if (durationDays !== undefined) {
      plan.durationInDays = durationDays ?? null;
    }

    if (Array.isArray(benefits)) {
      plan.benefits = benefits;
    }

    if (description !== undefined) {
      plan.description = description;
    }

    if (isActive !== undefined) {
      plan.isActive = isActive;
    }

    await plan.save();

    return res.status(200).json({
      success: true,
      message: "Membership plan updated successfully",
      data: plan,
    });
  } catch (err) {
    console.error("Edit Membership Plan Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getMembershipPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await MembershipPlan.findById(id).lean();

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Membership plan not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (err) {
    console.error("Get Membership Plan By ID Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateMembershipActiveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    /* =========================
       VALIDATION
    ========================= */
    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be boolean",
      });
    }

    /* =========================
       FIND & UPDATE
    ========================= */
    const plan = await MembershipPlan.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Membership plan not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Membership plan ${
        isActive ? "activated" : "deactivated"
      } successfully`,
      data: plan,
    });
  } catch (err) {
    console.error("Toggle Membership Status Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//membership plan controller logic to membership registration model
const showActiveMembershipPlanToMembers = async (req, res) => {
  try {
    const plans = await MembershipPlan.find({ isActive: true })
      .select("name amount durationInDays benefits description")
      .sort({ amount: 1 }) // optional: lowest price first
      .lean();

    return res.status(200).json({
      success: true,
      count: plans.length,
      data: plans,
    });
  } catch (err) {
    console.error("Show Active Membership Plans Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createMembershipPlan,
  viewMembershipPlan,
  editMembershipPlan,
  getMembershipPlanById,
  updateMembershipActiveStatus,
  showActiveMembershipPlanToMembers,
};
