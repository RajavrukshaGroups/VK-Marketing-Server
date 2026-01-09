require("dotenv").config(); // 👈 MUST BE FIRST LINE

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, // smtp.gmail.com
  port: Number(process.env.SMTP_PORT), // 587
  secure: false, // true ONLY for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS.replace(/\s/g, ""), // remove spaces
  },
});

transporter.sendMail(
  {
    from: `"VK Marketing" <${process.env.SMTP_USER}>`,
    to: process.env.SMTP_USER,
    subject: "SMTP Test",
    text: "SMTP is working fine 🚀",
  },
  (err, info) => {
    if (err) {
      console.error("SMTP ERROR:", err);
    } else {
      console.log("EMAIL SENT:", info.response);
    }
  }
);
