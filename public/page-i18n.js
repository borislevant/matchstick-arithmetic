(() => {
  const storageKey = 'matchstick-language';
  const languageSelect = document.querySelector('[data-page-language]');
  const copyElement = document.getElementById('page-copy');
  const pageCopy = copyElement ? JSON.parse(copyElement.textContent || '{}') : {};

  function storedLanguage() {
    try { return localStorage.getItem(storageKey) === 'he' ? 'he' : 'ru'; }
    catch { return 'ru'; }
  }

  function applyLanguage(language) {
    const nextLanguage = language === 'he' ? 'he' : 'ru';
    const copy = pageCopy[nextLanguage] || pageCopy.ru || {};
    document.documentElement.lang = nextLanguage;
    document.documentElement.dir = nextLanguage === 'he' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-language]').forEach((section) => {
      section.hidden = section.getAttribute('data-language') !== nextLanguage;
    });
    document.querySelectorAll('[data-copy]').forEach((element) => {
      const key = element.getAttribute('data-copy');
      if (key && typeof copy[key] === 'string') element.textContent = copy[key];
    });
    document.querySelectorAll('[data-copy-aria-label]').forEach((element) => {
      const key = element.getAttribute('data-copy-aria-label');
      if (key && typeof copy[key] === 'string') element.setAttribute('aria-label', copy[key]);
    });
    const activePage = document.querySelector(`[data-language="${nextLanguage}"]`);
    if (activePage) {
      document.title = `${activePage.getAttribute('data-title')} — ${copy.appName || ''}`;
      const description = document.querySelector('meta[name="description"]');
      if (description) description.setAttribute('content', activePage.getAttribute('data-description') || '');
    }
    if (languageSelect) languageSelect.value = nextLanguage;
    try { localStorage.setItem(storageKey, nextLanguage); }
    catch { /* The page remains usable when storage is unavailable. */ }
  }

  languageSelect?.addEventListener('change', (event) => applyLanguage(event.target.value));
  window.addEventListener('storage', () => applyLanguage(storedLanguage()));
  applyLanguage(storedLanguage());
})();
