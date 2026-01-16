const express = require("express");
const router = express.Router();
const PaymentController = require("../controller/paymentController");

router.post("/create-order", PaymentController.createOrder);
// router.post(
//   "/razorpay-webhook",
//   express.json({
//     verify: (req, res, buf) => {
//       req.rawBody = buf;
//     },
//   }),
//   PaymentController.razorpayWebhook
// );
router.post(
  "/razorpay-webhook",
  express.raw({ type: "application/json" }),
  PaymentController.razorpayWebhook
);
router.get("/get-payment-records", PaymentController.fetchPaymentRecords);
// router.get("/filters", PaymentController.fetchPaymentFilters);

module.exports = router;
