'use client';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { useConfirm } from '@/components/ui/confirm-modal';
import { GlassCard } from '@/components/ui/glass-card';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { staffApi } from '@/lib/api-client';
import { ApiUtils } from '@/lib/api-utils';
import { EMAIL_DOMAIN, UNIQUE_ROLES, MAINT_ROLES, migrateRole } from '@/lib/constants';
import type { InternalContact } from '@/types';

type StaffMember = InternalContact;

const ROLE_RANK: Record<string, number> = {
  '(líder)': 10,
  '(lider)': 10,
  supervisor: 20,
  coordenador: 30,
  comercial: 100,
  gerente: 110,
  diretor: 120,
};
const getRank = (role: string) => {
  const r = role.toLowerCase();
  return Object.entries(ROLE_RANK).find(([k]) => r.includes(k))?.[1] ?? 999;
};

function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
      <span style={{ fontSize: '1.4rem' }}>{icon}</span>
      <h2
        style={{
          fontSize: '1.1rem',
          color: 'var(--foreground)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          margin: 0,
        }}
      >
        {label}
      </h2>
    </div>
  );
}

function StaffItem({
  s,
  index,
  onEdit,
  onDelete,
}: {
  s: StaffMember;
  index: number;
  onEdit: (s: StaffMember) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const initials = s.name
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  return (
    <li
      style={{
        listStyle: 'none',
        animation: `fadeIn 0.6s var(--ease-out-expo) forwards ${index * 0.1}s`,
        opacity: 0,
      }}
    >
      <GlassCard
        className="responsive-card"
        style={{
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.5rem 2rem',
        }}
      >
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: '50px',
              height: '50px',
              flexShrink: 0,
              background: 'var(--primary-subtle)',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border)',
              fontWeight: 800,
              fontSize: '1rem',
              letterSpacing: '-0.5px',
              color: 'var(--primary)',
            }}
          >
            {initials}
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '6px',
                flexWrap: 'wrap',
              }}
            >
              <strong
                style={{
                  fontSize: '1.25rem',
                  color: 'var(--foreground)',
                  fontWeight: 700,
                  letterSpacing: '-0.5px',
                }}
              >
                {s.name}
              </strong>
              <Badge variant="primary">{s.role}</Badge>
            </div>
            <div
              className="info-row-mobile"
              style={{
                display: 'flex',
                gap: '2rem',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: 'var(--primary)', flexShrink: 0 }}
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                {ApiUtils.maskPII(s.phone ?? '')}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: 'var(--primary)', flexShrink: 0 }}
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                {ApiUtils.maskPII(s.email ?? '')}
              </span>
            </div>
          </div>
        </div>

        <div className="card-actions">
          <button
            onClick={() => onEdit(s)}
            className="btn-secondary"
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
          >
            Editar
          </button>
          <button onClick={() => onDelete(s.id, s.name)} className="btn-danger">
            Excluir
          </button>
        </div>
      </GlassCard>
    </li>
  );
}

