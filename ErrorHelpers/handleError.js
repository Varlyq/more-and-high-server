module.exports = (err, req, res, next) => {
  console.log(err);
  if (err.myErr) {
    res.status(err.statusCode).json({
      success: false,
      data: err.message,
    });
  } else {
    res.status(500).json({
      success: false,
      data: "Something went wrong",
    });
  }
};
