const admin = require("../firebaseAdmin");
const MyError = require("../ErrorHelpers/MyError");
const axios = require("axios");
const cryptoRandomString = require("crypto-random-string");
const generateExcelFromArray = require("../Helpers/generateExcel");
const { PAYMENT_TYPE } = require("../Helpers/contants");

const SERVER_KEY = "AAAA_ejvOpA:APA91bHQSlwDUncwUnVk_AhOUX0Cmzm4gd9mrkhgqJGrZmzvJ-WHEAsHzvRVIsormBQm3nSjZZPalLsQAwrzzfnfSqwrufEMeTBIGQZlmAbklRmWBlaFrcUYSD2PCUpqd-PANM4NvC9Z"

exports.generateToken = async (req, res, next) => {
  try {
    const firestore = admin.firestore();

    const numTokens = req.body.numberOfTokens;
    if (!numTokens) {
      throw new MyError(
        400,
        "Please mention the number of tokens that you want to generate."
      );
    }

    const batchWrites = [];
    let failedWrites = 0;
    let successWrites = 0;
    for (let i = 0; i < numTokens; i++) {
      const token = cryptoRandomString(10);
      batchWrites.push(
        firestore
          .collection("tokens")
          .doc(`${token}`)
          .create({
            tokenId: token,
            registered: false,
            registeredAt: null,
            userId: null,
            type: req.body.type,
          })
          .then((res) => {
            ++successWrites;
            return token;
          })
          .catch((err) => {
            failedWrites++;
          })
      );
    }

    const createdTokens = await Promise.all(batchWrites);

    const tokenAgg = await firestore
      .collection("Aggregations")
      .doc("token")
      .get();
    let { total } = tokenAgg.data();

    const updateTokenAgg = await admin
      .firestore()
      .collection("Aggregations")
      .doc("token")
      .update({
        total: total + successWrites,
      });

    if (!updateTokenAgg) {
      throw new MyError(500, `Couldnt update aggregation status in database!`);
    }

    const type =
      req.body.type === PAYMENT_TYPE.yearly ? "Yearly" : "Five-Yearly";

    const fileName = await generateExcelFromArray(createdTokens, type);

    const fileUrl =
      process.env.NODE_ENV === "production"
        ? `https://more-and-high.herokuapp.com/token/${fileName}`
        : `http://localhost:8000/token/${fileName}`;

    res.status(200).json({
      success: true,
      fileUrl,
    });
  } catch (err) {
    next(err);
  }
};

exports.getTokenDetails = async (req, res, next) => {
  try {
    const startAfter = req.query.startAfter || null;
    const limit = req.query.limit * 1 || 50;
    let filter = "all";
    let phoneNumber = req.query.phoneNumber;
    const type = req.query.type;

    if (
      req.query.filter &&
      ["all", "activated", "deactivated", "disabled"].indexOf(
        req.query.filter
      ) !== -1
    ) {
      filter = req.query.filter;
    }
    // filter values possible : all, activated, deactivated, disabled

    if (phoneNumber && phoneNumber.length === 10) {
      const user = await admin
        .firestore()
        .collection("Users")
        .where("phoneNumber", "==", phoneNumber)
        .get();

      if (user.docs.length === 0) {
        return res.status(200).json({
          success: true,
          tokens: [],
        });
      }
      const userDetails = user.docs[0].data();

      let tokenRef = null;
      if (filter === "all") {
        tokenRef = await admin
          .firestore()
          .collection("tokens")
          .where("userId", "==", userDetails.userId)
          .get();
      } else if (filter === "disabled") {
        tokenRef = await admin
          .firestore()
          .collection("tokens")
          .where("userId", "==", userDetails.userId)
          .where("disabled", "==", true)
          .get();
      } else {
        tokenRef = await admin
          .firestore()
          .collection("tokens")
          .where("registered", "==", filter === "activated" ? true : false)
          .where("userId", "==", userDetails.userId)
          .get();
      }

      const tokenDetails = tokenRef.docs[0]?.data();
      if (tokenDetails) {
        const data = {
          ...tokenDetails,
          name: userDetails.name,
          phoneNumber: userDetails.phoneNumber,
        };
        delete data.userId;

        return res.status(200).json({
          success: true,
          tokens: [data],
        });
      }
      return res.status(200).json({
        success: true,
        tokens: [],
      });
    }

    let tokensRef = admin.firestore().collection("tokens").orderBy("tokenId");

    switch (type) {
      case PAYMENT_TYPE.yearly:
        tokensRef = tokensRef.where("type", "==", PAYMENT_TYPE.yearly);
        break;

      case PAYMENT_TYPE.five_yearly:
        tokensRef = tokensRef.where("type", "==", PAYMENT_TYPE.five_yearly);
        break;

      default:
        break;
    }

    switch (filter) {
      case "all":
        tokensRef = await tokensRef.startAfter(startAfter).limit(limit).get();
        break;

      case "disabled":
        tokensRef = await tokensRef
          .where("disabled", "==", true)
          .startAfter(startAfter)
          .limit(limit)
          .get();
        break;

      case "activated":
        tokensRef = await tokensRef
          .where("registered", "==", true)
          .startAfter(startAfter)
          .limit(limit)
          .get();
        break;

      case "deactivated":
        tokensRef = await tokensRef
          .where("registered", "==", false)
          .startAfter(startAfter)
          .limit(limit)
          .get();
        break;

      default:
        break;
    }

    const userCollection = admin.firestore().collection("Users");
    const usersPromises = [];

    const tokens = tokensRef.docs.map((doc) => {
      const data = doc.data();
      if (data.registered) {
        const userPromise = userCollection
          .where("userId", "==", data.userId)
          .get()
          .then((res) => {
            delete data.userId;
            data.name = res.docs[0]?.data()?.name;
            data.phoneNumber = res.docs[0]?.data()?.phoneNumber;
          });
        usersPromises.push(userPromise);
      }
      return data;
    });
    await Promise.all(usersPromises);

    res.status(200).json({
      success: true,
      tokens,
    });
  } catch (err) {
    next(err);
  }
};

