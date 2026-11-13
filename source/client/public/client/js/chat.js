// =====================================================================
// chat.js – TRANG NHẮN TIN (danh sách hội thoại, khung chat, gửi ảnh/tài liệu)
//   A. Danh sách hội thoại: giờ, tìm kiếm, lọc Tất cả/Bạn bè/Nhóm
//   B. Vẽ tin nhắn (dùng chung cho tin cũ và tin realtime)
//   C. Cuộn tin nhắn + nút "Tin nhắn mới"
//   D. Tệp đính kèm: chọn, kéo thả, dán, nén ảnh, xem trước
//   E. Gửi tin nhắn (socket) và nhận tin nhắn realtime
//   F. Emoji
//   G. Xem ảnh phóng to (lightbox)
//   H. Panel thông tin hội thoại (ảnh / tài liệu đã gửi, tắt thông báo)
//   I. Nút gọi thoại / video call
// =====================================================================
(function () {
  var cfg = window.APP_CONFIG;
  var DEFAULT_AVATAR = "/client/images/avatar.jpg";

  // ---------------------------------------------------------------
  // A. DANH SÁCH HỘI THOẠI (cột trái) – chạy cả khi chưa chọn phòng
  // ---------------------------------------------------------------
  var convList = document.getElementById("conv-list");
  var convSearch = document.getElementById("conv-search");
  var convFilters = document.getElementById("conv-filters");
  var convEmpty = document.getElementById("conv-empty");
  var convType = "all";   // all | friend | group

  // Hiện giờ của tin nhắn cuối ("14:05", "T2", "12/10")
  document.querySelectorAll(".conv-time[data-time]").forEach(function (el) {
    el.textContent = UI.formatShortTime(el.dataset.time);
  });

  // Ẩn/hiện từng hội thoại theo từ khoá và loại đang chọn
  function applyConvFilter() {
    var keyword = UI.removeAccents(convSearch.value.trim());
    var visible = 0;
    convList.querySelectorAll(".conv").forEach(function (item) {
      var matchType = convType === "all" || item.dataset.type === convType;
      var matchName = UI.removeAccents(item.dataset.title).indexOf(keyword) !== -1;
      item.hidden = !(matchType && matchName);
      if (!item.hidden) visible++;
    });
    convEmpty.hidden = visible > 0;
  }
  convSearch.addEventListener("input", applyConvFilter);
  convFilters.addEventListener("click", function (e) {
    var button = e.target.closest("[data-filter]");
    if (!button) return;
    convType = button.dataset.filter;
    convFilters.querySelectorAll(".filter").forEach(function (b) { b.classList.toggle("active", b === button); });
    applyConvFilter();
  });

  // Chưa chọn phòng chat thì dừng ở đây
  var room = document.getElementById("room");
  if (!room || !room.dataset.roomId) return;

  // ---------------------------------------------------------------
  // Thông tin phòng đang mở (lấy từ data-* trong chat-room.pug)
  // ---------------------------------------------------------------
  var myId = document.body.dataset.myId;
  var myName = room.dataset.myName;
  var peerId = room.dataset.peerId;          // id người kia (chỉ có ở chat 1-1)
  var isGroup = room.dataset.roomType === "group";
  socket.emit("CLIENT_JOIN_ROOM", { roomChatId: room.dataset.roomId });
  var chatPage = document.querySelector(".chat-page");
  var messagesBox = document.getElementById("messages");
  var allMessages = [];                       // mọi tin nhắn đã vẽ (để tổng hợp ảnh/tệp)
  var lastMsg = null;                         // tin nhắn vừa vẽ gần nhất (để gộp nhóm)

  // ---------------------------------------------------------------
  // B. VẼ TIN NHẮN
  // msg = { userId, fullName, avatar, content, images[], files[], createdAt }
  // ---------------------------------------------------------------
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  // Biến chữ thường thành chữ có link bấm được (chỉ nhận http/https, không chèn HTML)
  function appendTextWithLinks(parent, text) {
    var pattern = /(https?:\/\/[^\s<]+)/g, last = 0, match;
    while ((match = pattern.exec(text))) {
      if (match.index > last) parent.appendChild(document.createTextNode(text.slice(last, match.index)));
      var link = el("a", "", match[0]);
      link.href = match[0]; link.target = "_blank"; link.rel = "noopener noreferrer";
      parent.appendChild(link);
      last = match.index + match[0].length;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  // Icon theo đuôi tệp
  function fileIconClass(name) {
    var ext = (name.split(".").pop() || "").toLowerCase();
    var map = { pdf: "fa-file-pdf", doc: "fa-file-word", docx: "fa-file-word", xls: "fa-file-excel", xlsx: "fa-file-excel",
      csv: "fa-file-excel", ppt: "fa-file-powerpoint", pptx: "fa-file-powerpoint", zip: "fa-file-zipper",
      rar: "fa-file-zipper", "7z": "fa-file-zipper", txt: "fa-file-lines" };
    return "fa-solid " + (map[ext] || "fa-file");
  }

  // Thẻ tài liệu: file = { name, size, url, local }
  function buildFileCard(file) {
    var card = file.url ? el("a", "file-card") : el("div", "file-card");
    if (file.url) { card.href = file.url; card.download = file.name; card.target = "_blank"; card.rel = "noopener"; }
    var icon = el("div", "file-icon");
    icon.appendChild(el("i", fileIconClass(file.name)));
    var meta = el("div", "file-meta");
    meta.appendChild(el("div", "file-name truncate", file.name));
    meta.appendChild(el("div", "file-size", UI.formatBytes(file.size || 0)));
    if (file.local) meta.appendChild(el("div", "demo-note", "Demo – chỉ hiển thị trên máy bạn"));
    card.appendChild(icon);
    card.appendChild(meta);
    return card;
  }

  function dayLabel(date) {
    var today = new Date(), yesterday = new Date(Date.now() - 86400000);
    if (date.toDateString() === today.toDateString()) return "Hôm nay";
    if (date.toDateString() === yesterday.toDateString()) return "Hôm qua";
    return date.toLocaleDateString("vi-VN");
  }

  // Thêm 1 tin nhắn vào cuối khung chat
  function appendMessage(msg) {
    var emptyHint = messagesBox.querySelector(".empty-chat");
    if (emptyHint) emptyHint.remove();

    var created = new Date(msg.createdAt || Date.now());
    var isOut = msg.userId === myId;

    // Vạch ngăn cách ngày
    var newDay = !lastMsg || new Date(lastMsg.createdAt).toDateString() !== created.toDateString();
    if (newDay) messagesBox.appendChild(el("div", "day-divider", dayLabel(created)));

    // Tin đầu tiên của một "cụm" (cùng người gửi, cách nhau < 5 phút) sẽ hiện avatar + tên
    var startsGroup = newDay || lastMsg.userId !== msg.userId || (created - new Date(lastMsg.createdAt)) > 5 * 60000;

    var row = el("div", "msg " + (isOut ? "msg-out" : "msg-in") + (startsGroup ? " first" : ""));

    if (!isOut) {                                      // avatar người gửi (tin nhận)
      var avatarBox = el("div", "msg-avatar");
      if (startsGroup) {
        var avatar = el("img");
        avatar.src = msg.avatar || (msg.userId === peerId ? room.dataset.peerAvatar : DEFAULT_AVATAR);
        avatar.alt = "";
        avatarBox.appendChild(avatar);
      }
      row.appendChild(avatarBox);
    }

    var col = el("div", "msg-col");
    if (!isOut && isGroup && startsGroup) col.appendChild(el("div", "msg-name", msg.fullName));

    if (msg.content) {                                 // nội dung chữ
      var bubble = el("div", "bubble");
      appendTextWithLinks(bubble, msg.content);
      col.appendChild(bubble);
    }
    if (msg.images && msg.images.length) {             // ảnh
      var grid = el("div", "msg-images");
      msg.images.forEach(function (url) {
        var img = el("img"); img.src = url; img.alt = "Ảnh"; img.loading = "lazy";
        grid.appendChild(img);
      });
      col.appendChild(grid);
    }
    (msg.files || []).forEach(function (file) { col.appendChild(buildFileCard(file)); });   // tài liệu

    col.appendChild(el("div", "msg-time", created.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })));
    row.appendChild(col);
    messagesBox.appendChild(row);

    allMessages.push(msg);
    lastMsg = { userId: msg.userId, createdAt: created };
  }

  // ---------------------------------------------------------------
  // C. CUỘN TIN NHẮN
  // ---------------------------------------------------------------
  var newMsgPill = document.getElementById("new-msg-pill");
  function isNearBottom() { return messagesBox.scrollHeight - messagesBox.scrollTop - messagesBox.clientHeight < 120; }
  function scrollToBottom(instant) { messagesBox.scrollTo({ top: messagesBox.scrollHeight, behavior: instant ? "instant" : "smooth" }); }
  messagesBox.addEventListener("scroll", function () { if (isNearBottom()) newMsgPill.hidden = true; });
  newMsgPill.addEventListener("click", function () { scrollToBottom(); newMsgPill.hidden = true; });

  // Vẽ lịch sử chat từ JSON mà server nhúng sẵn trong trang
  var oldMessages = JSON.parse(document.getElementById("chat-data").textContent);
  oldMessages.forEach(appendMessage);
  if (oldMessages.length === 0) {
    messagesBox.innerHTML = '<div class="empty-chat"><i class="fa-regular fa-hand"></i><p>Chưa có tin nhắn nào.</p><p>Hãy gửi lời chào 👋</p></div>';
  }
  scrollToBottom(true);
  window.addEventListener("load", function () { scrollToBottom(true); });   // ảnh tải xong làm đổi chiều cao → cuộn lại

  // ---------------------------------------------------------------
  // D. TỆP ĐÍNH KÈM (ảnh + tài liệu) trước khi gửi
  // pending = [{ kind: "image" | "doc", file: File, previewUrl }]
  // ---------------------------------------------------------------
  var pending = [];
  var previewBox = document.getElementById("attach-preview");
  var imageInput = document.getElementById("image-input");
  var fileInput = document.getElementById("file-input");

  function countPending(kind) { return pending.filter(function (p) { return p.kind === kind; }).length; }

  // Nén ảnh lớn xuống dưới MAX_IMAGE_BYTES (socket.io chỉ nhận gói ~1MB nên ảnh to sẽ làm đứt kết nối)
  async function compressImage(file) {
    if (file.size <= cfg.MAX_IMAGE_BYTES || file.type === "image/gif") return file;
    try {
      var bitmap = await createImageBitmap(file);
      var scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      var qualities = [0.82, 0.65, 0.5];
      for (var i = 0; i < qualities.length; i++) {
        var blob = await new Promise(function (done) { canvas.toBlob(done, "image/jpeg", qualities[i]); });
        if (blob && blob.size <= cfg.MAX_IMAGE_BYTES) {
          return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
        }
      }
    } catch (err) { console.warn("Không nén được ảnh", err); }
    return null;
  }

  // Thêm các tệp người dùng chọn / kéo thả / dán vào danh sách chờ gửi
  async function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList);
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (file.type.indexOf("image/") === 0) {
        if (countPending("image") >= cfg.MAX_IMAGES) { UI.toast("Tối đa " + cfg.MAX_IMAGES + " ảnh mỗi tin nhắn", "error"); continue; }
        var small = await compressImage(file);
        if (!small) { UI.toast("Ảnh «" + file.name + "» quá lớn, không thể gửi", "error"); continue; }
        pending.push({ kind: "image", file: small, previewUrl: URL.createObjectURL(small) });
      } else {
        var ext = (file.name.split(".").pop() || "").toLowerCase();
        if (cfg.BLOCKED_EXTENSIONS.indexOf(ext) !== -1) { UI.toast("Không cho phép gửi tệp ." + ext, "error"); continue; }
        if (file.size > cfg.MAX_DOC_MB * 1024 * 1024) { UI.toast("«" + file.name + "» vượt quá " + cfg.MAX_DOC_MB + " MB", "error"); continue; }
        if (countPending("doc") >= cfg.MAX_DOCS) { UI.toast("Tối đa " + cfg.MAX_DOCS + " tài liệu mỗi tin nhắn", "error"); continue; }
        pending.push({ kind: "doc", file: file });
      }
    }
    renderPreview();
  }

  // Vẽ khu vực xem trước, mỗi tệp có nút ✕ để bỏ
  function renderPreview() {
    previewBox.innerHTML = "";
    pending.forEach(function (item, index) {
      var box = el("div", "attach-item");
      if (item.kind === "image") {
        var img = el("img"); img.src = item.previewUrl; img.alt = item.file.name;
        box.appendChild(img);
      } else {
        var doc = el("div", "attach-doc");
        doc.appendChild(el("i", fileIconClass(item.file.name)));
        var info = el("div");
        info.appendChild(el("div", "truncate", item.file.name));
        info.appendChild(el("div", "muted", UI.formatBytes(item.file.size)));
        doc.appendChild(info);
        box.appendChild(doc);
      }
      var remove = el("button", "attach-remove"); remove.type = "button"; remove.dataset.remove = index;
      remove.setAttribute("aria-label", "Bỏ tệp này");
      remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      box.appendChild(remove);
      previewBox.appendChild(box);
    });
  }
  previewBox.addEventListener("click", function (e) {
    var button = e.target.closest("[data-remove]");
    if (!button) return;
    var removed = pending.splice(Number(button.dataset.remove), 1)[0];
    if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    renderPreview();
  });

  // Nút 🖼 / 📎 mở hộp chọn tệp
  document.querySelectorAll("[data-pick]").forEach(function (button) {
    button.addEventListener("click", function () { (button.dataset.pick === "image" ? imageInput : fileInput).click(); });
  });
  [imageInput, fileInput].forEach(function (input) {
    input.addEventListener("change", function () { addFiles(input.files); input.value = ""; });
  });

  // Kéo thả tệp vào khung chat
  var dropOverlay = document.getElementById("drop-overlay");
  var dragDepth = 0;
  function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, "Files") !== -1; }
  room.addEventListener("dragenter", function (e) { if (hasFiles(e)) { e.preventDefault(); dragDepth++; dropOverlay.hidden = false; } });
  room.addEventListener("dragover", function (e) { if (hasFiles(e)) e.preventDefault(); });
  room.addEventListener("dragleave", function (e) { if (hasFiles(e) && --dragDepth <= 0) { dragDepth = 0; dropOverlay.hidden = true; } });
  room.addEventListener("drop", function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault(); dragDepth = 0; dropOverlay.hidden = true;
    addFiles(e.dataTransfer.files);
  });

  // ---------------------------------------------------------------
  // E. GỬI VÀ NHẬN TIN NHẮN
  // ---------------------------------------------------------------
  var composer = document.getElementById("composer");
  var input = document.getElementById("message-input");

  function autosize() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 140) + "px"; }
  input.addEventListener("input", autosize);

  // Enter = gửi, Shift+Enter = xuống dòng (bỏ qua khi đang gõ dấu tiếng Việt bằng IME)
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      composer.requestSubmit();
    }
  });
  // Dán ảnh từ clipboard (Ctrl+V)
  input.addEventListener("paste", function (e) {
    var files = Array.prototype.filter.call(e.clipboardData.files, function (f) { return f.type.indexOf("image/") === 0; });
    if (files.length) { e.preventDefault(); addFiles(files); }
  });

  composer.addEventListener("submit", function (e) {
    e.preventDefault();
    var content = input.value.trim();
    var images = pending.filter(function (p) { return p.kind === "image"; }).map(function (p) { return p.file; });
    var docs = pending.filter(function (p) { return p.kind === "doc"; }).map(function (p) { return p.file; });
    if (!content && images.length === 0 && docs.length === 0) return;
    if (!socket.connected) { UI.toast("Chưa kết nối được máy chủ, vui lòng thử lại", "error"); return; }

    // Dữ liệu gửi lên server (sự kiện có sẵn của backend: CLIENT_SEND_MESSAGE)
    var payload = { roomChatId: room.dataset.roomId, content: content, images: images };
    var sendDocsToServer = docs.length > 0 && cfg.FEATURES.sendDocuments;
    if (sendDocsToServer) {
      payload.files = docs.map(function (f) { return { name: f.name, type: f.type, size: f.size, data: f }; });
    }
    if (content || images.length || sendDocsToServer) socket.emit("CLIENT_SEND_MESSAGE", payload);

    // CHẾ ĐỘ DEMO: backend chưa nhận tài liệu → chỉ hiện tin nhắn tài liệu trên máy mình
    if (docs.length > 0 && !sendDocsToServer) {
      appendMessage({
        userId: myId, fullName: myName, content: "", images: [], createdAt: new Date().toISOString(),
        files: docs.map(function (f) { return { name: f.name, size: f.size, url: URL.createObjectURL(f), local: true }; })
      });
      refreshSharedInfo();
      scrollToBottom();
    }

    // Dọn ô soạn tin
    pending.forEach(function (p) { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl); });
    pending = [];
    renderPreview();
    input.value = "";
    autosize();
  });

  // Cập nhật dòng "tin nhắn cuối" của hội thoại đang mở trong cột trái
  function updateConvPreview(msg) {
    var item = convList.querySelector(".conv.active");
    if (!item) return;
    var text = msg.content || (msg.images && msg.images.length ? "Đã gửi " + msg.images.length + " ảnh" : "Đã gửi tệp");
    item.querySelector(".conv-preview").textContent = (msg.userId === myId ? "Bạn" : msg.fullName) + ": " + text;
    item.querySelector(".conv-time").textContent = UI.formatShortTime(new Date().toISOString());
  }

  // Server phát tin nhắn mới cho mọi người trong phòng (sự kiện có sẵn: SERVER_RETURN_MESSAGE)
  socket.on("SERVER_CHAT_ERROR", function (data) {
    UI.toast((data && data.message) || "Không thể xử lý tin nhắn", "error");
  });

  socket.on("SERVER_RETURN_MESSAGE", function (data) {
    var keepAtBottom = data.userId === myId || isNearBottom();
    var msg = {
      userId: data.userId, fullName: data.fullName, avatar: data.avatar,
      content: data.content || "", images: data.images || [], files: data.files || [],
      createdAt: new Date().toISOString()
    };
    appendMessage(msg);
    updateConvPreview(msg);
    refreshSharedInfo();
    if (keepAtBottom) scrollToBottom(); else newMsgPill.hidden = false;
  });

  // ---------------------------------------------------------------
  // F. EMOJI
  // ---------------------------------------------------------------
  var emojiPop = document.getElementById("emoji-pop");
  document.getElementById("btn-emoji").addEventListener("click", function () { emojiPop.hidden = !emojiPop.hidden; });
  document.addEventListener("click", function (e) {
    if (!e.target.closest("#emoji-pop, #btn-emoji")) emojiPop.hidden = true;   // bấm ra ngoài thì đóng
  });
  emojiPop.querySelector("emoji-picker").addEventListener("emoji-click", function (e) {
    input.setRangeText(e.detail.unicode, input.selectionStart, input.selectionEnd, "end");   // chèn tại vị trí con trỏ
    input.focus();
    autosize();
  });

  // ---------------------------------------------------------------
  // G. XEM ẢNH PHÓNG TO (lightbox): bấm ảnh trong tin nhắn hoặc panel thông tin
  // ---------------------------------------------------------------
  function openLightbox(startSrc) {
    var urls = allMessages.reduce(function (list, m) { return list.concat(m.images || []); }, []);
    var index = Math.max(0, urls.indexOf(startSrc));
    var box = el("div", "lightbox");
    var img = el("img");
    var prev = el("button", "icon-btn nav prev"); prev.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    var next = el("button", "icon-btn nav next"); next.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    var close = el("button", "icon-btn close"); close.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    [prev, next, close].forEach(function (b) { b.type = "button"; });
    box.appendChild(img); box.appendChild(prev); box.appendChild(next); box.appendChild(close);
    document.body.appendChild(box);

    function show(i) { index = (i + urls.length) % urls.length; img.src = urls[index]; }
    function closeBox() { box.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) {
      if (e.key === "Escape") closeBox();
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    }
    prev.addEventListener("click", function (e) { e.stopPropagation(); show(index - 1); });
    next.addEventListener("click", function (e) { e.stopPropagation(); show(index + 1); });
    close.addEventListener("click", closeBox);
    box.addEventListener("click", function (e) { if (e.target === box) closeBox(); });
    document.addEventListener("keydown", onKey);
    show(index);
  }
  document.addEventListener("click", function (e) {
    var img = e.target.closest(".msg-images img, .media-grid img");
    if (img) openLightbox(img.getAttribute("src"));
  });

  // ---------------------------------------------------------------
  // H. PANEL THÔNG TIN HỘI THOẠI
  // ---------------------------------------------------------------
  var infoPanel = document.getElementById("info-panel");
  var infoMedia = document.getElementById("info-media");
  var infoFiles = document.getElementById("info-files");

  // Mở/đóng panel, nhớ lựa chọn lần sau. Màn hình rộng mặc định mở.
  var savedInfo = localStorage.getItem("infoOpen");
  chatPage.classList.toggle("info-open", savedInfo === null ? innerWidth >= 1280 : savedInfo === "1");
  document.getElementById("btn-info").addEventListener("click", function () {
    var open = chatPage.classList.toggle("info-open");
    localStorage.setItem("infoOpen", open ? "1" : "0");
  });

  // Tổng hợp ảnh và tài liệu đã gửi từ các tin nhắn đang có
  function refreshSharedInfo() {
    var images = [], files = [];
    allMessages.forEach(function (m) {
      images = images.concat(m.images || []);
      files = files.concat(m.files || []);
    });
    infoMedia.innerHTML = "";
    images.slice(-9).reverse().forEach(function (url) {
      var img = el("img"); img.src = url; img.alt = "Ảnh"; img.loading = "lazy";
      infoMedia.appendChild(img);
    });
    infoFiles.innerHTML = "";
    files.slice(-5).reverse().forEach(function (f) { infoFiles.appendChild(buildFileCard(f)); });
    document.getElementById("info-media-empty").hidden = images.length > 0;
    document.getElementById("info-files-empty").hidden = files.length > 0;
  }
  refreshSharedInfo();

  // Tắt thông báo: hiện mới chỉ lưu lựa chọn trên trình duyệt (chưa có backend)
  var muteButton = document.getElementById("btn-mute");
  var muteKey = "mute:" + room.dataset.roomId;
  function showMuteState() {
    var muted = localStorage.getItem(muteKey) === "1";
    muteButton.querySelector(".icon-btn").classList.toggle("active", muted);
    muteButton.querySelector("i").className = muted ? "fa-solid fa-bell-slash" : "fa-solid fa-bell";
  }
  muteButton.addEventListener("click", function () {
    var muted = localStorage.getItem(muteKey) === "1";
    localStorage.setItem(muteKey, muted ? "0" : "1");
    showMuteState();
    UI.toast(muted ? "Đã bật lại thông báo" : "Đã tắt thông báo cuộc trò chuyện này", "info");
  });
  showMuteState();

  // ---------------------------------------------------------------
  // I. NÚT GỌI THOẠI / VIDEO CALL (logic nằm trong call.js)
  // ---------------------------------------------------------------
  var peer = { id: peerId, name: room.dataset.peerName, avatar: room.dataset.peerAvatar, roomId: room.dataset.roomId };
  document.getElementById("btn-voice-call").addEventListener("click", function () { Call.start(peer, "audio"); });
  document.getElementById("btn-video-call").addEventListener("click", function () { Call.start(peer, "video"); });

  // Từ trang Bạn bè bấm biểu tượng gọi: /chat/:id?call=video → tự bắt đầu cuộc gọi
  var autoCall = new URLSearchParams(location.search).get("call");
  if (!isGroup && (autoCall === "video" || autoCall === "audio")) {
    history.replaceState(null, "", location.pathname);   // xoá ?call=... để F5 không gọi lại
    setTimeout(function () { Call.start(peer, autoCall); }, 400);
  }
})();
