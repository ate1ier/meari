/* 이전에 로그인한 적이 있으면 첫 화면 깜빡임을 줄이려고 다크 테마를 먼저 적용해요(CSP 때문에 인라인이 아닌 별도 파일) */
(function () {
  try {
    if (JSON.parse(localStorage.getItem('meari-user') || sessionStorage.getItem('meari-user'))) {
      var r = document.documentElement;
      r.dataset.theme = 'dark';
      r.classList.add('resume');
    }
  } catch (e) {}
})();
