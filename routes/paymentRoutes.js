const express = require("express");
const router = express.Router();
const PaymentController = require("../controller/paymentController");
const MayDayController = require("../controller/mayDayController");

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
// router.post(
//   "/razorpay-webhook",
//   express.raw({ type: "application/json" }),
//   PaymentController.razorpayWebhook,
// );
router.post("/razorpay-webhook", PaymentController.razorpayWebhook);
router.get("/get-payment-records", PaymentController.fetchPaymentRecords);
router.put(
  "/admin/payment/edit/:paymentId",
  PaymentController.editPaymentRecord,
);
router.get("/admin/view-payment/:id", PaymentController.viewIndPaymentRecord);
router.get("/referrals/:userId", PaymentController.getUserReferralDetails);
router.put(
  "/delete-payment-records/:paymentId",
  PaymentController.deleteIndPaymentRecords,
);
// router.get("/filters", PaymentController.fetchPaymentFilters);
router.post("/mayday/create-order", MayDayController.createMayDayOrder);
router.post("/mayday/webhook", MayDayController.maydayWebhook);
router.get("/mayday/list", MayDayController.getMayDayPayments);
module.exports = router;
