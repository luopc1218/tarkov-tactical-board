import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

interface NotFoundPageProps {
  pathname: string
  onBackHome: () => void
  onBackPrevious: () => void
}

export function NotFoundPage({ pathname, onBackHome, onBackPrevious }: NotFoundPageProps) {
  const { t } = useTranslation()

  return (
    <main className="app-page grid place-items-center px-4 py-8">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="panel w-full max-w-2xl p-6 md:p-8"
      >
        <p className="text-sm font-semibold tracking-[0.12em] text-emerald-300">ERROR 404</p>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight text-white">{t('notFound.title')}</h1>
        <p className="mt-4 text-emerald-50/75">{t('notFound.desc', { pathname })}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onBackHome}
            className="btn-primary h-11 rounded-xl px-5 text-[0.92rem] shadow-[0_12px_24px_rgba(14,40,29,0.35)] hover:-translate-y-0.5"
          >
            {t('common.backHome')}
          </button>
          <button
            type="button"
            onClick={onBackPrevious}
            className="btn-outline h-11 rounded-xl px-5 text-[0.92rem] backdrop-blur-sm hover:-translate-y-0.5"
          >
            {t('common.backPrevious')}
          </button>
        </div>
      </motion.section>
    </main>
  )
}
