'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import {
  AppWindow,
  Box,
  ChevronDown,
  CirclePlay,
  Clapperboard,
  MapPin,
  Monitor,
  MonitorPlay,
  Plus,
  Radio,
  Rocket,
  Satellite,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Tv,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  emptyClientDevice,
  formatMacAddress,
  MAX_CLIENT_DEVICES,
  type ClientDeviceInput,
} from '@/lib/client-device';

type EquipmentKind = 'tv' | 'external';
type CatalogItem = {
  value: string;
  label: string;
  kind: EquipmentKind | 'app';
  description: string;
  monogram?: string;
  logo?: string;
  aliases?: string[];
};
type LocationCatalogItem = {
  value: string;
  description: string;
  monogram: string;
};

const equipmentCatalog: CatalogItem[] = [
  {
    value: 'Samsung',
    label: 'Samsung',
    kind: 'tv',
    description: 'Smart TV • Tizen',
    monogram: 'SA',
  },
  {
    value: 'LG',
    label: 'LG',
    kind: 'tv',
    description: 'Smart TV • webOS',
    monogram: 'LG',
  },
  {
    value: 'TCL',
    label: 'TCL',
    kind: 'tv',
    description: 'Smart TV • Google TV / Roku TV',
    monogram: 'TC',
  },
  {
    value: 'Philips',
    label: 'Philips',
    kind: 'tv',
    description: 'Smart TV • Google TV / Saphi',
    monogram: 'PH',
  },
  {
    value: 'AOC',
    label: 'AOC',
    kind: 'tv',
    description: 'Smart TV • Roku TV',
    monogram: 'AO',
  },
  {
    value: 'Philco',
    label: 'Philco',
    kind: 'tv',
    description: 'Smart TV',
    monogram: 'PC',
  },
  {
    value: 'Semp / Toshiba',
    label: 'Semp / Toshiba',
    kind: 'tv',
    description: 'Smart TV • Google TV / VIDAA',
    monogram: 'ST',
  },
  {
    value: 'Panasonic',
    label: 'Panasonic',
    kind: 'tv',
    description: 'Smart TV',
    monogram: 'PN',
  },
  {
    value: 'Sony',
    label: 'Sony',
    kind: 'tv',
    description: 'Smart TV • Google TV',
    monogram: 'SO',
  },
  {
    value: 'Hisense',
    label: 'Hisense',
    kind: 'tv',
    description: 'Smart TV • VIDAA',
    monogram: 'HI',
  },
  {
    value: 'Roku TV',
    label: 'Roku TV',
    kind: 'tv',
    description: 'Smart TV • Roku OS',
    monogram: 'RT',
  },
  {
    value: 'Multilaser',
    label: 'Multi / Multilaser',
    kind: 'tv',
    description: 'Smart TV',
    monogram: 'MU',
  },
  {
    value: 'HQ',
    label: 'HQ',
    kind: 'tv',
    description: 'Smart TV',
    monogram: 'HQ',
  },
  {
    value: 'Roku Express',
    label: 'Roku Express',
    kind: 'external',
    description: 'Dispositivo de streaming',
    monogram: 'RO',
  },
  {
    value: 'Amazon Fire TV Stick',
    label: 'Amazon Fire TV Stick',
    kind: 'external',
    description: 'Dispositivo Fire TV',
    monogram: 'FT',
  },
  {
    value: 'Chromecast / Google TV',
    label: 'Chromecast / Google TV',
    kind: 'external',
    description: 'Dispositivo Google TV',
    monogram: 'GC',
  },
  {
    value: 'Android TV Box',
    label: 'Android TV Box',
    kind: 'external',
    description: 'TV Box com Android',
    monogram: 'AT',
  },
  {
    value: 'Xiaomi Mi TV Stick / Box',
    label: 'Xiaomi Mi TV Stick / Box',
    kind: 'external',
    description: 'Dispositivo Android TV',
    monogram: 'MI',
  },
  {
    value: 'Apple TV',
    label: 'Apple TV',
    kind: 'external',
    description: 'Dispositivo tvOS',
    monogram: 'AP',
  },
  {
    value: 'Aquário STV',
    label: 'Aquário STV',
    kind: 'external',
    description: 'TV Box',
    monogram: 'AQ',
  },
  {
    value: 'Intelbras Izy Play',
    label: 'Intelbras Izy Play',
    kind: 'external',
    description: 'Dispositivo Android TV',
    monogram: 'IZ',
  },
  {
    value: 'Nvidia Shield TV',
    label: 'Nvidia Shield TV',
    kind: 'external',
    description: 'Dispositivo Android TV',
    monogram: 'NS',
  },
];

