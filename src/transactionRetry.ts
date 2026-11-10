// PostgreSQL rolls back the entire RPC transaction for these SQLSTATE codes.
// Network errors are deliberately excluded: their commit status is unknown.
export async function retryTransaction<T extends { error: { code?: string } | null }>(
  operation: () => PromiseLike<T>,
  wait: (milliseconds: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const result = await operation();
    if (!result.error || !["40P01", "40001"].includes(result.error.code ?? "") || attempt >= 2) return result;
    await wait(250 * 2 ** attempt + Math.floor(Math.random() * 200));
  }
}
