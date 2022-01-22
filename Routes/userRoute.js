const express = require("express");
const controller = require("../Controllers/userController");
const mainController = require("../Controllers");
const router = express.Router();

router.route("/").get(mainController.validateToken, controller.getUserData);

router.route("/:id/images").get(controller.getUserImagesById);
router.route("/:id/locations").get(controller.getUserLocationsById);

router
  .route("/deviceUser")
  .post(mainController.validateToken, mainController.sendMessageToDevice);

module.exports = router;
