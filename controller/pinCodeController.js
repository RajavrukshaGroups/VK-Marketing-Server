const { search } = require("india-pincode-search");

const getPincodeDetails = async (req, res) => {
  try {
    const { pin } = req.params;

    const result = search(pin);

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Invalid PIN Code",
      });
    }

    console.log("result", result);

    const info = result[0];

    return res.json({
      success: true,
      data: {
        state: info.state,
        district: info.city,
        taluk: info.district,
        office: info.office,
      },
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch pincode details",
    });
  }
};

module.exports = {
  getPincodeDetails,
};
