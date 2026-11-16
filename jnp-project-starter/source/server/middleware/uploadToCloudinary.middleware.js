const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET
});
// End Cloudinary

module.exports = (req, res, next) => {
  if (req.file || req.files) {
    let streamUpload = (file) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          (error, result) => {
            if (error) {
              return reject(error);
            }

            return resolve(result);
          }
        );

        streamifier.createReadStream(file.buffer).pipe(stream);
      });
    };

    async function upload(req) {
      try {
        let files = [];

        // upload.single()
        if (req.file) {
          files = [req.file];
        }

        // upload.array()
        else if (Array.isArray(req.files)) {
          files = req.files;
        }

        // upload.fields()
        else if (req.files && typeof req.files === "object") {
          files = Object.values(req.files).flat();
        }

        for (const file of files) {
          const result = await streamUpload(file);
          const fieldName = file.fieldname;
          const imageUrl = result.secure_url;

          const sameFieldCount = files.filter(
            (item) => item.fieldname === fieldName
          ).length;
          if (sameFieldCount === 1) {
            req.body[fieldName] = imageUrl;
          } else {
            if (!Array.isArray(req.body[fieldName])) {
              req.body[fieldName] = [];
            }
            req.body[fieldName].push(imageUrl);
          }
        }
        return next();
      } catch (error) {
        return next(error);
      }
    }
    upload(req);
  } else {
    return next();
  }
};