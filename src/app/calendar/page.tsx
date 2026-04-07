'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import AppointmentModal from '@/components/calendar/AppointmentModal';
import CalendarGrid from '@/components/calendar/CalendarGrid';
import ItineraryPanel from '@/components/calendar/ItineraryPanel';
import ManualScheduleModal from '@/components/calendar/ManualScheduleModal';
import ScheduleControls from '@/components/calendar/ScheduleControls';
import { useConfirm } from '@/components/ui/confirm-modal';
import { useToast } from '@/components/ui/toast';
import { professionalsApi, holidaysApi, clientsApi, scheduleApi } from '@/lib/api-client';
import type { Appointment, Professional, Client } from '@/types';

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionalId, setProfessionalId] = useState('');
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState('');
  const [filterContractId, setFilterContractId] = useState<string | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualDate, setManualDate] = useState<string | null>(null);
  const [manualClientId, setManualClientId] = useState('');
  const [manualType, setManualType] = useState('TESTE_SDAI');
  const [clients, setClients] = useState<Client[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [existingYear, setExistingYear] = useState<number | null>(null);
  const [confirmModalEl, confirmAction] = useConfirm();
  const { showToast } = useToast();
  const [holidays, setHolidays] = useState<{ date: string; name: string }[]>([]);

  // Only show clients that appear in the current professional's appointments
  const linkedClients = useMemo(
    () =>
      clients.filter((c) =>
        c.contracts?.some((contract) => appointments.some((a) => a.contractId === contract.id)),
      ),
    [clients, appointments],
  );

  useEffect(() => {
    professionalsApi.list().then(({ data }) => {
      const profs = data ?? [];
      setProfessionals(profs);
      if (profs.length > 0) setProfessionalId(profs[0].id);
    });
  }, []);

  const fetchHolidays = useCallback(async () => {
    const { data } = await holidaysApi.list();
    if (data) setHolidays(data);
  }, []);

  const fetchAppointments = useCallback(async () => {
    if (!professionalId) return;
    try {
      const [yearRes, aptsRes] = await Promise.all([
        scheduleApi.getExistingYear(professionalId),
        scheduleApi.listByYear(professionalId, year),
        fetchHolidays(),
      ]);
      if (yearRes.ok) setExistingYear(yearRes.data?.existingYear ?? null);
      if (aptsRes.ok) setAppointments(aptsRes.data ?? []);
    } catch {}
  }, [professionalId, year, fetchHolidays]);

  const fetchClients = useCallback(async () => {
    const { data } = await clientsApi.list();
    if (data) {
      setClients(data);
      if (data.length > 0) setManualClientId(data[0].id);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);
  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);
  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Lock body scroll when any modal is open
  useEffect(() => {
    const anyOpen = isManualModalOpen || !!selectedApt;
    document.body.style.overflow = anyOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isManualModalOpen, selectedApt]);

  const generateAppointments = async () => {
    if (existingYear !== null && existingYear !== year) {
      const ok = await confirmAction({
        title: 'Substituir agenda existente?',
        message: `Este técnico já possui agenda gerada para ${existingYear}. Ao confirmar, ela será substituída pela agenda de ${year}.`,
        variant: 'warning',
        confirmLabel: 'Confirmar',
      });
      if (!ok) return;
    } else if (appointments.length > 0) {
      const ok = await confirmAction({
        title: 'Re-gerar agenda?',
        message: `Já existe uma agenda gerada para ${year}. Ao confirmar, ela será apagada e uma nova será criada do zero.`,
        variant: 'warning',
        confirmLabel: 'Confirmar',
      });
      if (!ok) return;
    }
    setLoading(true);
    try {
      const res = await scheduleApi.generate(professionalId, year);
      await fetchAppointments();
      if (res.ok && res.data) {
        showToast(`Agenda gerada: ${res.data.count} agendamentos criados`);
      }
    } catch {
      showToast('Erro ao gerar agenda. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteApt = async () => {
    if (!selectedApt) return;
    const ok = await confirmAction({
      title: 'Excluir visita',
      message: 'Tem certeza que deseja excluir esta visita?',
    });
    if (!ok) return;
    try {
      const res = await scheduleApi.delete(selectedApt.id);
      if (!res.ok) {
        showToast('Erro ao excluir visita.', 'error');
        return;
      }
      fetchAppointments();
      setSelectedApt(null);
    } catch {
      showToast('Falha de conexão. Tente novamente.', 'error');
    }
  };

  const handleToggleType = async () => {
    if (!selectedApt) return;
    const newType = selectedApt.type === 'VISITA_TECNICA' ? 'TESTE_SDAI' : 'VISITA_TECNICA';
    try {
      const res = await scheduleApi.update(selectedApt.id, { type: newType });
      if (!res.ok) {
        showToast('Erro ao alterar tipo.', 'error');
        return;
      }
      fetchAppointments();
      setSelectedApt(null);
    } catch {
      showToast('Falha de conexão. Tente novamente.', 'error');
    }
  };

  const handleUpdateDate = async () => {
    if (!selectedApt || !newDate) return;
    try {
      const res = await scheduleApi.update(selectedApt.id, { date: newDate });
      if (res.ok) {
        fetchAppointments();
        setSelectedApt(null);
        setNewDate('');
      } else {
        showToast('Erro ao mudar data. Verifique o formato.', 'error');
      }
    } catch {
      showToast('Falha de conexão. Tente novamente.', 'error');
    }
  };

  const handleDayClick = (dateStr: string) => {
    // busca sem filtro pra não ter dead end quando sidebar filtra por contrato
    const anyApt = appointments.find(
      (a) => new Date(a.date).toISOString().split('T')[0] === dateStr,
    );
    if (anyApt) {
      if (filterContractId && anyApt.contractId !== filterContractId) {
        setFilterContractId(null); // limpa filtro pra mostrar a visita que o cara clicou
      }
      setSelectedApt(anyApt);
      setNewDate(dateStr);
    } else {
      setManualDate(dateStr);
      setIsManualModalOpen(true);
    }
  };

  const handleManualSave = async () => {
    if (!manualClientId || !manualDate) return;

    const client = clients.find((c) => c.id === manualClientId);
    const matchingContract = client?.contracts?.find((ct) => ct.professionalId === professionalId);
    const contractId = matchingContract?.id ?? client?.contracts?.[0]?.id;

    try {
      const res = await scheduleApi.create({
        clientId: manualClientId,
        professionalId,
        contractId,
        date: manualDate,
        type: manualType,
        observation:
          manualType === 'TESTE_SDAI' ? 'Teste Geral SDAI (Manual)' : 'Visita Extra (Manual)',
      });
      if (res.ok) {
        setIsManualModalOpen(false);
        fetchAppointments();
        showToast('Visita agendada com sucesso');
      } else {
        showToast(res.error || 'Erro ao agendar visita', 'error');
      }
    } catch {
      showToast('Falha de conexão. Tente novamente.', 'error');
    }
  };

  const handleClearSchedule = async () => {
    const ok = await confirmAction({
      title: 'Limpar agenda completa',
      message:
        'Tem certeza que deseja apagar TODA a agenda deste ano para este técnico? Esta ação não pode ser desfeita.',
      variant: 'warning',
      confirmLabel: 'Apagar tudo',
    });
    if (!ok) return;
    setLoading(true);
    await scheduleApi.clearYear(professionalId, year);
    await fetchAppointments();
    setLoading(false);
    showToast('Agenda excluída com sucesso');
  };

  // TODO: filtro por sistema (SDAI, CFTV, etc) — o pessoal pediu pra poder ver só visitas de um tipo
  const getAppointment = (dateStr: string) => {
    return appointments.find((a) => {
      const isDateMatch = new Date(a.date).toISOString().split('T')[0] === dateStr;
      if (!isDateMatch) return false;
      if (filterContractId && a.contractId !== filterContractId) return false;
      return true;
    });
  };

  return (
    <main
      style={{
        padding: '4rem 2rem',
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        gap: '2rem',
        flexWrap: 'wrap',
        position: 'relative',
      }}
    >
      {confirmModalEl}

      <ManualScheduleModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSave={handleManualSave}
        manualDate={manualDate}
        manualClientId={manualClientId}
        setManualClientId={setManualClientId}
        manualType={manualType}
        setManualType={setManualType}
        clients={clients}
        professionalId={professionalId}
      />

      {selectedApt && (
        <AppointmentModal
          appointment={selectedApt}
          newDate={newDate}
          setNewDate={setNewDate}
          onToggleType={handleToggleType}
          onUpdateDate={handleUpdateDate}
          onDelete={handleDeleteApt}
          onClose={() => {
            setSelectedApt(null);
            setNewDate('');
          }}
        />
      )}

      <div style={{ flex: '1 1 800px' }}>
        <div
          className="page-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '2rem',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '0.5rem',
                flexWrap: 'wrap',
              }}
            >
              <h1 className="title" style={{ margin: 0 }}>
                Calendário Operacional {year}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => setYear((y) => y - 1)}
                  aria-label="Ano anterior"
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                    borderRadius: '6px',
                    width: '30px',
                    height: '30px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ‹
                </button>
                <button
                  onClick={() => setYear((y) => y + 1)}
                  aria-label="Próximo ano"
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                    borderRadius: '6px',
                    width: '30px',
                    height: '30px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ›
                </button>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)' }}>
              Visualize e gerencie a carga horária e itinerários técnicos.
            </p>
          </div>
          <Link
            href="/"
            className="btn-secondary"
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>&larr;</span> Voltar
          </Link>
        </div>

        <ScheduleControls
          professionals={professionals}
          professionalId={professionalId}
          setProfessionalId={setProfessionalId}
          loading={loading}
          appointments={appointments}
          onGenerate={generateAppointments}
          onClear={handleClearSchedule}
        />

        <CalendarGrid
          year={year}
          appointments={appointments}
          filterContractId={filterContractId}
          holidays={holidays}
          onDayClick={handleDayClick}
        />
      </div>

      <ItineraryPanel
        appointments={appointments}
        filterContractId={filterContractId}
        setFilterContractId={setFilterContractId}
        linkedClients={linkedClients}
        onDayClick={handleDayClick}
      />
    </main>
  );
}
