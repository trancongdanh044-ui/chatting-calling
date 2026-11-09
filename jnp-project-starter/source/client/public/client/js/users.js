// Cập nhật trạng thái người dùng
socket.on("CLIENT_CHANGE_STATUS", (data) => {
  console.log(data);
  const myFriendBoxList = document.querySelectorAll("[my-friend-id]");
  myFriendBoxList.forEach((box) => {
    const myFriendId = box.getAttribute("my-friend-id");
    if (myFriendId == data.userId) {
      const boxStatusOnline = box.querySelector("[status-online]");
      boxStatusOnline.setAttribute("status-online", data.statusOnline);
      const userStatusBox = box.querySelector("[user-status-box]");
      if (userStatusBox) {
        const span = userStatusBox.querySelector("span");
        if (data.statusOnline === "offline") {
          span.textContent = data.friendLastOnline;
        } else {
          span.textContent = "Đang hoạt động"
        }
      }
    }
  });
});

// Hết cập nhật trạng thái người dùng

// Tìm kiếm phòng chat
const searchSiderInput = document.querySelector("[search-sider]");
if (searchSiderInput) {
  let url = new URL(window.location.href);
  searchSiderInput.value = url.searchParams.get("keyword") || "";
  searchSiderInput.addEventListener("change", () => {
    const keyword = searchSiderInput.value;
    if (keyword) {
      url.searchParams.set("keyword", keyword);
    } else {
      url.searchParams.delete("keyword");
    }
    console.log(url);
    window.location.href = url;
  });
}
// Hết tìm kiếm phòng chat

// Lọc phòng chat
const filters = document.querySelectorAll("[filter]");
if(filters.length > 0){
  let url = new URL(window.location.href);
  const currentTypeRoom = url.searchParams.get("typeRoom") || "all";
  filters.forEach((filter) =>{
    const value = filter.getAttribute("filter");
    if(value === currentTypeRoom){
      filter.classList.add("active");
    }
    else{
      filter.classList.remove("active");
    }

    filter.addEventListener("click", () =>{
      filters.forEach((filter) => {
        filter.classList.remove("active");
      });

      filter.classList.add("active");

      if(value !== "all"){
        url.searchParams.set("typeRoom", value);
      }
      else{
        url.searchParams.delete("typeRoom");
      }

      window.location.href = url;
    });
  });
}
// Hết lọc phòng chat