// =====================================================================
// ui.js – TIỆN ÍCH GIAO DIỆN DÙNG CHUNG CHO MỌI TRANG
//   1. Hàm tiện ích (escape HTML, định dạng giờ, dung lượng...)
//   2. Toast (thông báo nổi) + đọc flash message từ server
//   3. Chuyển giao diện sáng / tối
//   4. Modal (hộp thoại) và popover thông báo
//   5. Thanh điều hướng: đánh dấu mục đang mở, badge lời mời kết bạn
//   6. Ô tìm kiếm / sắp xếp danh sách (trang bạn bè, nhóm)
//   7. Form: nút hiện mật khẩu, khoá nút khi đang gửi, chức năng "demo"
//   8. Trạng thái online/offline của bạn bè (realtime)
//   9. Thanh báo mất kết nối
// =====================================================================
var UI = {};

// ---------- 1. HÀM TIỆN ÍCH ----------
// Bỏ dấu tiếng Việt để tìm kiếm "an" ra được "Ân"
UI.removeAccents = function (text) {
  return (text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
};

// Định dạng dung lượng: 1536 -> "1.5 KB"
UI.formatBytes = function (bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
};

// Giờ ngắn gọn: hôm nay -> "14:05", trong tuần -> "T2", cũ hơn -> "12/10"
UI.formatShortTime = function (iso) {
  var date = new Date(iso);
  if (isNaN(date)) return "";
  var now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  var days = (now - date) / 86400000;
  if (days < 7) return ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][date.getDay()];
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
};

// ---------- 2. TOAST ----------
// UI.toast("Nội dung", "success" | "error" | "info")
UI.toast = function (message, type) {
  type = type || "info";
  var icons = { success: "fa-circle-check", error: "fa-circle-exclamation", info: "fa-circle-info" };
  var area = document.getElementById("toast-area");
  var toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.innerHTML = '<i class="fa-solid ' + icons[type] + '"></i><span></span>';
  toast.querySelector("span").textContent = message; // textContent: an toàn, không bị chèn HTML
  area.appendChild(toast);
  setTimeout(function () { toast.remove(); }, 4500);
};

// Thông báo cho chức năng chưa có backend
UI.notImplemented = function (name) {
  UI.toast("«" + name + "» chưa có backend – hiện mới chỉ có giao diện.", "info");
};

// Server (express-flash) gửi thông báo qua #flash-data → hiện thành toast
(function showFlashMessages() {
  var flash = document.getElementById("flash-data");
  if (!flash) return;
  if (flash.dataset.success) UI.toast(flash.dataset.success, "success");
  if (flash.dataset.error) UI.toast(flash.dataset.error, "error");
})();

// ---------- 3. GIAO DIỆN SÁNG / TỐI ----------
// mode: "light" | "dark" | "system" – lưu ở localStorage (đọc sớm trong head.pug)
UI.applyTheme = function (mode) {
  localStorage.setItem("theme", mode);
  var dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  // đánh dấu nút đang chọn trong hộp thoại tài khoản
  document.querySelectorAll("[data-theme-set]").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.themeSet === mode);
  });
  // bảng emoji cần biết đang sáng hay tối
  var picker = document.querySelector("emoji-picker");
  if (picker) picker.classList.toggle("dark", dark);
};

UI.applyTheme(localStorage.getItem("theme") || "system");

// Nút bấm nhanh (mặt trăng) đổi qua lại sáng <-> tối
document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var isDark = document.documentElement.dataset.theme === "dark";
    UI.applyTheme(isDark ? "light" : "dark");
  });
});
// 3 nút chọn trong hộp thoại tài khoản
document.querySelectorAll("[data-theme-set]").forEach(function (btn) {
  btn.addEventListener("click", function () { UI.applyTheme(btn.dataset.themeSet); });
});
// Đang ở chế độ "Hệ thống" thì đổi theo khi hệ điều hành đổi
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
  if ((localStorage.getItem("theme") || "system") === "system") UI.applyTheme("system");
});

// ---------- 4. MODAL & POPOVER ----------
UI.openModal = function (id) { document.getElementById(id).hidden = false; };
UI.closeModal = function (modal) { modal.hidden = true; };

document.addEventListener("click", function (e) {
  // Nút mở modal: data-open-modal="id-của-modal"
  var opener = e.target.closest("[data-open-modal]");
  if (opener) return UI.openModal(opener.dataset.openModal);

  // Nút đóng modal, hoặc bấm ra nền tối bên ngoài
  var modal = e.target.closest(".modal");
  if (modal && (e.target === modal || e.target.closest("[data-close-modal]"))) UI.closeModal(modal);

  // Popover thông báo: bấm chuông thì mở/đóng, bấm chỗ khác thì đóng
  var popover = document.getElementById("notify-popover");
  if (popover) {
    if (e.target.closest("#btn-notify")) popover.hidden = !popover.hidden;
    else if (!e.target.closest("#notify-popover")) popover.hidden = true;
  }

  // Bất kỳ phần tử nào có data-demo="Tên chức năng" → báo "chưa có backend"
  var demo = e.target.closest("[data-demo]");
  if (demo) UI.notImplemented(demo.dataset.demo);
});

