document.addEventListener("DOMContentLoaded", () => {
  const avatarInput = document.querySelector("#avatar");
  const coverInput = document.querySelector("#cover");
  const avatarPreview = document.querySelector("[data-avatar-preview]");
  const coverPreview = document.querySelector("[data-cover-preview]");

  let avatarObjectUrl = null;
  let coverObjectUrl = null;

  avatarInput?.addEventListener("change", () => {
    const file = avatarInput.files?.[0];
    if (!file || !file.type.startsWith("image/") || !avatarPreview) return;

    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
    avatarObjectUrl = URL.createObjectURL(file);
    avatarPreview.src = avatarObjectUrl;
  });

  coverInput?.addEventListener("change", () => {
    const file = coverInput.files?.[0];
    if (!file || !file.type.startsWith("image/") || !coverPreview) return;

    if (coverObjectUrl) URL.revokeObjectURL(coverObjectUrl);
    coverObjectUrl = URL.createObjectURL(file);
    coverPreview.src = coverObjectUrl;
  });

  window.addEventListener("pagehide", () => {
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
    if (coverObjectUrl) URL.revokeObjectURL(coverObjectUrl);
  });
});
