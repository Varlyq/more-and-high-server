const express = require("express");
const controller = require("../Controllers/paymentController");
const router = express.Router();

router.route("/create-order").get(controller.createOrder);
router.route("/verify").post(controller.verifyPayment);

module.exports = router;
