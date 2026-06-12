"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

// Eine einzige Socket-Verbindung pro Browser-Tab (Cookies werden im
// Handshake automatisch mitgesendet -> Auth fuer Fahrer/Admin).
export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
