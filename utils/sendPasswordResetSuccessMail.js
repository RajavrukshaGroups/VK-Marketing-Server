require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendPasswordResetSuccessMail = async (email, userId, companyName) => {
  await transporter.sendMail({
    // from: process.env.MAIL_FROM,
    // to: email,
    // subject: "Your Password Has Been Reset",
    // html: `
    // <p>Hello,</p>
    // <p>Your password has been reset successfully.</p>
    // `,
    from: `"FTII Karnataka" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Your Password Has Been Reset",
    html: `
      <p><strong>${companyName}</strong>, your password has been reset successfully.</p>
      <p><strong>User ID:</strong> ${userId}</p>
      <p><strong>Email:</strong> ${email}</p>
    `,
  });
};

module.exports = sendPasswordResetSuccessMail;
