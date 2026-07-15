import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button, Card, Field, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'

export const LoginPage = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page muru-rise">
      <Card className="muru-card--auth">
        <h1 className="muru-card__title muru-display">MURU</h1>
        <p className="muru-card__subtitle">Admin CRM</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </Field>

          <Field label="Пароль" htmlFor="password" error={error || undefined}>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          <Button type="submit" loading={submitting} fullWidth>
            {submitting ? 'Вход...' : 'Войти'}
          </Button>
        </form>
      </Card>
    </main>
  )
}
