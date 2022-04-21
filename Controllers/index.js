const admin = require("../firebaseAdmin");
const yup = require("yup");
const MyError = require("../ErrorHelpers/MyError");
const axios = require("axios");
const path = require("path");
const excelFolderPath = path.join(
  path.dirname(require.main.filename),
  "tokenFiles"
);
const fs = require("fs");
const jwt = require("jsonwebtoken");

const ADMIN_UID = "fh74347327w8fh23887h34";
const JWT_SIGN_KEY = fs
  .readFileSync(path.resolve(__dirname, "../RSA_KEY.key"))
  .toString();
const JWT_TOKEN_OPTIONS = {
  issuer: "https://moreandhigh.com",
  algorithm: "RS256",
  expiresIn: "12h",
};

const SERVER_KEY = "AAAA_ejvOpA:APA91bHQSlwDUncwUnVk_AhOUX0Cmzm4gd9mrkhgqJGrZmzvJ-WHEAsHzvRVIsormBQm3nSjZZPalLsQAwrzzfnfSqwrufEMeTBIGQZlmAbklRmWBlaFrcUYSD2PCUpqd-PANM4NvC9Z"

const loginSchema = yup.object({
  phone: yup
    .string()
    .required()
    .matches(/^[6789]\d{9}$/, "Not a valid Mobile Number")
    .label("Mobile Number"),
  password: yup.string().required().label("Password"),
});

exports.login = async (req, res, next) => {
  try {
    let data;
    try {
      data = await loginSchema.validate({
        phone: req.body.phone,
        password: req.body.password,
      });
    } catch (err) {
      throw new MyError(400, err.errors[0]);
    }

    // check if user is admin
    if (data.phone === "9479778872" && data.password === "9479778872") {
      const token = jwt.sign(
        { uid: ADMIN_UID },
        JWT_SIGN_KEY,
        JWT_TOKEN_OPTIONS
      );

      return res.status(200).json({
        success: true,
        role: "admin",
        name: "Admin User",
        token: token,
      });
    }

    const userDocs = await admin
      .firestore()
      .collection("Users")
      .where("phoneNumber", "==", data.phone)
      .get();

    if (userDocs.docs.length === 0) {
      throw new MyError(
        404,
        "There is no user registered with this mobile number."
      );
    }

    const truePassword = userDocs.docs[0].data().password;
    if (truePassword !== data.password) {
      throw new MyError(401, "Password you have entered is incorrect.");
    }

    const userUid = userDocs.docs[0].data().userId;
    const token = jwt.sign({ uid: userUid }, JWT_SIGN_KEY, JWT_TOKEN_OPTIONS);

    res.status(200).json({
      success: true,
      name: userDocs.docs[0].data().name,
      token: token,
    });
  } catch (err) {
    next(err);
  }
};

exports.validateToken = async (req, res, next) => {
  try {
    let token;
    try {
      token = req.headers.authorization.slice(
        7,
        req.headers.authorization.length
      );
    } catch (error) {
      throw new MyError(400, "Token not found or is in inappropriate format.");
    }

    try {
      const decoded = jwt.verify(token, JWT_SIGN_KEY, {
        algorithms: ["RS256"],
        issuer: "https://moreandhigh.com",
      });

      res.uid = decoded.uid;
    } catch (error) {
      throw new MyError(403, "The token is either invalid or expired!");
    }

    next();
  } catch (err) {
    next(err);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    let token;
    try {
      token = req.headers.authorization.slice(7);
    } catch (error) {
      throw new MyError(400, "Token not found or is in inappropriate format.");
    }

    let uid = null;

    try {
      const decoded = jwt.verify(token, JWT_SIGN_KEY, {
        algorithms: ["RS256"],
        issuer: "https://moreandhigh.com",
      });
      uid = decoded.uid;
    } catch (error) {
      if (error.name !== "TokenExpiredError") {
        throw new MyError(401, "The token is either invalid or expired!");
      }
    }

    if (uid === null) {
      const decoded = jwt.decode(token);
      uid = decoded.uid;
    }

    const newToken = jwt.sign({ uid }, JWT_SIGN_KEY, JWT_TOKEN_OPTIONS);

    res.status(200).json({
      success: true,
      token: newToken,
    });
  } catch (err) {
    next(err);
  }
};

exports.sendMessageToDevice = async (req, res, next) => {
  try {
    const task = req.body.task;
    if (task !== "lock" && task !== "unlock") {
      throw new MyError(400, "Invalid task for request!");
    }

    const userDocsRef = admin
      .firestore()
      .collection("Users")
      .where("userId", "==", res.uid);
    const userDocs = await userDocsRef.get();

    const deviceId = userDocs.docs[0].data().deviceId;

    const payload = {
      data: {
        task: task,
      },
      registration_ids: [`${deviceId}`],
    };

    const { data } = await axios.post(
      "https://fcm.googleapis.com/fcm/send",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${SERVER_KEY}`,
        },
      }
    );

    if (data?.success < 1) {
      throw new MyError(
        500,
        `Unable to ${task} phone. (User may have uninstalled the application...)`
      );
    }

    const docId = await userDocs.docs[0].id;

    const updatedDoc = await admin
      .firestore()
      .collection("Users")
      .doc(docId)
      .update({
        locked: task === "lock" ? true : false,
      });

    if (!updatedDoc) {
      throw new MyError(500, `Couldnt update ${task} status in database.`);
    }

    res.status(200).json({
      success: true,
    });
  } catch (err) {
    next(err);
  }
};

exports.downloadExcelFile = async (req, res, next) => {
  try {
    if (!req.params.id.match(/Tokens-\d+\.xlsx$/)) {
      throw new MyError(400, "Please enter a valid token file name.");
    }
    const filePath = path.join(excelFolderPath, req.params.id);

    if (fs.existsSync(filePath)) {
      res.status(200).sendFile(filePath);
    } else {
      throw new MyError(404, "File not found!");
    }
  } catch (err) {
    next(err);
  }
};

exports.deleteImagesPast7Days = async (req, res, next) => {
  try {
    const currDate = Date.now();
    const dateAWeekAgo = currDate - 604800000;
    const imagesDocs = await admin.firestore().collection("images").get();
    const imagesToDelete = [];

    imagesDocs.docs.forEach((data) => {
      const urls = data.data().urls;
      const docId = data.id;

      urls?.forEach((url) => {
        const date = Number(url.replace(/(\d+)(.+)/, "$1"));
        if (date < dateAWeekAgo) {
          imagesToDelete.push({ imageDate: date, docId });
        }
      });
    });

    const deleteFilePromises = [];
    imagesToDelete.forEach((image) => {
      const imageName = `${image.imageDate}.jpg`;
      deleteFilePromises.push(
        admin
          .storage()
          .bucket()
          .file(imageName)
          .delete({ ignoreNotFound: true })
          .then(() => ({ imageName, docId: image.docId }))
          .catch(() => null)
      );
    });

    const deleteResult = await Promise.all(deleteFilePromises);

    const updatePromises = [];
    deleteResult.forEach((item) => {
      const docRef = admin.firestore().collection("images").doc(item.docId);
      updatePromises.push(
        docRef.update({
          urls: admin.firestore.FieldValue.arrayRemove(item.imageName),
        })
      );
    });

    await Promise.all(updatePromises);

    res.json({
      success: true,
    });
  } catch (err) {
    next(err);
  }
};
