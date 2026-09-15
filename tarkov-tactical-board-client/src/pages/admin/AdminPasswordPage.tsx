import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { changeAdminPassword } from '../../api/admin-auth'
import { AdminShell } from './AdminShell'

interface AdminPasswordPageProps {
  onNavigate: (path: string) => void
  onLogout: () => void
}

export function AdminPasswordPage({ onNavigate, onLogout }: AdminPasswordPageProps) {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const passwordStrength = useMemo(() => {
    const candidate = newPassword.trim()
    if (!candidate) {
      return { score: 0, label: t('admin.passwordStrengthWeak') }
    }

    let score = 0
    if (candidate.length >= 8) score += 1
    if (/[A-Z]/.test(candidate) && /[a-z]/.test(candidate)) score += 1
    if (/\d/.test(candidate)) score += 1
    if (/[^A-Za-z0-9]/.test(candidate)) score += 1

    if (score <= 1) {
      return { score, label: t('admin.passwordStrengthWeak') }
    }
    if (score <= 3) {
      return { score, label: t('admin.passwordStrengthMedium') }
    }
    return { score, label: t('admin.passwordStrengthStrong') }
  }, [newPassword, t])

  const ruleStatus = useMemo(
    () => ({
      length: newPassword.length >= 8,
      diff: Boolean(currentPassword) && Boolean(newPassword) && currentPassword !== newPassword,
      match: Boolean(confirmPassword) && newPassword === confirmPassword,
    }),
    [confirmPassword, currentPassword, newPassword]
  )

  const validationError = useMemo(() => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      return t('admin.passwordRequired')
    }
    if (newPassword.length < 8) {
      return t('admin.passwordMinLength')
    }
    if (newPassword === currentPassword) {
      return t('admin.passwordNoChange')
    }
    if (newPassword !== confirmPassword) {
      return t('admin.passwordMismatch')
    }
    return null
  }, [confirmPassword, currentPassword, newPassword, t])

  const handleSubmit = async () => {
    setValidationMessage(null)
    setSuccessMessage(null)

    if (validationError) {
      setValidationMessage(validationError)
      return
    }

    try {
      setSaving(true)
      const result = await changeAdminPassword({
        oldPassword: currentPassword,
        newPassword,
      })
      setSuccessMessage(result.message || t('admin.passwordSubmitSuccess'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      console.warn('[AdminPasswordPage] Change password failed', error)
      setValidationMessage(t('admin.passwordSubmitError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminShell
      current="password"
      title={t('admin.passwordTitle')}
      subtitle={t('admin.passwordSubtitle')}
      onNavigate={onNavigate}
      onLogout={onLogout}
    >
      <Box sx={{ height: '100%', minHeight: 0, overflow: 'auto' }}>
        <Box sx={{ mx: 'auto', width: '100%', maxWidth: 1100, display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.2fr 1fr' } }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6">{t('admin.changePassword')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('admin.passwordFormHint')}
            </Typography>
            <Stack spacing={2} sx={{ mt: 3 }}>
              <TextField
                type={showCurrentPassword ? 'text' : 'password'}
                label={t('admin.currentPassword')}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              <Button size="small" color="inherit" onClick={() => setShowCurrentPassword((prev) => !prev)}>
                {showCurrentPassword ? t('admin.hidePassword') : t('admin.showPassword')}
              </Button>
              <TextField
                type={showNewPassword ? 'text' : 'password'}
                label={t('admin.newPassword')}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <Button size="small" color="inherit" onClick={() => setShowNewPassword((prev) => !prev)}>
                {showNewPassword ? t('admin.hidePassword') : t('admin.showPassword')}
              </Button>
              <TextField
                type={showConfirmPassword ? 'text' : 'password'}
                label={t('admin.confirmPassword')}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <Button size="small" color="inherit" onClick={() => setShowConfirmPassword((prev) => !prev)}>
                {showConfirmPassword ? t('admin.hidePassword') : t('admin.showPassword')}
              </Button>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" sx={{ mb: 1, justifyContent: 'space-between' }}>
                  <Typography variant="caption">{t('admin.passwordStrength')}</Typography>
                  <Typography variant="caption">{passwordStrength.label}</Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.max(8, (passwordStrength.score / 4) * 100)}
                />
              </Paper>
            </Stack>
            {validationMessage && <Alert severity="error" sx={{ mt: 2 }}>{validationMessage}</Alert>}
            {successMessage && <Alert severity="success" sx={{ mt: 2 }}>{successMessage}</Alert>}
            <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={() => void handleSubmit()}
                disabled={saving || Boolean(validationError)}
              >
                {saving ? t('common.loading') : t('admin.savePassword')}
              </Button>
            </Box>
          </Paper>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1">{t('admin.passwordSecurityTitle')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('admin.passwordSecurityDesc')}
            </Typography>
            <Stack spacing={1} sx={{ mt: 2 }}>
              <Alert severity={ruleStatus.length ? 'success' : 'info'}>{t('admin.passwordRuleLength')}</Alert>
              <Alert severity={ruleStatus.diff ? 'success' : 'info'}>{t('admin.passwordRuleDiff')}</Alert>
              <Alert severity={ruleStatus.match ? 'success' : 'info'}>{t('admin.passwordRuleMatch')}</Alert>
            </Stack>
          </Paper>
        </Box>
      </Box>
    </AdminShell>
  )
}
