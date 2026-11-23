module.exports.generateRandomString = (length) =>{
  const str = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghiklmnopqrstuvwxyz0123456789";
  let result = "";
  for(let i = 0; i < length; ++i){
    result += str.charAt(Math.ceil(length*Math.random()));
  }
  return result;
}

module.exports.generateOTP = (length) => {
  const str = "0123456789";
  let otp = "";
  for(let i = 0; i < length; ++i){
    otp += str.charAt(Math.ceil(str.length*Math.random()));
  }
  return otp;
}