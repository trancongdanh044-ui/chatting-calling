// Thông tin cuộc trò chuyện (dấu i)
const buttonInfo = document.querySelector(".chat .inner-head [info]");
const infoPanel = document.querySelector(".chat .chat-info-panel");
const innerHead = document.querySelector(".chat .inner-head");
const chatBox = document.querySelector(".chat");

if (buttonInfo && infoPanel && innerHead && chatBox) {
  const roomChatId = infoPanel.getAttribute("data-room-id");
  const myUserId = chatBox.getAttribute("my-user-id");

  // Panel nằm dưới header để vẫn bấm lại được dấu i
  infoPanel.style.top = innerHead.offsetHeight + "px";

  // Bật/tắt panel
  buttonInfo.addEventListener("click", () => {
    infoPanel.classList.toggle("show");
  });

  // Mở lại panel nếu trang vừa tải lại do cập nhật thông tin
  if (sessionStorage.getItem("infoOpen")) {
    sessionStorage.removeItem("infoOpen");
    infoPanel.classList.add("show");
  }

  // Mở/đóng từng mục
  infoPanel.querySelectorAll(".info-section-title").forEach(title => {
    title.addEventListener("click", () => {
      title.parentElement.classList.toggle("open");
    });
  });

  // Đổi chủ đề
  const applyTheme = (color) => {
    if (color) {
      chatBox.setAttribute("data-theme", "on");
      chatBox.style.setProperty("--chat-theme", color);
    } else {
      chatBox.removeAttribute("data-theme");
      chatBox.style.removeProperty("--chat-theme");
    }
    infoPanel.querySelectorAll(".theme-dot").forEach(dot => {
      dot.classList.toggle("active", dot.getAttribute("data-color") === (color || ""));
    });
  };
  applyTheme(infoPanel.getAttribute("data-theme"));

  infoPanel.querySelectorAll(".theme-dot").forEach(dot => {
    dot.addEventListener("click", () => {
      socket.emit("CLIENT_ROOM_THEME", { roomChatId: roomChatId, theme: dot.getAttribute("data-color") });
    });
  });

  // Tìm tin nhắn trong đoạn chat
  const searchButton = infoPanel.querySelector("[info-search-btn]");
  const searchBox = infoPanel.querySelector(".info-search");
  const searchInput = searchBox.querySelector("input");

  const filterMessages = (keyword) => {
    keyword = keyword.trim().toLowerCase();
    document.querySelectorAll(".chat .inner-body .inner-incoming, .chat .inner-body .inner-outcoming").forEach(message => {
      const match = message.textContent.toLowerCase().includes(keyword);
      message.style.display = (keyword && !match) ? "none" : "";
    });
  };

  searchButton.addEventListener("click", () => {
    searchBox.classList.toggle("show");
    if (searchBox.classList.contains("show")) {
      searchInput.focus();
    } else {
      searchInput.value = "";
      filterMessages("");
    }
  });
  searchInput.addEventListener("input", () => filterMessages(searchInput.value));

  // Đổi tên nhóm
  const buttonRename = infoPanel.querySelector("[info-rename]");
  if (buttonRename) {
    buttonRename.addEventListener("click", () => {
      const currentName = chatBox.querySelector(".user-name").textContent.trim();
      const title = prompt("Nhập tên mới cho đoạn chat:", currentName);
      if (title && title.trim()) {
        socket.emit("CLIENT_ROOM_RENAME", { roomChatId: roomChatId, title: title.trim() });
      }
    });
  }

  // Đổi ảnh nhóm
  const buttonAvatar = infoPanel.querySelector("[info-change-avatar]");
  const inputAvatar = infoPanel.querySelector("[info-avatar-input]");
  if (buttonAvatar && inputAvatar) {
    buttonAvatar.addEventListener("click", () => inputAvatar.click());
    inputAvatar.addEventListener("change", async () => {
      const file = inputAvatar.files[0];
      inputAvatar.value = "";
      if (!file) {
        return;
      }
      if (file.size > 1024 * 1024) {
        alert("Ảnh tối đa 1MB");
        return;
      }
      socket.emit("CLIENT_ROOM_AVATAR", { roomChatId: roomChatId, file: await file.arrayBuffer() });
    });
  }

  // Xóa thành viên (trưởng nhóm)
  infoPanel.querySelectorAll(".member-remove").forEach(button => {
    button.addEventListener("click", () => {
      if (confirm("Xóa thành viên này khỏi nhóm?")) {
        socket.emit("CLIENT_ROOM_REMOVE_MEMBER", { roomChatId: roomChatId, userId: button.getAttribute("data-user-id") });
      }
    });
  });

  // Rời nhóm
  const buttonLeave = infoPanel.querySelector("[info-leave-group]");
  if (buttonLeave) {
    buttonLeave.addEventListener("click", () => {
      if (confirm("Bạn có chắc muốn rời khỏi nhóm?")) {
        socket.emit("CLIENT_ROOM_LEAVE", { roomChatId: roomChatId });
      }
    });
  }

  // Server báo đoạn chat có thay đổi
  socket.on("SERVER_ROOM_UPDATED", (data) => {
    if (data.roomChatId !== roomChatId) {
      return;
    }
    if (data.removedUserId === myUserId) {
      // Mình bị xóa / vừa rời nhóm
      window.location.href = "/chat";
      return;
    }
    if (data.theme !== undefined) {
      applyTheme(data.theme);
      return;
    }
    sessionStorage.setItem("infoOpen", "1");
    window.location.reload();
  });

  socket.on("SERVER_ROOM_ERROR", (data) => {
    alert(data.message);
  });
}