const appNames = [
  '9XTREAM 4K',
  'A PLUS PLAYER',
  'ABE PLAYER',
  'AI PLAYER',
  'ALL PLAYER',
  'ARABISK PLAYER',
  'ASSIST PLUS',
  'BAY TV',
  'BAYTVPRO',
  'BIG PLAYER',
  'BLINK PLAYER',
  'BOB PLAYER',
  'BOB PREMIUM',
  'BOB PRO',
  'BOX LITE',
  'BOX PLAYER',
  'BOX PRIME',
  'BRASIL IPTV',
  'CAP PLAYER',
  'CLOUDDY',
  'CONECTADOS TV',
  'CORE PLAYER',
  'CR PLAYER',
  'D PLAYER',
  'DHUB IPTV',
  'DIRETV PLAY',
  'DONTV',
  'DREAM TV',
  'DTV SOL',
  'DUPLECAST',
  'DUPLEX MAX',
  'DUPLEX PLUS',
  'DUPLEX PRO',
  'DUPLEX TV DO IBO',
  'DUPLEXPLAY',
  'EASY PLAYER',
  'ECO IPTV',
  'EGO IPTV',
  'ENZO PLAYER',
  'EPIC PLAY',
  'EVO PLAYER',
  'FAMILY PLAYER',
  'FAST PLAYER',
  'FLIX IPTV',
  'FLIX PRO',
  'FLIX TV PLAY',
  'FLIXNET',
  'FLIXTRA PLAYER',
  'FOCO X PLAY',
  'FUN PLAY',
  'GALAXY TV',
  'GRAVITY PLAYER',
  'GREEN PLAYER',
  'GTV PLAYER',
  'HD MEDIA PLAYER',
  'HD PLAYER',
  'HOME IPTV',
  'HOT IPTV',
  'HOT ORA IPTV',
  'HOT PLAYER',
  'HQ PLAYER',
  'HUSH PLAY',
  'IBO PLAYER',
  'IBO PREMIUM',
  'IBO PRO',
  'IBO SMARTERS',
  'IBO SMARTERS PLAYER',
  'IBO STB',
  'IBO VPN PLAYER',
  'IBOSOL PLAYER',
  'IBOSS PLAYER',
  'IBOXX PLAYER',
  'ION PLAYER',
  'IPTV 4K',
  'IPTV DUPLEX',
  'IPTV ENTERTAINMENT',
  'IPTV MAIS',
  'IPTV NEXT',
  'IPTV OTT PLAYER',
  'IPTV PLAY',
  'IPTV PLAYER - I PLAYER',
  'IPTV PLAYER IO',
  'IPTV PLUS',
  'IPTV PRO',
  'IPTV SMART 4K PLAYER',
  'IPTV SMARTER 4K PLAYER',
  'IPTV SMARTERS PLAYER',
  'IPTV STAR',
  'IPTV STREAM PLAYER',
  'IPTVACTIVATION.COM',
  'ITELSMARTER PLAYER',
  'KEMET TV',
  'KIDS PLAY',
  'KING 4K OTT PLAYER',
  'KING 4K PLAYER',
  'KIWI 4K PLAYER',
  'KODI IPTV PLAYER',
  'KTN PLAYER',
  'LAXY PLAYER',
  'LAZER PLAYER',
  'LUMINA PLAYER',
  'M3U IPTV PLAYER',
  'MAC PLAYER',
  'MAGIC PLAYER',
  'MAX MEDIA PLAYER',
  'MAX PRO',
  'MCV PLAYER',
  'MEROPLAYER',
  'MESSI TV',
  'META PLAYER',
  'MIKA PLAYER',
  'MIROPLAYER',
  'MULTI PLAY',
  'MUV PLAYER',
  'MX PLAYER',
  'NINJA PLAYER',
  'NINJA PLUS',
  'NUBIA TV',
  'NUM PLAYER',
  'ORA PLAYER EU',
  'ORA PLAYERS.COM',
  'ORA PRO',
  'ORION PLAY',
  'OTT PLAYER',
  'OTT PLUS',
  'PLAY IBO',
  'PLAYSIM',
  'POP PLAYER',
  'POWER PLAY',
  'PRO PLAYER',
  'PRO SMARTONE',
  'QPLAY',
  'QUEEN TV',
  'QUICK PLAYER',
  'QUICK PLAYER +',
  'QUICK PLAYER PRO',
  'QUICK PLAYER V2',
  'QUICK PLAYER X',
  'QUICK PLAYER Z',
  'RIEN TV STAR',
  'RIVOLUT',
  'SCANDIC IPTV',
  'SEE PLAY',
  'SET IPTV',
  'SHAMEL TV',
  'SIMPLE PRO',
  'SKY PLAY PLUS',
  'SMART IPTV',
  'SMART IPTV PLAY',
  'SMART IPTV PLAYER',
  'SMART IPTV PLAYER PRO',
  'SMART LIVE TV',
  'SMARTERS MAX',
  'SMARTERS PLAYER',
  'SMARTERS PLUS',
  'SMARTERS PRO',
  'SMARTERS PRO APP',
  'SMARTERS VPN PLAYER',
  'SMARTONE',
  'SMARTONE IPTV',
  'SPORTS TV',
  'SS IPTV',
  'STAR IPTV',
  'STREAM MEDIA PLAYER',
  'STREAM XTREAM',
  'STRIMO',
  'STZ PLAYER',
  'SUPER PLAY',
  'SW4TV',
  'TELEVIZO IPTV PLAYER',
  'TERRY IPTV',
  'TERRY PLAYER',
  'TEVIS TV',
  'TIVI PLAYER',
  'TIVIMATE',
  'TURBO MEDIA PLAYER',
  'TVIP PLAYER',
  'TVOYATV',
  'UK IPTV 4K',
  'ULTRA PLAYER',
  'UN TV PLAYER',
  'UNI STREAM TV',
  'VIP',
  'VIRGINIA',
  'VIVO PLAYER',
  'VIZZION PLAY',
  'VU PLAYER PRO',
  'VUX PLAYER',
  'WORLD VISION IPTV',
  'X PLAYER',
  'XCIPTV',
  'XCIPTV PRO PLAYER',
  'XCLOUD',
  'XENDLY 4K IPTV PLAYER',
  'XP PLAYER',
  'XTREAM TV',
  'XTREAMUITV',
  'YOU TIVI',
  'YOU TV',
  'YTV 4K PLAYER',
  'ZEBRA PLAYER',
] as const;

