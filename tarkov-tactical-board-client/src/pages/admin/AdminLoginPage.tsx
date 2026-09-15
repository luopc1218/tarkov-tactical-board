import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'

interface AdminLoginPageProps {
  onLogin: (payload: { username: string; password: string }) => Promise<void>
  loading: boolean
}

export function AdminLoginPage({ onLogin, loading }: AdminLoginPageProps) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onLogin({ username, password })
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2, py: 4 }}>
      <Paper sx={{ width: '100%', maxWidth: 980, overflow: 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' } }}>
          <Box sx={{ p: { xs: 3, md: 4 }, borderRight: { md: 1 }, borderBottom: { xs: 1, md: 0 }, borderColor: 'divider' }}>
            <Typography variant="overline" color="text.secondary">
              {t('admin.portal')}
            </Typography>
            <Typography variant="h3" sx={{ mt: 1 }}>{t('admin.loginTitle')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, maxWidth: 360 }}>
              {t('admin.loginSubtitle')}
            </Typography>
          </Box>
          <Box sx={{ p: { xs: 3, md: 4 } }}>
            <Stack component="form" spacing={2} onSubmit={(event) => void handleSubmit(event)}>
              <TextField
                label={t('admin.account')}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
              <TextField
                type="password"
                label={t('admin.password')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={loading || !username.trim() || !password.trim()}
              >
                {loading ? t('common.loading') : t('admin.login')}
              </Button>
            </Stack>
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
