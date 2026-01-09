const Category = require("../Models/Category");

const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Category name is required",
      });
    }

    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingCategory) {
      return res.status(409).json({
        message: "Category already exists",
      });
    }

    const category = new Category({ name, description });
    await category.save();

    return res.status(201).json({
      message: "Business category created successfully",
      data: category,
    });
  } catch (err) {
    console.error("Create category error:", err);
    return res.status(500).json({
      message: "Server error while creating category",
    });
  }
};

const fetchCategories = async (req, res) => {
  try {
    // pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    // 🔍 search filter (optional)
    const filter = search
      ? {
          name: { $regex: search, $options: "i" },
        }
      : {};

    // fetch categories
    const [categories, total] = await Promise.all([
      Category.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Category.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      data: categories,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords: total,
        limit,
      },
    });
  } catch (err) {
    console.error("Fetch categories error:", err);
    return res.status(500).json({
      message: "Server error while fetching categories",
    });
  }
};

const editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // 1️⃣ Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Category name is required",
      });
    }

    // 2️⃣ Check if category exists
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    // 3️⃣ Check duplicate name (exclude current category)
    const existingCategory = await Category.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingCategory) {
      return res.status(409).json({
        message: "Another category with this name already exists",
      });
    }

    // 4️⃣ Update fields
    category.name = name.trim();
    category.description = description?.trim() || "";

    // slug will auto-update because of pre("save")
    await category.save();

    return res.status(200).json({
      message: "Category updated successfully",
      data: category,
    });
  } catch (err) {
    console.error("Edit category error:", err);
    return res.status(500).json({
      message: "Server error while updating category",
    });
  }
};

const toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    category.isActive = !category.isActive;
    await category.save();

    return res.status(200).json({
      message: `Category ${
        category.isActive ? "activated" : "deactivated"
      } successfully`,
      data: category,
    });
  } catch (err) {
    console.error("Toggle category status error:", err);
    return res.status(500).json({
      message: "Server error while updating category status",
    });
  }
};

const getAllTheCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select("name slug description")
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (err) {
    console.error("error fetching categories:", err);
    return res.status(500).json({
      success: false,
      message: "failed to fetch categories",
    });
  }
};

module.exports = {
  createCategory,
  fetchCategories,
  editCategory,
  toggleCategoryStatus,
  getAllTheCategories,
};