const appDescriptions: Partial<Record<(typeof appNames)[number], string>> = {
  'IBO PLAYER': 'Versão tradicional do IBO',
  'IBO PREMIUM': 'Versão Premium do IBO',
  'IBO PRO': 'Versão Pro do IBO',
};

const appAliases: Partial<Record<(typeof appNames)[number], string[]>> = {
  CLOUDDY: ['Cloudy'],
  'IBO PRO': ['IBO Player Pro'],
  'RIEN TV STAR': ['Reni TV Star'],
  RIVOLUT: ['Rvolution'],
};

const appsWithoutReferenceLogo = new Set<(typeof appNames)[number]>([
  'DUPLEXPLAY',
  'ECO IPTV',
  'FLIX IPTV',
  'HOT IPTV',
  'MEROPLAYER',
  'MX PLAYER',
  'QUICK PLAYER V2',
  'SMART IPTV',
  'SS IPTV',
  'SUPER PLAY',
  'TIVIMATE',
  'XCIPTV',
  'XCLOUD',
  'XTREAM TV',
  'YOU TV',
]);

const appLogoOverrides: Partial<
  Record<(typeof appNames)[number], string>
> = {
  '9XTREAM 4K': '9xtream.webp',
  'ASSIST PLUS': 'assist.png',
  'BAY TV': 'bayiptv.webp',
  'BLINK PLAYER': 'blink.webp',
  'BOX PLAYER': 'boxplayer.png',
  'BRASIL IPTV': 'brasil.webp',
  'CR PLAYER': 'cr7.webp',
  'FAST PLAYER': 'fastplayer.png',
  'FLIXTRA PLAYER': 'flixtra.webp',
  'FOCO X PLAY': 'focox.webp',
  'GRAVITY PLAYER': 'gravity-player.webp',
  'HOME IPTV': 'home.webp',
  'HOT PLAYER': 'hot.webp',
  'HQ PLAYER': 'hqplayer-v2.webp',
  'HUSH PLAY': 'hush.webp',
  'IBO VPN PLAYER': 'iptviboplayer.png',
  'IBOSOL PLAYER': 'ibosol.webp',
  'IBOSS PLAYER': 'iboss.webp',
  'IBOXX PLAYER': 'iboxx.webp',
  'IPTV OTT PLAYER': 'ottplayer.webp',
  'IPTV DUPLEX': 'iptvduplex.png',
  'IPTV PLAYER - I PLAYER': 'iplayer.webp',
  'IPTV PLUS': 'iptvmais.webp',
  'IPTV SMARTERS PLAYER': 'iptvsmartersplayer.png',
  'IPTV STAR': 'star.webp',
  'IPTV STREAM PLAYER': 'tiviplayer.webp',
  'IPTVACTIVATION.COM': 'iptvactivation.webp',
  'KING 4K PLAYER': 'king.webp',
  'KTN PLAYER': 'ktn.webp',
  'LAXY PLAYER': 'laxy.webp',
  'LAZER PLAYER': 'lazer.webp',
  'LUMINA PLAYER': 'lumina.webp',
  'MAC PLAYER': 'mac.webp',
  'MAGIC PLAYER': 'magicplayer.png',
  'MESSI TV': 'messi.png',
  'META PLAYER': 'meta.webp',
  'MIKA PLAYER': 'mika.webp',
  MIROPLAYER: 'miro.webp',
  'NINJA PLAYER': 'ninja.webp',
  'ORA PLAYERS.COM': 'oraplayercom.webp',
  'ORA PRO': 'ora-pro.webp',
  PLAYSIM: 'playsim.png',
  'POWER PLAY': 'powerplay.png',
  'PRO SMARTONE': 'smartonepro.webp',
  'QUICK PLAYER +': 'quickplayerplus.webp',
  'SMART IPTV PLAYER': 'smartiptvplayer2.webp',
  'SMARTERS PLAYER': 'smartersplayer.png',
  'SMARTERS PRO APP': 'smartersapp.webp',
  'SMARTERS VPN PLAYER': 'smartersvpnplayer.png',
  'SMARTONE IPTV': 'smartone.webp',
  'STAR IPTV': 'star.webp',
  'STREAM MEDIA PLAYER': 'streammedia.webp',
  'UNI STREAM TV': 'unistream.webp',
  'VIZZION PLAY': 'vizzon.png',
};

