import { PIPELINE_LIMITS } from "@/domain/content/pipeline-limits";
import type { PipelineLimits } from "@/domain/content/pipeline-types";

const workerGlobalScope: WorkerGlobalScope = self;
const pipelineLimits: PipelineLimits = PIPELINE_LIMITS;

workerGlobalScope.addEventListener("message", () => {
  if (pipelineLimits.maxFileBytes < 1) {
    throw new Error("Pipeline byte limit must be positive.");
  }
});

export {};
