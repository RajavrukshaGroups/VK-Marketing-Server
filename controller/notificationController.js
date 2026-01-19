const mongoose = require("mongoose");
const Notification = require("../Models/Notification");
const BusinessCategory = require("../Models/Category");
const User = require("../Models/Users");

const postNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      type,
      targetType,
      businessCategories,
      targetUsers,
    } = req.body;

    /* =========================
       BASIC VALIDATION
    ========================= */
    if (!title || !message || !targetType) {
      return res.status(400).json({
        success: false,
        message: "Title, message and targetType are required",
      });
    }

    if (
      !["ALL", "BUSINESS_CATEGORY", "SELECTED_COMPANIES"].includes(targetType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid target type",
      });
    }

    let categoryIds = [];
    let userIds = [];

    /* =========================
       BUSINESS CATEGORY TARGET
    ========================= */
    if (targetType === "BUSINESS_CATEGORY") {
      if (
        !Array.isArray(businessCategories) ||
        businessCategories.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Select at least one business category",
        });
      }

      for (const id of businessCategories) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid business category ID",
          });
        }
      }

      const validCategories = await BusinessCategory.find({
        _id: { $in: businessCategories },
      }).select("_id");

      if (validCategories.length !== businessCategories.length) {
        return res.status(400).json({
          success: false,
          message: "One or more business categories are invalid",
        });
      }

      categoryIds = businessCategories;
    }

    /* =========================
       SELECTED COMPANIES TARGET
    ========================= */
    if (targetType === "SELECTED_COMPANIES") {
      if (!Array.isArray(targetUsers) || targetUsers.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Select at least one company",
        });
      }

      for (const id of targetUsers) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid user ID in selected companies",
          });
        }
      }

      const validUsers = await User.find({
        _id: { $in: targetUsers },
        isActive: true,
      }).select("_id");

      if (validUsers.length !== targetUsers.length) {
        return res.status(400).json({
          success: false,
          message: "One or more selected companies are invalid or inactive",
        });
      }

      userIds = targetUsers;
    }

    /* =========================
       CREATE NOTIFICATION
    ========================= */
    const notification = await Notification.create({
      title,
      message,
      type: type || "INFO",
      targetType,
      businessCategories: targetType === "BUSINESS_CATEGORY" ? categoryIds : [],
      targetUsers: targetType === "SELECTED_COMPANIES" ? userIds : [],
      createdBy: "ADMIN",
    });

    return res.status(201).json({
      success: true,
      message: "Notification sent successfully",
      data: {
        _id: notification._id,
        targetType: notification.targetType,
        sentAt: notification.sentAt,
      },
    });
  } catch (err) {
    console.error("Post Notification Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to send notification",
    });
  }
};

const getBusinessCategories = async (req, res) => {
  try {
    const categories = await BusinessCategory.find({ isActive: true })
      .select("_id name")
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (err) {
    console.error("Get Categories Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch business categories",
    });
  }
};

const getCompanies = async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select("_id companyName userId businessCategory")
      .populate("businessCategory", "name")
      .sort({ companyName: 1 });

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (err) {
    console.error("Get Companies Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch companies",
    });
  }
};

const getCompaniesByCategory = async (req, res) => {
  try {
    const { categoryIds } = req.body;

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Category IDs are required",
      });
    }

    console.log("Received category IDs:", categoryIds);

    // Validate and convert to ObjectId
    const validCategoryIds = [];
    for (const id of categoryIds) {
      if (mongoose.Types.ObjectId.isValid(id)) {
        validCategoryIds.push(new mongoose.Types.ObjectId(id));
      } else {
        console.log(`Invalid ObjectId: ${id}`);
      }
    }

    if (validCategoryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid category IDs provided",
      });
    }

    console.log("Valid category IDs:", validCategoryIds);

    // First, let's check what categories actually exist
    const existingCategories = await BusinessCategory.find({
      _id: { $in: validCategoryIds },
      isActive: true,
    }).select("_id name");

    console.log("Found categories in DB:", existingCategories);

    if (existingCategories.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No active categories found with the provided IDs",
      });
    }

    const existingCategoryIds = existingCategories.map((cat) => cat._id);

    // Now find users with these categories
    const users = await User.find({
      businessCategory: { $in: existingCategoryIds },
      isActive: true,
    })
      .select("_id companyName userId businessCategory")
      .populate({
        path: "businessCategory",
        select: "name",
      })
      .lean();

    console.log(`Found ${users.length} users for categories:`);
    users.forEach((user) => {
      console.log(
        `${user.companyName} - Category: ${
          user.businessCategory?.name || "No category"
        }`
      );
    });

    return res.status(200).json({
      success: true,
      data: users,
      debug: {
        requestedCategories: categoryIds,
        validCategories: existingCategories.map((c) => ({
          id: c._id,
          name: c.name,
        })),
        userCount: users.length,
      },
    });
  } catch (err) {
    console.error("Get Companies By Category Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch companies",
    });
  }
};

module.exports = {
  postNotification,
  getBusinessCategories,
  getCompanies,
  getCompaniesByCategory,
};
