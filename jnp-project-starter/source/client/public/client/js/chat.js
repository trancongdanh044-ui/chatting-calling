import * as Popper from 'https://cdn.jsdelivr.net/npm/@popperjs/core@^2/dist/esm/index.js'

// Display timestamps locally without changing the message API.
const messageTimeFormat = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const messageDateFormat = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric'
});
const messageWeekdayFormat = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' });

function sameMessageDay(first, second) {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function messageTimeLabel(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const clock = messageTimeFormat.format(date);
  if (sameMessageDay(date, today)) return clock;
  if (sameMessageDay(date, yesterday)) return `Hôm qua, ${clock}`;
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  weekStart.setDate(weekStart.getDate() - 6);
  if (date >= weekStart && date < today) {
    return `${messageWeekdayFormat.format(date)}, ${clock}`;
  }
  return `${messageDateFormat.format(date)}, ${clock}`;
}

function decorateMessageTime(message) {
  const rawTime = message.dataset.messageTime;
  if (!rawTime || message.querySelector('.message-time')) return;
  const date = new Date(rawTime);
  if (Number.isNaN(date.getTime())) return;

  const previous = message.previousElementSibling;
  const previousTime = previous?.dataset.messageTime;
  const previousDate = previousTime ? new Date(previousTime) : null;
  if (!previousDate || Number.isNaN(previousDate.getTime())
    || !sameMessageDay(date, previousDate)
    || date - previousDate >= 15 * 60 * 1000) {
    const separator = document.createElement('time');
    separator.className = 'message-time-separator';
    separator.dateTime = date.toISOString();
    separator.textContent = messageTimeLabel(date);
    message.before(separator);
  }

  const time = document.createElement('time');
  time.className = 'message-time';
  time.dateTime = date.toISOString();
  time.textContent = messageTimeFormat.format(date);
  time.title = `${messageDateFormat.format(date)}, ${time.textContent}`;
  time.setAttribute('aria-label', `Gửi lúc ${time.title}`);
  (message.querySelector('.inner-message') || message).appendChild(time);
  message.tabIndex = 0;
  message.addEventListener('click', (event) => {
    if (event.target.closest('a, button, .inner-images')) return;
    message.classList.toggle('show-message-time');
  });
  message.addEventListener('keydown', (event) => {
    if (event.target !== message || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    message.classList.toggle('show-message-time');
  });
}

document.querySelectorAll('.chat .inner-body [data-message-time]').forEach(decorateMessageTime);

// File upload with preview
const upload = new FileUploadWithPreview.FileUploadWithPreview('upload-image', {
  multiple: true,
  maxFileCount: 6
});
// End file upload with preview

// Gửi tin nhắn
const messageForm = document.querySelector(".inner-form");
if (messageForm) {
  const chat = document.querySelector(".chat");
  const myUserId = chat.getAttribute("my-user-id");
  const myUserName = chat.getAttribute("my-user-name");
  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = messageForm.querySelector('input[name="content"]');
    const content = input.value;
    let images = upload.cachedFileArray || [];
    // console.log(content);
    if (content || images.length > 0) {
      socket.emit("CLIENT_SEND_MESSAGE", {
        content,
        images,
        myUserId,
        myUserName
      });
    }
    // upload.emulateInputSelection(); // to open image browser  
    upload.resetPreviewPanel(); // clear all selected images
    input.value = "";
    images = [];
  });
}
// Hết gửi tin nhắn

// SERVER_RETURN_MESSAGE
socket.on("SERVER_RETURN_MESSAGE", (data) => {
  const myUserId = document.querySelector("[my-user-id]").getAttribute("my-user-id");
  const body = document.querySelector(".chat .inner-body");
  const div = document.createElement("div");
  let html = ``;
  let htmlImages = ``

  if (myUserId == data.userId) {
    div.classList.add("inner-outcoming");
  } else {
    div.classList.add("inner-incoming");
    html = `
      <div class="inner-avatar">
        <img src="${data.avatar || "/client/images/avatar.jpg"}">
      </div>
      <div class="inner-message">
        <div class="inner-name">${data.fullName}</div>
      `;
  }

  if (data.content) {
    html += `
      <div class="inner-content">${data.content}</div>
    `;
  }

  if (data.images.length > 0) {
    htmlImages = `<div class="inner-images">`;
    for (const image of data.images) {
      htmlImages += `<img src="${image}" alt="Ảnh" width="250px" height="auto">`
    }
    htmlImages += `</div>`;
  }

  html += htmlImages + `</div>`

  div.innerHTML = html;

  // The current socket payload has no saved timestamp; use receipt time.
  div.dataset.messageTime = data.createdAt || new Date().toISOString();
  body.appendChild(div);
  decorateMessageTime(div);

  body.scrollTop = body.scrollHeight;

  const chatBody = document.querySelector('.inner-body');
  if (chatBody) {
    const gallery = new Viewer(chatBody, {
      filter(image) {
        return image.closest('.inner-images') !== null;
      }
    });
  }

});
// End SERVER_RETURN_MESSAGE

