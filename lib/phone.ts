export function brazilianPhoneDigits(value: string) {
  const digits = value.replace(/\D/g, '');

  return digits.startsWith('55') && digits.length > 11
    ? digits.slice(2)
    : digits;
}

export function isValidBrazilianPhone(value: string) {
  const digits = brazilianPhoneDigits(value);

  return /^[1-9]\d{9,10}$/.test(digits);
}

export function formatBrazilianPhone(value: string) {
  const digits = brazilianPhoneDigits(value).slice(0, 11);
  if (!digits) return '';
  if (digits.length < 3) return `(${digits}`;

  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length <= 4) return `(${ddd}) ${number}`;

  const prefixLength = number.length > 8 ? 5 : 4;
  return `(${ddd}) ${number.slice(0, prefixLength)}-${number.slice(prefixLength)}`;
}
