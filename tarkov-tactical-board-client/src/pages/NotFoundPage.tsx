import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Box, Button, Paper, Stack, Typography } from '@mui/material'

interface NotFoundPageProps {
  pathname: string
  onBackHome: () => void
  onBackPrevious: () => void
}

export function NotFoundPage({ pathname, onBackHome, onBackPrevious }: NotFoundPageProps) {
  const { t } = useTranslation()

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2, py: 4 }}>
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        style={{ width: '100%', maxWidth: 760 }}
      >
        <Paper sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="overline" color="text.secondary">
            {t('notFound.errorCode')}
          </Typography>
          <Typography variant="h3" sx={{ mt: 1 }}>
            {t('notFound.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            {t('notFound.desc', { pathname })}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
            <Button variant="contained" onClick={onBackHome}>
              {t('common.backHome')}
            </Button>
            <Button variant="outlined" color="inherit" onClick={onBackPrevious}>
              {t('common.backPrevious')}
            </Button>
          </Stack>
        </Paper>
      </motion.section>
    </Box>
  )
}
