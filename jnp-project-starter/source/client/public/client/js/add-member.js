(() => {
  const form = document.getElementById('formAddMember');
  const search = document.getElementById('member-search');
  const rows = Array.from(form.querySelectorAll('[data-member-search]'));
  const checkboxes = Array.from(form.querySelectorAll('input[name="members"]'));
  const submit = document.getElementById('add-member-submit');
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

  search.addEventListener('input', () => {
    const keyword = normalize(search.value);
    rows.forEach(row => { row.hidden = !normalize(row.dataset.memberSearch).includes(keyword); });
    document.getElementById('member-search-empty').hidden = rows.length === 0 || rows.some(row => !row.hidden);
  });

  const updateSelection = () => {
    const count = checkboxes.filter(input => input.checked).length;
    document.getElementById('member-count').textContent = `Đã chọn: ${count}`;
    submit.disabled = count === 0 || !form.querySelector('input[name="roomChatId"]');
  };
  form.addEventListener('change', updateSelection);
  form.addEventListener('submit', event => {
    updateSelection();
    if (submit.disabled) event.preventDefault();
  });
  updateSelection();
})();
