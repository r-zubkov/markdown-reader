const workerGlobalScope: WorkerGlobalScope = self;

workerGlobalScope.addEventListener("message", () => undefined);

export {};
