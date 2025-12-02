// index.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const { dbConnect } = require("./config/config");
const userRoute = require("./routes/routes.js");

const app = express();
// const port = 3500;
const port = 7000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from ./public (if you have one)
app.use(express.static(path.join(__dirname, "public")));

dbConnect();

// Enable CORS for all routes (recommended)
app.use(
  cors({
    // origin: "http://localhost:5173",
    origin: "https://test.bouncyboxstudio.in",
    credentials: true,
  })
);

app.use("/", userRoute);

// Example route
app.get("/", (req, res) => {
  res.send("Hello from server");
});

// Start server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
