export function formatKsh(amount) {
  const numericAmount = Number(amount || 0);
  return `KSH ${numericAmount.toLocaleString('en-KE')}`;
}
