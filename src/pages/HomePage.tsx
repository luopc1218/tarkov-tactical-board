import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { FiCrosshair, FiMap } from 'react-icons/fi'
import { fetchMapPresets, refreshMapPresets } from '../api/maps'
import type { TarkovMapPreset } from '../constants/maps'

interface HomePageProps {
  onCreateInstance: (mapId: string) => void
}

const bannerModules = import.meta.glob('../assets/images/Banner_*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const normalizeId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '_')

const bannerAliasByMapId: Record<string, string> = {
  labs: 'theLab',
  'ground-zero': 'ground_zero',
}

const bannerByMapId = Object.entries(bannerModules).reduce<Record<string, string>>((acc, [path, src]) => {
  const filename = path.split('/').pop() ?? ''
  const rawId = filename.replace(/^Banner_/i, '').replace(/\.png$/i, '')
  acc[normalizeId(rawId)] = src
  return acc
}, {})

const getMapBanner = (mapId: string) => {
  const mappedId = bannerAliasByMapId[mapId] ?? mapId
  return bannerByMapId[normalizeId(mappedId)] ?? null
}

export function HomePage({ onCreateInstance }: HomePageProps) {
  const { t } = useTranslation()
  const [mapPresets, setMapPresets] = useState<TarkovMapPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadMapPresets = useCallback(
    async (forceRefresh = false) => {
      try {
        setLoading(true)
        setErrorMessage(null)
        const data = forceRefresh ? await refreshMapPresets() : await fetchMapPresets()
        setMapPresets(data)
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : t('home.loadError'))
      } finally {
        setLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void loadMapPresets()
  }, [loadMapPresets])

  return (
    <main className="app-page px-4 py-8 md:py-12">
      <section className="mx-auto w-full max-w-6xl">
        <div className="mb-8 space-y-4 md:mb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/45 bg-emerald-900/35 px-3 py-1 text-sm text-emerald-100">
            <FiCrosshair />
            <span>TARKOV TACTICAL BOARD</span>
          </span>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight text-white md:text-6xl">
            {t('home.title')}
          </h1>
          <p className="max-w-3xl text-emerald-50/80">{t('home.subtitle')}</p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-emerald-50/80">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-100/30 border-t-emerald-200" />
            <span>{t('home.loadingMaps')}</span>
          </div>
        )}

        {!loading && errorMessage && (
          <div className="space-y-3">
            <p className="rounded-xl border border-rose-300/35 bg-rose-950/40 px-4 py-3 text-rose-200">{errorMessage}</p>
            <button type="button" onClick={() => void loadMapPresets(true)} className="btn-outline">
              {t('common.retry')}
            </button>
          </div>
        )}

        {!loading && !errorMessage && mapPresets.length === 0 && (
          <p className="rounded-xl border border-emerald-300/30 bg-emerald-950/35 px-4 py-3 text-emerald-100">
            {t('home.emptyMaps')}
          </p>
        )}

        {!loading && !errorMessage && mapPresets.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mapPresets.map((preset, index) => {
              const bannerSrc = getMapBanner(preset.id)

              return (
                <motion.article
                  key={preset.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: index * 0.03 }}
                  whileHover={{ y: -4 }}
                  className="overflow-hidden rounded-2xl border border-emerald-300/30 bg-emerald-950/35 shadow-float"
                >
                  <button
                    type="button"
                    onClick={() => onCreateInstance(preset.id)}
                    className="block w-full text-left"
                  >
                    <div
                      className="h-40 border-b border-emerald-300/25 bg-cover bg-center"
                      style={{
                        backgroundImage: bannerSrc
                          ? `linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(8,12,10,0.72) 100%), url(${bannerSrc})`
                          : 'linear-gradient(160deg, rgba(51,84,65,0.7) 0%, rgba(20,30,24,0.85) 100%)',
                      }}
                    />
                    <div className="space-y-4 p-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white">
                          {t(`maps.${preset.id}`, { defaultValue: preset.name })}
                        </h2>
                        <FiMap className="text-emerald-300" />
                      </div>
                      <span className="btn-outline">{t('home.createInstance')}</span>
                    </div>
                  </button>
                </motion.article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
