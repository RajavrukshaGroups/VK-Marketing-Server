require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { dbConnect } = require("./config/config");
const userRoute = require("./routes/userRoutes.js");
const adminLoginRoute = require("./routes/loginRoutes.js");
const adminCategoryRoute = require("./routes/categoryRoutes.js");
const membershipPlansRoutes = require("./routes/membershipPlansRoutes.js");
const paymentRoutes = require("./routes/paymentRoutes.js");
const notificationRoutes = require("./routes/notificationRoutes.js");

//memberpanel routes
const memberAuthRoutes = require("./routes/MemberPanelRoutes/meberPanelLoginRoutes.js");

const app = express();
const port = process.env.PORT;

// Middleware
// app.use(express.json());

app.use((req, res, next) => {
  if (req.originalUrl === "/admin/payment/razorpay-webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

dbConnect();

// Allowed origins
// const allowedOrigins = [
//   "http://localhost:5173",
//   // "https://api.bouncyboxstudio.in",
//   "https://bouncyboxstudio.in",
// ];

// // CORS Setup
// app.use(
//   cors({
//     origin: function (origin, callback) {
//       // allow requests with no origin (like Postman or curl)
//       if (!origin) return callback(null, true);
//       if (allowedOrigins.indexOf(origin) === -1) {
//         const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
//         return callback(new Error(msg), false);
//       }
//       return callback(null, true);
//     },
//     credentials: true,
//   })
// );

app.use(
  cors({
    origin: [
      // "https://admin-panel.rajavrukshagroup.in",
      "http://localhost:5173",
      "http://localhost:3000",
      // "https://rrplserver.rajavrukshagroup.in",
      // "http://localhost:5173",
    ],
    credentials: true,
  })
);

// app.post("/_test-webhook", (req, res) => {
//   console.log("🔥 TEST WEBHOOK HIT");
//   res.send("OK");
// });

app.use("/users", userRoute);
app.use("/admin", adminLoginRoute);
app.use("/admin/category", adminCategoryRoute);
app.use("/admin/businessplans", membershipPlansRoutes);
app.use("/admin/payment", paymentRoutes);
app.use("/admin/notification", notificationRoutes);

//memberpanel routes
app.use("/member/auth", memberAuthRoutes);

app.get("/", (req, res) => {
  res.send("Hello from bouncy box server");
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
