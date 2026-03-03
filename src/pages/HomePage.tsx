import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { FiArrowRight, FiCrosshair, FiHash, FiMap, FiRefreshCw } from 'react-icons/fi'
import homeHeroBg from '../assets/images/home_hero_bg.png'
import { resolveImagePath } from '../api/files'
import { fetchMapPresets, refreshMapPresets } from '../api/maps'
import type { TarkovMapPreset } from '../constants/maps'
import { getRecentInstances, type RecentInstanceRecord } from '../features/recent-instances'

const CUSTOM_MAP_BANNER_URL = resolveImagePath('images/home_hero_bg.png')

interface HomePageProps {
  onCreateInstance: (payload: { mapId: number; mapName: string }) => Promise<void>
  onJoinInstance: (instanceId: string) => Promise<void>
}

export function HomePage({ onCreateInstance, onJoinInstance }: HomePageProps) {
  const { t, i18n } = useTranslation()
  const [mapPresets, setMapPresets] = useState<TarkovMapPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [joinErrorMessage, setJoinErrorMessage] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [creatingMapId, setCreatingMapId] = useState<string | null>(null)
  const [instanceIdInput, setInstanceIdInput] = useState('')
  const [recentInstances, setRecentInstances] = useState<RecentInstanceRecord[]>([])

  const loadMapPresets = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true)
      setLoadFailed(false)
      const data = forceRefresh ? await refreshMapPresets() : await fetchMapPresets()
      setMapPresets(data)
    } catch {
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMapPresets()
  }, [loadMapPresets])

  useEffect(() => {
    setRecentInstances(getRecentInstances())
  }, [])

  const renderMapName = (preset: TarkovMapPreset) => {
    const zh = preset.nameZh?.trim()
    const en = preset.nameEn?.trim()
    if (i18n.language.startsWith('zh')) {
      return zh || en || preset.name
    }
    return en || zh || preset.name
  }

  return (
    <main
      className="app-page px-4 py-9 md:py-12"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(10,12,12,0.4) 0%, rgba(10,12,12,0.66) 54%, rgba(10,12,12,0.86) 100%), url(${homeHeroBg})`,
        backgroundSize: '100% 100%, 100% auto',
        backgroundPosition: 'center, top center',
        backgroundRepeat: 'no-repeat, no-repeat',
        backgroundBlendMode: 'multiply',
      }}
    >
      <section className="mx-auto w-full max-w-6xl">
        <div className="mb-9 space-y-4 md:mb-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-500/80 bg-slate-800/65 px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur">
            <FiCrosshair className="text-amber-300" />
            <span>Tarkov Map Board</span>
          </span>
          <h1 className="ios-large-title max-w-3xl text-slate-50">{t('home.title')}</h1>
          <p className="ios-subtitle max-w-3xl">{t('home.subtitle')}</p>
        </div>

        <div className="ios-card mb-7 p-5 md:p-6">
          <p className="text-lg font-semibold text-slate-100 md:text-base">
            {t('home.joinByInstance')}
          </p>
          <p className="mt-1 text-sm text-slate-300/85">{t('home.instanceIdPlaceholder')}</p>

          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
            <label className="ios-input flex h-14 items-center gap-3 px-4 text-slate-100 md:h-11 md:flex-1 md:px-3">
              <FiHash className="shrink-0 text-slate-400" />
              <input
                value={instanceIdInput}
                onChange={(event) => setInstanceIdInput(event.target.value)}
                placeholder={t('home.instanceIdPlaceholder')}
                className="h-full w-full bg-transparent text-base outline-none placeholder:text-slate-500 md:text-sm"
              />
            </label>

            <button
              type="button"
              className="btn-primary inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition"
              onClick={async () => {
                const nextId = instanceIdInput.trim()
                if (!nextId) {
                  setJoinErrorMessage(t('home.instanceIdRequired'))
                  return
                }
                try {
                  setJoinErrorMessage(null)
                  await onJoinInstance(nextId)
                } catch (error) {
                  console.warn('[HomePage] Join instance failed', error)
                }
              }}
            >
              <FiArrowRight />
              {t('home.enterInstance')}
            </button>
          </div>
          {joinErrorMessage && (
            <p className="mt-3 rounded-xl border border-rose-400/45 bg-rose-950/65 px-4 py-2 text-sm text-rose-200">
              {joinErrorMessage}
            </p>
          )}
          <div className="mt-4 border-t border-slate-700/70 pt-3">
            <p className="text-xs font-medium text-slate-300">{t('home.recentInstancesTitle')}</p>
            {recentInstances.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">{t('home.recentInstancesEmpty')}</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {recentInstances.map((item) => (
                  <div
                    key={item.instanceId}
                    className="flex items-center justify-between gap-3 rounded-md border border-slate-700/70 bg-slate-900/30 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-100">{item.mapName}</p>
                      <p className="truncate text-xs text-slate-400">{item.instanceId}</p>
                    </div>
                    <button
                      type="button"
                      className="btn-outline h-8 shrink-0 rounded-md px-3 text-xs"
                      onClick={async () => {
                        try {
                          setJoinErrorMessage(null)
                          await onJoinInstance(item.instanceId)
                        } catch (error) {
                          console.warn('[HomePage] Join recent instance failed', error)
                        }
                      }}
                    >
                      {t('home.enterInstance')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-slate-300/90">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-amber-300" />
            <span>{t('home.loadingMaps')}</span>
          </div>
        )}

        {!loading && loadFailed && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void loadMapPresets(true)}
              className="btn-outline inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold"
            >
              <FiRefreshCw />
              {t('common.retry')}
            </button>
          </div>
        )}

        {!loading && !loadFailed && mapPresets.length === 0 && (
          <p className="ios-card px-4 py-3 text-slate-200">{t('home.emptyMaps')}</p>
        )}

        {!loading && !loadFailed && mapPresets.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mapPresets.map((preset, index) => {
              const bannerSrc = preset.bannerUrl

              return (
                <motion.article
                  key={preset.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: index * 0.024, ease: [0.22, 1, 0.36, 1] }}
                  className="ios-card cursor-default overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div
                    className="relative h-40 bg-cover bg-center"
                    style={{
                      backgroundImage: bannerSrc
                        ? `linear-gradient(180deg, rgba(15,23,42,0.16) 0%, rgba(15,23,42,0.7) 100%), url(${bannerSrc})`
                        : 'linear-gradient(160deg, rgba(55,65,81,0.78) 0%, rgba(30,41,59,0.88) 100%)',
                    }}
                  >
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-900 to-transparent" />
                  </div>
                  <div className="space-y-4 p-4 pt-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold tracking-[-0.01em] text-slate-100">
                        {renderMapName(preset)}
                      </h2>
                      <FiMap className="text-slate-400" />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setJoinErrorMessage(null)
                          setCreatingMapId(preset.id)
                          await onCreateInstance({
                            mapId: preset.mapId,
                            mapName: renderMapName(preset),
                          })
                        } catch (error) {
                          console.warn('[HomePage] Create instance failed', error)
                        } finally {
                          setCreatingMapId(null)
                        }
                      }}
                      disabled={creatingMapId !== null}
                      className="btn-primary inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
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
              transition={{
                duration: 0.24,
                delay: mapPresets.length * 0.024,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="ios-card overflow-hidden border-dashed border-slate-500/80"
            >
              <div
                className="relative h-40 bg-cover bg-center"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.2) 0%, rgba(15,23,42,0.72) 100%), url(${CUSTOM_MAP_BANNER_URL})`,
                }}
              >
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-900 to-transparent" />
              </div>
              <div className="space-y-4 p-4 pt-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-100">
                    {t('home.customMapTitle')}
                  </h2>
                  <FiMap className="text-slate-400" />
                </div>
                <button
                  type="button"
                  disabled
                  className="btn-outline inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-300"
                >
                  {t('home.comingSoon')}
                </button>
              </div>
            </motion.article>
          </div>
        )}

        <footer className="ios-card mt-10 px-4 py-4 text-xs leading-6 text-slate-400 md:mt-12 md:px-5 md:py-5 md:text-sm">
          <p className="font-semibold text-slate-200">{t('home.copyrightTitle')}</p>
          <p className="mt-1">{t('home.copyrightDesc1')}</p>
          <p className="mt-1">{t('home.copyrightDesc2')}</p>
        </footer>
      </section>
    </main>
  )
}
