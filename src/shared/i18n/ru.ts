export const appCopy = {
  productName: "Markdown Reader",
  a11y: { primaryNavigation: "Основная навигация", readerToolbar: "Панель чтения", skipToDocument: "Перейти к тексту документа", skipToMain: "Перейти к основному содержимому", theme: "Выбрать тему" },
  navigation: { backToLibrary: "К библиотеке", library: "Библиотека", toLibrary: "Открыть библиотеку" },
  library: {
    eyebrow: "Локальная библиотека", title: "Библиотека", localOnly: "Документы хранятся только в этом браузере.", placeholderLabel: "Состояние библиотеки",
    emptyTitle: "Пока нет документов", emptyDescription: "Добавьте Markdown-файл, чтобы читать его локально.", import: "Добавить Markdown-файл", loading: "Загружаем библиотеку…",
    unavailable: "Библиотека временно недоступна.", retry: "Повторить", ready: "Готово", fragments: "фрагментов", open: "Открыть документ",
    progress: "Прогресс чтения пока не сохранён.", storageUnavailable: "Хранилище браузера недоступно; импорт отключён.",
  },
  reader: { eyebrow: "Чтение документа", title: "Документ", toolbarTitle: "Режим чтения", placeholderDescription: "Содержимое документа будет доступно после завершения импорта.", restoring: "Восстанавливаем место чтения…", boundedWindow: "Загружено ограниченное окно документа.", savePosition: "Запомнить это место", saveFailed: "Не удалось сохранить место чтения.", emptyDocument: "В документе нет доступных фрагментов.", missingDocument: "Этот локальный документ не найден в данном браузере.", staleDocument: "Документ требует безопасной повторной обработки.", corruptDocument: "Не удалось безопасно открыть сохранённые данные." },
  notFound: { eyebrow: "404", title: "Страница не найдена", description: "Этого адреса нет в локальном Markdown Reader." },
  theme: { dark: "Тёмная тема", light: "Светлая тема" },
} as const;
