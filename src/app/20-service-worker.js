/* =========================================================
   SERVICE WORKER
========================================================= */

if ("serviceWorker" in navigator) {

  window.addEventListener(
    "load",
    function () {

      navigator.serviceWorker
        .register(
          "./sw.js",
          {
            scope: "./",
            updateViaCache: "none"
          }
        )
        .then(
          function (registration) {

            if (
              registration.waiting
            ) {

              registration.waiting.postMessage({
                type:
                  "SKIP_WAITING"
              });

            }

          }
        )
        .catch(
          function () {}
        );

    }
  );

}

/* =========================================================
   ALMACENAMIENTO PERSISTENTE
========================================================= */

if (
  navigator.storage &&
  navigator.storage.persist
) {

  navigator.storage
    .persist()
    .catch(
      function () {}
    );

}

