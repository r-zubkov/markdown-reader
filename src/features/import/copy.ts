import type { ImportErrorCode } from "./import-coordinator";
import type { ImportStage } from "@/workers/import-protocol";

export const importCopy = {
  label: "Импорт Markdown-файла",
  chooseFile: "Выбрать файл",
  description: "Выберите один файл .md. Он останется только в этом браузере.",
  selectedFile: "Выбран",
  cancel: "Отменить",
  cancelling: "Отменяем импорт…",
  cancelled: "Импорт отменён.",
  succeeded: "Документ готов.",
  open: "Открыть",
  stages: {
    validating: "Проверяем файл…",
    processing: "Обрабатываем Markdown…",
    staging: "Сохраняем части документа…",
    finalizing: "Завершаем импорт…",
  } as const satisfies Record<ImportStage, string>,
  errors: {
    UNSUPPORTED_EXTENSION: "Выберите файл с расширением .md.",
    FILE_TOO_LARGE: "Файл слишком большой.",
    INVALID_UTF8: "Файл должен быть в UTF-8.",
    PROTOCOL_MISMATCH: "Версии приложения несовместимы. Перезагрузите страницу.",
    WORKER_CRASH: "Обработка прервана. Попробуйте снова.",
    CANCELLED: "Импорт отменён.",
    DB_UNAVAILABLE: "Локальное хранилище недоступно.",
    MIGRATION_FAILED: "Не удалось обновить хранилище.",
    STALE_DERIVED: "Документ требует переобработки.",
    QUOTA_EXCEEDED: "Не хватает места в хранилище.",
    COMMIT_CONFLICT: "Документ изменился в другой вкладке.",
    DOCUMENT_NOT_FOUND: "Документ не найден.",
    INVALID_PERSISTED_RECORD: "Данные хранилища повреждены.",
    UNKNOWN_STORAGE_ERROR: "Не удалось сохранить документ.",
  } as const satisfies Record<ImportErrorCode, string>,
} as const;
