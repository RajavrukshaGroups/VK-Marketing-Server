const { google } = require("googleapis");
const Payment = require("../Models/Payment");
const BusinessCategory = require("../Models/Category");

const exportPaymentsToGoogleSheet = async (req, res) => {
  try {
    const payments = await Payment.find().populate("membershipPlan").lean();

    if (!payments.length) {
      return res.status(404).json({
        success: false,
        message: "No payments found",
      });
    }

    const formattedData = [];

    for (const p of payments) {
      const snapshot = p.registrationSnapshot || {};

      // Get Business Category Name
      let categoryName = "";
      if (snapshot.businessCategory) {
        const category = await BusinessCategory.findById(
          snapshot.businessCategory,
        ).lean();
        categoryName = category?.name || "";
      }

      const businessNature = [];
      if (snapshot.businessNature?.manufacturer?.isManufacturer)
        businessNature.push("Manufacturer");
      if (snapshot.businessNature?.trader?.isTrader)
        businessNature.push("Trader");

      formattedData.push([
        p._id.toString(),

        snapshot.companyName || "",
        snapshot.proprietors || "",
        snapshot.address?.street || "",
        snapshot.address?.pin || "",
        snapshot.address?.state || "",
        snapshot.address?.district || "",
        snapshot.address?.taluk || "",
        snapshot.mobileNumber || "",
        snapshot.email || "",

        categoryName,
        businessNature.join(", "),
        snapshot.businessNature?.manufacturer?.scale?.join(", ") || "",
        snapshot.businessNature?.trader?.type?.join(", ") || "",
        snapshot.majorCommodities?.join(", ") || "",
        snapshot.gstNumber || "",
        snapshot.bankDetails?.bankName || "",
        snapshot.bankDetails?.accountNumber || "",
        snapshot.bankDetails?.ifscCode || "",
        snapshot.referral?.source || "",

        p.membershipPlan?.name || "",
        p.membershipPlan?.amount || "",
        // p.membershipPlan?.durationInDays || "",
        // p.membershipPlan?.description || "",
        // p.membershipPlan?.benefits?.map((b) => b.title).join(", ") || "",

        p.amount || "",
        p.paymentSource || "",
        p.razorpay?.orderId || "",
        p.razorpay?.paymentId || "",
        p.status || "",
        p.createdAt ? new Date(p.createdAt).toLocaleString() : "",
        p.paidAt ? new Date(p.paidAt).toLocaleString() : "",
      ]);
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: "service_account",
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.SHEET_ID;

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: "Sheet1",
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Sheet1!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            "Payment ID",
            "Company Name",
            "Proprietors",
            "Street Address",
            "PIN Code",
            "State",
            "District",
            "Taluk",
            "Mobile Number",
            "Email",
            "Business Category",
            "Business Nature",
            "Manufacturer Scale",
            "Trader Type",
            "Major Commodities",
            "GST Number",
            "Bank Name",
            "Account Number",
            "IFSC Code",
            "Referral Source",
            "Membership Plan",
            "Plan Amount",
            // "Plan Duration (Days)",
            // "Plan Description",
            // "Plan Benefits",
            "Payment Amount",
            "Payment Source",
            "Razorpay Order ID",
            "Razorpay Payment ID",
            "Payment Status",
            "Created At",
            "Paid At",
          ],
          ...formattedData,
        ],
      },
    });

    return res.status(200).json({
      success: true,
      message: "Full payment data exported successfully",
    });
  } catch (error) {
    console.error("Export error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  exportPaymentsToGoogleSheet,
};
