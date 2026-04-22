'use client';

import { useCallback, useEffect, useState } from 'react';

import ClientTable from '@/components/clients/ClientTable';
import ContractFormModal from '@/components/clients/ContractFormModal';
import { useConfirm } from '@/components/ui/confirm-modal';
import { useToast } from '@/components/ui/toast';
import { clientsApi, professionalsApi } from '@/lib/api-client';
import type { Client, Professional } from '@/types';

export default function ClientsPage() {
  const { showToast } = useToast();
  const [confirmModal, confirm] = useConfirm();
  // Estados de Dados da API
  const [clients, setClients] = useState<Client[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);

  // Estados dos Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Carregamento Inicial
  const carregarDados = useCallback(async () => {
    try {
      const [resC, resP] = await Promise.all([clientsApi.list(), professionalsApi.list()]);

      if (resC.data) setClients(resC.data);
      if (resP.data) setProfessionals(resP.data);
    } catch {
      showToast('Erro ao carregar dados', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    carregarDados(); // eslint-disable-line react-hooks/set-state-in-effect -- fetch inicial
  }, [carregarDados]);

  // Bloqueio de Scroll
  useEffect(() => {
    document.body.style.overflow = isModalOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

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

  return (
    <div style={{ padding: '4rem 2rem', maxWidth: '1000px', margin: '0 auto' }}>
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
      <ClientTable clients={clients} onEdit={handleEdit} onDelete={handleDelete} />

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

      {confirmModal}
    </div>
  );
}
