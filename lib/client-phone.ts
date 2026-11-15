import { brazilianPhoneDigits, formatBrazilianPhone, isValidBrazilianPhone } from '@/lib/phone';

export const MAX_CLIENT_PHONES = 5;

export type ClientPhoneInput = {
  label: string;
  phone: string;
};

export function emptyClientPhone(label = ''): ClientPhoneInput {
  return { label, phone: '' };
}

export function parseClientPhones(value: unknown, fallbackPhone = ''): ClientPhoneInput[] {
  const rawItems = Array.isArray(value)
    ? value
    : fallbackPhone
      ? [{ label: 'Principal', phone: fallbackPhone }]
      : [];

  if (rawItems.length > MAX_CLIENT_PHONES) {
    throw new Error(`Cadastre no máximo ${MAX_CLIENT_PHONES} telefones por cliente.`);
  }

  const seen = new Set<string>();
  const phones: ClientPhoneInput[] = [];

  for (const [index, rawItem] of rawItems.entries()) {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) continue;
    const item = rawItem as Record<string, unknown>;
    const phoneValue = typeof item.phone === 'string' ? item.phone.trim() : '';
    if (!phoneValue) continue;
    if (!isValidBrazilianPhone(phoneValue)) {
      throw new Error(`Revise o telefone ${index + 1}. Informe DDD e número.`);
    }

    const digits = brazilianPhoneDigits(phoneValue);
    if (seen.has(digits)) throw new Error('O mesmo telefone foi informado mais de uma vez.');
    seen.add(digits);

    phones.push({
      label: (typeof item.label === 'string' ? item.label.trim() : '').slice(0, 50) || (index === 0 ? 'Principal' : `Contato ${index + 1}`),
      phone: formatBrazilianPhone(phoneValue),
    });
  }

  if (!phones.length) throw new Error('Informe ao menos um telefone válido.');
  return phones;
}
