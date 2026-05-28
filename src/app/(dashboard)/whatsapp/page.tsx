'use client'

import { useEffect, useState, useCallback } from 'react'
import { Smartphone, RefreshCw, Link2, Link2Off, ScanLine, CheckCircle2, AlertCircle } from 'lucide-react'

type ConnectionState = 'connecting' | 'open' | 'close' | 'disconnected' | 'loading'

const STATE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: 'check' | 'alert' | 'scan' }> = {
  open:         { label: 'Conectado',   color: '#065f46', bg: '#f0fdf4', icon: 'check' },
  connecting:   { label: 'Conectando',  color: '#5b21b6', bg: '#f5f3ff', icon: 'scan' },
  close:        { label: 'Desconectado', color: '#991b1b', bg: '#fef2f2', icon: 'alert' },
  disconnected: { label: 'Desconectado', color: '#991b1b', bg: '#fef2f2', icon: 'alert' },
  loading:      { label: 'Cargando...',  color: '#64748b', bg: '#f1f5f9', icon: 'alert' },
}

export default function WhatsAppPage() {
  const [state, setState] = useState<ConnectionState>('loading')
  const [qrBase64, setQrBase64] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const fetchQr = useCallback(async () => {
    try {
      const res = await fetch('/api/evolution/connect')
      const data = await res.json()
      if (data.base64) {
        setQrBase64(data.base64)
      }
      return data
    } catch {
      return null
    }
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/evolution/status')
      const data = await res.json()
      const instanceState = data?.instance?.state ?? 'close'
      setState(instanceState as ConnectionState)
      return instanceState
    } catch {
      setState('close')
      return 'close'
    }
  }, [])

  const handleConnect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    setQrBase64(null)
    setState('connecting')
    try {
      const data = await fetchQr()
      if (data?.base64) {
        setQrBase64(data.base64)
      }
      // Poll for QR refresh while connecting
      let attempts = 0
      const interval = setInterval(async () => {
        const s = await fetchStatus()
        if (s === 'open') {
          clearInterval(interval)
          setConnecting(false)
          return
        }
        attempts++
        if (attempts > 30) {
          clearInterval(interval)
          setConnecting(false)
          return
        }
        // Refresh QR every 5s
        const qr = await fetchQr()
        if (qr?.base64) setQrBase64(qr.base64)
      }, 5000)
    } catch (err: any) {
      setError(err?.message ?? 'Error al conectar')
      setConnecting(false)
    }
  }, [fetchQr, fetchStatus])

  const handleDisconnect = useCallback(async () => {
    try {
      await fetch('/api/evolution/disconnect')
      setState('close')
      setQrBase64(null)
    } catch (err: any) {
      setError(err?.message ?? 'Error al desconectar')
    }
  }, [])

  useEffect(() => {
    async function init() {
      const s = await fetchStatus()
      if (s === 'open') {
        setState('open')
      } else if (s === 'connecting') {
        await handleConnect()
      } else {
        setState('close')
      }
    }
    init()
  }, [fetchStatus, handleConnect])

  const sc = STATE_CONFIG[state] ?? STATE_CONFIG.loading
  const IconComponent = sc.icon === 'check' ? CheckCircle2 : sc.icon === 'alert' ? AlertCircle : ScanLine

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <h1 className="text-xl font-semibold">WhatsApp</h1>

      {/* Status */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone size={16} style={{ color: 'var(--brand)' }} />
          <h2 className="font-semibold text-sm">Conexión WhatsApp</h2>
        </div>

        {/* Estado */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-full)] text-xs font-medium"
            style={{ background: sc.bg, color: sc.color }}>
            <IconComponent size={14} />
            {sc.label}
          </div>
          {state === 'open' && (
            <button onClick={handleDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium transition-colors"
              style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
              <Link2Off size={14} />
              Desconectar
            </button>
          )}
        </div>

        {/* QR Code */}
        {qrBase64 && state !== 'open' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="rounded-[var(--radius-lg)] overflow-hidden border-2" style={{ borderColor: 'var(--border)' }}>
              <img src={qrBase64} alt="QR Code" className="w-64 h-64" />
            </div>
            <p className="text-xs text-center max-w-sm" style={{ color: 'var(--subtle)' }}>
              Escaneá este código QR desde WhatsApp en tu celular: Menú &gt; Dispositivos vinculados &gt; Vincular un dispositivo
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-[var(--radius-md)] text-xs" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        {state === 'close' && (
          <button onClick={handleConnect} disabled={connecting}
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--brand)' }}>
            {connecting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <Link2 size={16} />
                Conectar WhatsApp
              </>
            )}
          </button>
        )}

        {state === 'connecting' && !qrBase64 && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            <RefreshCw size={16} className="animate-spin" />
            Generando QR...
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card p-4">
        <h2 className="font-semibold text-sm mb-2">¿Cómo funciona?</h2>
        <ul className="space-y-1.5 text-xs" style={{ color: 'var(--muted)' }}>
          <li>1. Hacé clic en &quot;Conectar WhatsApp&quot; para generar un código QR</li>
          <li>2. Escanealo desde WhatsApp (Menú &gt; Dispositivos vinculados)</li>
          <li>3. Una vez conectado, los mensajes entrantes serán gestionados por el agente de IA</li>
          <li>4. Podés desconectar en cualquier momento desde esta página</li>
        </ul>
      </div>
    </div>
  )
}
