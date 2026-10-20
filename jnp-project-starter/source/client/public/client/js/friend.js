// Tính năng thêm bạn bè (gửi yêu cầu kết bạn)
const btnAddFriend = document.querySelectorAll("[btn-add-friend]");
if (btnAddFriend.length > 0) {
  btnAddFriend.forEach((button) => {
    button.addEventListener('click', () => {
      const hintUser = document.querySelector("[data-hint-user]");
      const reqUserBox = button.closest(".col-6");
      const reqUserId = reqUserBox.getAttribute("user-hint-id")
      // console.log(reqUserId);
      reqUserBox.querySelector(".box-users").classList.add("add");
      socket.emit("CLIENT_ADD_FRIEND", {
        reqUserId
      });
    });
  });
}
// Hết tính năng thêm bạn bè

// SERVER_RETURN_ADD_FRIEND
socket.on("SERVER_RETURN_ADD_FRIEND", (data) => {
  const inviteFriend = document.querySelector(".invite-friend");
  if (inviteFriend) {
    const myUserId = inviteFriend.getAttribute("data-invitation-friend");
    const user = data.user;
    if (myUserId == data.myUserId) {
      const invitation = inviteFriend.querySelector("[invitation]");
      // console.log(invitation);
      const existBoxUser = invitation.querySelector(`[user-invite-id="${user._id}"]`);
      // console.log(existBoxUser);
      if (!existBoxUser) {
        const div = document.createElement("div");
        let html = `
        <div class="box-users">
          <div class="inner-avatar">
            <img src="${user.avatar || "/client/images/avatar.jpg"}" alt="${user.fullName}">
          </div>
          <div class="inner-info">
            <div class="inner-name">${user.fullName}</div>
            <div class="inner-buttons">
              <button class="btn btn-sm btn-primary mr-1" btn-accept-friend>Chấp nhận</button>
              <button class="btn btn-sm btn-secondary mr-1" btn-refuse-friend>Từ chối</button>
            </div>  
          </div>
        </div>
      `;
        div.classList.add("col-6");
        div.setAttribute("user-invite-id", user._id);
        div.innerHTML = html;
        invitation.appendChild(div);
      }

      // Tính năng từ chối kết bạn
      const btnRefuseFriend = document.querySelectorAll("[btn-refuse-friend]");
      if (btnRefuseFriend.length > 0) {
        btnRefuseFriend.forEach((button) => {
          button.addEventListener('click', () => {
            const boxUserRemove = button.closest(".col-6");
            const userId = boxUserRemove.getAttribute("user-invite-id");
            // console.log(userId);
            socket.emit("CLIENT_REFUSE_FRIEND", {
              userId
            });
            const row = button.closest(".row");
            row.removeChild(boxUserRemove);
          });
        });
      }
      // Hết tính năng từ chối kết bạn
    }
  }
});
// End SERVER_RETURN_ADD_FRIEND

// Gỡ gợi ý khỏi trang gợi ý bạn bè
const btnRemoveHint = document.querySelectorAll("[btn-remove-friend]");
if (btnRemoveHint.length > 0) {
  btnRemoveHint.forEach((button) => {
    button.addEventListener('click', () => {
      const boxUserRemove = button.closest(".col-6");
      const row = button.closest(".row");
      row.removeChild(boxUserRemove);
    });
  });
}
// Hết gỡ gợi ý khỏi trang gợi ý bạn bè

// Tính năng từ chối kết bạn
const btnRefuseFriend = document.querySelectorAll("[btn-refuse-friend]");
if (btnRefuseFriend.length > 0) {
  btnRefuseFriend.forEach((button) => {
    button.addEventListener('click', () => {
      const boxUserRemove = button.closest(".col-6");
      const userId = boxUserRemove.getAttribute("user-invite-id");
      // console.log(userId);
      socket.emit("CLIENT_REFUSE_FRIEND", {
        userId
      });
      const row = button.closest(".row");
      row.removeChild(boxUserRemove);
    });
  });
}
// Hết tính năng từ chối kết bạn

// Tính năng huỷ yêu cầu kết bạn
const btnCancelFriend = document.querySelectorAll("[btn-cancel-friend]");
if (btnCancelFriend.length > 0) {
  btnCancelFriend.forEach((button) => {
    button.addEventListener('click', () => {
      const boxUser = button.closest(".col-6");
      // console.log(boxUser);
      const userId = boxUser.getAttribute("user-hint-id");
      // console.log(userId);
      boxUser.querySelector(".box-users").classList.remove("add");
      // console.log(boxUser);
      socket.emit("CLIENT_CANCEL_REQUEST", {
        userId
      });
    });
  });
}
// Hết tính năng huỷ yêu cầu kết bạn

// Tính năng thu hồi yêu cầu kết bạn
const btnRevokeFriend = document.querySelectorAll("[btn-revoke-friend]");
if (btnRevokeFriend.length > 0) {
  btnRevokeFriend.forEach((button) => {
    button.addEventListener('click', () => {
      const boxUser = button.closest(".col-6");
      // console.log(boxUser);
      const userId = boxUser.getAttribute("req-user-id");
      // console.log(userId);
      socket.emit("CLIENT_REVOKE_REQUEST", {
        userId
      });
      const request = document.querySelector("[request]");
      request.removeChild(boxUser);
    });
  });
}
// Hết tính năng huỷ yêu cầu kết bạn

