// Gửi tin nhắn
const messageForm = document.querySelector(".inner-form");
if (messageForm) {
  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = messageForm.querySelector('input[name="content"]');
    const content = input.value;
    // console.log(content);
    if(content){
      socket.emit("CLIENT_SEND_MESSAGE", content);
    }
    input.value = "";
  });
}
// Hết gửi tin nhắns

// SERVER_RETURN_MESSAGE
socket.on("SERVER_RETURN_MESSAGE", (data) => {
  const myUserId = document.querySelector("[my-user-id]").getAttribute("my-user-id");
  const body = document.querySelector(".chat .inner-body");
  const div = document.createElement("div");
  let htmlFullName = "";
  let htmlContent = "";
  let htmlImages = "";

  if (myUserId == data.userId) {
    div.classList.add("inner-outcoming");
  } else {
    div.classList.add("inner-incoming");
    htmlFullName = `<div class="inner-name"> ${data.fullName}</div>`
  }

  if (data.content) {
    htmlContent = `<div class="inner-content">${data.content}</div>`
  }

  if (data.images.length > 0) {
    htmlImages += `<div class="inner-images">`;
    for (const image of data.images) {
      htmlImages += `<img src="${image}">`
    }
    htmlImages += `</div>`
  }

  div.innerHTML = `
    ${htmlFullName}
    ${htmlContent}
    ${htmlImages}
  `;

  body.appendChild(div);

  body.scrollTop = body.scrollHeight;

});

// End SERVER_RETURN_MESSAGE