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
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onBackHome} className="btn-primary">
            {t('common.backHome')}
          </button>
          <button type="button" onClick={onBackPrevious} className="btn-outline">
            {t('common.backPrevious')}
          </button>
        </div>
      </motion.section>
    </main>
  )
}
