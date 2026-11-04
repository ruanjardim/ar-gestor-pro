export const MAX_CLIENT_DEVICES = 20;

export type ClientDeviceInput = {
  tv: string;
  app: string;
  macAddress: string;
  device: string;
};

export const emptyClientDevice = (): ClientDeviceInput => ({
  tv: '',
  app: '',
  macAddress: '',
  device: '',
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
    throw new Error(`Cadastre no máximo ${MAX_CLIENT_DEVICES} TVs por cliente.`);
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

    if ([tv, app, device].some((field) => field.length > 191)) {
      throw new Error('TV, aplicativo e dispositivo devem ter no máximo 191 caracteres.');
    }

    if (rawMacAddress && !/^[0-9A-Fa-f:.\-\s]+$/.test(rawMacAddress)) {
      throw new Error('O MAC aceita somente números e letras de A a F.');
    }
    const macAddress = rawMacAddress ? formatMacAddress(rawMacAddress) : '';
    if (rawMacAddress && !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(macAddress)) {
      throw new Error('Informe o MAC completo no formato AA:BB:CC:DD:EE:FF.');
    }

    return tv || app || macAddress || device ? [{ tv, app, macAddress, device }] : [];
  });

  const macAddresses = devices.map((item) => item.macAddress).filter(Boolean);
  if (new Set(macAddresses).size !== macAddresses.length) {
    throw new Error('O mesmo MAC foi informado mais de uma vez para este cliente.');
  }

  return devices;
}
