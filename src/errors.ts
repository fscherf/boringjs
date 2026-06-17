export class BoringError extends Error {
  constructor(message?: string, options?: { cause?: unknown }) {
    super(message);

    this.name = "BoringError";

    if (options?.cause !== undefined) {
      (this as any).cause = options.cause;
    }
  }
}