exports.getTokenAggrDetails = async (req, res, next) => {
  try {
    const aggrData = await admin
      .firestore()
      .collection("Aggregations")
      .doc("token")
      .get()
      .catch((err) => {
        throw new MyError(503, "Could not load token info.");
      });

    res.status(200).json({
      success: true,
      data: aggrData.data(),
    });
  } catch (err) {
    next(err);
  }
};

exports.getUsersLockStatus = async (req, res, next) => {
  try {
    const startAfter = req.query.startAfter || null;
    const limit = req.query.limit * 1 || 50;
    const phoneNumber = req.query.phoneNumber;

    if (phoneNumber && phoneNumber.length === 10) {
      const user = await admin
        .firestore()
        .collection("Users")
        .where("phoneNumber", "==", phoneNumber)
        .get();

      if (user.docs.length === 0) {
        return res.status(200).json({
          success: true,
          tokens: [],
        });
      }
      const userDetails = user.docs[0].data();

      const token = await admin
        .firestore()
        .collection("tokens")
        .where("tokenId", "==", userDetails.token || "")
        .get();

      const tokenDetails = token.docs[0]?.data();

      return res.status(200).json({
        success: true,
        tokens: [
          {
            registeredAt: tokenDetails?.registeredAt,
            tokenId: tokenDetails?.tokenId,
            registered: tokenDetails?.registered,
            name: userDetails.name,
            phoneNumber: userDetails.phoneNumber,
            locked: userDetails.locked,
          },
        ],
      });
    }

    const tokensRef = await admin
      .firestore()
      .collection("tokens")
      .orderBy("tokenId")
      .where("registered", "==", true)
      .startAfter(startAfter)
      .limit(limit)
      .get();

    const userCollection = admin.firestore().collection("Users");
    const usersPromises = [];

    const tokens = tokensRef.docs.map((doc) => {
      const data = doc.data();

      const userPromise = userCollection
        .where("userId", "==", data.userId)
        .get()
        .then((res) => {
          delete data.userId;
          data.name = res.docs[0]?.data()?.name;
          data.phoneNumber = res.docs[0]?.data()?.phoneNumber;
          data.locked = res.docs[0]?.data()?.locked || false;
        });
      usersPromises.push(userPromise);

      return data;
    });
    await Promise.all(usersPromises);

    res.status(200).json({
      success: true,
      tokens,
    });
  } catch (err) {
    next(err);
  }
};

exports.sendMessageToDeviceViaAdmin = async (req, res, next) => {
  try {
    const task = req.body.task;
    if (task !== "lock" && task !== "unlock") {
      throw new MyError(400, "Invalid task for request!");
    }

    const token = req.body.token;
    if (token?.length !== 10) {
      throw new MyError(400, "Token not provided or invalid token!");
    }

    const userDocsRef = admin
      .firestore()
      .collection("Users")
      .where("token", "==", token);
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
    // FAILED REQ WILL LOOK LIKE:
    // {
    //   multicast_id: 1201833344011481900,
    //   success: 0,
    //   failure: 1,
    //   canonical_ids: 0,
    //   results: [ { error: 'NotRegistered' } ]
    // }

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

exports.disableToken = async (req, res, next) => {
  try {
    const { tokenId, action } = req.body;
    const response = await admin
      .firestore()
      .collection("tokens")
      .where("tokenId", "==", tokenId)
      .get();

    let docRef;
    response.docs.forEach((doc) => {
      docRef = admin.firestore().collection("tokens").doc(doc.id);
    });

    if (docRef) {
      await docRef.update({ disabled: action }).catch(() => {
        throw new MyError(501, "Failed to update.");
      });
      return res.json({
        status: true,
      });
    }
  } catch (error) {
    next(error);
  }
};
