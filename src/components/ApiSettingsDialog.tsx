import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { LanguageSwitcher } from './LanguageSwitcher'
import { getApiBaseUrl, getDefaultApiBaseUrl, setApiBaseUrl } from '../lib/runtime-config'

interface ApiSettingsDialogProps {
  onClose: () => void
  onOpenAdmin: () => void
}

const isValidApiBaseUrl = (value: string) => {
  if (value.startsWith('/') || value.startsWith('./')) {
    return true
  }

  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function ApiSettingsDialog({ onClose, onOpenAdmin }: ApiSettingsDialogProps) {
  const { t } = useTranslation()
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState(() => getApiBaseUrl())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSave = () => {
    const value = apiBaseUrlInput.trim()
    if (!value || !isValidApiBaseUrl(value)) {
      setErrorMessage(t('settings.apiBaseUrlInvalid'))
      return
    }

    setApiBaseUrl(value)
    onClose()
  }

  const handleReset = () => {
    setApiBaseUrl('')
    onClose()
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm"
    >
      <DialogTitle>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{t('settings.title')}</span>
          <Button
            size="small"
            color="inherit"
            onClick={onOpenAdmin}
            sx={{
              minWidth: 'auto',
              px: 0.75,
              py: 0.25,
              color: 'text.disabled',
              fontSize: '0.72rem',
              fontWeight: 500,
              textTransform: 'none',
            }}
          >
            {t('settings.adminEntry')}
          </Button>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {t('settings.description')}
          </Typography>
          <Stack
            direction="row"
            sx={{ justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Typography variant="subtitle2">{t('common.language')}</Typography>
            <LanguageSwitcher inline />
          </Stack>
          <TextField
            label={t('settings.apiBaseUrlLabel')}
            value={apiBaseUrlInput}
            onChange={(event) => setApiBaseUrlInput(event.target.value)}
            placeholder={getDefaultApiBaseUrl()}
            fullWidth
          />
          <Typography variant="caption" color="text.secondary">
            {t('settings.apiBaseUrlHint')}
          </Typography>
          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={handleReset} color="inherit">
          {t('settings.reset')}
        </Button>
        <Button onClick={handleSave} variant="contained">
          {t('settings.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
