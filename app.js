const express = require("express");
require("dotenv").config();
const cors = require("cors");
const errorMiddleware = require("./ErrorHelpers/handleError.js");
const admin = require("./firebaseAdmin.js");
const MyError = require("./ErrorHelpers/MyError.js");

require("./gmailApi");

const whitelist = ["https://moreandhigh.com", "http://localhost:3000"];
const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new MyError(403, "Not authorized to access this domain."));
    }
  },
};

const controller = require("./Controllers");

const app = express();
app.use(express.json());
app.use(cors());

// routes available to all the IPs
app.get("/", (_req, res) => {
  res.send("OK");
});

app.route("/token/:id").get(controller.downloadExcelFile);

// routes that are not accessible to all the IPs.
// app.use(cors(corsOptions));

app.route("/login").post(controller.login);
app.route("/refresh-token").get(controller.refreshToken);
app
  .route("/device")
  .post(controller.validateToken, controller.sendMessageToDevice);

const userRoutes = require("./Routes/userRoute");
const adminRoutes = require("./Routes/adminRoute");
const paymentRoutes = require("./Routes/paymentRoute");
app.use("/user", userRoutes);
app.use("/admin", controller.validateToken, adminRoutes);
app.use("/payment", paymentRoutes);

app.get("/clear-database", controller.deleteImagesPast7Days);

app.use(errorMiddleware);

module.exports.admin = admin;
module.exports = app;
