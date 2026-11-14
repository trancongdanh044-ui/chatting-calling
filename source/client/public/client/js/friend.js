// =====================================================================
// friend.js – CHỨC NĂNG KẾT BẠN (trang Bạn bè, Gợi ý, Đã gửi, Lời mời)
//   A. Bấm nút trên thẻ người dùng  → gửi sự kiện lên server
//   B. Nhận sự kiện từ server        → cập nhật danh sách realtime
// Dùng "event delegation": chỉ cần MỘT listener cho cả danh sách, thẻ nào
// được thêm vào sau (realtime) cũng tự hoạt động, không cần gắn lại sự kiện.
// =====================================================================
(function () {
  var page = document.querySelector("[data-page]");
  var grid = document.getElementById("user-grid");
  if (!page || !grid) return;

  var pageName = page.dataset.page;               // friends | hint | request | invitation
  var myId = document.body.dataset.myId;
  var emptyState = document.getElementById("empty-state");

  // ---------- Hàm hỗ trợ ----------
  function findCard(userId) { return grid.querySelector('[data-user-id="' + userId + '"]'); }

  // Hiện/ẩn khối "danh sách trống" tuỳ còn thẻ nào không
  function refreshEmptyState() {
    emptyState.hidden = grid.querySelector(".user-card") !== null;
  }

  function removeCard(userId) {
    var card = findCard(userId);
    if (card) card.remove();
    refreshEmptyState();
  }

  // Tạo thẻ người dùng cho dữ liệu realtime. HTML giống mixin user-card trong friend.pug.
  function createUserCard(user, kind) {
    var card = document.createElement("div");
    card.className = "user-card";
    card.dataset.userId = user._id;
    card.dataset.name = user.fullName;

    var actions = "";
    if (kind === "hint") {
      actions =
        '<button type="button" class="btn btn-primary btn-sm when-idle" data-action="add">Thêm bạn bè</button>' +
        '<button type="button" class="btn btn-sm when-idle" data-action="remove">Gỡ</button>' +
        '<span class="muted when-requested">Đã gửi lời mời</span>' +
        '<button type="button" class="btn btn-sm when-requested" data-action="cancel">Huỷ</button>';
    } else if (kind === "invitation") {
      actions =
        '<button type="button" class="btn btn-primary btn-sm when-idle" data-action="accept">Chấp nhận</button>' +
        '<button type="button" class="btn btn-sm when-idle" data-action="refuse">Từ chối</button>' +
        '<span class="when-accepted"><i class="fa-solid fa-check"></i> Đã chấp nhận</span>';
    }

    card.innerHTML =
      '<div class="avatar"><img alt=""></div>' +
      '<div class="user-info"><div class="user-name truncate"></div><div class="user-actions">' + actions + "</div></div>";
    // Gán tên / ảnh bằng thuộc tính để tránh bị chèn mã HTML
    card.querySelector("img").src = user.avatar || "/client/images/avatar.jpg";
    card.querySelector("img").alt = user.fullName;
    card.querySelector(".user-name").textContent = user.fullName;
    return card;
  }

  function addCard(user, kind) {
    if (findCard(user._id)) return;      // đã có thì thôi
    grid.appendChild(createUserCard(user, kind));
    refreshEmptyState();
  }

  // ---------- A. BẤM NÚT TRÊN THẺ ----------
  grid.addEventListener("click", function (e) {
    var button = e.target.closest("[data-action]");
    if (!button) return;
    var card = button.closest(".user-card");
    var userId = card.dataset.userId;

    switch (button.dataset.action) {
      case "add":     // Gửi lời mời kết bạn (trang Gợi ý)
        card.classList.add("is-requested");
        socket.emit("CLIENT_ADD_FRIEND", { reqUserId: userId });
        UI.toast("Đã gửi lời mời kết bạn", "success");
        break;
      case "cancel":  // Huỷ lời mời vừa gửi (trang Gợi ý)
        card.classList.remove("is-requested");
        socket.emit("CLIENT_CANCEL_REQUEST", { userId: userId });
        break;
      case "remove":  // Gỡ gợi ý khỏi danh sách (chỉ ẩn trên trình duyệt)
        removeCard(userId);
        break;
      case "revoke":  // Thu hồi lời mời đã gửi (trang Đã gửi)
        socket.emit("CLIENT_REVOKE_REQUEST", { userId: userId });
        removeCard(userId);
        break;
      case "accept":  // Chấp nhận lời mời (trang Lời mời)
        card.classList.add("is-accepted");
        socket.emit("CLIENT_ACCEPT_FRIEND", { userId: userId });
        UI.toast("Các bạn đã trở thành bạn bè", "success");
        break;
      case "refuse":  // Từ chối lời mời (trang Lời mời)
        socket.emit("CLIENT_REFUSE_FRIEND", { userId: userId });
        removeCard(userId);
        break;
    }
  });

  // ---------- B. NHẬN SỰ KIỆN TỪ SERVER ----------
  // Có người gửi lời mời cho mình
  socket.on("SERVER_RETURN_ADD_FRIEND", function (data) {
    if (data.myUserId !== myId) return;            // lời mời này không dành cho mình
    if (pageName === "invitation") addCard(data.user, "invitation");
    if (pageName === "hint") removeCard(data.user._id);  // người đó không cần gợi ý nữa
  });

  // Người gửi lời mời đã huỷ → bỏ khỏi danh sách lời mời của mình
  socket.on("SERVER_RETURN_CANCEL_USER", function (data) {
    if (data.myUserId === myId && pageName === "invitation") removeCard(data.userId);
  });

  // Người gửi lời mời đã thu hồi
  socket.on("SERVER_RETURN_REVOKE_USER", function (data) {
    if (data.myUserId === myId && pageName === "invitation") removeCard(data.userId);
  });

  // Lời mời mình gửi bị từ chối → người đó quay lại danh sách gợi ý
  socket.on("SERVER_RETURN_REFUSE_USER", function (data) {
    if (data.myUserId !== myId) return;
    if (pageName === "hint") addCard(data.user, "hint");
    if (pageName === "request") removeCard(data.user._id);
  });

  // Người nhận đã chấp nhận lời mời của mình.
  socket.on("SERVER_RETURN_FRIEND_ACCEPTED", function (data) {
    if (pageName === "request" && data.userId) removeCard(data.userId);
  });

  socket.on("SERVER_FRIEND_ERROR", function (data) {
    UI.toast((data && data.message) || "Không thể xử lý yêu cầu kết bạn", "error");
  });
})();
