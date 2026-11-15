'use client';

import { Phone, Plus, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { emptyClientPhone, MAX_CLIENT_PHONES, type ClientPhoneInput } from '@/lib/client-phone';
import { formatBrazilianPhone } from '@/lib/phone';

export default function ClientPhonesEditor({
  phones,
  onChange,
}: {
  phones: ClientPhoneInput[];
  onChange: (phones: ClientPhoneInput[]) => void;
}) {
  const update = (index: number, field: keyof ClientPhoneInput, value: string) => {
    onChange(phones.map((phone, currentIndex) => currentIndex === index
      ? { ...phone, [field]: field === 'phone' ? formatBrazilianPhone(value) : value }
      : phone));
  };

  const makePrimary = (index: number) => {
    const selected = phones[index];
    onChange([selected, ...phones.filter((_, currentIndex) => currentIndex !== index)]);
  };

  return <section className="client-phones-editor" aria-labelledby="client-phones-title">
    <div className="client-phones-heading">
      <div>
        <span className="client-phones-eyebrow"><Phone/>Contatos</span>
        <h3 id="client-phones-title">Telefones do cliente</h3>
        <p>O primeiro telefone é o principal e será usado nas cobranças por WhatsApp.</p>
      </div>
      <strong>{phones.length}/{MAX_CLIENT_PHONES}</strong>
    </div>
    <div className="client-phone-list">
      {phones.map((phone, index) => <article className="client-phone-row" key={index}>
        <label className="field-label" htmlFor={`client-phone-label-${index}`}>
          <span>Identificação</span>
          <Input
            id={`client-phone-label-${index}`}
            value={phone.label}
            maxLength={50}
            placeholder={index === 0 ? 'Principal' : 'Ex.: Recado, comercial'}
            onChange={(event) => update(index, 'label', event.currentTarget.value)}
          />
        </label>
        <label className="field-label" htmlFor={`client-phone-number-${index}`}>
          <span>Telefone com DDD</span>
          <Input
            id={`client-phone-number-${index}`}
            value={phone.phone}
            type="tel"
            inputMode="numeric"
            autoComplete={index === 0 ? 'tel-national' : 'off'}
            required
            pattern="\([0-9]{2}\) [0-9]{4,5}-[0-9]{4}"
            title="Informe o DDD e o telefone no formato (21) 99163-5584"
            placeholder="(21) 99163-5584"
            onChange={(event) => update(index, 'phone', event.currentTarget.value)}
          />
        </label>
        <div className="client-phone-actions">
          {index === 0
            ? <span className="primary-phone-badge"><Star/>Principal</span>
            : <Button type="button" size="sm" variant="outline" onClick={() => makePrimary(index)}><Star/>Tornar principal</Button>}
          <Button
            type="button"
            size="icon-sm"
            variant="destructive"
            aria-label={`Remover telefone ${index + 1}`}
            disabled={phones.length === 1}
            onClick={() => onChange(phones.filter((_, currentIndex) => currentIndex !== index))}
          ><Trash2/></Button>
        </div>
      </article>)}
    </div>
    <Button
      type="button"
      variant="outline"
      disabled={phones.length >= MAX_CLIENT_PHONES}
      onClick={() => onChange([...phones, emptyClientPhone()])}
    ><Plus/>Adicionar telefone</Button>
  </section>;
}
