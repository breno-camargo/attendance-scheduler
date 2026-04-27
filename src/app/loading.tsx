'use client';

export default function Loading() {
  return (
    <div className="app-loading">
      <div className="app-loading__spinner" aria-hidden="true" />
      <p className="app-loading__text">Carregando Módulo CompaSSS...</p>
    </div>
  );
}
