// config.ts
//
// Configuração por estação. Antes a etapa (separação/corte/usinagem/
// expedição) vinha fixa no código, exigindo um build do Angular por
// estação. Agora um único build serve todas as máquinas: a etapa fica
// guardada no localStorage DO NAVEGADOR daquele PC, escolhida uma vez
// na tela de bipagem (ver EtapaSetupComponent) e persiste dali em
// diante — sobrevive a reload e a fechar/abrir o navegador, mas é
// local àquela máquina (trocar de PC = escolher de novo).

import { isDevMode } from '@angular/core';

export type Etapa = 'separacao' | 'corte' | 'usinagem' | 'expedicao';

const ETAPAS_VALIDAS: readonly Etapa[] = ['separacao', 'corte', 'usinagem', 'expedicao'];

const CHAVE_ETAPA_STORAGE = 'obr_etapa_estacao';

export const CONFIG = {
  // Em dev (`ng serve`, porta 4200) o front e o backend rodam em portas
  // diferentes, então aponta explicitamente pro backend local.
  // Em produção (deploy único, backend servindo o build do Angular),
  // front e backend são a MESMA origem — usar window.location.origin
  // funciona tanto localhost quanto acessando pelo IP da rede da fábrica,
  // sem precisar trocar essa string a cada estação.
  apiUrl: isDevMode() ? 'http://localhost:3000' : window.location.origin,
};

export const ETAPA_LABEL: Record<Etapa, string> = {
  separacao: 'Separação',
  corte: 'Corte',
  usinagem: 'Usinagem',
  expedicao: 'Expedição',
};

/** Lê a etapa configurada nesta máquina, ou null se ainda não foi escolhida. */
export function obterEtapaEstacao(): Etapa | null {
  const valor = localStorage.getItem(CHAVE_ETAPA_STORAGE);
  return (ETAPAS_VALIDAS as string[]).includes(valor ?? '') ? (valor as Etapa) : null;
}

/** Salva a etapa desta máquina (fica valendo até alguém trocar de novo). */
export function definirEtapaEstacao(etapa: Etapa): void {
  localStorage.setItem(CHAVE_ETAPA_STORAGE, etapa);
}

/** Limpa a etapa configurada — usado pra "trocar de estação" na mesma máquina. */
export function limparEtapaEstacao(): void {
  localStorage.removeItem(CHAVE_ETAPA_STORAGE);
}
