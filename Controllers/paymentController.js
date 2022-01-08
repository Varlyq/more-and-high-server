const admin = require("../firebaseAdmin");
const MyError = require("../ErrorHelpers/MyError");
const uuid = require("uuid");
const Razorpay = require("razorpay");
var crypto = require("crypto-js");
const cryptoRandomString = require("crypto-random-string");
const { PAYMENT_TYPE } = require("../Helpers/contants");

// this will surely generate a new token no matter how many tries.
const generateToken = async (tokenType) => {
  const token = cryptoRandomString(10);
  let generatedToken;

  try {
    await admin.firestore().collection("tokens").doc(`${token}`).create({
      tokenId: token,
      registered: false,
      registeredAt: null,
      userId: null,
      type: tokenType,
      processing: true,
    });

    generatedToken = token;
  } catch (error) {
    generatedToken = await generateToken(tokenType);
  }

  return generatedToken;
};

exports.createOrder = async (req, res, next) => {
  const paymentType = req.query.type;

  try {
    if (!Object.values(PAYMENT_TYPE).includes(paymentType))
      throw new MyError(404, "Invalid.");

    const key_id = process.env.RAZORPAY_KEY_ID;

    const instance = new Razorpay({
      key_id,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    let amount;

    switch (paymentType) {
      case PAYMENT_TYPE.yearly:
        amount = 599;
        break;
      case PAYMENT_TYPE.five_yearly:
        amount = 999;
        break;
    }

    const order = await instance.orders.create({
      amount: amount * 100, // in paise.
      currency: "INR",
      receipt: uuid.v4(),
      payment_capture: true,
    });

    if (!order) throw new MyError(500, "Failed to make payment");

    order.key_id = key_id;

    res.status(200).json({
      success: true,
      order,
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, type } =
      req.body;

    if (!Object.values(PAYMENT_TYPE).includes(type))
      throw new MyError(404, "Invalid.");

    let tokenType;

    switch (type) {
      case PAYMENT_TYPE.yearly:
        tokenType = PAYMENT_TYPE.yearly;
        break;
      case PAYMENT_TYPE.five_yearly:
        tokenType = PAYMENT_TYPE.five_yearly;
        break;
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      throw new MyError(400, "Invalid request.");

    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    const generated_signature = crypto
      .HmacSHA256(`${razorpay_order_id}|${razorpay_payment_id}`, key_secret)
      .toString();

    let success = false;
    if (generated_signature === razorpay_signature) success = true;

    if (success === true) {
      // payment successful, generate a new token and assign it.

      const token = await generateToken(tokenType);

      // send it to other services via mail and phone.
    }

    res.status(200).json({
      success,
    });
  } catch (err) {
    next(err);
  }
};
