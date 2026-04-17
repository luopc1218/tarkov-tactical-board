import { useTranslation } from 'react-i18next'
import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import { ROUTES } from '../../router/routes'
import { AdminShell } from './AdminShell'

interface AdminDashboardPageProps {
  onNavigate: (path: string) => void
  onLogout: () => void
}

export function AdminDashboardPage({ onNavigate, onLogout }: AdminDashboardPageProps) {
  const { t } = useTranslation()

  return (
    <AdminShell
      current="dashboard"
      title={t('admin.dashboardTitle')}
      subtitle={t('admin.dashboardSubtitle')}
      onNavigate={onNavigate}
      onLogout={onLogout}
      headerActions={
        <Stack direction="row" spacing={1}>
          <Button onClick={() => onNavigate(ROUTES.adminMaps)} color="inherit" variant="outlined">
            {t('admin.mapManagement')}
          </Button>
          <Button onClick={() => onNavigate(ROUTES.adminInstances)} color="inherit" variant="outlined">
            {t('admin.instanceManagement')}
          </Button>
          <Button onClick={() => onNavigate(ROUTES.adminPassword)} color="inherit" variant="outlined">
            {t('admin.changePassword')}
          </Button>
        </Stack>
      }
    >
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {t('admin.apiConnection')}
          </Typography>
          <Typography variant="h5" sx={{ mt: 1 }}>
            {t('admin.apiConnected')}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {t('admin.systemStatus')}
          </Typography>
          <Typography variant="h5" sx={{ mt: 1 }}>
            {t('admin.online')}
          </Typography>
        </Paper>
      </Box>
    </AdminShell>
  )
}
