"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Header() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("compasss_theme") as
      | "dark"
      | "light"
      | null;
    const initial = saved || "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("compasss_theme", next);
  };

  if (pathname.startsWith("/reports")) return null;

  const navLinks = [
    { name: "Dashboard", href: "/" },
    { name: "Clientes", href: "/clients" },
    { name: "Técnicos", href: "/professionals" },
    { name: "Equipe", href: "/staff" },
    { name: "Calendário", href: "/calendar" },
  ];

  const logoColor = theme === "light" ? "#047857" : "#10b981";
  const logoText = theme === "light" ? "#0f172a" : "white";

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "1.8rem",
            fontWeight: 900,
            color: logoText,
            display: "flex",
            alignItems: "center",
            gap: "2px",
            letterSpacing: "-1px",
            transition: "color 0.4s ease",
          }}
        >
          <span>C</span>
          <svg
            width="34"
            height="34"
            viewBox="0 0 100 100"
            style={{ margin: "0 0px" }}
          >
            <circle
              cx="50"
              cy="50"
              r="42"
              stroke={logoColor}
              strokeWidth="8"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r="26"
              stroke={logoColor}
              strokeWidth="4"
              fill="transparent"
            />
            <circle cx="50" cy="8" r="4.5" fill={logoText} />
            <circle cx="50" cy="92" r="4.5" fill={logoText} />
            <circle cx="8" cy="50" r="4.5" fill={logoText} />
            <circle cx="92" cy="50" r="4.5" fill={logoText} />
            <path
              d="M50 20 L55 38 L72 35 L60 48 L70 65 L50 55 L30 65 L40 48 L28 35 L45 38 Z"
              fill={logoColor}
            />
          </svg>
          <span>
            mpa<span style={{ color: logoColor }}>SSS</span>
          </span>
        </h1>
      </div>

      <nav style={{ display: "flex", gap: "2rem" }}>
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="nav-link"
            style={{
              textDecoration: "none",
              color:
                pathname === link.href ? "var(--primary)" : "var(--text-muted)",
              fontSize: "0.95rem",
              fontWeight: pathname === link.href ? "700" : "500",
              transition: "var(--transition-smooth)",
              position: "relative",
            }}
          >
            {link.name}
            <span
              style={{
                position: "absolute",
                bottom: "-4px",
                left: "0",
                width: pathname === link.href ? "100%" : "0",
                height: "2px",
                background: "var(--primary)",
                borderRadius: "2px",
                transition: "var(--transition-smooth)",
                opacity: pathname === link.href ? 1 : 0,
              }}
            />
          </Link>
        ))}
      </nav>

      <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          title={
            theme === "dark"
              ? "Mudar para tema claro"
              : "Mudar para tema escuro"
          }
          aria-label="Alternar tema"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>

        <div style={{ textAlign: "right" }}>
          <p
            style={{
              fontSize: "0.8rem",
              fontWeight: "600",
              color: "var(--foreground)",
            }}
          >
            Admin
          </p>
          <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
            Compasss Brasil
          </p>
        </div>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "var(--input-bg)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.8rem",
          }}
        >
          👤
        </div>
      </div>
    </header>
  );
}
