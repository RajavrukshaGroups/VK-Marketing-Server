require("dotenv").config();
const nodemailer = require("nodemailer");

const sendOtpMail = async (toEmail, otp) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false, // true only for port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"FTII Support" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Password Reset OTP",
    html: `
      <div style="font-family: Arial;">
        <h2>Password Reset OTP</h2>
        <p>Your OTP is:</p>
        <h1 style="letter-spacing: 4px;">${otp}</h1>
        <p>This OTP is valid for 10 minutes.</p>
      </div>
    `,
  });
};

module.exports = sendOtpMail;