// --- THÊM MỚI: SERVER_RETURN_CALL_LOG (Hiển thị lịch sử cuộc gọi realtime) ---
socket.on("SERVER_RETURN_CALL_LOG", (data) => {
  const chatBox = document.querySelector(".chat");
  const body = document.querySelector(".chat .inner-body");
  if (!chatBox || !body) return;

  const myUserId = chatBox.getAttribute("my-user-id");
  const isOutcoming = String(myUserId) === String(data.userId);
  const { callType = "video", status = "missed", duration = 0 } = data.callInfo || {};

  let title = callType === "audio" ? "Cuộc gọi thoại" : "Cuộc gọi video";
  let subtitle = "Nhấn để gọi lại";
  let statusClass = "call-completed";

  if (status === "missed") {
    title = isOutcoming ? "Người nhận không trả lời" : "Cuộc gọi nhỡ";
    statusClass = "call-missed";
  } else if (status === "rejected") {
    title = "Cuộc gọi bị từ chối";
    statusClass = "call-missed";
  } else if (status === "completed") {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    subtitle = `${mins > 0 ? `${mins} phút ` : ""}${secs} giây`;
  }

  const cardHtml = `
    <div class="inner-call-log ${statusClass}">
      <div class="call-icon">
        <i class="fa-solid ${callType === "audio" ? "fa-phone" : "fa-video"}"></i>
      </div>
      <div class="call-detail">
        <div class="call-title">${title}</div>
        <div class="call-subtitle">${subtitle}</div>
      </div>
      <button class="btn-recall" type="button" data-call-type="${callType}">Gọi lại</button>
    </div>
  `;

  const div = document.createElement("div");
  div.classList.add(isOutcoming ? "inner-outcoming" : "inner-incoming");

  if (isOutcoming) {
    div.innerHTML = cardHtml;
  } else {
    const avatar = data.avatar || chatBox.getAttribute("data-call-avatar") || "/client/images/avatar.jpg";
    const fullName = data.fullName || chatBox.getAttribute("data-call-name") || "";
    div.innerHTML = `
      <div class="inner-avatar">
        <img src="${avatar}" alt="">
      </div>
      <div class="inner-message">
        <div class="inner-name">${fullName}</div>
        ${cardHtml}
      </div>
    `;
  }

  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
});

// Bấm nút "Gọi lại" trên thẻ lịch sử cuộc gọi
document.addEventListener("click", (e) => {
  const btnRecall = e.target.closest(".btn-recall");
  if (!btnRecall) return;

  const callType = btnRecall.getAttribute("data-call-type");
  const selector = callType === "audio"
    ? ".chat .inner-head .box-tool [call]"
    : ".chat .inner-head .box-tool [video-call]";
  const triggerBtn = document.querySelector(selector);
  if (triggerBtn) triggerBtn.click();
});
// --- KẾT THÚC PHẦN THÊM MỚI ---

// emoji-picker
const buttonIcon = document.querySelector('.button-icon')
const tooltip = document.querySelector('.tooltip')
Popper.createPopper(buttonIcon, tooltip)
buttonIcon.onclick = () => {
  tooltip.classList.toggle('shown')
}

const inputMessage = document.querySelector(".inner-foot form input");
if (inputMessage) {
  const emojiPicker = document.querySelector('emoji-picker');
  if (emojiPicker) {
    emojiPicker.addEventListener('emoji-click', (e) => {
      const icon = e.detail.unicode;
      inputMessage.value += icon;
      const end = inputMessage.value.length;
      inputMessage.setSelectionRange(end, end);
      inputMessage.focus();
    });
  }
}
// End emoji-picker

// ViewerJS
const chatBody = document.querySelector('.inner-body');
if (chatBody) {
  const gallery = new Viewer(chatBody, {
    filter(image) {
      return image.closest('.inner-images') !== null;
    }
  });
}
// End ViewerJS

// Chat Info
const infoPanel = document.querySelector('.main-row #info-panel');
const infoToggle = document.querySelector('.chat .inner-head .box-tool [info]');

