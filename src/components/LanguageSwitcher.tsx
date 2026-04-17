import { useTranslation } from 'react-i18next'
import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material'
import type { SupportedLanguage } from '../i18n/resources'

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['zh', 'en']

interface LanguageSwitcherProps {
  inline?: boolean
}

export function LanguageSwitcher({ inline = false }: LanguageSwitcherProps) {
  const { i18n } = useTranslation()

  const current = SUPPORTED_LANGUAGES.includes(i18n.language as SupportedLanguage)
    ? (i18n.language as SupportedLanguage)
    : 'zh'

  const changeLanguage = (lang: SupportedLanguage) => {
    if (lang === current) {
      return
    }
    void i18n.changeLanguage(lang)
  }

  return (
    <Box
      sx={
        inline
          ? { position: 'relative', zIndex: 10 }
          : {
              position: 'fixed',
              zIndex: 30,
              right: 16,
              top: 'calc(12px + var(--desktop-titlebar-safe-top))',
            }
      }
    >
      <ToggleButtonGroup
        exclusive
        value={current}
        onChange={(_, value) => {
          if (value) {
            changeLanguage(value as SupportedLanguage)
          }
        }}
        size="small"
        aria-label="Language"
      >
        <ToggleButton value="zh">中</ToggleButton>
        <ToggleButton value="en">EN</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  )
}
