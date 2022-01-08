const admin = require("../firebaseAdmin");
const MyError = require("../ErrorHelpers/MyError");

exports.getUserData = async (req, res, next) => {
  try {
    const userDocs = await admin
      .firestore()
      .collection("Users")
      .where("userId", "==", res.uid)
      .get();

    if (!userDocs.docs[0]) throw new MyError(404, "User does not exist.");

    const user = userDocs.docs[0].data();
    res.status(200).json({
      success: true,
      data: {
        name: user.name,
        phoneNumber: user.phoneNumber,
        email: user.email,
        locked: user.locked,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getUserImagesById = async (req, res, next) => {
  try {
    if (!req.params.id) {
      throw new MyError(400, "User Id not found...");
    }

    const imagesDocs = await admin
      .firestore()
      .collection("images")
      .where("userId", "==", req.params.id)
      .orderBy("urls", "asc")
      .limit(100)
      .get();

    const imageObjArr = [];
    imagesDocs.docs.forEach((data) => {
      data.data().urls.forEach((imageName) => {
        imageObjArr.push({
          timestamp: Number(imageName.split(".")[0]),
          url: admin
            .storage()
            .bucket()
            .file(imageName)
            .getSignedUrl({
              action: "read",
              expires: Date.now() + 1000 * 60 * 60 * 2, // one hour
            }),
        });
      });
    });

    const imageUrl = await Promise.all(imageObjArr.map((obj) => obj.url));

    imageUrl.forEach((url, i) => {
      imageObjArr[i].url = url[0];
    });

    const sendData = imageObjArr.sort((a, b) => b.timestamp - a.timestamp);

    res.status(200).json({
      success: true,
      data: sendData,
    });
  } catch (err) {
    next(err);
  }
};

exports.getUserLocationsById = async (req, res, next) => {
  try {
    if (!req.params.id) {
      throw new MyError(400, "User Id not found...");
    }

    const userLocationDocs = await admin
      .firestore()
      .collection("Location")
      .where("userId", "==", req.params.id)
      .orderBy("timestamp", "desc")
      .limit(100)
      .get();

    const dataArr = [];
    userLocationDocs.docs.forEach((lData) => {
      const data = lData.data();
      dataArr.push({
        timestamp: data.timestamp,
        latitude: data.latitude,
        longitude: data.longitude,
      });
    });

    res.status(200).json({
      success: true,
      data: dataArr,
    });
  } catch (err) {
    next(err);
  }
};

// exports.rahul = async (req, res, next) => {
//   const collectionName = "tokens";
//   try {
//     const collection = admin.firestore().collection(collectionName);

//     const newDocumentBody = {
//       type: "YEARLY",
//     };

//     const docArr = [];
//     const failedDocIdArr = [];

//     collection.get().then((response) => {
//       response.docs.forEach((doc) => {
//         const docRef = admin.firestore().collection(collectionName).doc(doc.id);

//         docArr.push(
//           docRef
//             .update(newDocumentBody)
//             .catch((err) => failedDocIdArr.push(doc.id))
//         );
//       });

//       Promise.all(docArr).then((result) => {
//         res.status(200).json({
//           success: true,
//           failedDocIdArr,
//         });
//       });
//     });
//   } catch (error) {
//     console.log(error);
//   }
// };
