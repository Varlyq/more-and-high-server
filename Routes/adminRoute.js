const express = require("express");
const controller = require("../Controllers/adminController");

const router = express.Router();

router
  .route("/token")
  .get(controller.getTokenDetails)
  .post(controller.generateToken);

router.route("/token/aggr").get(controller.getTokenAggrDetails);
router.route("/token/users").get(controller.getUsersLockStatus);
router.route("/device").post(controller.sendMessageToDeviceViaAdmin);
router.post("/disableToken", controller.disableToken);

module.exports = router;
