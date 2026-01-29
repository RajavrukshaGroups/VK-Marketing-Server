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
const dashBoardRoutes = require("./routes/dashboardRoutes.js");

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
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

dbConnect();

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
  }),
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
app.use("/admin/dashboard", dashBoardRoutes);

//memberpanel routes
app.use("/member/auth", memberAuthRoutes);

app.get("/", (req, res) => {
  res.send("Hello from bouncy box server");
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
