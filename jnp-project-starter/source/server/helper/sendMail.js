const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "Gmail", // Use any Service ID from the table below (matching is case-insensitive)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.APP_PASS,
  },
});

module.exports = async (email, subject, html) => {
  transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: html,
    },
    (err, info) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log(info.envelope);
      console.log(info.messageId);
    }
  );
}
