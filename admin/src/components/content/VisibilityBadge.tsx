import { Badge } from '../ui/Badge'

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
  <Badge variant={visible ? 'success' : 'neutral'}>
    {visible ? visibleLabel : hiddenLabel}
  </Badge>
)
