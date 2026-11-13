const mongoose = require('mongoose');

module.exports.connect = async () => {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error('Thiếu biến môi trường MONGO_URL trong file .env');

  await mongoose.connect(mongoUrl, {
    serverSelectionTimeoutMS: 10000
  });
  console.log('Đã kết nối MongoDB thành công.');
};
