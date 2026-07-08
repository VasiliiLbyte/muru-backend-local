type VisibilityBadgeProps = {
  visible: boolean
  visibleLabel?: string
  hiddenLabel?: string
}

export const VisibilityBadge = ({
  visible,
  visibleLabel = 'Видно',
  hiddenLabel = 'Скрыто',
}: VisibilityBadgeProps) => (
  <span className={`badge ${visible ? 'badge-visible' : 'badge-hidden'}`}>
    {visible ? visibleLabel : hiddenLabel}
  </span>
)
