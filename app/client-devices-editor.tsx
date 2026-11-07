'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  AppWindow,
  Box,
  ChevronDown,
  Monitor,
  Plus,
  Search,
  Trash2,
  Tv,
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

const appCatalog: CatalogItem[] = [
  {
    value: 'IPTV Smarters Player',
    label: 'IPTV Smarters Player',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'IS',
  },
  {
    value: 'XCIPTV',
    label: 'XCIPTV',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'XC',
  },
  {
    value: 'IBO Player Pro',
    label: 'IBO Player Pro',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'IB',
  },
  {
    value: 'Bob Player',
    label: 'Bob Player',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'BO',
  },
  {
    value: 'SmartOne IPTV',
    label: 'SmartOne IPTV',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'S1',
  },
  {
    value: 'DuplexPlay',
    label: 'DuplexPlay',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'DP',
  },
  {
    value: 'SS IPTV',
    label: 'SS IPTV',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'SS',
  },
  {
    value: 'TiviMate',
    label: 'TiviMate',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'TV',
  },
  {
    value: 'Flix IPTV',
    label: 'Flix IPTV',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'FL',
  },
  {
    value: 'Set IPTV',
    label: 'Set IPTV',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'SE',
  },
  {
    value: 'Hot IPTV',
    label: 'Hot IPTV',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'HO',
  },
  {
    value: 'Smart IPTV',
    label: 'Smart IPTV',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'SI',
  },
  {
    value: 'OTT Player',
    label: 'OTT Player',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'OT',
  },
  {
    value: 'CAP Player',
    label: 'CAP Player',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'CP',
  },
  {
    value: 'Cloudy',
    label: 'Cloudy',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'CL',
  },
  {
    value: 'Easy Player',
    label: 'Easy Player',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'EA',
  },
  {
    value: 'Eco IPTV',
    label: 'Eco IPTV',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'EC',
  },
  {
    value: 'Fun Play',
    label: 'Fun Play',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'FP',
  },
  {
    value: 'Galaxy TV',
    label: 'Galaxy TV',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'GX',
  },
  {
    value: 'MeroPlayer',
    label: 'MeroPlayer',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'ME',
  },
  {
    value: 'Multi Play',
    label: 'Multi Play',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'MP',
  },
  {
    value: 'MX Player',
    label: 'MX Player',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'MX',
  },
  {
    value: 'Quick Player V2',
    label: 'Quick Player V2',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'QP',
  },
  {
    value: 'Reni TV Star',
    label: 'Reni TV Star',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'RS',
  },
  {
    value: 'Rvolution',
    label: 'Rvolution',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'RV',
  },
  {
    value: 'Terry IPTV',
    label: 'Terry IPTV',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'TI',
  },
  {
    value: 'Terry Player',
    label: 'Terry Player',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'TP',
  },
  {
    value: 'XP Player',
    label: 'XP Player',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'XP',
  },
  {
    value: 'Xtream TV',
    label: 'Xtream TV',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'XT',
  },
  {
    value: 'You TV',
    label: 'You TV',
    kind: 'app',
    description: 'Aplicativo player',
    monogram: 'YT',
  },
];

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
  const isKnownValue = items.some((item) => item.value === value);
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
  const selected = items.find((item) => item.value === value);
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
          <span className="catalog-trigger-icon">
            <Icon />
          </span>
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
              <small>Até 10 opções visíveis</small>
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
                  data-checked={item.value === value}
                  key={item.value}
                  value={`${item.label} ${item.description}`}
                  onSelect={() => selectItem(item)}
                >
                  <span
                    className={`catalog-monogram catalog-monogram-${item.kind}`}
                  >
                    {item.monogram}
                  </span>
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
    (item) => item.tv || item.app || item.macAddress || item.device,
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
