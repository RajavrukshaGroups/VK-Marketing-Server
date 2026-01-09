const Login = require("../Models/Login");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const loginDetails = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const admin = await Login.findOne({ email });

    if (!admin) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        message: "Account is disabled. Contact administrator.",
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        role: admin.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      message: "Server error during login",
    });
  }
};

/**
 * LOGOUT CONTROLLER
 * JWT-based logout (stateless)
 */
const logoutDetails = async (req, res) => {
  try {
    // If you later add token blacklisting, it will go here

    return res.status(200).json({
      message: "Logout successful",
    });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({
      message: "Server error during logout",
    });
  }
};

module.exports = {
  loginDetails,
  logoutDetails,
};
