export class ApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly status = 400,
    public readonly data?: unknown
  ) {
    super(message);
  }
}

