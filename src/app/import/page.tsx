'use client';

import ExcelJS from 'exceljs';
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

import { GlassCard } from '@/components/ui/glass-card';
import { useToast } from '@/components/ui/toast';

const TEMPLATE_COLUMNS = [
  'Cliente',
  'Telefone',
  'Sistemas',
  'Visitas/Mês',
  'Frequência',
  'Dias Preferidos',
  'Técnico',
  'Telefone Técnico',
  'Email Técnico',
  'Escopo',
];

const TEMPLATE_EXAMPLE = [
  {
    Cliente: 'Paulista Office Park',
    Telefone: '(11) 99999-0000',
    Sistemas: 'SDAI,CFTV',
    'Visitas/Mês': 2,
    Frequência: 'Mensal',
    'Dias Preferidos': 'Seg,Qua,Sex',
    Técnico: 'João Silva',
    'Telefone Técnico': '(11) 97777-0000',
    'Email Técnico': 'joao.silva',
    Escopo: 'Victor Lopes',
  },
  {
    Cliente: 'Shopping Center Norte',
    Telefone: '(11) 98888-0000',
    Sistemas: 'SDAI',
    'Visitas/Mês': 1,
    Frequência: 'Mensal',
    'Dias Preferidos': '',
    Técnico: 'João Silva',
    'Telefone Técnico': '',
    'Email Técnico': '',
    Escopo: '',
  },
  {
    Cliente: 'Condomínio Alphaville',
    Telefone: '',
    Sistemas: 'SCA,SAP',
    'Visitas/Mês': 1,
    Frequência: 'Trimestral',
    'Dias Preferidos': 'Ter,Qui',
    Técnico: 'Maria Santos',
    'Telefone Técnico': '(11) 96666-0000',
    'Email Técnico': 'maria.santos@compasss.com.br',
    Escopo: 'Gabriel Domingos',
  },
];

