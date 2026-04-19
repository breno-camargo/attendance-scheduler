'use client';

import { useState, useEffect } from 'react';

import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { capitalizeName, formatPhone } from '@/lib/formatting';
import type { Client, Professional } from '@/types';

interface ContractFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingId: string | null;
  initialData?: Client | null;
  professionals: Professional[];
}

export default function ContractFormModal({
  isOpen,
  onClose,
  onSuccess,
  editingId,
  initialData,
  professionals,
}: ContractFormModalProps) {
  const { showToast } = useToast();
  const defaultSystems = ['SDAI', 'CFTV', 'SAP', 'SCA', 'SAI'];
  const monthNames = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [visitsPerMonth, setVisitsPerMonth] = useState('2');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [targetMonths, setTargetMonths] = useState<number[]>([]);
  const [professionalId, setProfessionalId] = useState('');
  const [availableSystems, setAvailableSystems] = useState<string[]>(defaultSystems);
  const [selectedSystems, setSelectedSystems] = useState<string[]>(['SDAI', 'CFTV']);
  const [preferredDays, setPreferredDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [newSystem, setNewSystem] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editingId && initialData) {
        setName(initialData.name || '');
        setPhone(formatPhone(initialData.phone || ''));
        const contract = initialData.contracts?.[0];
        if (contract) {
          setVisitsPerMonth(contract.visitsPerMonth?.toString() || '2');
          setFrequency(contract.frequency || 'MONTHLY');
          setProfessionalId(contract.professionalId || '');
          const savedSystems = contract.systemTypes ? contract.systemTypes.split(',') : [];
          setSelectedSystems(savedSystems);
          const currentAvailable = [...defaultSystems];
          savedSystems.forEach((s: string) => {
            if (!currentAvailable.includes(s)) currentAvailable.push(s);
          });
          setAvailableSystems(currentAvailable);
          setTargetMonths(
            contract.targetMonths ? contract.targetMonths.split(',').map(Number) : [],
          );
          setPreferredDays(
            contract.preferredDays ? contract.preferredDays.split(',').map(Number) : [],
          );
        }
      } else {
        setName('');
        setPhone('');
        setVisitsPerMonth('2');
        setFrequency('MONTHLY');
        setTargetMonths([]);
        setProfessionalId(professionals[0]?.id || '');
        setAvailableSystems([...defaultSystems]);
        setSelectedSystems(['SDAI', 'CFTV']);
        setPreferredDays([]);
      }
    }
  }, [isOpen, editingId, initialData, professionals]);

  const toggleTargetMonth = (m: number) => {
    if (targetMonths.includes(m)) {
      setTargetMonths(targetMonths.filter((prev) => prev !== m));
    } else {
      if (frequency === 'MONTHLY') {
        setTargetMonths([...targetMonths, m]);
      } else {
        const period =
          frequency === 'BIMONTHLY'
            ? 2
            : frequency === 'QUARTERLY'
              ? 3
              : frequency === 'SEMIANNUAL'
                ? 6
                : 12;
        const newMonths = [...targetMonths];
        for (let i = m; i < 12; i += period) {
          if (!newMonths.includes(i)) newMonths.push(i);
        }
        setTargetMonths(newMonths.sort((a, b) => a - b));
      }
    }
  };

  const toggleSystem = (sys: string) => {
    setSelectedSystems(
      selectedSystems.includes(sys)
        ? selectedSystems.filter((s) => s !== sys)
        : [...selectedSystems, sys],
    );
  };

  const addCustomSystem = () => {
    const upper = newSystem.trim().toUpperCase();
    if (!upper) return;
    if (!availableSystems.includes(upper)) setAvailableSystems([...availableSystems, upper]);
    if (!selectedSystems.includes(upper)) setSelectedSystems([...selectedSystems, upper]);
    setNewSystem('');
  };

  const removeSystem = (e: React.MouseEvent, sys: string) => {
    e.stopPropagation();
    if (defaultSystems.includes(sys)) return;
    setAvailableSystems(availableSystems.filter((s) => s !== sys));
    setSelectedSystems(selectedSystems.filter((s) => s !== sys));
  };

  const togglePreferredDay = (day: number) => {
    setPreferredDays(
      preferredDays.includes(day)
        ? preferredDays.filter((d) => d !== day)
        : [...preferredDays, day],
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: capitalizeName(name),
      phone,
      visitsPerMonth,
      frequency,
      targetMonths: targetMonths.join(','),
      professionalId,
      systemTypes: selectedSystems.join(','),
      preferredDays: preferredDays.join(','),
    };
    try {
      const url = editingId ? `/api/clients/${editingId}` : '/api/clients';
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        showToast(`Erro ao salvar: ${err.details || err.error || 'Falha no servidor'}`, 'error');
      }
    } catch {
      showToast('Erro de conexão com o servidor.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleBtnStyle = (selected: boolean, disabled = false): React.CSSProperties => ({
    padding: '6px 0',
    borderRadius: '6px',
    border: `1px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
    background: selected ? 'var(--primary-subtle)' : 'var(--input-bg)',
    color: selected ? 'var(--primary)' : disabled ? 'var(--text-muted)' : 'var(--foreground)',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.3 : 1,
    transition: 'opacity 0.15s, background 0.15s',
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingId ? 'Editar Contrato' : 'Novo Contrato'}
      maxWidth="700px"
    >
      <form onSubmit={handleSave} style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <div className="form-field" style={{ flex: 2 }}>
            <label htmlFor="contract-name" className="form-label">
              Nome do Cliente (Prédio/Shopping)
            </label>
            <input
              id="contract-name"
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ex: Shopping Ibirapuera"
            />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="contract-phone" className="form-label">
              Telefone (Opcional)
            </label>
            <input
              id="contract-phone"
              className="form-input"
              type="text"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              maxLength={15}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="contract-freq" className="form-label">
              Frequência
            </label>
            <select
              id="contract-freq"
              className="form-input"
              value={frequency}
              onChange={(e) => {
                setFrequency(e.target.value);
                setTargetMonths([]);
              }}
              required
              style={{ cursor: 'pointer' }}
            >
              <option value="MONTHLY">Mensal</option>
              <option value="BIMONTHLY">Bimestral</option>
              <option value="QUARTERLY">Trimestral</option>
              <option value="SEMIANNUAL">Semestral</option>
              <option value="ANNUAL">Anual</option>
            </select>
          </div>
          {frequency === 'MONTHLY' && (
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="contract-visits" className="form-label">
                Visitas/Mês
              </label>
              <input
                id="contract-visits"
                className="form-input"
                type="number"
                min="1"
                max="30"
                value={visitsPerMonth}
                onChange={(e) => setVisitsPerMonth(e.target.value)}
                required
              />
            </div>
          )}
          <div className="form-field" style={{ flex: 2 }}>
            <label htmlFor="contract-prof" className="form-label">
              Técnico Responsável
            </label>
            <select
              id="contract-prof"
              className="form-input"
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="">Selecione o Técnico</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
            }}
          >
            <label className="form-label" style={{ margin: 0 }}>
              Estratégia Mensal (Meses de Visita)
            </label>
            {targetMonths.length > 0 && (
              <button
                type="button"
                onClick={() => setTargetMonths([])}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--danger, #f87171)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Limpar
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
            {monthNames.map((m, i) => {
              const period =
                frequency === 'BIMONTHLY'
                  ? 2
                  : frequency === 'QUARTERLY'
                    ? 3
                    : frequency === 'SEMIANNUAL'
                      ? 6
                      : frequency === 'ANNUAL'
                        ? 12
                        : 1;
              const firstMonth = targetMonths.length > 0 ? Math.min(...targetMonths) : null;
              const isAllowed = firstMonth === null || (i - firstMonth) % period === 0;
              const isSelected = targetMonths.includes(i);
              const isDisabled = !isAllowed && frequency !== 'MONTHLY';
              return (
                <button
                  key={m}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => toggleTargetMonth(i)}
                  style={toggleBtnStyle(isSelected, isDisabled)}
                >
                  {m}
                </button>
              );
            })}
          </div>
          {frequency !== 'MONTHLY' && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(234,179,8,0.08)',
                border: '1px solid rgba(234,179,8,0.2)',
                marginTop: '8px',
              }}
            >
              <p style={{ color: '#eab308', fontSize: '0.75rem', margin: 0, fontWeight: 700 }}>
                ⚠️ Modo Baixa Frequência — testes SDAI devem ser inseridos manualmente.
              </p>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.8rem',
            alignItems: 'start',
          }}
        >
          <div className="form-field" style={{ margin: 0 }}>
            <label className="form-label">Dias de Preferência (Opcional)</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[1, 2, 3, 4, 5].map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => togglePreferredDay(d)}
                  style={{
                    ...toggleBtnStyle(preferredDays.includes(d)),
                    flex: 1,
                    padding: '10px 0',
                  }}
                >
                  {dayNames[i]}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <label className="form-label">Sistemas Mantidos</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              {availableSystems.map((sys) => (
                <div key={sys} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => toggleSystem(sys)}
                    style={{
                      ...toggleBtnStyle(selectedSystems.includes(sys)),
                      padding: '7px 14px',
                      paddingRight: !defaultSystems.includes(sys) ? '26px' : '14px',
                    }}
                  >
                    {sys}
                  </button>
                  {!defaultSystems.includes(sys) && (
                    <span
                      onClick={(e) => removeSystem(e, sys)}
                      style={{
                        position: 'absolute',
                        right: '4px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--danger, #f87171)',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      &times;
                    </span>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="text"
                  value={newSystem}
                  onChange={(e) => setNewSystem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomSystem();
                    }
                  }}
                  placeholder="Novo sistema"
                  style={{
                    width: '90px',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: '1px dashed var(--primary)',
                    background: 'var(--input-bg)',
                    color: 'var(--foreground)',
                    fontSize: '0.75rem',
                  }}
                />
                <button
                  type="button"
                  onClick={addCustomSystem}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: '1px dashed var(--primary)',
                    background: 'var(--primary-subtle)',
                    color: 'var(--primary)',
                    fontSize: '1rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
          <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1 }}>
            {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Contrato'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}
