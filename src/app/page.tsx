"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{ padding: "6rem 4rem", maxWidth: "1400px", margin: "0 auto" }}
    >
      <header className="animate-fade-in" style={{ marginBottom: "4rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.8rem",
            color: "var(--primary)",
            fontWeight: "bold",
            fontSize: "0.9rem",
            textTransform: "uppercase",
            marginBottom: "1rem",
          }}
        >
          <span
            style={{
              width: "40px",
              height: "2px",
              background: "var(--primary)",
            }}
          ></span>
          Painel de Controle
        </div>
        <h1 className="title">Sistema Gestor de Manutenção</h1>
        <p className="subtitle" style={{ maxWidth: "600px" }}>
          Bem-vindo ao portal oficial da CompaSSS. Gerencie técnicos, visualize
          contratos e otimize o cronograma de visitas de forma automatizada.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
          gap: "2.5rem",
        }}
      >
        <section
          className="glass-panel animate-fade-in"
          style={{
            animationDelay: "0.1s",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-20px",
              right: "-20px",
              fontSize: "12rem",
              opacity: 0.03,
              fontWeight: 900,
              color: "var(--primary)",
              userSelect: "none",
              pointerEvents: "none",
            }}
          >
            01
          </div>
          <h2
            style={{
              fontSize: "1.6rem",
              marginBottom: "1.2rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "0.8rem",
            }}
          >
            <span style={{ fontSize: "2rem" }}>📋</span> Gestão de Ativos
          </h2>
          <p
            style={{
              color: "var(--text-muted)",
              marginBottom: "2rem",
              lineHeight: "1.7",
              fontSize: "1rem",
            }}
          >
            Controle centralizado de <strong>Técnicos</strong> e{" "}
            <strong>Clientes</strong>. Configure frequências de visita, sistemas
            (SDAI, CFTV) e preferências de agenda.
          </p>
          <div style={{ display: "flex", gap: "1.2rem" }}>
            <Link
              href="/clients"
              className="btn-primary"
              style={{
                textDecoration: "none",
                textAlign: "center",
                flex: 1,
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Contratos
            </Link>
            <Link
              href="/professionals"
              className="btn-secondary"
              style={{
                textDecoration: "none",
                textAlign: "center",
                flex: 1,
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Técnicos
            </Link>
          </div>
        </section>

        <section
          className="glass-panel animate-fade-in"
          style={{
            animationDelay: "0.2s",
            position: "relative",
            overflow: "hidden",
            borderLeft: "4px solid var(--primary)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-20px",
              right: "-20px",
              fontSize: "12rem",
              opacity: 0.03,
              fontWeight: 900,
              color: "var(--primary)",
              userSelect: "none",
              pointerEvents: "none",
            }}
          >
            02
          </div>
          <h2
            style={{
              fontSize: "1.6rem",
              marginBottom: "1.2rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "0.8rem",
            }}
          >
            <span style={{ fontSize: "2rem" }}>📅</span> Cronograma Anual
          </h2>
          <p
            style={{
              color: "var(--text-muted)",
              marginBottom: "2rem",
              lineHeight: "1.7",
              fontSize: "1rem",
            }}
          >
            Visualização estratégica da agenda. Gere visitas automáticas, valide
            conflitos e agende testes trimestrais obrigatórios com precisão
            cirúrgica.
          </p>
          <Link
            href="/calendar"
            className="btn-primary"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              width: "100%",
              border: "none",
            }}
          >
            Visualizar Calendário Completo
          </Link>
        </section>
      </div>

      <footer
        style={{
          marginTop: "6rem",
          paddingTop: "2rem",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <p>
          © 2026 CompaSSS - Companhia de Parceira em Soluções e Serviços em
          Sistemas
        </p>
        <p>Versão 8.0 - Enterprise Edition</p>
      </footer>
    </main>
  );
}