function getAppLogo(name: (typeof appNames)[number]) {
  if (appsWithoutReferenceLogo.has(name)) return undefined;

  const fileName =
    appLogoOverrides[name] ??
    `${name.toLocaleLowerCase('en-US').replace(/[^a-z0-9]/g, '')}.webp`;

  return `/app-logos/${fileName}`;
}

const appCatalog: CatalogItem[] = appNames.map((name) => ({
  value: name,
  label: name,
  kind: 'app',
  description: appDescriptions[name] ?? 'Aplicativo player',
  logo: getAppLogo(name),
  aliases: appAliases[name],
}));

const locationCatalog: LocationCatalogItem[] = [
  { value: 'Sala', description: 'Ambiente residencial', monogram: 'SL' },
  { value: 'Quarto', description: 'Ambiente residencial', monogram: 'QT' },
  { value: 'Suíte', description: 'Ambiente residencial', monogram: 'ST' },
  { value: 'Cozinha', description: 'Ambiente residencial', monogram: 'CZ' },
  { value: 'Área gourmet', description: 'Lazer e convivência', monogram: 'AG' },
  { value: 'Área externa', description: 'Ambiente externo', monogram: 'AE' },
  { value: 'Recepção', description: 'Atendimento ao público', monogram: 'RC' },
  { value: 'Escritório', description: 'Ambiente de trabalho', monogram: 'ES' },
  {
    value: 'Consultório',
    description: 'Atendimento profissional',
    monogram: 'CT',
  },
  { value: 'Salão', description: 'Área comercial ou social', monogram: 'SA' },
  { value: 'Estoque', description: 'Área de apoio', monogram: 'ET' },
  { value: 'Portaria', description: 'Acesso e segurança', monogram: 'PT' },
  { value: 'Garagem', description: 'Área de acesso', monogram: 'GR' },
];

