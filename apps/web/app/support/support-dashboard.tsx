'use client';

import { useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type TicketStatus = 'OPEN' | 'AWAITING_USER' | 'RESOLVED' | 'CLOSED';
type TicketChannel = 'IN_APP' | 'EMAIL' | 'WHATSAPP' | 'TELEGRAM';
type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

interface SupportMessage {
  id: string;
  body: string;
  senderRole: 'USER' | 'ADMIN' | 'SYSTEM';
  createdAt: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  status: TicketStatus;
  channel: TicketChannel;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  messages?: SupportMessage[];
}

export function SupportDashboard() {
  const [token, setToken] = useState('');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [status, setStatus] = useState('Hazır');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState<TicketChannel>('IN_APP');
  const [priority, setPriority] = useState<TicketPriority>('NORMAL');
  const [reply, setReply] = useState('');

  function headers(): HeadersInit {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  async function loadTickets() {
    if (!token) return setStatus('Önce JWT girin');
    setStatus('Talepler yükleniyor');
    const response = await fetch(`${apiUrl}/support/tickets`, { headers: headers() });
    if (!response.ok) {
      setStatus(`Hata: ${response.status}`);
      return;
    }
    const data = (await response.json()) as SupportTicket[];
    setTickets(data);
    setStatus(`${data.length} talep yüklendi`);
  }

  async function createTicket() {
    if (!subject.trim() || !body.trim()) return setStatus('Konu ve mesaj gerekli');
    setStatus('Talep gönderiliyor');
    const response = await fetch(`${apiUrl}/support/tickets`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ subject, body, channel, priority }),
    });
    if (!response.ok) {
      setStatus(`Hata: ${response.status}`);
      return;
    }
    setSubject('');
    setBody('');
    setStatus('Talep oluşturuldu');
    await loadTickets();
  }

  async function openTicket(id: string) {
    setStatus('Mesajlar yükleniyor');
    const response = await fetch(`${apiUrl}/support/tickets/${id}`, { headers: headers() });
    if (!response.ok) {
      setStatus(`Hata: ${response.status}`);
      return;
    }
    const data = (await response.json()) as SupportTicket;
    setActiveTicket(data);
    setStatus('Hazır');
  }

  async function sendReply() {
    if (!activeTicket || !reply.trim()) return;
    const response = await fetch(`${apiUrl}/support/tickets/${activeTicket.id}/reply`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ body: reply }),
    });
    if (!response.ok) {
      setStatus(`Hata: ${response.status}`);
      return;
    }
    setReply('');
    await openTicket(activeTicket.id);
  }

  async function closeTicket() {
    if (!activeTicket) return;
    const response = await fetch(`${apiUrl}/support/tickets/${activeTicket.id}/close`, {
      method: 'POST',
      headers: headers(),
    });
    if (!response.ok) {
      setStatus(`Hata: ${response.status}`);
      return;
    }
    setActiveTicket(null);
    await loadTickets();
  }

  return (
    <main className="panel">
      <h1>Destek</h1>
      <p className="panel-status">{status}</p>
      <section className="panel-section">
        <label>
          JWT Token
          <input value={token} onChange={(event) => setToken(event.target.value)} />
        </label>
        <button type="button" onClick={() => void loadTickets()}>
          Taleplerimi getir
        </button>
      </section>

      <section className="panel-section">
        <h2>Yeni talep</h2>
        <label>
          Konu
          <input value={subject} onChange={(event) => setSubject(event.target.value)} />
        </label>
        <label>
          Mesaj
          <textarea rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
        <label>
          Kanal
          <select value={channel} onChange={(event) => setChannel(event.target.value as TicketChannel)}>
            <option value="IN_APP">Uygulama içi</option>
            <option value="EMAIL">E-posta</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="TELEGRAM">Telegram</option>
          </select>
        </label>
        <label>
          Öncelik
          <select value={priority} onChange={(event) => setPriority(event.target.value as TicketPriority)}>
            <option value="LOW">Düşük</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">Yüksek</option>
            <option value="URGENT">Acil</option>
          </select>
        </label>
        <button type="button" onClick={() => void createTicket()}>
          Gönder
        </button>
      </section>

      <section className="panel-section">
        <h2>Taleplerim</h2>
        <ul className="panel-list">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <button type="button" onClick={() => void openTicket(ticket.id)}>
                [{ticket.status}] {ticket.subject}
              </button>
            </li>
          ))}
          {tickets.length === 0 && <li>Henüz talebiniz yok.</li>}
        </ul>
      </section>

      {activeTicket && (
        <section className="panel-section">
          <h2>{activeTicket.subject}</h2>
          <p>
            Durum: {activeTicket.status} · Öncelik: {activeTicket.priority} · Kanal: {activeTicket.channel}
          </p>
          <ul className="panel-list">
            {(activeTicket.messages ?? []).map((message) => (
              <li key={message.id}>
                <strong>{message.senderRole}</strong> · {new Date(message.createdAt).toLocaleString('tr-TR')}
                <p>{message.body}</p>
              </li>
            ))}
          </ul>
          <label>
            Yanıt
            <textarea rows={3} value={reply} onChange={(event) => setReply(event.target.value)} />
          </label>
          <div className="panel-actions">
            <button type="button" onClick={() => void sendReply()}>
              Yanıt gönder
            </button>
            <button type="button" onClick={() => void closeTicket()}>
              Talebi kapat
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
