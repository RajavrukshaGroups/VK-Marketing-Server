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
  const loginUrl = "https://aitif.in/member/login";

  await transporter.sendMail({
    from: `"AITIF Karnataka" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Welcome to AITIF – Membership Registered Successfully",
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
        <h2 style="color:#1e3a8a;">Welcome to AITIF</h2>

        <p>
          <strong>${companyName}</strong>, your membership with
          <strong>All India Trade and Industries Forum (AITIF)</strong>
          has been registered successfully.
        </p>

        <h3>Login Credentials</h3>
        <p><strong>User ID:</strong> ${userId}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${password}</p>

        <p style="margin:20px 0;">
          <a href="${loginUrl}"
             style="
               background:#1e3a8a;
               color:#ffffff;
               padding:12px 20px;
               text-decoration:none;
               border-radius:6px;
               font-weight:bold;
               display:inline-block;
             ">
            Login to Your Account
          </a>
        </p>

        <p>
          Or copy and paste this link in your browser:<br/>
          <a href="${loginUrl}">${loginUrl}</a>
        </p>
        <p>
          Regards,<br/>
          <strong>AITIF Team</strong>
        </p>
      </div>
    `,
  });
};

