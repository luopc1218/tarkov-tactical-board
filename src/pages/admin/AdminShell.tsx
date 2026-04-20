import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { ROUTES } from '../../router/routes'

type AdminNavKey = 'dashboard' | 'maps' | 'map-intel' | 'instances' | 'password'

interface AdminShellProps {
  current: AdminNavKey
  title: string
  subtitle: string
  onNavigate: (path: string) => void
  onLogout: () => void
  children: ReactNode
  headerActions?: ReactNode
}

export function AdminShell({
  current,
  title,
  subtitle,
  onNavigate,
  onLogout,
  children,
  headerActions,
}: AdminShellProps) {
  const { t } = useTranslation()

  return (
    <Box
      sx={{
        height: '100vh',
        px: 3,
        py: 3,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="overline" color="text.secondary">
          {t('admin.portal')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Tarkov Map Board
        </Typography>
      </Box>
      <Stack direction="row" spacing={3} sx={{ flex: 1, minHeight: 0 }}>
        <Paper sx={{ width: 240, p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            onClick={() => onNavigate(ROUTES.adminDashboard)}
            variant={current === 'dashboard' ? 'contained' : 'text'}
          >
            {t('admin.dashboardTitle')}
          </Button>
          <Button
            onClick={() => onNavigate(ROUTES.adminMaps)}
            variant={current === 'maps' ? 'contained' : 'text'}
          >
            {t('admin.mapManagement')}
          </Button>
          <Button
            onClick={() => onNavigate(ROUTES.adminMapIntel)}
            variant={current === 'map-intel' ? 'contained' : 'text'}
          >
            {t('admin.mapIntelManagement')}
          </Button>
          <Button
            onClick={() => onNavigate(ROUTES.adminInstances)}
            variant={current === 'instances' ? 'contained' : 'text'}
          >
            {t('admin.instanceManagement')}
          </Button>
          <Button
            onClick={() => onNavigate(ROUTES.adminPassword)}
            variant={current === 'password' ? 'contained' : 'text'}
          >
            {t('admin.changePassword')}
          </Button>
          <Button sx={{ mt: 'auto' }} variant="outlined" color="inherit" onClick={() => onNavigate(ROUTES.home)}>
            {t('admin.backToClient')}
          </Button>
          <Button color="inherit" onClick={onLogout}>
            {t('admin.logout')}
          </Button>
        </Paper>
        <Box sx={{ minWidth: 0, minHeight: 0, flex: 1 }}>
          <motion.div
            key={current}
            style={{ display: 'flex', height: '100%', minHeight: 0, flexDirection: 'column', gap: 16 }}
            initial={{ opacity: 0, x: 18, filter: 'blur(4px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <Paper sx={{ p: 2.5, flexShrink: 0 }}>
              <Stack
                direction="row"
                spacing={2}
                sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
              >
                <Box>
                  <Typography variant="h4">{title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {subtitle}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>{headerActions}</Stack>
              </Stack>
            </Paper>
            <Paper sx={{ p: 2.5, minHeight: 0, flex: 1, overflow: 'auto' }}>{children}</Paper>
          </motion.div>
        </Box>
      </Stack>
    </Box>
  )
}
