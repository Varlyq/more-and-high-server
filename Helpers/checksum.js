const PaytmChecksum = require("paytmchecksum");

exports.createChecksum = async (bodyData) => {
  try {
    const checksum = await PaytmChecksum.generateSignature(
      JSON.stringify(bodyData),
      process.env.PAYTM_KEY
    );

    return checksum;
  } catch (err) {
    return null;
  }
};

exports.validateChecksum = (paytmParams, paytmChecksum) => {
  var isVerifySignature = PaytmChecksum.verifySignature(
    paytmParams,
    process.env.PAYTM_KEY,
    paytmChecksum
  );
  if (isVerifySignature) {
    console.log("Checksum Matched");
    return true;
  } else {
    console.log("Checksum Mismatched");
    return false;
  }
};
