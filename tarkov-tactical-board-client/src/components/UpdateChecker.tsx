import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, CircularProgress, LinearProgress, Stack, Typography } from '@mui/material'
import type { Update } from '@tauri-apps/plugin-updater'
import { checkForUpdate, installUpdate, isUpdaterSupported } from '../lib/updater'

type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'upToDate' }
  | { status: 'available'; update: Update }
  | { status: 'installing'; version: string; progress: number | null }
  | { status: 'error' }

export function UpdateChecker() {
  const { t } = useTranslation()
  const [state, setState] = useState<UpdateState>({ status: 'idle' })

  if (!isUpdaterSupported()) {
    return null
  }

  const handleCheck = async () => {
    setState({ status: 'checking' })
    try {
      const update = await checkForUpdate()
      setState(update ? { status: 'available', update } : { status: 'upToDate' })
    } catch {
      setState({ status: 'error' })
    }
  }

  const handleInstall = async (update: Update) => {
    setState({ status: 'installing', version: update.version, progress: null })
    try {
      await installUpdate(update, (progress) =>
        setState({ status: 'installing', version: update.version, progress }),
      )
    } catch {
      setState({ status: 'error' })
    }
  }

  return (
    <Stack spacing={1}>
      {state.status === 'idle' && (
        <>
          <Typography variant="caption" color="text.secondary">
            {t('settings.updateHint')}
          </Typography>
          <Button size="small" variant="outlined" onClick={() => void handleCheck()}>
            {t('settings.updateCheck')}
          </Button>
        </>
      )}

      {state.status === 'checking' && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">
            {t('settings.updateChecking')}
          </Typography>
        </Stack>
      )}

      {state.status === 'upToDate' && (
        <>
          <Typography variant="caption" color="success.main">
            {t('settings.updateUpToDate')}
          </Typography>
          <Button size="small" color="inherit" onClick={() => void handleCheck()}>
            {t('settings.updateCheck')}
          </Button>
        </>
      )}

      {state.status === 'available' && (
        <>
          <Typography variant="caption" color="text.secondary">
            {t('settings.updateAvailable', { version: state.update.version })}
          </Typography>
          <Button
            size="small"
            variant="contained"
            onClick={() => void handleInstall(state.update)}
          >
            {t('settings.updateInstall')}
          </Button>
        </>
      )}

      {state.status === 'installing' && (
        <Stack spacing={0.75}>
          <Typography variant="caption" color="text.secondary">
            {t('settings.updateInstalling', { version: state.version })}
          </Typography>
          <LinearProgress
            variant={state.progress === null ? 'indeterminate' : 'determinate'}
            value={state.progress ?? 0}
          />
        </Stack>
      )}

      {state.status === 'error' && (
        <>
          <Alert severity="error">{t('settings.updateError')}</Alert>
          <Button size="small" color="inherit" onClick={() => void handleCheck()}>
            {t('settings.updateRetry')}
          </Button>
        </>
      )}
    </Stack>
  )
}
