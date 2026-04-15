'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

import ContactRow from '@/components/clients/ContactRow';
import { useToast } from '@/components/ui/toast';
import { contactsApi } from '@/lib/api-client';
import { UNIQUE_ROLES, MAINT_ROLES, migrateRole } from '@/lib/constants';
import type { Contact, InternalContact } from '@/types';

interface ContactListModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string | null;
  initialTech: {
    name: string;
    phone: string;
    email: string;
  };
  internalStaff: InternalContact[];
  availableMaintRoles: string[];
  availableEscRoles: string[];
  setAvailableMaintRoles: (roles: string[]) => void;
  setAvailableEscRoles: (roles: string[]) => void;
}

export default function ContactListModal({
  isOpen,
  onClose,
  contractId,
  initialTech,
  internalStaff,
  availableMaintRoles,
  availableEscRoles,
  setAvailableMaintRoles,
  setAvailableEscRoles,
}: ContactListModalProps) {
  const defaultContacts = () => ({
    maintenance: [
      { action: '2° Contato', role: 'Técnico de Sistemas (Líder)', name: '', phone: '', email: '' },
      { action: '3° Contato', role: 'Supervisor', name: '', phone: '', email: '' },
      { action: '4° Contato', role: 'Coordenador', name: '', phone: '', email: '' },
    ],
    escalation: [
      { contact: 'Setor Comercial', role: 'Comercial Obras/Peça', name: '', phone: '', email: '' },
      { contact: '', role: 'Comercial Serviços', name: '', phone: '', email: '' },
      { contact: 'Manutenção Sistemas', role: 'Gerente', name: '', phone: '', email: '' },
      { contact: 'Operação de Segurança', role: 'Diretor', name: '', phone: '', email: '' },
    ],
  });

  const [contacts, setContacts] = useState<{
    maintenance: Contact[];
    escalation: Contact[];
  }>(defaultContacts());

  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Carregar dados salvos ao abrir o modal
  useEffect(() => {
    if (isOpen && contractId) {
      loadContacts();
    }
  }, [isOpen, contractId]);

  const loadContacts = async () => {
    try {
      const { data, ok } = await contactsApi.get(contractId!);
      if (ok && data) {
        // Garantimos que não existam campos null no estado
        const sanitize = (list: Partial<Contact>[]) =>
          (list || []).map((row) => ({
            ...row,
            name: row.name || '',
            phone: row.phone || '',
            email: row.email || '',
            role: migrateRole(row.role || ''),
            action: row.action || '',
            contact: row.contact || '',
          }));

        const santizedMaint = sanitize(data.maintenance);
        const sortedMaint = santizedMaint.sort(
          (a, b) => getMaintenanceRank(a.role) - getMaintenanceRank(b.role),
        );
        const finalMaint = sortedMaint.map((r, i) => ({
          ...r,
          action: `${i + 2}° Contato`,
        }));

        setContacts({
          maintenance: finalMaint,
          escalation: sanitize(data.escalation),
        });
      } else {
        // Se falhar (ex: contrato novo), tenta sincronizar com a staff
        const defaults = defaultContacts();
        const usedIds = new Set<string>();
        const syncRow = (row: Contact) => {
          if (row.role) {
            const match = internalStaff.find((s) => {
              if (usedIds.has(s.id)) return false;
              return s.role?.toLowerCase() === row.role.toLowerCase();
            });
            if (match) {
              usedIds.add(match.id);
              return {
                ...row,
                name: match.name || '',
                phone: match.phone || '',
                email: match.email || '',
              };
            }
          }
          return row;
        };
        setContacts({
          maintenance: defaults.maintenance.map(syncRow),
          escalation: defaults.escalation.map(syncRow),
        });
      }
    } catch {}
  };

  const syncWithStaff = () => {
    const maintStaff = internalStaff.filter((s) => MAINT_ROLES.includes(s.role));
    const escStaff = internalStaff.filter((s) => !MAINT_ROLES.includes(s.role));

    const toMaintRow = (s: InternalContact, i: number) => ({
      action: `${i + 2}° Contato`,
      role: s.role || '',
      name: s.name || '',
      phone: s.phone || '',
      email: s.email || '',
    });

    const toEscRow = (s: InternalContact) => ({
      contact: getEscalationDepartment(s.role, s.role),
      role: s.role || '',
      name: s.name || '',
      phone: s.phone || '',
      email: s.email || '',
    });

    setContacts((prev) => ({
      maintenance: maintStaff
        .sort((a, b) => getMaintenanceRank(a.role) - getMaintenanceRank(b.role))
        .map((s, i) => {
          const existing = prev.maintenance.find((r) => r.role === s.role);
          return existing
            ? {
                ...existing,
                name: s.name || existing.name,
                phone: s.phone || existing.phone,
                email: s.email || existing.email,
              }
            : toMaintRow(s, i);
        }),
      escalation: escStaff
        .sort((a, b) => getEscalationRank(a.role) - getEscalationRank(b.role))
        .map((s) => {
          const existing = prev.escalation.find((r) => r.role === s.role);
          return existing
            ? {
                ...existing,
                contact: getEscalationDepartment(s.role, existing.contact || ''),
                name: s.name || existing.name,
                phone: s.phone || existing.phone,
                email: s.email || existing.email,
              }
            : toEscRow(s);
        }),
    }));
  };

  const handleSave = async () => {
    if (!contractId) return;
    setSaving(true);

    // LIMPEZA FINAL: Antes de enviar para a API, garante que nada seja NULL
    const sanitizeForAPI = (list: Contact[]) =>
      list.map((item) => ({
        ...item,
        name: item.name || '',
        phone: item.phone || '',
        email: item.email || '',
        role: item.role || '',
        action: item.action || '',
        contact: item.contact || '',
      }));

    const payload = {
      maintenance: sanitizeForAPI(contacts.maintenance),
      escalation: sanitizeForAPI(contacts.escalation),
    };

    try {
      const res = await contactsApi.save(contractId!, payload);
      if (!res.ok) {
        showToast(`Erro ao salvar: ${res.error || 'Tente novamente'}`, 'error');
      } else {
        showToast('Contatos salvos com sucesso');
        onClose();
      }
    } catch {
      showToast('Falha crítica ao conectar com o servidor.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getMaintenanceRank = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('(líder)') || r.includes('(lider)')) return 1;
    if (r.includes('líder') || r.includes('lider')) return 1;
    if (r.includes('supervisor')) return 2;
    if (r.includes('coordenador')) return 3;
    return 4;
  };

  const getEscalationRank = (role: string) => {
    if (role === 'Comercial Obras/Peça') return 1;
    if (role === 'Comercial Serviços') return 2;
    if (role === 'Gerente') return 3;
    if (role === 'Diretor') return 4;
    return 5;
  };

  const getEscalationDepartment = (role: string, currentContact: string) => {
    if (role === 'Comercial Obras/Peça' || role === 'Comercial Serviços') return 'Setor Comercial';
    if (role === 'Gerente') return 'Manutenção de Sistemas';
    if (role === 'Diretor') return 'Operação de Segurança';
    return currentContact;
  };

  const updateMaintenance = (idx: number, field: string, value: string) =>
    setContacts((prev) => {
      const nextMaint = prev.maintenance.map((r, i) => (i === idx ? { ...r, [field]: value } : r));
      if (field === 'role') {
        const sorted = [...nextMaint].sort(
          (a, b) => getMaintenanceRank(a.role) - getMaintenanceRank(b.role),
        );
        const withCorrectActions = sorted.map((r, i) => ({
          ...r,
          action: `${i + 2}° Contato`,
        }));
        return { ...prev, maintenance: withCorrectActions };
      }
      return { ...prev, maintenance: nextMaint };
    });

  const updateEscalation = (idx: number, field: string, value: string) =>
    setContacts((prev) => {
      const nextEsc = prev.escalation.map((r, i) => {
        if (i !== idx) return r;
        const newRow = { ...r, [field]: value };
        if (field === 'role') {
          newRow.contact = getEscalationDepartment(value, newRow.contact || '');
        }
        return newRow;
      });
      if (field === 'role')
        nextEsc.sort((a, b) => getEscalationRank(a.role) - getEscalationRank(b.role));
      return { ...prev, escalation: nextEsc };
    });

  const handleRoleSelect = (
    e: React.ChangeEvent<HTMLSelectElement>,
    idx: number,
    table: 'maintenance' | 'escalation',
  ) => {
    const val = e.target.value;
    const isMaint = table === 'maintenance';
    const currentRoles = isMaint ? availableMaintRoles : availableEscRoles;
    const setRoles = isMaint ? setAvailableMaintRoles : setAvailableEscRoles;
    const storageKey = isMaint ? 'compasss_maint_roles' : 'compasss_esc_roles';

    if (val === '+++') {
      const nova = window.prompt('Nova função:');
      if (nova && nova.trim()) {
        const newRoles = [...currentRoles, nova.trim()];
        setRoles(newRoles);
        localStorage.setItem(storageKey, JSON.stringify(newRoles));
        if (isMaint) updateMaintenance(idx, 'role', nova.trim());
        else updateEscalation(idx, 'role', nova.trim());
      }
    } else if (val === '---') {
      const qual = window.prompt(
        'Qual função deseja excluir? Digite o nome exato:\n' + currentRoles.join(', '),
      );
      if (qual) {
        const filtered = currentRoles.filter((r) => r !== qual);
        setRoles(filtered);
        localStorage.setItem(storageKey, JSON.stringify(filtered));
      }
    } else {
      if (val !== '+++' && val !== '---' && UNIQUE_ROLES.includes(val)) {
        const alreadyInMaint = contacts.maintenance.find(
          (r, i) => r.role === val && (table !== 'maintenance' || i !== idx),
        );
        const alreadyInEsc = contacts.escalation.find(
          (r, i) => r.role === val && (table !== 'escalation' || i !== idx),
        );

        if (alreadyInMaint || alreadyInEsc) {
          showToast(
            `Ops! Já existe um(a) ${val} na lista de contatos deste cliente. Este cargo de gestão deve ser único por contrato.`,
            'error',
          );
          return;
        }
      }

      // Lógica de Preenchimento Sequencial (Inteligente)
      const usedNames = new Set([
        ...contacts.maintenance.map((r) => r.name),
        ...contacts.escalation.map((r) => r.name),
      ]);

      const matched = internalStaff.find(
        (s) => (s.role || '').toLowerCase() === val.toLowerCase() && !usedNames.has(s.name),
      );

      if (isMaint) {
        setContacts((prev) => {
          const nextMaint = prev.maintenance.map((r, i) => {
            if (i !== idx) return r;
            const updated = { ...r, role: val };
            if (matched) {
              updated.name = matched.name || '';
              updated.phone = matched.phone || '';
              updated.email = matched.email || '';
            }
            return updated;
          });

          const sorted = [...nextMaint].sort(
            (a, b) => getMaintenanceRank(a.role) - getMaintenanceRank(b.role),
          );
          const withCorrectActions = sorted.map((r, i) => ({
            ...r,
            action: `${i + 2}° Contato`,
          }));

          return { ...prev, maintenance: withCorrectActions };
        });
      } else {
        setContacts((prev) => {
          const nextEsc = prev.escalation.map((r, i) => {
            if (i !== idx) return r;
            const updated = { ...r, role: val };
            if (matched) {
              updated.name = matched.name || '';
              updated.phone = matched.phone || '';
              updated.email = matched.email || '';
            }
            updated.contact = getEscalationDepartment(val, updated.contact || '');
            return updated;
          });
          nextEsc.sort((a, b) => getEscalationRank(a.role) - getEscalationRank(b.role));
          return { ...prev, escalation: nextEsc };
        });
      }
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.92)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backdropFilter: 'blur(8px)',
      }}
    >
      <section
        className="glass-panel animate-fade-in hide-scrollbar"
        style={{
          width: '100%',
          maxWidth: '1350px',
          maxHeight: '96vh',
          overflowY: 'auto',
          scrollbarWidth: 'none',
          padding: '1.5rem',
          border: '1px solid var(--primary-border-subtle)',
          borderRadius: '16px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h2
              className="text-2xl font-bold flex items-center"
              style={{ color: 'var(--foreground)' }}
            >
              📋 Lista de Contatos
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Edite, adicione ou remova contatos chave para este contrato.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={syncWithStaff}
              style={{
                background: 'var(--primary-subtle)',
                color: 'var(--primary)',
                border: '1px solid var(--primary-border-subtle)',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'opacity 0.2s, background 0.2s',
              }}
              title="Preencher campos vazios com a equipe oficial da Staff"
            >
              🔄 Sincronizar com Staff
            </button>
            <button
              onClick={onClose}
              aria-label="Fechar modal"
              style={{
                background: 'var(--input-bg)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '1.2rem',
                cursor: 'pointer',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Seções lado a lado */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.2rem',
            alignItems: 'start',
          }}
        >
          {/* SEÇÃO 1: Manutenção de Sistemas */}
          <div>
            <div
              style={{
                background: 'var(--primary-subtle)',
                color: 'var(--primary)',
                padding: '10px 14px',
                borderRadius: '8px 8px 0 0',
                fontWeight: 800,
                fontSize: '0.8rem',
                letterSpacing: '1px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--primary-border-subtle)',
              }}
            >
              <span>🔧 MANUTENÇÃO DE SISTEMAS</span>
            </div>
            <div
              style={{
                border: '1px solid var(--primary-border-subtle)',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                overflow: 'hidden',
              }}
            >
              {/* Cabeçalho */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr 1fr 95px 1fr 28px',
                  background: 'var(--surface, rgba(0,0,0,0.2))',
                  padding: '7px 10px',
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  gap: '6px',
                }}
              >
                <span>Ação</span>
                <span>Função</span>
                <span>Nome</span>
                <span>Telefone</span>
                <span>E-mail</span>
                <span></span>
              </div>

              {/* 1° Contato (Read-Only) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr 1fr 95px 1fr 28px',
                  padding: '8px 10px',
                  fontSize: '0.75rem',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  gap: '6px',
                  alignItems: 'center',
                  background: 'rgba(16,185,129,0.07)',
                }}
              >
                <div
                  style={{
                    padding: '5px 7px',
                    fontSize: '0.7rem',
                    background: 'var(--input-bg)',
                    borderRadius: '5px',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                    fontWeight: 800,
                    cursor: 'not-allowed',
                  }}
                >
                  1° Contato
                </div>
                <span
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.72rem',
                    fontStyle: 'italic',
                    fontWeight: 600,
                    opacity: 0.8,
                  }}
                >
                  Técnico (Fixo)
                </span>
                <span style={{ fontWeight: 800, color: 'var(--foreground)', fontSize: '0.75rem' }}>
                  {initialTech.name || '—'}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700 }}>
                  {initialTech.phone || '—'}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 500 }}>
                  {initialTech.email || '—'}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'rgba(255,255,255,0.2)',
                    textAlign: 'center',
                  }}
                >
                  🔒
                </span>
              </div>

              {/* Linhas Editáveis */}
              {contacts.maintenance.map((row, idx) => (
                <ContactRow
                  key={idx}
                  row={row}
                  idx={idx}
                  table="maintenance"
                  availableRoles={availableMaintRoles}
                  focusedField={focusedField}
                  setFocusedField={setFocusedField}
                  onRoleSelect={handleRoleSelect}
                  onUpdate={updateMaintenance}
                  onRemove={(i) =>
                    setContacts((p) => ({
                      ...p,
                      maintenance: p.maintenance.filter((_, j) => j !== i),
                    }))
                  }
                />
              ))}
              <div style={{ padding: '8px 10px' }}>
                <button
                  onClick={() =>
                    setContacts((p) => ({
                      ...p,
                      maintenance: [
                        ...p.maintenance,
                        {
                          action: `${p.maintenance.length + 2}° Contato`,
                          role: '',
                          name: '',
                          phone: '',
                          email: '',
                        },
                      ],
                    }))
                  }
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px dashed #10b981',
                    color: '#10b981',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  + Adicionar Contato
                </button>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: Escalonamento */}
          <div>
            <div
              style={{
                background: 'var(--primary-subtle)',
                color: 'var(--primary)',
                padding: '10px 14px',
                borderRadius: '8px 8px 0 0',
                fontWeight: 800,
                fontSize: '0.8rem',
                letterSpacing: '1px',
                borderBottom: '1px solid var(--primary-border-subtle)',
              }}
            >
              🚨 ESCALONAMENTO E CONTATOS-CHAVE
            </div>
            <div
              style={{
                border: '1px solid var(--primary-border-subtle)',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1fr 1fr 95px 1fr 28px',
                  background: 'var(--surface, rgba(0,0,0,0.2))',
                  padding: '7px 10px',
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  gap: '6px',
                }}
              >
                <span>Contato</span>
                <span>Função</span>
                <span>Nome</span>
                <span>Telefone</span>
                <span>E-mail</span>
                <span></span>
              </div>
              {contacts.escalation.map((row, idx) => (
                <ContactRow
                  key={idx}
                  row={row}
                  idx={idx}
                  table="escalation"
                  availableRoles={availableEscRoles}
                  focusedField={focusedField}
                  setFocusedField={setFocusedField}
                  onRoleSelect={handleRoleSelect}
                  onUpdate={updateEscalation}
                  onRemove={(i) =>
                    setContacts((p) => ({
                      ...p,
                      escalation: p.escalation.filter((_, j) => j !== i),
                    }))
                  }
                />
              ))}
              <div style={{ padding: '8px 10px' }}>
                <button
                  onClick={() =>
                    setContacts((p) => ({
                      ...p,
                      escalation: [
                        ...p.escalation,
                        { contact: '', role: '', name: '', phone: '', email: '' },
                      ],
                    }))
                  }
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'rgba(6,78,59,0.1)',
                    border: '1px dashed #065f46',
                    color: '#34d399',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  + Adicionar Contato
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '2rem', display: 'flex', gap: '12px' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
            style={{ flex: 1, padding: '12px', borderRadius: '10px', fontWeight: 'bold' }}
          >
            {saving ? 'Salvando...' : '✅ Salvar Alterações'}
          </button>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ flex: 1, padding: '12px', borderRadius: '10px', fontWeight: 'bold' }}
          >
            Cancelar
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