function normalizeCatalogValue(value: string) {
  return value.trim().toLocaleUpperCase('pt-BR');
}

function catalogItemMatches(item: CatalogItem, value: string) {
  const normalizedValue = normalizeCatalogValue(value);

  return [item.value, ...(item.aliases ?? [])].some(
    (candidate) => normalizeCatalogValue(candidate) === normalizedValue,
  );
}

function getAppIconTone(label: string) {
  const total = Array.from(label).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );

  return (total % 6) + 1;
}

function AppCatalogGlyph({ label }: { label: string }) {
  if (/\b(IBO|IBOSOL|IBOSS|IBOXX)\b/.test(label)) {
    return <CirclePlay aria-hidden="true" />;
  }

  if (/\b(BOX|STB)\b/.test(label)) {
    return <Box aria-hidden="true" />;
  }

  if (/\b(4K|TV)\b/.test(label)) {
    return <MonitorPlay aria-hidden="true" />;
  }

  if (/\b(IPTV|OTT|XCIPTV)\b/.test(label)) {
    return <Satellite aria-hidden="true" />;
  }

  if (/\b(STREAM|MEDIA)\b/.test(label)) {
    return <Radio aria-hidden="true" />;
  }

  if (/\b(SMART|APP)\b/.test(label)) {
    return <Smartphone aria-hidden="true" />;
  }

  if (/\b(PRO|PREMIUM|PLUS|MAX)\b/.test(label)) {
    return <ShieldCheck aria-hidden="true" />;
  }

  if (/\b(PLAY|PLAYER|PLAYSIM)\b/.test(label)) {
    return <CirclePlay aria-hidden="true" />;
  }

  if (/\b(STAR|GALAXY|ORION)\b/.test(label)) {
    return <Sparkles aria-hidden="true" />;
  }

  if (/\b(TURBO|POWER|FAST)\b/.test(label)) {
    return <Rocket aria-hidden="true" />;
  }

  if (/\b(VIDEO|VIVO|VIZZION)\b/.test(label)) {
    return <Video aria-hidden="true" />;
  }

  return <Clapperboard aria-hidden="true" />;
}

