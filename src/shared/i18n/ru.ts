export const appCopy = {
  productName: "Markdown Reader",
  a11y: { primaryNavigation: "Основная навигация", readerToolbar: "Панель чтения", skipToDocument: "Перейти к тексту документа", skipToMain: "Перейти к основному содержимому", theme: "Выбрать тему" },
  navigation: { backToLibrary: "К библиотеке", library: "Библиотека", toLibrary: "Открыть библиотеку" },
  library: { eyebrow: "Локальная библиотека", title: "Библиотека", localOnly: "Документы хранятся только в этом браузере.", placeholderLabel: "Состояние библиотеки", emptyTitle: "Пока нет документов", emptyDescription: "Импорт Markdown-файлов появится на следующем шаге." },
  reader: { eyebrow: "Чтение документа", title: "Документ", toolbarTitle: "Режим чтения", placeholderDescription: "Содержимое документа будет доступно после завершения импорта." },
  notFound: { eyebrow: "404", title: "Страница не найдена", description: "Этого адреса нет в локальном Markdown Reader." },
  theme: { dark: "Тёмная тема", light: "Светлая тема" },
} as const;
