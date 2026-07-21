import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, Shield, Trash2, UserCheck, UserMinus, UserPlus, Users } from 'lucide-react'

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageHeader,
  Select,
  SkeletonTable,
  Table,
  TableActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useConfirm,
  usePrompt,
  useToast,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import {
  createUser,
  deleteUser,
  listUsers,
  patchUser,
  resetUserPassword,
} from '../../lib/users-api'
import type { AdminUserRole, CrmUserDto } from '../../types/admin-users'
import { PASSWORD_MIN_LENGTH } from '../../types/admin-users'

const formatLastLogin = (value: string | null): string => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const UsersSettingsPage = () => {
  const { admin } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const prompt = usePrompt()

  const [users, setUsers] = useState<CrmUserDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<AdminUserRole>('manager')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setUsers(await listUsers())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить пользователей'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const activeOwnerCount = useMemo(
    () => users.filter((u) => u.role === 'owner' && u.is_active).length,
    [users],
  )

  const isSelf = (row: CrmUserDto) =>
    Boolean(admin?.email) && row.email.toLowerCase() === admin!.email.toLowerCase()

  const isLastActiveOwner = (row: CrmUserDto) =>
    row.role === 'owner' && row.is_active && activeOwnerCount === 1

  const dangerousDisabled = (row: CrmUserDto) => isSelf(row) || isLastActiveOwner(row)

  const dangerousTitle = (row: CrmUserDto, action: string): string | undefined => {
    if (isSelf(row)) return `Нельзя ${action} себя`
    if (isLastActiveOwner(row)) return `Нельзя ${action} последнего активного владельца`
    return undefined
  }

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (createPassword.length < PASSWORD_MIN_LENGTH) {
      toast.error(`Пароль не короче ${PASSWORD_MIN_LENGTH} символов`)
      return
    }
    setCreating(true)
    try {
      await createUser({
        email: createEmail.trim(),
        password: createPassword,
        role: createRole,
      })
      setCreateEmail('')
      setCreatePassword('')
      setCreateRole('manager')
      setShowCreate(false)
      await load()
      toast.success('Пользователь создан')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось создать пользователя')
    } finally {
      setCreating(false)
    }
  }

  const onToggleRole = async (row: CrmUserDto) => {
    const nextRole: AdminUserRole = row.role === 'owner' ? 'manager' : 'owner'
    if (nextRole === 'manager' && dangerousDisabled(row)) return

    const ok = await confirm({
      title: nextRole === 'owner' ? 'Сделать владельцем?' : 'Сделать менеджером?',
      message: `${row.email} → ${nextRole}`,
      confirmLabel: 'Сменить роль',
    })
    if (!ok) return

    setBusyId(row.id)
    try {
      await patchUser(row.id, { role: nextRole })
      await load()
      toast.success('Роль обновлена')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сменить роль')
    } finally {
      setBusyId(null)
    }
  }

  const onToggleActive = async (row: CrmUserDto) => {
    const nextActive = !row.is_active
    if (!nextActive && dangerousDisabled(row)) return

    const ok = await confirm({
      title: nextActive ? 'Активировать пользователя?' : 'Отключить пользователя?',
      message: row.email,
      confirmLabel: nextActive ? 'Активировать' : 'Отключить',
      variant: nextActive ? 'default' : 'danger',
    })
    if (!ok) return

    setBusyId(row.id)
    try {
      await patchUser(row.id, { is_active: nextActive })
      await load()
      toast.success(nextActive ? 'Пользователь активен' : 'Пользователь отключён')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось изменить статус')
    } finally {
      setBusyId(null)
    }
  }

  const onResetPassword = async (row: CrmUserDto) => {
    const value = await prompt({
      title: 'Новый пароль',
      message: `Для ${row.email}. Минимум ${PASSWORD_MIN_LENGTH} символов.`,
      confirmLabel: 'Сохранить',
    })
    if (value === null) return
    if (value.length < PASSWORD_MIN_LENGTH) {
      toast.error(`Пароль не короче ${PASSWORD_MIN_LENGTH} символов`)
      return
    }

    setBusyId(row.id)
    try {
      await resetUserPassword(row.id, value)
      toast.success('Пароль обновлён')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сбросить пароль')
    } finally {
      setBusyId(null)
    }
  }

  const onDelete = async (row: CrmUserDto) => {
    if (dangerousDisabled(row)) return

    const ok = await confirm({
      title: 'Удалить пользователя?',
      message: `${row.email} будет удалён без возможности восстановления.`,
      confirmLabel: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return

    setBusyId(row.id)
    try {
      await deleteUser(row.id)
      await load()
      toast.success('Пользователь удалён')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось удалить')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="page-stack">
      <PageHeader
        title="Пользователи"
        backTo="/settings"
        actions={
          <Button type="button" onClick={() => setShowCreate((v) => !v)}>
            <UserPlus size={16} aria-hidden />
            Добавить пользователя
          </Button>
        }
      />

      {error ? <p className="error-text">{error}</p> : null}

      {showCreate ? (
        <Card title="Новый пользователь">
          <form className="form-stack" onSubmit={onCreate}>
            <Field label="Email" htmlFor="create-user-email">
              <Input
                id="create-user-email"
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
                autoComplete="off"
              />
            </Field>
            <Field label={`Пароль (от ${PASSWORD_MIN_LENGTH} символов)`} htmlFor="create-user-password">
              <Input
                id="create-user-password"
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                required
                minLength={PASSWORD_MIN_LENGTH}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Роль" htmlFor="create-user-role">
              <Select
                id="create-user-role"
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as AdminUserRole)}
              >
                <option value="manager">manager</option>
                <option value="owner">owner</option>
              </Select>
            </Field>
            <div className="muru-page-header__actions">
              <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                Отмена
              </Button>
              <Button type="submit" loading={creating}>
                Создать
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Пользователей пока нет"
          action={
            <Button type="button" onClick={() => setShowCreate(true)}>
              Добавить пользователя
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader sticky>
            <TableRow hover={false}>
              <TableHead>Email</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Последний вход</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((row) => {
              const blocked = dangerousDisabled(row)
              const demoteBlocked = row.role === 'owner' && blocked
              const deactivateBlocked = row.is_active && blocked
              const rowBusy = busyId === row.id

              return (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.email}
                    {isSelf(row) ? (
                      <Badge variant="neutral" className="inline-badge">
                        вы
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.role === 'owner' ? 'warning' : 'neutral'}>{row.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.is_active ? 'success' : 'danger'} dot>
                      {row.is_active ? 'активен' : 'выключен'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatLastLogin(row.last_login_at)}</TableCell>
                  <TableCell>
                    <TableActions>
                      <IconButton
                        aria-label="Сменить роль"
                        title={
                          demoteBlocked
                            ? dangerousTitle(row, 'понизить')
                            : row.role === 'owner'
                              ? 'Сделать менеджером'
                              : 'Сделать владельцем'
                        }
                        disabled={rowBusy || demoteBlocked}
                        onClick={() => void onToggleRole(row)}
                      >
                        <Shield size={16} aria-hidden />
                      </IconButton>
                      <IconButton
                        aria-label={row.is_active ? 'Отключить' : 'Активировать'}
                        title={
                          deactivateBlocked
                            ? dangerousTitle(row, 'отключить')
                            : row.is_active
                              ? 'Отключить'
                              : 'Активировать'
                        }
                        disabled={rowBusy || deactivateBlocked}
                        onClick={() => void onToggleActive(row)}
                      >
                        {row.is_active ? (
                          <UserMinus size={16} aria-hidden />
                        ) : (
                          <UserCheck size={16} aria-hidden />
                        )}
                      </IconButton>
                      <IconButton
                        aria-label="Сбросить пароль"
                        title="Сбросить пароль"
                        disabled={rowBusy}
                        onClick={() => void onResetPassword(row)}
                      >
                        <KeyRound size={16} aria-hidden />
                      </IconButton>
                      <IconButton
                        variant="danger"
                        aria-label="Удалить"
                        title={blocked ? dangerousTitle(row, 'удалить') : 'Удалить'}
                        disabled={rowBusy || blocked}
                        onClick={() => void onDelete(row)}
                      >
                        <Trash2 size={16} aria-hidden />
                      </IconButton>
                    </TableActions>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
