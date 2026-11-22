const viewPasswordCheckbox = document.querySelector("#view-password");
const passwordInput = document.querySelector("#password");

if (viewPasswordCheckbox && passwordInput) {
  const updatePasswordVisibility = () => {
    passwordInput.type = viewPasswordCheckbox.checked ? "text" : "password";
  };

  viewPasswordCheckbox.addEventListener("change", updatePasswordVisibility);
  updatePasswordVisibility();
}

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

function normalizeListSearch(value) {
  return value.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

function initListSearch({ inputSelector, listSelector, itemSelector, nameSelector, placeholder, sortSelector }) {
  const input = document.querySelector(inputSelector);
  const list = document.querySelector(listSelector);
  if (!input || !list) return;

  if (placeholder) input.placeholder = placeholder;
  input.setAttribute("aria-label", input.placeholder);

  const empty = document.createElement("p");
  empty.className = "text-muted mt-2";
  empty.setAttribute("role", "status");
  empty.textContent = "Không tìm thấy kết quả phù hợp.";
  list.after(empty);

  const getName = item => item.querySelector(nameSelector)?.textContent.trim() || "";

  function filterList() {
    const keyword = normalizeListSearch(input.value);
    let hasMatch = false;
    list.querySelectorAll(itemSelector).forEach(item => {
      const matches = normalizeListSearch(getName(item)).includes(keyword);
      item.classList.toggle("d-none", !matches);
      hasMatch ||= matches;
    });
    empty.hidden = !keyword || hasMatch;
  }

  input.addEventListener("input", filterList);
  input.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    filterList();
  });
  input.parentElement.querySelector("button")?.addEventListener("click", filterList);

  if (sortSelector) {
    const sortControls = document.querySelector(sortSelector);
    const select = sortControls?.querySelector("select");
    const button = sortControls?.querySelector("[filter-btn]");
    if (select && button) {
      const collator = new Intl.Collator("vi", { sensitivity: "base" });
      button.addEventListener("click", () => {
        const direction = select.value.endsWith(" desc") ? -1 : 1;
        const items = [...list.querySelectorAll(itemSelector)];
        items.sort((first, second) => direction * collator.compare(getName(first), getName(second)));
        list.append(...items);
      });
    }
  }

  new MutationObserver(filterList).observe(list, { childList: true });
  filterList();
}

initListSearch({
  inputSelector: '.friend-search input[name="friend-search"]',
  listSelector: ".row[data-users-friends], .row[hint], .row[request], .row[invitation]",
  itemSelector: ":scope > .col-6",
  nameSelector: ".inner-name",
  sortSelector: ".friend-filter"
});

initListSearch({
  inputSelector: ".group #group",
  listSelector: ".group .inner-body > .row",
  itemSelector: ":scope > .col-6",
  nameSelector: ".box-groupname"
});

initListSearch({
  inputSelector: ".group-create #group-search",
  listSelector: ".group-create .group-friends",
  itemSelector: ":scope > .group-friend",
  nameSelector: ".friend-name",
  placeholder: "Tìm bạn bè theo tên..."
});
