export const getStatusPill = (status: string): { label: string; className: string } => {
  const s = status.toLowerCase()
  if (s.includes('чернов')) return { label: status, className: 'bg-[#e3dccd] text-[#6f6655]' }
  if (s.includes('отмен')) return { label: status, className: 'bg-[#efe0d8] text-[#9a5b43]' }
  if (s.includes('достав') || s.includes('выполн') || s.includes('получен')) {
    return { label: status, className: 'bg-[#dfe7d3] text-[#4f6b3a]' }
  }
  return { label: status, className: 'bg-[#e6e9dc] text-muru-olive' }
}
