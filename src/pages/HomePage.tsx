import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { FiArrowRight, FiCrosshair, FiHash, FiMap } from 'react-icons/fi'
import homeHeroBg from '../assets/images/home_hero_bg.png'
import { buildFileDownloadUrl } from '../api/files'
import { fetchMapPresets, refreshMapPresets } from '../api/maps'
import type { TarkovMapPreset } from '../constants/maps'

const CUSTOM_MAP_BANNER_URL =
  buildFileDownloadUrl('maps/banners/custom-map.png')

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
    <main
      className="app-page px-4 py-8 md:py-12"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(7,18,14,0.55) 0%, rgba(7,18,14,0.85) 42%, rgba(7,18,14,0.95) 100%), url(${homeHeroBg})`,
        backgroundSize: '100% auto',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'top center',
      }}
    >
      <section className="mx-auto w-full max-w-6xl">
        <div className="mb-8 space-y-4 md:mb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/45 bg-emerald-900/35 px-3 py-1 text-sm text-emerald-100">
            <FiCrosshair />
            <span>TARKOV TACTICAL BOARD</span>
          </span>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight text-white md:text-6xl">
            {t('home.title')}
          </h1>
          <p className="max-w-3xl text-emerald-50/85">{t('home.subtitle')}</p>
        </div>

        <div className="mb-6 rounded-2xl border border-emerald-300/35 bg-[linear-gradient(140deg,rgba(7,20,15,0.9)_0%,rgba(15,40,30,0.76)_100%)] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.24)] md:p-5">
          <p className="text-lg font-semibold text-emerald-50 md:text-base">{t('home.joinByInstance')}</p>
          <p className="mt-1 text-sm text-emerald-100/70">{t('home.instanceIdPlaceholder')}</p>

          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
            <label className="flex h-14 items-center gap-3 rounded-2xl border border-emerald-200/25 bg-black/25 px-4 text-emerald-50 focus-within:border-emerald-200/60 md:h-11 md:flex-1 md:rounded-xl md:px-3">
              <FiHash className="shrink-0 text-emerald-200/85" />
              <input
                value={instanceIdInput}
                onChange={(event) => setInstanceIdInput(event.target.value)}
                placeholder={t('home.instanceIdPlaceholder')}
                className="h-full w-full bg-transparent text-base outline-none placeholder:text-emerald-100/45 md:text-sm"
              />
            </label>

            <button
              type="button"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-cyan-200/35 bg-[linear-gradient(135deg,#2f7b56_0%,#1f9d79_55%,#13b6a1_100%)] px-5 text-base font-bold text-white shadow-[0_12px_26px_rgba(20,184,166,0.3)] transition hover:brightness-110 active:brightness-100 md:h-11 md:rounded-xl md:px-4 md:text-sm"
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
              <FiArrowRight />
              {t('home.enterInstance')}
            </button>
          </div>
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
                  className="overflow-hidden rounded-2xl border border-white/12 bg-[rgba(9,16,13,0.82)] shadow-[0_12px_36px_rgba(0,0,0,0.28)] cursor-default"
                >
                  <div
                    className="relative h-40 bg-cover bg-center"
                    style={{
                      backgroundImage: bannerSrc
                        ? `linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(8,12,10,0.72) 100%), url(${bannerSrc})`
                        : 'linear-gradient(160deg, rgba(51,84,65,0.7) 0%, rgba(20,30,24,0.85) 100%)',
                    }}
                  >
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[rgba(9,16,13,0.88)] to-transparent" />
                  </div>
                  <div className="space-y-4 p-4 pt-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-white">
                        {t(`maps.${preset.id}`, { defaultValue: preset.name })}
                      </h2>
                      <FiMap className="text-emerald-300" />
                    </div>
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
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-100/35 bg-[linear-gradient(135deg,#52b788_0%,#34d399_100%)] px-3 py-2 text-sm font-semibold text-emerald-950 shadow-[0_10px_24px_rgba(16,185,129,0.32)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {creatingMapId === preset.id ? t('common.loading') : t('home.createInstance')}
                      <FiArrowRight />
                    </button>
                  </div>
                </motion.article>
              )
            })}
            <motion.article
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: mapPresets.length * 0.03 }}
              className="overflow-hidden rounded-2xl border border-dashed border-white/20 bg-[rgba(9,16,13,0.72)] shadow-[0_12px_36px_rgba(0,0,0,0.24)]"
            >
              <div
                className="relative h-40 bg-cover bg-center"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(8,12,10,0.75) 100%), url(${CUSTOM_MAP_BANNER_URL})`,
                }}
              >
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[rgba(9,16,13,0.88)] to-transparent" />
              </div>
              <div className="space-y-4 p-4 pt-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">{t('home.customMapTitle')}</h2>
                  <FiMap className="text-emerald-300/70" />
                </div>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-100/25 bg-emerald-100/10 px-3 py-2 text-sm font-semibold text-emerald-100/75"
                >
                  {t('home.comingSoon')}
                </button>
              </div>
            </motion.article>
          </div>
        )}

        <footer className="mt-10 rounded-2xl border border-emerald-300/20 bg-black/25 px-4 py-4 text-xs leading-6 text-emerald-100/75 md:mt-12 md:px-5 md:py-5 md:text-sm">
          <p className="font-semibold text-emerald-100">{t('home.copyrightTitle')}</p>
          <p className="mt-1">{t('home.copyrightDesc1')}</p>
          <p className="mt-1">{t('home.copyrightDesc2')}</p>
        </footer>
      </section>
    </main>
  )
}
