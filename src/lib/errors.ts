export class AppError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export function check(value: unknown, status: number, code: string): asserts value {
  if (!value) throw new AppError(status, code);
}
