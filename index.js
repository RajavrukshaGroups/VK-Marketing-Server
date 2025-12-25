require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { dbConnect } = require("./config/config");
const userRoute = require("./routes/routes.js");

const app = express();
const port = process.env.PORT;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

dbConnect();

// Allowed origins
const allowedOrigins = [
  "http://localhost:5173",
  // "https://api.bouncyboxstudio.in",
  "https://bouncyboxstudio.in",
];

// CORS Setup
app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like Postman or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use("/", userRoute);

app.get("/", (req, res) => {
  res.send("Hello from bouncy box server");
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
