export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (data as { error?: { message?: string } }).error?.message || response.statusText;
    throw new Error(message);
  }
  return data as T;
}

export function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
