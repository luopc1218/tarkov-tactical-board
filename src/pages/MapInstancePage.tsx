import { useTranslation } from 'react-i18next'
import type { MapInstance } from '../types/map-instance'

interface MapInstancePageProps {
  instance: MapInstance | null
  onBackHome: () => void
}

export function MapInstancePage({ instance, onBackHome }: MapInstancePageProps) {
  const { t } = useTranslation()

  if (!instance) {
    return (
      <main className="app-page grid place-items-center px-4 py-8">
        <section className="panel w-full max-w-xl p-6 md:p-8">
          <h1 className="text-3xl font-extrabold text-white">{t('mapInstance.notFoundTitle')}</h1>
          <p className="mt-3 text-emerald-50/75">{t('mapInstance.notFoundDesc')}</p>
          <button type="button" onClick={onBackHome} className="btn-primary mt-5">
            {t('common.backHome')}
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="app-page grid place-items-center px-4 py-8">
      <section className="panel w-full max-w-xl p-6 md:p-8">
        <h1 className="text-3xl font-extrabold text-white">{t('mapInstance.title')}</h1>
        <div className="mt-4 space-y-2 text-emerald-50/80">
          <p>
            <span className="font-semibold">{t('mapInstance.instanceId')}:</span> {instance.id}
          </p>
          <p>
            <span className="font-semibold">{t('mapInstance.mapId')}:</span> {instance.mapId}
          </p>
        </div>
        <button type="button" onClick={onBackHome} className="btn-outline mt-6">
          {t('common.backHome')}
        </button>
      </section>
    </main>
  )
}
