// bipagem.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { CONFIG, Etapa } from '../config';

export interface Funcionario {
  id: number;
  codigo_cracha: string;
  nome: string;
  cargo: string | null;
  role: 'operador' | 'admin';
  ativo: 0 | 1;
}

export interface ResultadoBipagem {
  funcionario: { nome: string; cargo: string | null };
  os: { numero_os: string; cliente: string };
  etapa: Etapa;
  tipo_evento: 'inicio' | 'fim';
}

@Injectable({ providedIn: 'root' })
export class BipagemService {
  private http = inject(HttpClient);

  // Conexão única de socket, reaproveitada por qualquer componente que
  // precisar reagir a eventos em tempo real (bipagem:novo, os:nova, etc).
  readonly socket: Socket = io(CONFIG.apiUrl);

  buscarFuncionario(codigoCracha: string): Observable<Funcionario> {
    return this.http.get<Funcionario>(
      `${CONFIG.apiUrl}/funcionarios/${encodeURIComponent(codigoCracha)}`
    );
  }

  registrarBipagem(
    codigoCracha: string,
    numeroOs: string,
    etapa: Etapa
  ): Observable<ResultadoBipagem> {
    return this.http.post<ResultadoBipagem>(`${CONFIG.apiUrl}/bipagem`, {
      codigo_cracha: codigoCracha,
      numero_os: numeroOs,
      etapa,
    });
  }
}