function AppCatalogIcon({ item }: { item: CatalogItem }) {
  if (item.logo) {
    return (
      <span className="catalog-app-logo" aria-hidden="true">
        <Image
          src={item.logo}
          alt=""
          width={36}
          height={36}
          unoptimized
        />
      </span>
    );
  }

  return (
    <span
      className={`catalog-app-icon catalog-app-icon-${getAppIconTone(item.label)}`}
      aria-hidden="true"
    >
      <AppCatalogGlyph label={item.label} />
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field-label">
      <span>{label}</span>
      {children}
    </label>
  );
}

function CatalogPicker({
  value,
  onChange,
  mode,
}: {
  value: string;
  onChange: (value: string) => void;
  mode: 'equipment' | 'app';
}) {
  const items = mode === 'equipment' ? equipmentCatalog : appCatalog;
  const isKnownValue = items.some((item) => catalogItemMatches(item, value));
  const [open, setOpen] = useState(false);
  const [customRequested, setCustomRequested] = useState(false);
  const [filter, setFilter] = useState<'all' | EquipmentKind>('all');
  const customMode = customRequested || Boolean(value && !isKnownValue);

  const visibleItems = useMemo(
    () =>
      mode === 'equipment' && filter !== 'all'
        ? items.filter((item) => item.kind === filter)
        : items,
    [filter, items, mode],
  );
  const selected = items.find((item) => catalogItemMatches(item, value));
  const Icon =
    mode === 'equipment'
      ? selected?.kind === 'external'
        ? Box
        : Tv
      : AppWindow;

  const selectItem = (item: CatalogItem) => {
    onChange(item.value);
    setCustomRequested(false);
    setOpen(false);
  };

  return (
    <div className="catalog-field">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          type="button"
          className="catalog-trigger"
          aria-label={
            mode === 'equipment'
              ? 'Selecionar TV ou aparelho'
              : 'Selecionar aplicativo'
          }
        >
          {mode === 'app' && selected ? (
            <AppCatalogIcon item={selected} />
          ) : (
            <span className="catalog-trigger-icon">
              <Icon />
            </span>
          )}
          <span className="catalog-trigger-copy">
            <strong>
              {value ||
                (mode === 'equipment'
                  ? 'Selecione a TV ou aparelho'
                  : 'Selecione o aplicativo')}
            </strong>
            <small>
              {selected?.description ||
                (value ? 'Cadastro personalizado' : 'Pesquise no catálogo')}
            </small>
          </span>
          <ChevronDown />
        </PopoverTrigger>
        <PopoverContent
          className="device-catalog-popover"
          align="start"
          sideOffset={7}
        >
          <Command>
            <div className="catalog-search-heading">
              <span>
                {mode === 'equipment' ? 'TVs e aparelhos' : 'Aplicativos'}
              </span>
              <small>
                {mode === 'app'
                  ? `${appCatalog.length} opções • 10 por vez`
                  : 'Até 10 opções visíveis'}
              </small>
            </div>
            <CommandInput
              placeholder={
                mode === 'equipment'
                  ? 'Buscar marca ou aparelho...'
                  : 'Buscar aplicativo...'
              }
            />
            {mode === 'equipment' && (
              <div className="catalog-filters" aria-label="Filtrar catálogo">
                <button
                  type="button"
                  data-active={filter === 'all'}
                  onClick={() => setFilter('all')}
                >
                  Todos
                </button>
                <button
                  type="button"
                  data-active={filter === 'tv'}
                  onClick={() => setFilter('tv')}
                >
                  <Monitor />
                  Smart TVs
                </button>
                <button
                  type="button"
                  data-active={filter === 'external'}
                  onClick={() => setFilter('external')}
                >
                  <Box />
                  Aparelhos
                </button>
              </div>
            )}
            <CommandList className="device-catalog-list">
              <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
              {visibleItems.map((item) => (
                <CommandItem
                  className="device-catalog-item"
                  data-checked={catalogItemMatches(item, value)}
                  key={item.value}
                  value={`${item.label} ${item.description}`}
                  onSelect={() => selectItem(item)}
                >
                  {item.kind === 'app' ? (
                    <AppCatalogIcon item={item} />
                  ) : (
                    <span
                      className={`catalog-monogram catalog-monogram-${item.kind}`}
                    >
                      {item.monogram}
                    </span>
                  )}
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </CommandItem>
              ))}
              <CommandItem
                className="device-catalog-item catalog-custom-item"
                value="outro personalizado não listado"
                onSelect={() => {
                  onChange('');
                  setCustomRequested(true);
                  setOpen(false);
                }}
              >
                <span className="catalog-monogram catalog-monogram-custom">
                  +
                </span>
                <span>
                  <strong>
                    {mode === 'equipment'
                      ? 'Outro equipamento'
                      : 'Outro aplicativo'}
                  </strong>
                  <small>Informar manualmente</small>
                </span>
              </CommandItem>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {(customMode || Boolean(value && !isKnownValue)) && (
        <Input
          aria-label={
            mode === 'equipment'
              ? 'Nome personalizado da TV ou aparelho'
              : 'Nome personalizado do aplicativo'
          }
          maxLength={191}
          placeholder={
            mode === 'equipment'
              ? 'Digite a marca, modelo ou aparelho'
              : 'Digite o nome do aplicativo'
          }
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

function LocationPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customRequested, setCustomRequested] = useState(false);
  const selected = locationCatalog.find(
    (item) =>
      normalizeCatalogValue(item.value) === normalizeCatalogValue(value),
  );
  const customMode = customRequested || Boolean(value && !selected);

  return (
    <div className="catalog-field location-catalog-field">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          type="button"
          className="catalog-trigger"
          aria-label="Selecionar ambiente ou setor"
        >
          <span className="catalog-trigger-icon catalog-trigger-location-icon">
            <MapPin />
          </span>
          <span className="catalog-trigger-copy">
            <strong>{value || 'Selecione o ambiente ou setor'}</strong>
            <small>
              {selected?.description ||
                (value
                  ? 'Ambiente personalizado'
                  : 'Ex.: Sala, Quarto ou Recepção')}
            </small>
          </span>
          <ChevronDown />
        </PopoverTrigger>
        <PopoverContent
          className="device-catalog-popover location-catalog-popover"
          align="start"
          sideOffset={7}
        >
          <Command>
            <div className="catalog-search-heading">
              <span>Ambientes e setores</span>
              <small>{locationCatalog.length} opções + Outro</small>
            </div>
            <CommandInput placeholder="Buscar ambiente ou setor..." />
            <CommandList className="device-catalog-list location-catalog-list">
              <CommandEmpty>Nenhum ambiente encontrado.</CommandEmpty>
              {locationCatalog.map((item) => (
                <CommandItem
                  className="device-catalog-item"
                  data-checked={selected?.value === item.value}
                  key={item.value}
                  value={`${item.value} ${item.description}`}
                  onSelect={() => {
                    onChange(item.value);
                    setCustomRequested(false);
                    setOpen(false);
                  }}
                >
                  <span className="catalog-monogram catalog-monogram-location">
                    {item.monogram}
                  </span>
                  <span>
                    <strong>{item.value}</strong>
                    <small>{item.description}</small>
                  </span>
                </CommandItem>
              ))}
              <CommandItem
                className="device-catalog-item catalog-custom-item"
                value="outro ambiente setor personalizado não listado"
                onSelect={() => {
                  onChange('');
                  setCustomRequested(true);
                  setOpen(false);
                }}
              >
                <span className="catalog-monogram catalog-monogram-custom">
                  +
                </span>
                <span>
                  <strong>Outro</strong>
                  <small>Informar um ambiente personalizado</small>
                </span>
              </CommandItem>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {customMode && (
        <Input
          aria-label="Nome personalizado do ambiente ou setor"
          maxLength={191}
          placeholder="Ex.: Piscina"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

export default function ClientDevicesEditor({
  devices,
  onChange,
}: {
  devices: ClientDeviceInput[];
  onChange: (devices: ClientDeviceInput[]) => void;
}) {
  const update = (
    index: number,
    field: keyof ClientDeviceInput,
    value: string,
  ) =>
    onChange(
      devices.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  const remove = (index: number) =>
    onChange(
      devices.length === 1
        ? [emptyClientDevice()]
        : devices.filter((_, itemIndex) => itemIndex !== index),
    );
  const filledCount = devices.filter(
    (item) => item.tv || item.app || item.macAddress || item.device || item.location,
  ).length;

  return (
    <section
      className="client-devices-editor"
      aria-labelledby="client-devices-title"
    >
      <div className="client-devices-heading">
        <div>
          <span className="client-devices-eyebrow">
            <Tv />
            Configuração técnica
          </span>
          <h3 id="client-devices-title">TVs, aparelhos e aplicativos</h3>
          <p>
            Selecione pelo catálogo ou use “Outro” para cadastrar um item
            personalizado.
          </p>
        </div>
        <span>
          {filledCount}/{MAX_CLIENT_DEVICES}
        </span>
      </div>
      <div className="client-device-list">
        {devices.map((item, index) => (
          <article className="client-device-card" key={index}>
            <div className="client-device-card-heading">
              <div>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>Dispositivo {index + 1}</strong>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => remove(index)}
              >
                <Trash2 />
                {devices.length === 1 ? 'Limpar' : 'Remover'}
              </Button>
            </div>
            <div className="client-device-grid">
              <Field label="TV ou aparelho">
                <CatalogPicker
                  value={item.tv}
                  mode="equipment"
                  onChange={(value) => update(index, 'tv', value)}
                />
              </Field>
              <Field label="Aplicativo">
                <CatalogPicker
                  value={item.app}
                  mode="app"
                  onChange={(value) => update(index, 'app', value)}
                />
              </Field>
              <div className="client-device-location">
                <Field label="Ambiente / setor">
                  <LocationPicker
                    value={item.location}
                    onChange={(value) => update(index, 'location', value)}
                  />
                </Field>
              </div>
              <Field label="MAC Address">
                <Input
                  className="mac-address-input"
                  value={item.macAddress}
                  maxLength={17}
                  placeholder="AA:BB:CC:DD:EE:FF"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  pattern="(?:[0-9A-F]{2}:){5}[0-9A-F]{2}"
                  title="Informe os 12 caracteres do MAC no formato AA:BB:CC:DD:EE:FF"
                  onChange={(event) =>
                    update(
                      index,
                      'macAddress',
                      formatMacAddress(event.target.value),
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Backspace' &&
                      event.currentTarget.selectionStart ===
                        item.macAddress.length &&
                      item.macAddress.endsWith(':')
                    ) {
                      event.preventDefault();
                      update(
                        index,
                        'macAddress',
                        formatMacAddress(item.macAddress.slice(0, -2)),
                      );
                    }
                  }}
                />
              </Field>
              <Field label="Chave / Device Key">
                <Input
                  value={item.device}
                  maxLength={191}
                  placeholder="Chave ou código do aplicativo"
                  onChange={(event) =>
                    update(index, 'device', event.target.value)
                  }
                />
              </Field>
            </div>
          </article>
        ))}
      </div>
      <Button
        className="add-device-button"
        type="button"
        variant="outline"
        disabled={devices.length >= MAX_CLIENT_DEVICES}
        onClick={() => onChange([...devices, emptyClientDevice()])}
      >
        <Plus />
        Adicionar dispositivo
      </Button>
      <p className="catalog-footnote">
        <Search />
        As listas exibem até 10 opções por vez; continue rolando para ver o
        restante.
      </p>
    </section>
  );
}
