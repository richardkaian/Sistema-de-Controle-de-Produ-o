// socket.service.ts
import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { CONFIG } from '../config';

@Injectable({ providedIn: 'root' })
export class SocketService {
  readonly socket: Socket = io(CONFIG.apiUrl);
}
