interface ReportContact {
  action?: string;
  contact?: string;
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface ReportContactTablesProps {
  maintenance: ReportContact[];
  escalation: ReportContact[];
  professional: { name?: string | null; phone?: string | null; email?: string | null } | null;
}

export default function ReportContactTables({
  maintenance,
  escalation,
  professional,
}: ReportContactTablesProps) {
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 10,
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      <div style={{ height: '30px' }}></div>

      {/* Seção 1: Manutenção de Sistemas */}
      <table className="contact-table" style={{ marginBottom: '4px' }}>
        <thead>
          <tr>
            <th colSpan={6} style={{ textAlign: 'center', letterSpacing: '1.5px', fontSize: '0.55rem', padding: '8px' }}>
              LISTA DE CONTATOS
            </th>
          </tr>
          <tr
            style={{
              background: '#0f4a3a',
              color: 'white',
              fontSize: '0.48rem',
            }}
          >
            <th style={{ width: '13%' }}>Ação</th>
            <th style={{ width: '12%' }}>Empresa</th>
            <th style={{ width: '22%' }}>Função</th>
            <th style={{ width: '18%' }}>Nome</th>
            <th style={{ width: '14%' }}>Telefone</th>
            <th style={{ width: '21%' }}>E-mail</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ fontWeight: 800 }}>
              1° Contato
            </td>
            <td
              rowSpan={maintenance.length + 1}
              style={{
                fontWeight: 800,
                verticalAlign: 'middle',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
              }}
            >
              CompaSSS
            </td>
            <td>Técnico de Sistemas (Fixo)</td>
            <td style={{ fontWeight: 800 }}>{professional?.name || '-'}</td>
            <td>{professional?.phone || '-'}</td>
            <td style={{ fontSize: '0.45rem' }}>{professional?.email || '-'}</td>
          </tr>
          {maintenance.map((row, idx) => (
            <tr key={idx}>
              <td style={{ fontWeight: 800 }}>{idx + 2}° Contato</td>
              <td>{row.role}</td>
              <td style={{ fontWeight: 800 }}>{row.name || '-'}</td>
              <td>{row.phone || '-'}</td>
              <td style={{ fontSize: '0.45rem' }}>{row.email || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Seção 2: Escalonamento e Contatos-Chave */}
      <table className="contact-table">
        <thead>
          <tr style={{ background: '#064e3b', color: 'white' }}>
            <th
              colSpan={6}
              style={{
                textAlign: 'center',
                letterSpacing: '1px',
                fontSize: '0.48rem',
              }}
            >
              ESCALONAMENTO DE OCORRÊNCIAS E CONTATOS-CHAVE
            </th>
          </tr>
          <tr
            style={{
              background: '#0f4a3a',
              color: 'white',
              fontSize: '0.48rem',
            }}
          >
            <th style={{ width: '18%' }}>Contato</th>
            <th style={{ width: '12%' }}>Empresa</th>
            <th style={{ width: '18%' }}>Função</th>
            <th style={{ width: '18%' }}>Nome</th>
            <th style={{ width: '14%' }}>Telefone</th>
            <th style={{ width: '20%' }}>E-mail</th>
          </tr>
        </thead>
        <tbody>
          {escalation.map((row, idx) => {
            const prevContact = idx > 0 ? escalation[idx - 1].contact : null;
            let rSpan = 1;
            if (row.contact !== prevContact) {
              for (let i = idx + 1; i < escalation.length; i++) {
                if (escalation[i].contact === row.contact && row.contact) rSpan++;
                else break;
              }
            }

            return (
              <tr key={idx}>
                {row.contact !== prevContact && (
                  <td
                    rowSpan={rSpan}
                    style={{
                      fontWeight: 800,
                      verticalAlign: 'middle',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    {row.contact}
                  </td>
                )}
                {idx === 0 && (
                  <td
                    rowSpan={escalation.length}
                    style={{
                      fontWeight: 800,
                      verticalAlign: 'middle',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    CompaSSS
                  </td>
                )}
                <td>{row.role}</td>
                <td style={{ fontWeight: 800 }}>{row.name || '-'}</td>
                <td>{row.phone || '-'}</td>
                <td style={{ fontSize: '0.45rem' }}>{row.email || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
