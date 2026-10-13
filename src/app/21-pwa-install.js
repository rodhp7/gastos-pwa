/* =========================================================
   INSTALACIÓN PWA
========================================================= */

var deferredPrompt = null;

var isIos =
  /iphone|ipad|ipod/
    .test(
      window.navigator.userAgent
        .toLowerCase()
    );

var isStandalone =
  window.matchMedia(
    "(display-mode: standalone)"
  ).matches ||
  window.navigator.standalone === true;

window.addEventListener(
  "beforeinstallprompt",
  function (e) {

    e.preventDefault();

    deferredPrompt = e;

    if (!isStandalone) {

      document
        .getElementById(
          "install-banner"
        )
        .style.display =
        "flex";

    }

  }
);

if (
  isIos &&
  !isStandalone
) {

  document
    .getElementById(
      "install-text"
    )
    .textContent =
    'Toca Compartir y luego "Agregar a Inicio" para instalar esta app.';

  document
    .getElementById(
      "install-btn"
    )
    .style.display =
    "none";

  document
    .getElementById(
      "install-banner"
    )
    .style.display =
    "flex";

}

document
  .getElementById(
    "install-btn"
  )
  .addEventListener(
    "click",
    function () {

      if (!deferredPrompt) {
        return;
      }

      deferredPrompt
        .prompt();

      deferredPrompt
        .userChoice
        .then(
          function () {

            deferredPrompt =
              null;

            document
              .getElementById(
                "install-banner"
              )
              .style.display =
              "none";

          }
        );

    }
  );

