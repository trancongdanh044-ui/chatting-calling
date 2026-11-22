const cloudinary = require("cloudinary").v2;
const { randomUUID } = require("node:crypto");
const { extname } = require("node:path");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET
});

async function uploadFile(file) {
  if (!Buffer.isBuffer(file?.buffer) || file.buffer.length === 0) {
    throw new Error("Tệp tải lên không có dữ liệu.");
  }

  const extension = extname(file.originalname || "").toLowerCase();
  if (!/^\.[a-z0-9]{1,16}$/.test(extension)) {
    throw new Error("Tệp cần có phần mở rộng hợp lệ.");
  }

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        type: "authenticated",
        public_id: `chat-files/${randomUUID()}${extension}`
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.on("error", reject);
    stream.end(file.buffer);
  });

  return {
    name: file.originalname,
    size: file.buffer.length,
    publicId: result.public_id
  };
}

module.exports = uploadFile;