export default function ImportPage() {
  const { showToast } = useToast();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; techsCreated: number; clientsCreated: number; errors: string[] } | null>(null);

  const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'CompaSSS';
    const ws = wb.addWorksheet('Contratos', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // Colunas
    ws.columns = [
      { header: 'Cliente', key: 'cliente', width: 32 },
      { header: 'Telefone', key: 'telefone', width: 18 },
      { header: 'Sistemas', key: 'sistemas', width: 20 },
      { header: 'Visitas/Mês', key: 'visitas', width: 14 },
      { header: 'Frequência', key: 'frequencia', width: 16 },
      { header: 'Dias Preferidos', key: 'dias', width: 22 },
      { header: 'Técnico', key: 'tecnico', width: 24 },
      { header: 'Telefone Técnico', key: 'telTec', width: 18 },
      { header: 'Email Técnico', key: 'emailTec', width: 30 },
      { header: 'Escopo', key: 'escopo', width: 22 },
    ];

    // Estilo do cabeçalho
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF6366f1' } },
      };
    });
    headerRow.height = 28;

    // Exemplos
    const examples = [
      ['Paulista Office Park', '(11) 99999-0000', 'SDAI,CFTV', 2, 'Mensal', 'Seg,Qua,Sex', 'João Silva', '(11) 97777-0000', 'joao.silva'],
      ['Shopping Center Norte', '(11) 98888-0000', 'SDAI', 1, 'Mensal', '', 'João Silva', '', ''],
      ['Condomínio Alphaville', '', 'SCA,SAP', 1, 'Trimestral', 'Ter,Qui', 'Maria Santos', '(11) 96666-0000', 'maria.santos'],
    ];

    examples.forEach((row) => {
      const added = ws.addRow(row);
      added.eachCell((cell) => {
        cell.font = { size: 10, color: { argb: 'FF666666' }, italic: true };
      });
    });

    // Data validation (dropdowns) nas linhas 2 a 200
    for (let r = 2; r <= 200; r++) {
      // Visitas/Mês
      ws.getCell(`D${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"1,2,3,4,5,6,7,8,9,10"'],
        showErrorMessage: true,
      };

      // Frequência
      ws.getCell(`E${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Mensal,Bimestral,Trimestral,Semestral,Anual"'],
        showErrorMessage: true,
      };

      // Dias Preferidos
      ws.getCell(`F${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Seg,Ter,Qua,Qui,Sex,Qua;Sex,Seg;Qua;Sex,Ter;Qui"'],
        showErrorMessage: true,
        errorStyle: 'warning' as 'warning',
        errorTitle: 'Dias',
        error: 'Selecione da lista ou digite (separe com vírgula)',
      };

      // Escopo (supervisor)
      ws.getCell(`J${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Victor Lopes,Gabriel Domingos"'],
        showErrorMessage: true,
      };
    }

    // Gera e baixa
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_contratos_compasss.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/import', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          showToast(data.error || 'Erro ao importar', 'error');
          return;
        }

        setImportResult({ created: data.created, skipped: data.skipped, techsCreated: data.techsCreated || 0, clientsCreated: data.clientsCreated || 0, errors: data.errors || [] });
      } catch {
        showToast('Falha de conexão. Tente novamente.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleImport(file);
    },
    [handleImport],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleImport(file);
      e.target.value = '';
    },
    [handleImport],
  );

  return (
    <main style={{ padding: '4rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="title" style={{ margin: 0 }}>
            Importar Contratos
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '1.1rem' }}>
            Importe contratos em massa a partir de uma planilha Excel.
          </p>
        </div>
      </div>

      {/* Instruções */}
      <GlassCard style={{ marginBottom: '2rem' }}>
        <h2
          style={{
            fontSize: '1rem',
            color: 'var(--foreground)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            margin: '0 0 1rem 0',
          }}
        >
          Como funciona
        </h2>
        <ol
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.95rem',
            lineHeight: '1.8',
            paddingLeft: '1.2rem',
            margin: 0,
          }}
        >
          <li>
            Baixe o{' '}
            <button
              onClick={downloadTemplate}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                textDecoration: 'underline',
                font: 'inherit',
                fontWeight: 700,
                padding: 0,
              }}
            >
              template Excel
            </button>{' '}
            com as colunas e exemplos
          </li>
          <li>Preencha com os dados dos seus contratos</li>
          <li>Arraste o arquivo ou clique pra fazer upload</li>
          <li>O sistema cria clientes, técnicos e contratos automaticamente</li>
        </ol>

        <div
          style={{
            marginTop: '1.2rem',
            padding: '0.8rem 1rem',
            borderRadius: '10px',
            background: 'var(--primary-subtle)',
            border: '1px solid var(--border)',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
          }}
        >
          <strong style={{ color: 'var(--foreground)' }}>Colunas da planilha:</strong>{' '}
          Cliente, Telefone, Sistemas (SDAI, CFTV, SCA...), Visitas/Mês, Frequência
          (Mensal, Trimestral...), Dias Preferidos (Seg, Ter...), Técnico, Telefone Técnico, Email Técnico, Escopo (Victor Lopes ou Gabriel Domingos)
        </div>
      </GlassCard>

      {/* Upload area */}
      <GlassCard style={{ marginBottom: '2rem' }}>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: '16px',
            padding: '3rem 2rem',
            textAlign: 'center',
            background: dragging ? 'var(--primary-subtle)' : 'transparent',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
          }}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
            {loading ? '...' : '📁'}
          </div>
          <p
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              color: 'var(--foreground)',
              marginBottom: '0.5rem',
            }}
          >
            {loading ? 'Importando...' : 'Arraste a planilha aqui'}
          </p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            ou clique para selecionar o arquivo (.xlsx, .xls, .csv)
          </p>
        </div>
      </GlassCard>

      {/* Modal de resultado */}
      {importResult && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(6px)',
          }}
          onClick={() => setImportResult(null)}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{
              maxWidth: '420px',
              width: '90%',
              padding: '2.5rem',
              textAlign: 'center',
              border: importResult.errors.length > 0
                ? '1px solid rgba(239, 68, 68, 0.3)'
                : '1px solid rgba(16, 185, 129, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Accent line */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: importResult.errors.length > 0
                  ? 'linear-gradient(90deg, transparent, #ef4444, transparent)'
                  : 'linear-gradient(90deg, transparent, #34d399, transparent)',
                borderRadius: '12px 12px 0 0',
              }}
            />

            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
              {importResult.errors.length > 0 ? '⚠️' : '✅'}
            </div>

            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.3rem', fontWeight: 700 }}>
              Importação Concluída
            </h2>

            <div style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              {importResult.created > 0 && (
                <div style={{ textAlign: 'center', minWidth: '70px' }}>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#34d399', lineHeight: 1 }}>
                    {importResult.created}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '4px' }}>
                    {importResult.created === 1 ? 'Contrato' : 'Contratos'}
                  </div>
                </div>
              )}
              {importResult.clientsCreated > 0 && (
                <div style={{ textAlign: 'center', minWidth: '70px' }}>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#60a5fa', lineHeight: 1 }}>
                    {importResult.clientsCreated}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '4px' }}>
                    {importResult.clientsCreated === 1 ? 'Cliente novo' : 'Clientes novos'}
                  </div>
                </div>
              )}
              {importResult.techsCreated > 0 && (
                <div style={{ textAlign: 'center', minWidth: '70px' }}>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#c084fc', lineHeight: 1 }}>
                    {importResult.techsCreated}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '4px' }}>
                    {importResult.techsCreated === 1 ? 'Técnico novo' : 'Técnicos novos'}
                  </div>
                </div>
              )}
              {importResult.skipped > 0 && (
                <div style={{ textAlign: 'center', minWidth: '70px' }}>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fbbf24', lineHeight: 1 }}>
                    {importResult.skipped}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '4px' }}>
                    Já {importResult.skipped === 1 ? 'existia' : 'existiam'}
                  </div>
                </div>
              )}
              {importResult.errors.length > 0 && (
                <div style={{ textAlign: 'center', minWidth: '70px' }}>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f87171', lineHeight: 1 }}>
                    {importResult.errors.length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '4px' }}>
                    {importResult.errors.length === 1 ? 'Erro' : 'Erros'}
                  </div>
                </div>
              )}
            </div>

            {importResult.errors.length > 0 && (
              <div
                style={{
                  textAlign: 'left',
                  padding: '0.8rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  marginBottom: '1.5rem',
                  maxHeight: '120px',
                  overflowY: 'auto',
                }}
              >
                {importResult.errors.map((err, i) => (
                  <p key={i} style={{ margin: i > 0 ? '4px 0 0' : 0, fontSize: '0.82rem', color: '#f87171' }}>
                    {err}
                  </p>
                ))}
              </div>
            )}

            <button
              onClick={() => setImportResult(null)}
              className="btn-primary"
              style={{ width: '100%', padding: '0.8rem' }}
            >
              Fechar
            </button>
          </div>
        </div>,
        document.body,
      )}
    </main>
  );
}