// Phím Esc đóng modal đang mở
document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;
  document.querySelectorAll(".modal:not([hidden])").forEach(UI.closeModal);
});

// ---------- 5. THANH ĐIỀU HƯỚNG ----------
// Đánh dấu mục đang mở (so khớp đầu đường dẫn)
document.querySelectorAll("[data-nav]").forEach(function (link) {
  if (location.pathname.indexOf(link.dataset.nav) === 0) link.classList.add("active");
});

// Cập nhật số lời mời kết bạn ở mọi badge trên trang
UI.setInvitationBadge = function (count) {
  document.querySelectorAll("[badge-invitation]").forEach(function (badge) {
    badge.textContent = count;
    badge.hidden = count === 0;
  });
};

// Server báo số lời mời mới (sự kiện có sẵn của backend)
socket.on("SERVER_RETURN_LENGTH_INVITATION", function (data) {
  if (data.userId === document.body.dataset.myId) UI.setInvitationBadge(data.lengthOfInvitation);
});

// ---------- 6. TÌM KIẾM & SẮP XẾP DANH SÁCH ----------
// Ô nhập có [data-filter-input] lọc các phần tử con có [data-name] của [data-filter-list]
(function initListFilter() {
  var list = document.querySelector("[data-filter-list]");
  var input = document.querySelector("[data-filter-input]");
  var select = document.querySelector("[data-sort-select]");
  if (!list) return;

  function items() { return Array.prototype.slice.call(list.querySelectorAll("[data-name]")); }

  if (input) {
    input.addEventListener("input", function () {
      var keyword = UI.removeAccents(input.value.trim());
      items().forEach(function (item) {
        item.hidden = UI.removeAccents(item.dataset.name).indexOf(keyword) === -1;
      });
    });
  }
  if (select) {
    select.addEventListener("change", function () {
      var sorted = items().sort(function (a, b) { return a.dataset.name.localeCompare(b.dataset.name, "vi"); });
      if (select.value === "desc") sorted.reverse();
      sorted.forEach(function (item) { list.appendChild(item); });
    });
  }
})();

// ---------- 7. FORM ----------
document.addEventListener("click", function (e) {
  // Nút con mắt: hiện / ẩn mật khẩu
  var toggle = e.target.closest("[data-toggle-password]");
  if (!toggle) return;
  var input = toggle.parentElement.querySelector("input");
  var show = input.type === "password";
  input.type = show ? "text" : "password";
  toggle.querySelector("i").className = show ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
});

// Form có [data-submit-lock]: khoá nút gửi để không bấm 2 lần
document.addEventListener("submit", function (e) {
  var form = e.target;
  if (form.hasAttribute("data-submit-lock") && !e.defaultPrevented) {
    var button = form.querySelector('[type="submit"]');
    setTimeout(function () { button.disabled = true; }, 0); // đợi form gửi đi rồi mới khoá
  }
  // Form có [data-demo-form="Tên"]: chưa có backend, chỉ báo cho người dùng
  if (form.hasAttribute("data-demo-form")) {
    e.preventDefault();
    UI.notImplemented(form.dataset.demoForm);
    var modal = form.closest(".modal");
    if (modal) UI.closeModal(modal);
  }
});

// ---------- 8. TRẠNG THÁI ONLINE CỦA BẠN BÈ ----------
// Backend phát CLIENT_CHANGE_STATUS khi ai đó đăng nhập / đăng xuất.
// Phần tử nào có [data-friend-id="id"] sẽ được cập nhật chấm xanh + dòng chữ trạng thái.
socket.on("CLIENT_CHANGE_STATUS", function (data) {
  document.querySelectorAll('[data-friend-id="' + data.userId + '"]').forEach(function (box) {
    box.querySelectorAll("[data-status]").forEach(function (dot) { dot.dataset.status = data.statusOnline; });
    box.querySelectorAll("[data-status-text]").forEach(function (text) {
      text.textContent = data.statusOnline === "online" ? "Đang hoạt động" : (data.friendLastOnline || "Ngoại tuyến");
    });
  });
  // Khung chat đang mở cũng có dòng trạng thái ở panel thông tin
  var room = document.getElementById("room");
  if (room && room.dataset.peerId === data.userId) {
    var text = data.statusOnline === "online" ? "Đang hoạt động" : (data.friendLastOnline || "Ngoại tuyến");
    document.querySelectorAll("#info-panel [data-status-text]").forEach(function (el) { el.textContent = text; });
  }
});

// ---------- 9. THANH BÁO MẤT KẾT NỐI ----------
(function connectionBar() {
  var bar = null, wasDisconnected = false;
  function show(html) {
    if (!bar) { bar = document.createElement("div"); bar.id = "connection-bar"; document.body.appendChild(bar); }
    bar.innerHTML = html;
  }
  socket.on("disconnect", function () {
    wasDisconnected = true;
    show('<i class="fa-solid fa-wifi"></i> Mất kết nối máy chủ, đang thử lại…');
  });
  socket.on("connect", function () {
    if (!wasDisconnected) return;
    // Backend chỉ gắn sự kiện cho kết nối đầu tiên của trang, nên sau khi nối lại cần tải lại trang.
    show('Đã kết nối lại. <button type="button" onclick="location.reload()">Tải lại trang</button>');
  });
})();
