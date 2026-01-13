const express = require("express");
const router = express.Router();
const PaymentController = require("../controller/paymentController");

router.post("/create-order", PaymentController.createOrder);
router.post(
  "/razorpay-webhook",
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
  PaymentController.razorpayWebhook
);

module.exports = router;
