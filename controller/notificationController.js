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
      url,
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
      url,
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

const getAllNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({})
      .populate({
        path: "targetUsers",
        select: "_id companyName userId",
      })
      .populate({
        path: "businessCategories",
        select: "_id name",
      })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = notifications.map((n) => ({
      _id: n._id,
      title: n.title,
      message: n.message,
      type: n.type,
      targetType: n.targetType,
      url: n.url,
      sentAt: n.sentAt,

      // BUSINESS CATEGORY TARGET
      businessCategories:
        n.targetType === "BUSINESS_CATEGORY"
          ? n.businessCategories.map((c) => ({
              id: c._id,
              name: c.name,
            }))
          : [],

      // SELECTED COMPANIES TARGET
      companies:
        n.targetType === "SELECTED_COMPANIES"
          ? n.targetUsers.map((u) => ({
              id: u._id,
              companyName: u.companyName,
              userId: u.userId,
            }))
          : [],

      createdBy: n.createdBy,
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (err) {
    console.error("Get Notifications Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

const deleteIndividualNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    /* =========================
       VALIDATE NOTIFICATION ID
    ========================= */
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    /* =========================
       HARD DELETE
    ========================= */
    const deletedNotification = await Notification.findByIdAndDelete(
      notificationId
    );

    if (!deletedNotification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification permanently deleted",
      data: {
        _id: deletedNotification._id,
      },
    });
  } catch (err) {
    console.error("Hard Delete Notification Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete notification",
    });
  }
};

const toggleNotificationStatus = async (req, res) => {
  try {
    const { notificationId } = req.params;

    /* =========================
       VALIDATE ID
    ========================= */
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    /* =========================
       FIND NOTIFICATION
    ========================= */
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    /* =========================
       TOGGLE STATUS
    ========================= */
    notification.isActive = !notification.isActive;
    await notification.save();

    return res.status(200).json({
      success: true,
      message: `Notification ${
        notification.isActive ? "activated" : "deactivated"
      } successfully`,
      data: {
        _id: notification._id,
        isActive: notification.isActive,
      },
    });
  } catch (err) {
    console.error("Toggle Notification Status Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update notification status",
    });
  }
};

module.exports = {
  postNotification,
  getBusinessCategories,
  getCompanies,
  getCompaniesByCategory,
  getAllNotifications,
  deleteIndividualNotification,
  toggleNotificationStatus,
};
