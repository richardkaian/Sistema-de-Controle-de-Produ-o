// admin.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CONFIG } from '../config';

export interface OrdemServico {
  id: number;
  numero_os: string;
  vendedor: string | null;
  cliente: string;
  data_pedido: string | null;
  data_limite_usinagem: string | null;
  tempo_usinagem_total: number | null;
  status: string;
  ordem_producao: number | null;
  arquivo_origem: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ItemOS {
  id: number;
  os_id: number;
  qtd: number;
  tempo_por_item: number | null;
  descricao: string;
  observacoes: string | null;
}

export interface OrdemServicoDetalhe extends OrdemServico {
  itens: ItemOS[];
}

export interface Funcionario {
  id: number;
  codigo_cracha: string;
  nome: string;
  cargo: string | null;
  role: 'operador' | 'admin';
  ativo: 0 | 1;
  criado_em: string;
}

export interface EventoBipagem {
  id: number;
  etapa: string;
  tipo_evento: 'inicio' | 'fim';
  criado_em: string;
  numero_os: string;
  cliente: string;
  funcionario_nome: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);

  listarOS(): Observable<OrdemServico[]> {
    return this.http.get<OrdemServico[]>(`${CONFIG.apiUrl}/os`);
  }

  buscarOS(numeroOs: string): Observable<OrdemServicoDetalhe> {
    return this.http.get<OrdemServicoDetalhe>(`${CONFIG.apiUrl}/os/${encodeURIComponent(numeroOs)}`);
  }

  listarEventos(limite = 50): Observable<EventoBipagem[]> {
    return this.http.get<EventoBipagem[]>(`${CONFIG.apiUrl}/eventos?limite=${limite}`);
  }

  listarFuncionarios(): Observable<Funcionario[]> {
    return this.http.get<Funcionario[]>(`${CONFIG.apiUrl}/funcionarios`);
  }

  criarFuncionario(dados: {
    codigo_cracha: string;
    nome: string;
    cargo?: string;
    role: 'operador' | 'admin';
    senha?: string;
  }): Observable<Funcionario> {
    return this.http.post<Funcionario>(`${CONFIG.apiUrl}/funcionarios`, dados);
  }

  atualizarAtivo(id: number, ativo: boolean): Observable<Funcionario> {
    return this.http.patch<Funcionario>(`${CONFIG.apiUrl}/funcionarios/${id}/ativo`, { ativo });
  }

  atualizarStatusOS(numeroOs: string, status: string): Observable<OrdemServico> {
    return this.http.patch<OrdemServico>(
      `${CONFIG.apiUrl}/os/${encodeURIComponent(numeroOs)}/status`,
      { status }
    );
  }

  buscarProgramacao(): Observable<{ fila: OrdemServico[]; disponiveis: OrdemServico[] }> {
    return this.http.get<{ fila: OrdemServico[]; disponiveis: OrdemServico[] }>(
      `${CONFIG.apiUrl}/programacao`
    );
  }

  reordenarProgramacao(numerosOs: string[]): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${CONFIG.apiUrl}/programacao/ordem`, {
      numeros_os: numerosOs,
    });
  }

  adicionarAProgramacao(numeroOs: string): Observable<OrdemServico> {
    return this.http.post<OrdemServico>(
      `${CONFIG.apiUrl}/programacao/${encodeURIComponent(numeroOs)}`,
      {}
    );
  }

  removerDaProgramacao(numeroOs: string): Observable<OrdemServico> {
    return this.http.delete<OrdemServico>(
      `${CONFIG.apiUrl}/programacao/${encodeURIComponent(numeroOs)}`
    );
  }
}
