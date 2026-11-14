// =====================================================================
// auth.js – TRANG ĐĂNG KÝ: đo độ mạnh mật khẩu + kiểm tra nhập lại mật khẩu
// (nút hiện/ẩn mật khẩu nằm trong ui.js)
// =====================================================================
(function () {
  var form = document.getElementById("signup-form");
  if (!form) return;

  var password = document.getElementById("password");
  var confirm = document.getElementById("confirm");
  var confirmError = document.getElementById("confirm-error");
  var strength = document.getElementById("strength");

  // Độ mạnh 0–4: +1 cho mỗi tiêu chí đạt được
  function passwordLevel(value) {
    var level = 0;
    if (value.length >= 6) level++;
    if (value.length >= 10) level++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) level++;
    if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) level++;
    return level;
  }
  function showStrength() {
    var level = password.value ? Math.max(1, passwordLevel(password.value)) : 0;
    strength.dataset.level = level;
    strength.firstElementChild.style.width = level * 25 + "%";
  }

  function checkConfirm() {
    var mismatch = confirm.value !== "" && confirm.value !== password.value;
    confirmError.textContent = mismatch ? "Mật khẩu nhập lại chưa khớp" : "";
    return !mismatch;
  }

  password.addEventListener("input", function () { showStrength(); checkConfirm(); });
  confirm.addEventListener("input", checkConfirm);

  form.addEventListener("submit", function (e) {
    if (!checkConfirm() || confirm.value === "") {
      e.preventDefault();               // chặn gửi lên server khi mật khẩu chưa khớp
      checkConfirm();
      confirmError.textContent = confirmError.textContent || "Vui lòng nhập lại mật khẩu";
      confirm.focus();
    }
  });
})();
