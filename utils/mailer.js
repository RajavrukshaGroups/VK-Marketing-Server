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

exports.sendWelcomeMail = async ({ email, companyName, password, userId }) => {
  await transporter.sendMail({
    from: `"FTII Karnataka" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Welcome to FTII – Membership Registered",
    html: `
      <h2>Welcome to FTII</h2>
      <p><strong>${companyName}</strong>, your membership has been registered successfully.</p>
      <p><b>Login Credentials:</b></p>
      <p><strong>User ID:</strong> ${userId}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p>Password: <strong>${password}</strong></p>
      <p>Please change your password after first login.</p>
    `,
  });
};
