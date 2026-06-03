import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { CdekPvz } from '../lib/api'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const SelectedIcon = L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#5d6b3a;border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 22],
})

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))

type Props = {
  points: CdekPvz[]
  selectedCode: string | null
  onSelect: (pvz: CdekPvz) => void
}

export const PvzMap = ({ points, selectedCode, onSelect }: Props) => {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const leafletRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const validPoints = useMemo(
    () => points.filter((p) => p.location.latitude && p.location.longitude),
    [points],
  )

  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return
    const map = L.map(mapRef.current, { attributionControl: false, zoomControl: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)
    leafletRef.current = map
    map.setView([59.9343, 30.3351], 11)
    const t1 = setTimeout(() => map.invalidateSize(), 100)
    const t2 = setTimeout(() => map.invalidateSize(), 300)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      map.remove()
      leafletRef.current = null
      markersRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const map = leafletRef.current
    if (!map) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current.clear()

    if (validPoints.length === 0) return
    const bounds: [number, number][] = []
    for (const p of validPoints) {
      const marker = L.marker([p.location.latitude, p.location.longitude], {
        icon: p.code === selectedCode ? SelectedIcon : DefaultIcon,
      })
      marker.bindPopup(
        `<div style="font-size:13px;max-width:220px">
            <b>${escapeHtml(p.name)}</b><br/>
            ${escapeHtml(p.address)}<br/>
            ${p.workTime ? `<span style="color:#6b6b4a">${escapeHtml(p.workTime)}</span><br/>` : ''}
            <button id="pick-${p.code}" style="margin-top:6px;background:#5d6b3a;color:#fff;border:none;border-radius:8px;padding:6px 10px;font-size:13px;cursor:pointer">Выбрать этот ПВЗ</button>
          </div>`,
      )
      marker.on('popupopen', () => {
        const btn = document.getElementById(`pick-${p.code}`)
        btn?.addEventListener(
          'click',
          () => {
            onSelectRef.current(p)
            map.closePopup()
          },
          { once: true },
        )
      })
      marker.addTo(map)
      markersRef.current.set(p.code, marker)
      bounds.push([p.location.latitude, p.location.longitude])
    }
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
    }
  }, [validPoints, selectedCode])

  useEffect(() => {
    const map = leafletRef.current
    if (!map || !selectedCode) return
    const sel = validPoints.find((p) => p.code === selectedCode)
    if (sel) map.setView([sel.location.latitude, sel.location.longitude], 15)
  }, [selectedCode, validPoints])

  return (
    <div
      ref={mapRef}
      style={{
        height: '320px',
        width: '100%',
        borderRadius: '14px',
        overflow: 'hidden',
        zIndex: 0,
      }}
    />
  )
}
