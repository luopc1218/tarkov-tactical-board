import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { FiArrowRight, FiCrosshair, FiMap } from 'react-icons/fi'
import { fetchMapPresets, refreshMapPresets } from '../api/maps'
import type { TarkovMapPreset } from '../constants/maps'

interface HomePageProps {
  onCreateInstance: (mapId: number) => Promise<void>
  onJoinInstance: (instanceId: string) => Promise<void>
}

export function HomePage({ onCreateInstance, onJoinInstance }: HomePageProps) {
  const { t } = useTranslation()
  const [mapPresets, setMapPresets] = useState<TarkovMapPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [creatingMapId, setCreatingMapId] = useState<string | null>(null)
  const [instanceIdInput, setInstanceIdInput] = useState('')

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

        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-emerald-300/30 bg-emerald-950/35 p-4 md:flex-row md:items-center">
          <span className="text-sm font-semibold text-emerald-100">{t('home.joinByInstance')}</span>
          <input
            value={instanceIdInput}
            onChange={(event) => setInstanceIdInput(event.target.value)}
            placeholder={t('home.instanceIdPlaceholder')}
            className="h-10 flex-1 rounded-xl border border-emerald-300/35 bg-black/20 px-3 text-sm text-emerald-50 outline-none placeholder:text-emerald-100/45 focus:border-emerald-200/60"
          />
          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              const nextId = instanceIdInput.trim()
              if (!nextId) {
                setErrorMessage(t('home.instanceIdRequired'))
                return
              }
              try {
                setErrorMessage(null)
                await onJoinInstance(nextId)
              } catch (error) {
                setErrorMessage(error instanceof Error ? error.message : t('home.loadError'))
              }
            }}
          >
            {t('home.enterInstance')}
          </button>
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
              const bannerSrc = preset.bannerUrl

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
                    onClick={async () => {
                      try {
                        setErrorMessage(null)
                        setCreatingMapId(preset.id)
                        await onCreateInstance(preset.mapId)
                      } catch (error) {
                        setErrorMessage(error instanceof Error ? error.message : t('home.loadError'))
                      } finally {
                        setCreatingMapId(null)
                      }
                    }}
                    disabled={creatingMapId !== null}
                    className="group block w-full text-left"
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
                      <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-3 py-2 text-sm font-bold text-emerald-950 shadow-[0_8px_20px_rgba(110,231,183,0.28)] transition group-hover:bg-emerald-200">
                        {creatingMapId === preset.id ? t('common.loading') : t('home.createInstance')}
                        <FiArrowRight className="transition group-hover:translate-x-0.5" />
                      </span>
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
