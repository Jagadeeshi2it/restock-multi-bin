/* Boot. Load order matters: data -> store -> actions -> view -> render. */
(function (RM) {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    RM.mount(document.getElementById('app'));
  });
})(window.RM = window.RM || {});
