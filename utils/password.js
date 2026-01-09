const crypto = require("crypto");

exports.generatePassword = () => {
  return crypto.randomBytes(4).toString("hex"); // 8-char password
};
