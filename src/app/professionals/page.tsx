'use client';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { useConfirm } from '@/components/ui/confirm-modal';
import { GlassCard } from '@/components/ui/glass-card';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { clientsApi, professionalsApi, staffApi } from '@/lib/api-client';
import { EMAIL_DOMAIN } from '@/lib/constants';
import { capitalizeName, formatPhone } from '@/lib/formatting';
import type { Contract, InternalContact, Professional } from '@/types';

export default function ProfessionalsPage() {
  const { showToast } = useToast();
  const [confirmModal, confirm] = useConfirm();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [name, setName] = useState('');
  const [emailPrefix, setEmailPrefix] = useState('');
  const [phone, setPhone] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unassignedContracts, setUnassignedContracts] = useState<
    (Contract & { clientName: string })[]
  >([]);
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [supervisors, setSupervisors] = useState<InternalContact[]>([]);
  const [supervisorId, setSupervisorId] = useState<string>('');

  const carregarDados = useCallback(async () => {
    try {
      const [profsRes, clientsRes, staffRes] = await Promise.all([
        professionalsApi.list(),
        clientsApi.list(),
        staffApi.list(),
      ]);
      if (profsRes.data) setProfessionals(profsRes.data);
      if (staffRes.data) {
        const supRoles = ['técnico de sistemas (líder)', 'supervisor'];
        setSupervisors(
          staffRes.data.filter((s) => supRoles.includes((s.role || '').toLowerCase())),
        );
      }
      if (clientsRes.data) {
        const unassigned = clientsRes.data.flatMap((c) =>
          (c.contracts || [])
            .filter((ct) => !ct.professionalId)
            .map((ct) => ({ ...ct, clientName: c.name })),
        );
        setUnassignedContracts(unassigned);
      }
    } catch {
      showToast('Erro ao carregar dados', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    carregarDados(); // eslint-disable-line react-hooks/set-state-in-effect -- fetch inicial
  }, [carregarDados]);

  const resetForm = () => {
    setName('');
    setEmailPrefix('');
    setPhone('');
    setEditingId(null);
    setSelectedContracts([]);
    setSupervisorId('');
    setIsModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      name,
      email: `${emailPrefix.split('@')[0]}@${EMAIL_DOMAIN}`,
      phone,
      supervisorId: supervisorId || null,
    };
    if (!editingId && selectedContracts.length > 0) {
      payload.contractIds = selectedContracts;
    }
    try {
      const res = editingId
        ? await professionalsApi.update(editingId, payload)
        : await professionalsApi.create(payload);
      if (res.ok) {
        carregarDados();
        resetForm();
        showToast('Técnico salvo com sucesso');
      } else {
        showToast(`Erro: ${res.error || 'Falha no servidor'}`, 'error');
      }
    } catch {
      showToast('Falha de conexão. Tente novamente.', 'error');
    }
  };

  const handleEdit = async (prof: Professional) => {
    const res = await professionalsApi.getById(prof.id);
    if (!res.data) {
      showToast('Erro ao carregar dados para edição.', 'error');
      return;
    }
    const full = res.data;
    setEditingId(full.id);
    setName(full.name);
    setEmailPrefix(full.email?.split('@')[0] || '');
    setPhone(formatPhone(full.phone || ''));
    setSupervisorId(full.supervisorId || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, profName: string) => {
    const ok = await confirm({
      title: 'Excluir técnico',
      message: `Tem certeza que deseja excluir o técnico '${profName}'? Ele será removido de todos os contratos.`,
    });
    if (!ok) return;
    const res = await professionalsApi.delete(id);
    if (res.ok) {
      carregarDados();
      showToast('Técnico excluído com sucesso');
    } else {
      showToast(
        `Erro ao excluir: ${res.error || 'O técnico pode ter dependências ativas.'}`,
        'error',
      );
    }
  };

  return (
    <div style={{ padding: '4rem 2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="title" style={{ margin: 0 }}>
            Gestão de Técnicos
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Especifique os profissionais capacitados da CompaSSS.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="btn-primary"
        >
          + Novo Técnico
        </button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={resetForm}
        title={editingId ? 'Editar Técnico' : 'Novo Técnico'}
      >
        <form
          onSubmit={handleSave}
          style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
        >
          <div className="form-field">
            <label htmlFor="prof-name" className="form-label">
              Nome Completo
            </label>
            <input
              id="prof-name"
              className="form-input"
              type="text"
              placeholder="Nome do Técnico"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="prof-email" className="form-label">
              E-mail Corporativo
            </label>
            <div className="email-input-wrapper">
              <input
                id="prof-email"
                className="form-input"
                type="text"
                placeholder="usuário"
                value={emailPrefix}
                onChange={(e) => setEmailPrefix(e.target.value.split('@')[0])}
                required
              />
              <span className="email-domain-badge">@{EMAIL_DOMAIN}</span>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="prof-phone" className="form-label">
              Telefone de Contato
            </label>
            <input
              id="prof-phone"
              className="form-input"
              type="text"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              required
              maxLength={15}
            />
          </div>
          {supervisors.length > 0 && (
            <div className="form-field">
              <label htmlFor="prof-supervisor" className="form-label">
                Escopo / Responde a
              </label>
              <select
                id="prof-supervisor"
                className="form-input"
                value={supervisorId}
                onChange={(e) => setSupervisorId(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="">Sem supervisor direto</option>
                {supervisors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.role}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!editingId && unassignedContracts.length > 0 && (
            <div className="form-field">
              <label className="form-label">Vincular Contratos sem Técnico</label>
              <div
                style={{
                  maxHeight: '160px',
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  background: 'var(--input-bg)',
                }}
              >
                {unassignedContracts.map((ct) => (
                  <label
                    key={ct.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '0.6rem 0.8rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      fontSize: '0.9rem',
                      color: 'var(--foreground)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedContracts.includes(ct.id)}
                      onChange={(e) => {
                        setSelectedContracts((prev) =>
                          e.target.checked ? [...prev, ct.id] : prev.filter((id) => id !== ct.id),
                        );
                      }}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <span style={{ fontWeight: 600 }}>{ct.clientName}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {ct.systemTypes || 'Sem sistema'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>
              {editingId ? 'Salvar Alterações' : 'Criar Técnico'}
            </button>
            <button type="button" onClick={resetForm} className="btn-secondary" style={{ flex: 1 }}>
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      <div>
        <h2
          style={{
            marginBottom: '1.5rem',
            fontSize: '1.1rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          Técnicos Cadastrados
        </h2>
        {professionals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👷</div>
            <p>Nenhum técnico cadastrado ainda.</p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {professionals.map((p, index) => (
              <li
                key={p.id}
                style={{
                  animation: `fadeIn 0.5s var(--ease-out-expo) forwards ${index * 0.08}s`,
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
                  <div
                    style={{
                      display: 'flex',
                      gap: '1.5rem',
                      alignItems: 'center',
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: '50px',
                        height: '50px',
                        background: 'var(--primary-subtle)',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--border)',
                        fontSize: '1.3rem',
                        flexShrink: 0,
                      }}
                    >
                      🔧
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
                            letterSpacing: '-0.3px',
                          }}
                        >
                          {capitalizeName(p.name)}
                        </strong>
                        <Badge variant="primary">Técnico</Badge>
                        {p.supervisor && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: 'rgba(168, 85, 247, 0.1)',
                              color: '#c084fc',
                              border: '1px solid rgba(168, 85, 247, 0.25)',
                            }}
                          >
                            {p.supervisor.name}
                          </span>
                        )}
                      </div>
                      <div
                        className="info-row-mobile"
                        style={{
                          display: 'flex',
                          gap: '1.5rem',
                          color: 'var(--text-muted)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg
                            width="13"
                            height="13"
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
                          {p.email}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg
                            width="13"
                            height="13"
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
                          {p.phone || ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="card-actions">
                    <button onClick={() => handleEdit(p)} className="btn-icon btn-icon-orange">
                      <span style={{ fontSize: '1.1rem' }}>✏️</span>Editar
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      className="btn-icon btn-icon-red"
                    >
                      <span style={{ fontSize: '1.1rem' }}>🗑️</span>Excluir
                    </button>
                  </div>
                </GlassCard>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirmModal}
    </div>
  );
}
