const User = require("../Models/Users");

const generateUserId = async () => {
  let userId;
  let exists = true;

  while (exists) {
    userId = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    exists = await User.exists({ userId });
  }

  return userId;
};

module.exports = { generateUserId };