if (infoPanel && infoToggle) {
  const mainRow = infoPanel.closest('.main-row');
  const messageBody = mainRow.querySelector('.chat .inner-body');
  const mediaGrid = infoPanel.querySelector('#info-media');
  const mediaEmpty = infoPanel.querySelector('#info-media-empty');
  const closeInfo = document.createElement('button');
  closeInfo.type = 'button';
  closeInfo.className = 'info-close';
  closeInfo.setAttribute('aria-label', 'Đóng thông tin cuộc trò chuyện');
  closeInfo.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
  infoPanel.prepend(closeInfo);
  infoPanel.hidden = true;
  infoPanel.setAttribute('aria-label', 'Thông tin cuộc trò chuyện');
  infoToggle.setAttribute('role', 'button');
  infoToggle.setAttribute('tabindex', '0');
  infoToggle.setAttribute('aria-label', 'Thông tin cuộc trò chuyện');
  infoToggle.setAttribute('aria-controls', infoPanel.id);
  infoToggle.setAttribute('aria-expanded', 'false');

  const updateInfoMedia = () => {
    if (!mediaGrid || !messageBody) return;
    const images = [...messageBody.querySelectorAll('.inner-images img')];
    const uniqueImages = images.filter((image, index) =>
      images.findIndex(item => item.src === image.src) === index
    );
    mediaGrid.replaceChildren();
    uniqueImages.forEach((image, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'info-media-item';
      button.setAttribute('aria-label', `Xem ảnh đã gửi ${index + 1}`);
      const thumbnail = document.createElement('img');
      thumbnail.src = image.src;
      thumbnail.alt = image.alt || 'Ảnh đã gửi';
      thumbnail.loading = 'lazy';
      button.append(thumbnail);
      button.addEventListener('click', () => image.click());
      mediaGrid.append(button);
    });
    if (mediaEmpty) mediaEmpty.hidden = uniqueImages.length > 0;
  };

  const setInfoOpen = (open, returnFocus = false) => {
    mainRow.classList.toggle('info-open', open);
    infoPanel.hidden = !open;
    infoToggle.setAttribute('aria-expanded', String(open));
    if (open) {
      updateInfoMedia();
      closeInfo.focus();
    } else if (returnFocus) {
      infoToggle.focus();
    }
  };

  infoToggle.addEventListener('click', () => setInfoOpen(infoPanel.hidden));
  infoToggle.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setInfoOpen(infoPanel.hidden);
    }
  });
  closeInfo.addEventListener('click', () => setInfoOpen(false, true));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !infoPanel.hidden) setInfoOpen(false, true);
  });
  document.addEventListener('click', event => {
    if (!infoPanel.hidden && window.matchMedia('(max-width: 1199px)').matches &&
        !infoPanel.contains(event.target) && !infoToggle.contains(event.target)) {
      setInfoOpen(false);
    }
  });

  if (messageBody) {
    new MutationObserver(() => {
      if (!infoPanel.hidden) updateInfoMedia();
    }).observe(messageBody, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  }
}
// End Chat Info

// Group member list
const memberSection = document.querySelector('#info-panel .info-members');
if (memberSection) {
  const toggle = memberSection.querySelector('.info-members-toggle');
  const content = memberSection.querySelector('#info-members-content');
  const search = memberSection.querySelector('#info-member-search');
  const members = [...memberSection.querySelectorAll('.info-member')];
  const empty = memberSection.querySelector('#info-members-empty');
  toggle.setAttribute('aria-expanded', 'false');
  content.hidden = true;

  const normalizeName = value => value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(expanded));
    content.hidden = !expanded;
  });

  search.addEventListener('input', () => {
    const keyword = normalizeName(search.value);
    let visibleCount = 0;
    members.forEach(member => {
      const matches = normalizeName(member.dataset.memberName).includes(keyword);
      member.hidden = !matches;
      if (matches) visibleCount++;
    });
    empty.hidden = visibleCount > 0;
  });
}


// Rời khỏi nhóm && Giải tán nhóm
const formDataGroup = document.querySelector("[form-data-group]");
if(formDataGroup){
  formDataGroup.addEventListener('submit', (e) =>{
    e.preventDefault();
    const dataGroupAction = formDataGroup.getAttribute("data-group-action");
    const dataRoomId = formDataGroup.getAttribute("data-room-id");
    let action = "";
    if(dataGroupAction === "leave") {
      action = `/group/leave/${dataRoomId}?_method=PATCH`;
    }else if(dataGroupAction === "disband"){
      action = `/group/disband/${dataRoomId}?_method=PATCH`;
    }
    formDataGroup.action = action;
    formDataGroup.submit();
  });
}
// Hết rời khỏi nhóm && giải tán nhóm

// // SERVER RETURN LENGTH OF INVITATION
// socket.on("SERVER_RETURN_LENGTH_INVITATION", (data) =>{
//   const myUserHeader = document.querySelector("[my-user-id]");
//   if(myUserHeader){
//     const myUserId = myUserHeader.getAttribute("my-user-id");
//     const userId = data.userId;
//     if(myUserId === userId){
//       const badge = myUserHeader.querySelector(".badge-danger");
//       if(data.lengthOfInvitation > 0){
//         badge.innerHTML = data.lengthOfInvitation;
//       }else{
//         badge.style.display = "none"; 
//       }
//     }
//   }
// });
// // END SERVER RETURN LENGTH OF INVITATION