import * as Popper from 'https://cdn.jsdelivr.net/npm/@popperjs/core@^2/dist/esm/index.js'

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

  body.appendChild(div);

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