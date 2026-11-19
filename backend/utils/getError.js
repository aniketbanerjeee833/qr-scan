
const getError = (res, statusCode = 500, message = "Internal Server Error") => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};

export default getError;
