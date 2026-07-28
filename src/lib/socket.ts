"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

// Eine einzige Socket-Verbindung pro Browser-Tab (Cookies werden im
// Handshake automatisch mitgesendet -> Auth fuer Fahrer/Admin).
export function getSocket(): Socket {
  if (!socket || socket.disconnected) {
    socket = io({
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
    });
  }
  return socket;
}

// Bestehende Verbindung schliessen und beim naechsten getSocket() neu aufbauen.
// WICHTIG nach Login/Logout: sonst bleibt die Verbindung mit der ALTEN Session
// (Rolle) bestehen und das Dashboard erhaelt keine Daten mehr ("Einfrieren").
export function resetSocket(): void {
  if (socket) {
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch {
      /* ignore */
    }
    socket = null;
  }
}
