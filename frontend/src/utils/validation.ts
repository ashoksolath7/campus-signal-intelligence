export type FieldErrors = Record<string, string>;

export function required(value: string, label: string): string | undefined {
  if (!value.trim()) {
    return `${label} is required`;
  }
  return undefined;
}

export function validEmail(value: string): string | undefined {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    return "Enter a valid email address";
  }
  return undefined;
}

export function minLength(value: string, length: number, label: string): string | undefined {
  if (value.trim().length < length) {
    return `${label} must be at least ${length} characters`;
  }
  return undefined;
}

export function firstError(...errors: Array<string | undefined>): string | undefined {
  return errors.find((error) => Boolean(error));
}
