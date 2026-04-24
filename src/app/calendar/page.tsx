'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import AppointmentModal from '@/components/calendar/AppointmentModal';
import CalendarGrid from '@/components/calendar/CalendarGrid';
import ItineraryPanel from '@/components/calendar/ItineraryPanel';
import ManualScheduleModal from '@/components/calendar/ManualScheduleModal';
import ScheduleControls from '@/components/calendar/ScheduleControls';
import SchedulePreviewModal from '@/components/calendar/SchedulePreviewModal';
import { useConfirm } from '@/components/ui/confirm-modal';
import { useToast } from '@/components/ui/toast';
import { professionalsApi, holidaysApi, clientsApi, scheduleApi } from '@/lib/api-client';
import type { Appointment, Professional, Client, SchedulePreviewData } from '@/types';

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionalId, setProfessionalId] = useState('');
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [preview, setPreview] = useState<SchedulePreviewData | null>(null);
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState('');
  const [filterContractId, setFilterContractId] = useState<string | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualDate, setManualDate] = useState<string | null>(null);
  const [manualClientId, setManualClientId] = useState('');
  const [manualType, setManualType] = useState('TESTE_SDAI');
  const [clients, setClients] = useState<Client[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [yearInitialized, setYearInitialized] = useState(false);
  const [existingYears, setExistingYears] = useState<number[]>([]);
  const [confirmModalEl, confirmAction] = useConfirm();
  const { showToast } = useToast();
  const [holidays, setHolidays] = useState<{ date: string; name: string }[]>([]);

  useEffect(() => {
    const saved = sessionStorage.getItem('calendar-year');
    if (saved) setYear(parseInt(saved));
    setYearInitialized(true);
  }, []);

  useEffect(() => {
    if (yearInitialized) sessionStorage.setItem('calendar-year', String(year));
  }, [year, yearInitialized]);

  useEffect(() => {
    if (professionalId) sessionStorage.setItem('calendar-professional', professionalId);
  }, [professionalId]);

  // Ao trocar de tecnico, volta pra visao geral (sem filtro de contrato).
  useEffect(() => {
    setFilterContractId(null);
  }, [professionalId]);

  // Only show clients that appear in the current professional's appointments
  const linkedClients = useMemo(() => {
    const contractIds = new Set(appointments.map((a) => a.contractId));
    return clients.filter((c) => c.contracts?.some((ct) => contractIds.has(ct.id)));
  }, [clients, appointments]);

  useEffect(() => {
    const init = async () => {
      const [profsRes, clientsRes] = await Promise.all([
        professionalsApi.list(),
        clientsApi.list(),
      ]);
      const profs = profsRes.data ?? [];
      setProfessionals(profs);
      const cls = clientsRes.data ?? [];
      setClients(cls);
      if (cls.length > 0) setManualClientId(cls[0].id);
      if (profs.length > 0) {
        const saved = sessionStorage.getItem('calendar-professional');
        const match = saved && profs.find((p) => p.id === saved);
        setProfessionalId(match ? saved : profs[0].id);
      }
    };
    init();
  }, []);

  const fetchHolidays = useCallback(async () => {
    const { data } = await holidaysApi.list(year);
    if (data) setHolidays(data);
  }, [year]);

  const fetchAppointments = useCallback(async () => {
    if (!professionalId || !yearInitialized) return;
    try {
      const [aptsRes] = await Promise.all([
        scheduleApi.listByYear(professionalId, year),
        fetchHolidays(),
      ]);
      if (aptsRes.ok) setAppointments(aptsRes.data ?? []);
    } catch {
      showToast('Erro ao carregar agendamentos', 'error');
    }
  }, [professionalId, year, yearInitialized, fetchHolidays, showToast]);

  // Consulta os anos que o técnico tem agenda. Usado na primeira carga, ao trocar
  // de técnico e após operações destrutivas (clear/generate) pra manter o aviso
  // destrutivo do preview honesto.
  const refreshExistingYears = useCallback(
    async (id: string, opts: { syncYearFromExisting?: boolean } = {}) => {
      const res = await scheduleApi.getExistingYears(id);
      if (!res.ok) return;
      const years = res.data?.years ?? [];
      setExistingYears(years);
      if (
        opts.syncYearFromExisting &&
        years.length > 0 &&
        !sessionStorage.getItem('calendar-year')
      ) {
        // Pula pro ano mais recente pra não abrir num ano vazio.
        setYear(years[years.length - 1]);
      }
    },
    [],
  );

  useEffect(() => {
    if (!professionalId) return;
    refreshExistingYears(professionalId, { syncYearFromExisting: true });
  }, [professionalId, refreshExistingYears]);

  // fetchHolidays já é chamado dentro de fetchAppointments via Promise.all
  // clients são carregados no init junto com professionals
  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Lock body scroll when any modal is open
  useEffect(() => {
    const anyOpen = isManualModalOpen || !!selectedApt || !!preview;
    document.body.style.overflow = anyOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isManualModalOpen, selectedApt, preview]);

  // Fluxo: preview → modal com resumo/aviso → confirmar → generate.
  // O modal de preview é o único ponto de confirmação; mostra o impacto antes
  // de disparar a transação destrutiva.
  const openPreview = async () => {
    setLoadingPreview(true);
    try {
      const res = await scheduleApi.preview(professionalId, year);
      if (res.ok && res.data) {
        setPreview(res.data);
      } else {
        showToast(res.error || 'Erro ao gerar prévia. Tente novamente.', 'error');
      }
    } catch {
      showToast('Falha de conexão ao gerar prévia. Tente novamente.', 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const confirmGenerate = async () => {
    setLoadingGenerate(true);
    try {
      const res = await scheduleApi.generate(professionalId, year);
      if (res.ok && res.data) {
        await Promise.all([fetchAppointments(), refreshExistingYears(professionalId)]);
        setPreview(null);
        showToast(
          `${res.data.contractCount} agendas criadas: ${res.data.count} atendimentos agendados`,
        );
      } else {
        showToast(res.error || 'Erro ao gerar agenda. Tente novamente.', 'error');
      }
    } catch {
      showToast('Falha de conexão. Tente novamente.', 'error');
    } finally {
      setLoadingGenerate(false);
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

  const handleUpdateDate = async (): Promise<string | null> => {
    if (!selectedApt || !newDate) return null;
    try {
      const res = await scheduleApi.update(selectedApt.id, { date: newDate });
      if (res.ok) {
        fetchAppointments();
        setSelectedApt(null);
        setNewDate('');
        return null;
      }
      return res.error || 'Erro ao mudar data.';
    } catch {
      return 'Falha de conexão. Tente novamente.';
    }
  };

  const handleDayClick = (dateStr: string) => {
    // Match a prioridade do CalendarGrid: contrato filtrado primeiro, fallback
    // pra qualquer visita do dia. Dimming garante que apt de outro contrato
    // continua clicável sem precisar limpar filtro.
    const aptsOnDay = appointments.filter(
      (a) => new Date(a.date).toISOString().split('T')[0] === dateStr,
    );
    const apt = filterContractId
      ? (aptsOnDay.find((a) => a.contractId === filterContractId) ?? aptsOnDay[0])
      : aptsOnDay[0];

    if (apt) {
      setSelectedApt(apt);
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
    await Promise.all([fetchAppointments(), refreshExistingYears(professionalId)]);
    setLoading(false);
    showToast('Agenda excluída com sucesso');
  };

  const handleMoveAppointment = async (appointmentId: string, newDate: string) => {
    // Atualização otimista — move no state local antes da resposta do servidor
    const prev = appointments;
    setAppointments((apts) =>
      apts.map((a) => (a.id === appointmentId ? { ...a, date: newDate } : a)),
    );
    try {
      const res = await scheduleApi.update(appointmentId, { date: newDate });
      if (res.ok) {
        fetchAppointments(); // sincroniza renumeração
      } else {
        setAppointments(prev); // reverte em caso de erro
        showToast(res.error || 'Erro ao mover visita', 'error');
      }
    } catch {
      setAppointments(prev);
      showToast('Falha de conexão. Tente novamente.', 'error');
    }
  };

  return (
    <div
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

      <SchedulePreviewModal
        isOpen={!!preview}
        preview={preview}
        year={year}
        existingYears={existingYears}
        loading={loadingGenerate}
        onConfirm={confirmGenerate}
        onClose={() => {
          if (!loadingGenerate) setPreview(null);
        }}
      />

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
                Calendário Operacional{' '}
                <input
                  type="text"
                  inputMode="numeric"
                  value={year}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v)) setYear(v);
                  }}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value);
                    if (isNaN(v) || v < 2020 || v > 2100) setYear(new Date().getFullYear());
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  maxLength={4}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '2px dashed var(--border)',
                    color: 'inherit',
                    font: 'inherit',
                    width: '4.5ch',
                    textAlign: 'center',
                    padding: 0,
                    outline: 'none',
                    cursor: 'text',
                  }}
                />
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
            className="btn-secondary desktop-only"
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
          loadingPreview={loadingPreview}
          appointments={appointments}
          onGenerate={openPreview}
          onClear={handleClearSchedule}
          contractIds={linkedClients.flatMap((c) => (c.contracts || []).map((ct) => ct.id))}
        />

        <CalendarGrid
          year={year}
          appointments={appointments}
          filterContractId={filterContractId}
          holidays={holidays}
          onDayClick={handleDayClick}
          onMoveAppointment={handleMoveAppointment}
        />
      </div>

      <ItineraryPanel
        appointments={appointments}
        filterContractId={filterContractId}
        setFilterContractId={setFilterContractId}
        linkedClients={linkedClients}
        onDayClick={handleDayClick}
      />
    </div>
  );
}
