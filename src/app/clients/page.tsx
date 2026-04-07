'use client';

import { useCallback, useEffect, useState } from 'react';

import ClientTable from '@/components/clients/ClientTable';
import ContactListModal from '@/components/clients/ContactListModal';
import ContractFormModal from '@/components/clients/ContractFormModal';
import { useConfirm } from '@/components/ui/confirm-modal';
import { useToast } from '@/components/ui/toast';
import { clientsApi, professionalsApi, staffApi } from '@/lib/api-client';
import { migrateRole } from '@/lib/constants';
import type { Client, Professional, InternalContact } from '@/types';

export default function ClientsPage() {
  const { showToast } = useToast();
  const [confirmModal, confirm] = useConfirm();
  // Estados de Dados da API
  const [clients, setClients] = useState<Client[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [internalStaff, setInternalStaff] = useState<InternalContact[]>([]);

  // Estados dos Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [contactsModalOpen, setContactsModalOpen] = useState(false);
  const [contactsContractId, setContactsContractId] = useState<string | null>(null);
  const [contactsTech, setContactsTech] = useState({ name: '', phone: '', email: '' });

  // Listas de Funções (Compartilhadas via Props e Persistidas)
  const [availableMaintRoles, setAvailableMaintRoles] = useState<string[]>([
    'Técnico de Sistemas (Líder)',
    'Supervisor',
    'Coordenador',
  ]);
  const [availableEscRoles, setAvailableEscRoles] = useState<string[]>([
    'Comercial Obras/Peça',
    'Comercial Serviços',
    'Gerente',
    'Diretor',
    'Outros',
  ]);

  // Carregamento Inicial
  const carregarDados = useCallback(async () => {
    try {
      const [resC, resP, resS] = await Promise.all([
        clientsApi.list(),
        professionalsApi.list(),
        staffApi.list(),
      ]);

      if (resC.data) setClients(resC.data);
      if (resP.data) setProfessionals(resP.data);
      if (resS.data) setInternalStaff(resS.data);

      // Carrega permissões personalizadas do LocalStorage e MIGRAÇÃO (Legacy Roles)
      const savedMaint = localStorage.getItem('compasss_maint_roles');
      if (savedMaint) {
        const roles: string[] = JSON.parse(savedMaint);
        const migrated = roles.map(migrateRole);
        const uniqueMigrated = Array.from(new Set(migrated)).filter(
          (r) => r !== 'Técnico de Sistemas (Cobertura)',
        );
        const changed =
          uniqueMigrated.length !== roles.length || migrated.some((m, i) => m !== roles[i]);

        if (changed) {
          setAvailableMaintRoles(uniqueMigrated);
          localStorage.setItem('compasss_maint_roles', JSON.stringify(uniqueMigrated));
        } else {
          setAvailableMaintRoles(roles);
        }
      }

      const savedEsc = localStorage.getItem('compasss_esc_roles');
      if (savedEsc) {
        const roles: string[] = JSON.parse(savedEsc);
        const filtered = roles.filter((r) => r !== 'Técnico de Sistemas (Cobertura)');
        if (filtered.length !== roles.length) {
          setAvailableEscRoles(filtered);
          localStorage.setItem('compasss_esc_roles', JSON.stringify(filtered));
        } else {
          setAvailableEscRoles(roles);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    carregarDados(); // eslint-disable-line react-hooks/set-state-in-effect -- fetch inicial
  }, [carregarDados]);

  // Bloqueio de Scroll
  useEffect(() => {
    const anyOpen = isModalOpen || contactsModalOpen;
    document.body.style.overflow = anyOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen, contactsModalOpen]);

  // Ações Principais
  const handleEdit = (client: Client) => {
    setEditingId(client.id);
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingId(null);
    setEditingClient(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, clientName: string) => {
    const ok = await confirm({
      title: 'Excluir cliente',
      message: `Tem certeza que deseja excluir o cliente '${clientName}'? Todos os contratos e agendamentos associados serão removidos.`,
    });
    if (!ok) return;
    const res = await clientsApi.delete(id);
    if (res.ok) {
      carregarDados();
      showToast('Cliente excluído com sucesso');
    }
  };

  const openContactsModal = (contractId: string, tech: Professional) => {
    setContactsContractId(contractId);
    setContactsTech({
      name: tech?.name || '',
      phone: tech?.phone || '',
      email: tech?.email || '',
    });
    setContactsModalOpen(true);
  };

  return (
    <main style={{ padding: '4rem 2rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '3rem',
        }}
      >
        <div>
          <h1 className="title" style={{ margin: 0 }}>
            Gestão de Contratos
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Administre os ativos e frequências dos clientes CompaSSS.
          </p>
        </div>
        <button
          onClick={openNewModal}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
        >
          <span style={{ fontSize: '1.2rem' }}>+</span> Novo Contrato
        </button>
      </div>

      {/* Tabela de Clientes */}
      <ClientTable
        clients={clients}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onOpenContacts={openContactsModal}
      />

      {/* Modal de Formulário (Novo/Editar) */}
      <ContractFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          carregarDados();
          showToast('Contrato salvo com sucesso');
        }}
        editingId={editingId}
        initialData={editingClient}
        professionals={professionals}
      />

      {/* Modal de Contatos */}
      <ContactListModal
        isOpen={contactsModalOpen}
        onClose={() => setContactsModalOpen(false)}
        contractId={contactsContractId}
        initialTech={contactsTech}
        internalStaff={internalStaff}
        availableMaintRoles={availableMaintRoles}
        availableEscRoles={availableEscRoles}
        setAvailableMaintRoles={setAvailableMaintRoles}
        setAvailableEscRoles={setAvailableEscRoles}
      />

      {confirmModal}
    </main>
  );
}
