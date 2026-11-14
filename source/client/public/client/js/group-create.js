// =====================================================================
// group-create.js – TRANG TẠO NHÓM
// Chọn bạn bè bằng checkbox → hiện thành "chip" phía trên, đếm số người,
// chỉ cho bấm "Tạo nhóm" khi có tên nhóm và ít nhất 2 thành viên.
// =====================================================================
(function () {
  var form = document.getElementById("group-form");
  if (!form) return;

  var MIN_MEMBERS = 2;                                // backend yêu cầu nhóm từ 3 người (mình + 2 bạn)
  var nameInput = document.getElementById("groupName");
  var picked = document.getElementById("picked");
  var pickedHint = document.getElementById("picked-hint");
  var countText = document.getElementById("pick-count");
  var errorText = document.getElementById("group-error");
  var submit = document.getElementById("group-submit");
  var checkboxes = form.querySelectorAll('input[name="members"]');

  // Vẽ lại danh sách chip và cập nhật trạng thái nút Tạo nhóm
  function refresh() {
    var selected = Array.prototype.filter.call(checkboxes, function (box) { return box.checked; });

    picked.innerHTML = "";
    selected.forEach(function (box) {
      var chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = box.closest(".pick-item").dataset.name + " ";
      var remove = document.createElement("button");
      remove.type = "button";
      remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      remove.setAttribute("aria-label", "Bỏ chọn");
      remove.addEventListener("click", function () { box.checked = false; refresh(); });
      chip.appendChild(remove);
      picked.appendChild(chip);
    });
    if (selected.length === 0) picked.appendChild(pickedHint);

    countText.textContent = selected.length;
    submit.disabled = !(nameInput.value.trim() && selected.length >= MIN_MEMBERS);
  }

  checkboxes.forEach(function (box) { box.addEventListener("change", refresh); });
  nameInput.addEventListener("input", refresh);
  refresh();
})();
