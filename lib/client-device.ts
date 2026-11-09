export const MAX_CLIENT_DEVICES = 20;

export type ClientDeviceInput = {
  tv: string;
  app: string;
  macAddress: string;
  device: string;
  location: string;
};

export const emptyClientDevice = (): ClientDeviceInput => ({
  tv: '',
  app: '',
  macAddress: '',
  device: '',
  location: '',
});

export function formatMacAddress(value: string) {
  const hex = value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 12);
  const formatted = hex.match(/.{1,2}/g)?.join(':') ?? '';
  return hex.length > 0 && hex.length < 12 && hex.length % 2 === 0
    ? `${formatted}:`
    : formatted;
}

export function parseClientDevices(value: unknown): ClientDeviceInput[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('A lista de TVs e dispositivos é inválida.');
  if (value.length > MAX_CLIENT_DEVICES) {
    throw new Error(`Cadastre no máximo ${MAX_CLIENT_DEVICES} dispositivos por cliente.`);
  }

  const devices = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Há uma TV ou dispositivo com dados inválidos.');
    }

    const row = entry as Record<string, unknown>;
    const readText = (field: unknown) => {
      if (field === undefined || field === null) return '';
      if (typeof field !== 'string') throw new Error('Os dados de TV e dispositivo devem ser textos.');
      return field.trim();
    };
    const tv = readText(row.tv);
    const app = readText(row.app);
    const rawMacAddress = readText(row.macAddress);
    const device = readText(row.device);
    const location = readText(row.location);

    if ([tv, app, device, location].some((field) => field.length > 191)) {
      throw new Error('TV, aplicativo, dispositivo e ambiente devem ter no máximo 191 caracteres.');
    }

    if (rawMacAddress && !/^[0-9A-Fa-f:.\-\s]+$/.test(rawMacAddress)) {
      throw new Error('O MAC aceita somente números e letras de A a F.');
    }
    const macAddress = rawMacAddress ? formatMacAddress(rawMacAddress) : '';
    if (rawMacAddress && !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(macAddress)) {
      throw new Error('Informe o MAC completo no formato AA:BB:CC:DD:EE:FF.');
    }

    return tv || app || macAddress || device || location
      ? [{ tv, app, macAddress, device, location }]
      : [];
  });

  const macAddresses = devices.map((item) => item.macAddress).filter(Boolean);
  if (new Set(macAddresses).size !== macAddresses.length) {
    throw new Error('O mesmo MAC foi informado mais de uma vez para este cliente.');
  }

  return devices;
}

const legacyFieldPattern = /(^|[\s·|;,])(tv|app|aplicativo|mac(?:\s+address)?|device(?:\s+key)?|chave|dispositivo)\s*:?\s*/gi;

export function parseLegacyClientDevices(observation: string): ClientDeviceInput[] {
  const matches = [...observation.matchAll(legacyFieldPattern)];
  if (!matches.length || (matches.length === 1 && (matches[0].index ?? 0) > 2)) return [];

  const devices: ClientDeviceInput[] = [];
  let current = emptyClientDevice();
  const hasContent = () => Boolean(
    current.tv || current.app || current.macAddress || current.device || current.location,
  );
  const pushCurrent = () => {
    if (hasContent()) devices.push(current);
    current = emptyClientDevice();
  };

  matches.forEach((match, index) => {
    const rawKey = match[2].toLowerCase().replace(/\s+/g, ' ');
    const valueStart = (match.index ?? 0) + match[0].length;
    const valueEnd = index + 1 < matches.length ? matches[index + 1].index : observation.length;
    const value = observation.slice(valueStart, valueEnd).replace(/^[\s·|;,]+|[\s·|;,]+$/g, '').trim().slice(0, 191);
    if (!value) return;

    if (rawKey === 'tv' && hasContent()) pushCurrent();
    if (rawKey === 'tv') current.tv = value;
    else if (rawKey === 'app' || rawKey === 'aplicativo') current.app = value;
    else if (rawKey === 'device' || rawKey === 'device key' || rawKey === 'chave' || rawKey === 'dispositivo') current.device = value;
    else {
      const macAddress = formatMacAddress(value);
      if (/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(macAddress)) current.macAddress = macAddress;
    }
  });
  pushCurrent();

  return devices.slice(0, MAX_CLIENT_DEVICES);
}
