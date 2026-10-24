// ---------------------------------------------------------------------------
// overview-modal.js — opens/closes the "Project Overview" modal.
// Uses the native <dialog> element, so Esc-to-close, focus trapping and
// restoring focus to the trigger button are handled by the browser.
// Independent of app.js: no changes to it are needed.
// ---------------------------------------------------------------------------
(function () {
  const dialog = document.getElementById("overviewModal");
  if (!dialog || typeof dialog.showModal !== "function") return;

  const body = dialog.querySelector(".ov-body");

  function openModal() {
    if (!dialog.open) dialog.showModal();
    if (body) body.scrollTop = 0;
    document.documentElement.style.overflow = "hidden"; // lock page scroll behind the modal
  }

  function closeModal() {
    if (dialog.open) dialog.close();
  }

  // Any element with class "js-open-overview" opens the modal.
  document.querySelectorAll(".js-open-overview").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openModal();
    });
  });

  dialog.querySelector(".ov-close").addEventListener("click", closeModal);

  // Clicking the dark backdrop (the dialog element itself, outside its content) closes it.
  dialog.addEventListener("click", (e) => {
    const r = dialog.getBoundingClientRect();
    const outside =
      e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside) closeModal();
  });

  // Fires for Esc, the close button, and backdrop clicks alike.
  dialog.addEventListener("close", () => {
    document.documentElement.style.overflow = "";
  });

  // In-modal section links scroll the modal body rather than the page.
  dialog.querySelectorAll(".ov-nav a").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const target = dialog.querySelector(a.getAttribute("href"));
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
})();