export default function StaffPage() {
  const { showToast } = useToast();
  const [confirmModal, confirm] = useConfirm();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [emailPrefix, setEmailPrefix] = useState('');
  const [phone, setPhone] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const carregarDados = useCallback(async () => {
    try {
      const { data } = await staffApi.list();
      if (data) {
        setStaff(
          data.map((s) => ({
            ...s,
            role: migrateRole(s.role || ''),
          })),
        );
      }
    } catch {}
  }, []);

  useEffect(() => {
    carregarDados(); // eslint-disable-line react-hooks/set-state-in-effect -- fetch inicial
  }, [carregarDados]);

  const resetForm = () => {
    setName('');
    setRole('');
    setEmailPrefix('');
    setPhone('');
    setEditingId(null);
    setIsModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullEmail = emailPrefix ? `${emailPrefix.split('@')[0]}@${EMAIL_DOMAIN}` : '';

    if (UNIQUE_ROLES.includes(role)) {
      const existing = staff.find((s) => s.role === role && s.id !== editingId);
      if (existing) {
        showToast(`Atenção: O cargo de ${role} já está ocupado por ${existing.name}.`, 'error');
        return;
      }
    }

    const payload = { name, role, email: fullEmail, phone };

    try {
      const res = editingId
        ? await staffApi.update(editingId, payload)
        : await staffApi.create(payload);
      if (res.ok) {
        carregarDados();
        resetForm();
        showToast('Contato salvo com sucesso');
      } else {
        showToast(`Erro: ${res.error || 'Falha no servidor'}`, 'error');
      }
    } catch {
      showToast('Falha de conexão. Tente novamente.', 'error');
    }
  };

  const handleEdit = (s: StaffMember) => {
    setEditingId(s.id);
    setName(s.name);
    setRole(migrateRole(s.role || ''));
    setEmailPrefix(s.email?.split('@')[0] || '');
    setPhone(ApiUtils.formatPhone(s.phone || ''));
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, sName: string) => {
    const ok = await confirm({
      title: 'Excluir integrante',
      message: `Tem certeza que deseja excluir '${sName}'?`,
    });
    if (!ok) return;
    const res = await staffApi.delete(id);
    if (res.ok) {
      carregarDados();
      showToast('Contato excluído com sucesso');
    }
  };

  const maintGroup = staff
    .filter((s) => MAINT_ROLES.includes(s.role))
    .sort((a, b) => getRank(a.role) - getRank(b.role));
  const escGroup = staff
    .filter((s) => !MAINT_ROLES.includes(s.role))
    .sort((a, b) => getRank(a.role) - getRank(b.role));

  return (
    <main style={{ padding: '4rem 2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="title" style={{ margin: 0, fontSize: '3.2rem', letterSpacing: '-1.5px' }}>
            Painel da Equipe
          </h1>
          <p
            style={{
              color: 'var(--text-muted)',
              marginTop: '0.5rem',
              fontSize: '1.1rem',
              maxWidth: '450px',
            }}
          >
            Gerenciamento oficial de contatos internos e níveis de monitoramento operacional.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="btn-primary"
        >
          + Novo Integrante
        </button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={resetForm}
        title={editingId ? 'Editar Integrante' : 'Novo Integrante'}
      >
        <form
          onSubmit={handleSave}
          style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
        >
          <div className="form-field">
            <label htmlFor="staff-name" className="form-label">
              Nome Completo
            </label>
            <input
              id="staff-name"
              className="form-input"
              type="text"
              placeholder="Nome do integrante"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="staff-role" className="form-label">
              Cargo / Função
            </label>
            <select
              id="staff-role"
              className="form-input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              style={{ cursor: 'pointer' }}
            >
              <option value="" disabled>
                Selecione um Cargo
              </option>
              <option value="Técnico de Sistemas (Líder)">Técnico de Sistemas (Líder)</option>
              <option value="Supervisor">Supervisor</option>
              <option value="Coordenador">Coordenador</option>
              <option value="Comercial Obras/Peça">Comercial Obras/Peça</option>
              <option value="Comercial Serviços">Comercial Serviços</option>
              <option value="Gerente">Gerente</option>
              <option value="Diretor">Diretor</option>
              <option value="Outros">Outros</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="staff-email" className="form-label">
              E-mail (Opcional)
            </label>
            <div className="email-input-wrapper">
              <input
                id="staff-email"
                className="form-input"
                type="text"
                placeholder="usuário"
                value={emailPrefix}
                onChange={(e) => setEmailPrefix(e.target.value.split('@')[0])}
              />
              <span className="email-domain-badge">@{EMAIL_DOMAIN}</span>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="staff-phone" className="form-label">
              Telefone (Opcional)
            </label>
            <input
              id="staff-phone"
              className="form-input"
              type="text"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(ApiUtils.formatPhone(e.target.value))}
              maxLength={15}
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>
              {editingId ? 'Salvar Alterações' : 'Cadastrar'}
            </button>
            <button type="button" onClick={resetForm} className="btn-secondary" style={{ flex: 1 }}>
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
        <section>
          <SectionHeader icon="🛠️" label="Manutenção de Sistemas" />
          {maintGroup.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', paddingLeft: '2.5rem' }}>
              Não há contatos técnicos registrados.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {maintGroup.map((s, i) => (
                <StaffItem key={s.id} s={s} index={i} onEdit={handleEdit} onDelete={handleDelete} />
              ))}
            </ul>
          )}
        </section>
        <section>
          <SectionHeader icon="📈" label="Escalonamento e Gestão" />
          {escGroup.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', paddingLeft: '2.5rem' }}>
              Não há contatos de gestão registrados.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {escGroup.map((s, i) => (
                <StaffItem
                  key={s.id}
                  s={s}
                  index={i + maintGroup.length}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      {confirmModal}
    </main>
  );
}
