import { useState } from 'react'
import { ArrowDown, ArrowUp, Briefcase, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

import { RichTextEditor } from './RichTextEditor'
import { Button, EmptyState, Field, IconButton, Input } from '../ui'
import type { VacancyItem } from '../../types/content'

type VacancyItemsEditorProps = {
  value: VacancyItem[]
  onChange: (value: VacancyItem[]) => void
}

const emptyItem = (): VacancyItem => ({
  id: crypto.randomUUID(),
  title: '',
  city: '',
  experience: '',
  format: '',
  salary: '',
  description: '',
})

export const VacancyItemsEditor = ({ value, onChange }: VacancyItemsEditorProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(value.map((item) => item.id)),
  )

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const updateItem = (index: number, patch: Partial<VacancyItem>) => {
    const next = [...value]
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }

  const addRow = () => {
    const item = emptyItem()
    onChange([...value, item])
    setExpandedIds((prev) => new Set(prev).add(item.id))
  }

  const removeRow = (index: number) => {
    const removed = value[index]
    onChange(value.filter((_, i) => i !== index))
    if (removed) {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        next.delete(removed.id)
        return next
      })
    }
  }

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= value.length) return
    const next = [...value]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange(next)
  }

  return (
    <div className="vacancy-items-editor">
      {value.length === 0 ? (
        <EmptyState icon={Briefcase} title="Вакансии не добавлены" />
      ) : (
        value.map((item, index) => {
          const expanded = expandedIds.has(item.id)
          return (
            <div className="vacancy-items-editor__item" key={item.id}>
              <div className="vacancy-items-editor__header">
                <button
                  type="button"
                  className="vacancy-items-editor__toggle"
                  onClick={() => toggleExpanded(item.id)}
                  aria-expanded={expanded}
                >
                  {expanded ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
                  <span>{item.title.trim() || 'Без названия'}</span>
                </button>
                <div className="vacancy-items-editor__actions">
                  <IconButton
                    aria-label="Переместить вверх"
                    disabled={index === 0}
                    onClick={() => moveRow(index, -1)}
                  >
                    <ArrowUp size={16} />
                  </IconButton>
                  <IconButton
                    aria-label="Переместить вниз"
                    disabled={index === value.length - 1}
                    onClick={() => moveRow(index, 1)}
                  >
                    <ArrowDown size={16} />
                  </IconButton>
                  <IconButton variant="danger" aria-label="Удалить" onClick={() => removeRow(index)}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </div>

              {expanded ? (
                <div className="form-stack vacancy-items-editor__body">
                  <Field label="Название" htmlFor={`vacancy-title-${item.id}`}>
                    <Input
                      id={`vacancy-title-${item.id}`}
                      value={item.title}
                      onChange={(e) => updateItem(index, { title: e.target.value })}
                    />
                  </Field>
                  <Field label="Город" htmlFor={`vacancy-city-${item.id}`}>
                    <Input
                      id={`vacancy-city-${item.id}`}
                      value={item.city}
                      onChange={(e) => updateItem(index, { city: e.target.value })}
                    />
                  </Field>
                  <Field label="Опыт" htmlFor={`vacancy-experience-${item.id}`}>
                    <Input
                      id={`vacancy-experience-${item.id}`}
                      value={item.experience}
                      onChange={(e) => updateItem(index, { experience: e.target.value })}
                    />
                  </Field>
                  <Field label="Формат" htmlFor={`vacancy-format-${item.id}`}>
                    <Input
                      id={`vacancy-format-${item.id}`}
                      value={item.format}
                      onChange={(e) => updateItem(index, { format: e.target.value })}
                    />
                  </Field>
                  <Field label="Зарплата" htmlFor={`vacancy-salary-${item.id}`}>
                    <Input
                      id={`vacancy-salary-${item.id}`}
                      value={item.salary}
                      onChange={(e) => updateItem(index, { salary: e.target.value })}
                    />
                  </Field>
                  <RichTextEditor
                    label="Описание"
                    value={item.description}
                    onChange={(description) => updateItem(index, { description })}
                  />
                </div>
              ) : null}
            </div>
          )
        })
      )}
      <Button type="button" variant="secondary" onClick={addRow}>
        Добавить вакансию
      </Button>
    </div>
  )
}
