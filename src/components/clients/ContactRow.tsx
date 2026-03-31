'use client';

import { ApiUtils } from '@/lib/api-utils';
import type { Contact } from '@/types';

interface ContactRowProps {
  row: Contact;
  idx: number;
  /** 'maintenance' uses action column (80px), 'escalation' uses contact column (110px) */
  table: 'maintenance' | 'escalation';
  availableRoles: string[];
  focusedField: string | null;
  setFocusedField: (field: string | null) => void;
  onRoleSelect: (
    e: React.ChangeEvent<HTMLSelectElement>,
    idx: number,
    table: 'maintenance' | 'escalation',
  ) => void;
  onUpdate: (idx: number, field: string, value: string) => void;
  onRemove: (idx: number) => void;
}

const gridColumns = {
  maintenance: '80px 1fr 1fr 95px 1fr 28px',
  escalation: '110px 1fr 1fr 95px 1fr 28px',
};

const inputStyle: React.CSSProperties = {
  padding: '5px 7px',
  fontSize: '0.7rem',
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: '5px',
  color: 'var(--foreground)',
  width: '100%',
};

const selectStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: '5px',
  color: 'var(--foreground)',
  padding: '4px 6px',
  fontSize: '0.7rem',
  fontWeight: 600,
  width: '100%',
  cursor: 'pointer',
  colorScheme: 'dark',
};

const optionStyle: React.CSSProperties = {
  background: 'var(--surface-solid)',
  color: 'var(--foreground)',
};

export default function ContactRow({
  row,
  idx,
  table,
  availableRoles,
  focusedField,
  setFocusedField,
  onRoleSelect,
  onUpdate,
  onRemove,
}: ContactRowProps) {
  const prefix = table === 'maintenance' ? 'm' : 'e';
  const firstColValue = table === 'maintenance' ? row.action || `${idx + 2}° Contato` : row.contact;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: gridColumns[table],
        padding: '5px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        gap: '6px',
        alignItems: 'center',
        background: 'rgba(16,185,129,0.07)',
      }}
    >
      {table === 'maintenance' ? (
        <div
          style={{
            padding: '5px 7px',
            fontSize: '0.7rem',
            background: 'var(--input-bg)',
            borderRadius: '5px',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
            fontWeight: 800,
          }}
        >
          {firstColValue}
        </div>
      ) : (
        <input
          value={row.contact || ''}
          onChange={(e) => onUpdate(idx, 'contact', e.target.value)}
          placeholder="Ex: Setor Financeiro"
          style={{ ...inputStyle, fontWeight: 800 }}
        />
      )}

      <select
        value={row.role || ''}
        onChange={(e) => onRoleSelect(e, idx, table)}
        style={selectStyle}
      >
        <option value="">Selecione...</option>
        {availableRoles.map((r) => (
          <option key={r} value={r} style={optionStyle}>
            {r}
          </option>
        ))}
        <option disabled style={{ ...optionStyle, color: 'var(--text-muted)' }}>
          ──────────
        </option>
        <option value="+++" style={optionStyle}>
          + Adicionar...
        </option>
        <option value="---" style={optionStyle}>
          🗑️ Excluir...
        </option>
      </select>

      <input
        value={row.name}
        onChange={(e) => onUpdate(idx, 'name', e.target.value)}
        placeholder="Nome"
        style={inputStyle}
      />

      <input
        value={
          focusedField === `${prefix}-phone-${idx}`
            ? row.phone
            : (ApiUtils.maskPII(row.phone) as string)
        }
        onFocus={() => setFocusedField(`${prefix}-phone-${idx}`)}
        onBlur={() => setFocusedField(null)}
        onChange={(e) => onUpdate(idx, 'phone', ApiUtils.formatPhone(e.target.value))}
        placeholder="Telefone"
        style={inputStyle}
      />

      <input
        value={
          focusedField === `${prefix}-email-${idx}`
            ? row.email
            : (ApiUtils.maskPII(row.email) as string)
        }
        onFocus={() => setFocusedField(`${prefix}-email-${idx}`)}
        onBlur={() => setFocusedField(null)}
        onChange={(e) => onUpdate(idx, 'email', e.target.value)}
        placeholder="Email"
        style={inputStyle}
      />

      <button
        onClick={() => onRemove(idx)}
        style={{
          background: 'rgba(239,68,68,0.2)',
          color: '#f87171',
          border: 'none',
          borderRadius: '4px',
          width: '24px',
          height: '24px',
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </div>
  );
}
