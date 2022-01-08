class MyError extends Error {
  constructor(statusCode, message) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(message);

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MyError);
    }

    this.myErr = true;
    this.statusCode = statusCode;
  }
}

module.exports = MyError;