// SERVER_RETURN_REFUSE_USER
socket.on("SERVER_RETURN_REFUSE_USER", (data) => {
  const hintFriend = document.querySelector(".hint-friend");
  const myUserId = hintFriend.getAttribute("data-hint-user");
  const user = data.user;
  if (myUserId == data.myUserId) {
    const div = document.createElement("div");
    const hint = hintFriend.querySelector("[hint]");
    const existBoxUser = hint.querySelector(`[user-hint-id="${user._id}"]`);
    if(existBoxUser){
      hint.removeChild(existBoxUser);
    }
    let html = `<div class="box-users">
          <div class="inner-avatar">
            <img src="${user.avatar || "/client/images/avatar.jpg"}" alt="${user.fullName}">
          </div>
          <div class="inner-info">
            <div class="inner-name">${user.fullName}</div>
            <div class="inner-buttons">
              <button class="btn btn-sm btn-primary mr-1" btn-add-friend>Thêm bạn bè</button>
              <button class="btn btn-sm btn-secondary mr-1" btn-remove-friend>Gỡ</button>
              <button class="btn btn-sm btn-secondary mr-1" btn-cancel-friend>Huỷ</button>
            </div>  
          </div>
        </div>
      `;
    div.classList.add("col-6");
    div.setAttribute("user-hint-id", user._id);
    div.innerHTML = html;
    hint.appendChild(div);

    // Tính năng thêm bạn bè (gửi yêu cầu kết bạn)
    const btnAddFriend = document.querySelectorAll("[btn-add-friend]");
    if (btnAddFriend.length > 0) {
      btnAddFriend.forEach((button) => {
        button.addEventListener('click', () => {
          const hintUser = document.querySelector("[data-hint-user]");
          const reqUserBox = button.closest(".col-6");
          const reqUserId = reqUserBox.getAttribute("user-hint-id")
          // console.log(reqUserId);
          reqUserBox.querySelector(".box-users").classList.add("add");
          socket.emit("CLIENT_ADD_FRIEND", {
            reqUserId
          });
        });
      });
    }
    // Hết tính năng thêm bạn bè

    // Tính năng huỷ yêu cầu kết bạn
    const btnCancelFriend = document.querySelectorAll("[btn-cancel-friend]");
    if (btnCancelFriend.length > 0) {
      btnCancelFriend.forEach((button) => {
        button.addEventListener('click', () => {
          const boxUser = button.closest(".col-6");
          // console.log(boxUser);
          const userId = boxUser.getAttribute("user-hint-id");
          // console.log(userId);
          boxUser.querySelector(".box-users").classList.remove("add");
          // console.log(boxUser);
          socket.emit("CLIENT_CANCEL_REQUEST", {
            userId
          });
        });
      });
    }
    // Hết tính năng huỷ yêu cầu kết bạn
  }
});
// End SERVER_RETURN_REFUSE_USER

// SERVER_RETURN_CANCEL_USER 
socket.on("SERVER_RETURN_CANCEL_USER", (data) => {
  const inviteFriend = document.querySelector(".invite-friend");
  const myUserId = inviteFriend.getAttribute("data-invitation-friend");
  const userId = data.userId;
  if (myUserId == data.myUserId) {
    const invitation = inviteFriend.querySelector("[invitation]");
    const boxUserRemove = invitation.querySelector(`[user-invite-id="${userId}"]`);
    if (boxUserRemove) {
      invitation.removeChild(boxUserRemove);
    }
  }
});
// End SERVER_RETURN_CANCEL_USER

// SERVER_RETURN_REVOKE_USER
socket.on("SERVER_RETURN_REVOKE_USER", (data) => {
  const inviteFriend = document.querySelector(".invite-friend");
  const requestFriend = document.querySelector(".request-friend");
  const myUserId = inviteFriend.getAttribute("data-invitation-friend");
  const userId = data.userId;
  if (myUserId == data.myUserId) {
    const invitation = inviteFriend.querySelector("[invitation]");
    if(invitation){
      const boxUserRemove = invitation.querySelector(`[user-invite-id="${userId}"]`);
      if (boxUserRemove) {
        invitation.removeChild(boxUserRemove);
      }
    }
    
    const request = requestFriend.querySelector("[request]");
    if(request){
      const boxUserRemove = request.querySelector(`[req-user-id="${userId}"]`);
      if (boxUserRemove) {
        request.removeChild(boxUserRemove);
      }
    }
  }

});
// End SERVER_RETURN_REVOKE_USER

// Tính năng chấp nhận kết bạn
const btnAcceptFriend = document.querySelectorAll("[btn-accept-friend]");
if(btnAcceptFriend.length > 0){
  btnAcceptFriend.forEach((button) => {
    button.addEventListener('click', () =>{
      const boxUser = button.closest(".col-6");
      const userId = boxUser.getAttribute("user-invite-id");
      boxUser.querySelector(".box-users").classList.add("accepted");
      socket.emit("CLIENT_ACCEPT_FRIEND", {userId});
    });
  })
}
// Hết tính năng chấp nhận kết bạn

// SERVER_RETURN_LENGTH_INVITATION
socket.on("SERVER_RETURN_LENGTH_INVITATION", (data) => {
  console.log(data);
  const badgeInvitation = document.querySelector("[badge-invitation]");
  const myUserId = badgeInvitation.getAttribute("badge-invitation");
  const userId = data.userId;
  if(myUserId == userId){
    badgeInvitation.innerHTML = data.lengthOfInvitation;
  }
});
// END SERVER_RETURN_LENGTH_INVITATION