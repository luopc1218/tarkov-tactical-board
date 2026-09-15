import type { RefObject } from 'react'
import type {
  ExtractionIntelItem,
  MapIntelResponse,
} from '../../api/whiteboard'
import type { TarkovMapPreset } from '../../constants/maps'
import type { MapInstance } from '../../types/map-instance'

// Shared whiteboard view-model contracts used across the instance page, controls, and rendering layer.
export interface Point {
  x: number
  y: number
}

export interface Stroke {
  id: string
  points: Point[]
  color: string
  width: number
}

export type ToolMode = 'draw' | 'erase'

export interface Viewport {
  x: number
  y: number
  scale: number
}

export interface LocalPoint {
  x: number
  y: number
}

export interface RemoteCursor {
  clientId: string
  x: number
  y: number
  label: string
  color: string
  updatedAt: number
}

export interface MapInstanceControlsProps {
  instanceId: string
  mapId: number | null
  mapLabel: string
  wsConnected: boolean
  zoomPercent: number
  copied: boolean
  mapPresets: TarkovMapPreset[]
  selectedMapId: number | null
  switchingMap: boolean
  toolMode: ToolMode
  brushColor: string
  brushWidth: number
  cursorScale: number
  canUndo: boolean
  onCopyId: () => Promise<void> | void
  onSelectedMapIdChange: (mapId: number | null) => void
  onSwitchMap: () => void
  onToolModeChange: (mode: ToolMode) => void
  onBrushColorChange: (value: string) => void
  onBrushWidthChange: (value: number) => void
  onCursorScaleChange: (value: number) => void
  onResetView: () => void
  onClearBoard: () => void
  onUndo: () => void
  onBackHome: () => void
}

export interface MapCanvasProps {
  containerRef: RefObject<HTMLDivElement | null>
  contentSize: { width: number; height: number }
  viewport: Viewport
  toolMode: ToolMode
  mapUrl?: string
  mapAlt: string
  renderedStrokes: React.ReactNode
  renderedRemoteInProgressStrokes: React.ReactNode
  renderedRemoteCursors: React.ReactNode
  onPointerDown: React.PointerEventHandler<HTMLDivElement>
  onPointerMove: React.PointerEventHandler<HTMLDivElement>
  onPointerUp: React.PointerEventHandler<HTMLDivElement>
  onPointerLeave: React.PointerEventHandler<HTMLDivElement>
  onImageLoad: (event: React.SyntheticEvent<HTMLImageElement>) => void
  emptyLabel: string
}

export interface MapIntelPanelProps {
  mapIntel: MapIntelResponse | null
  mapIntelLoading: boolean
  mapIntelLoadError: string | null
  bossIntelOpen: boolean
  extractionsOpen: boolean
  setBossIntelOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  setExtractionsOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  renderIntelBool: (value: boolean | null) => string
  isGuaranteedSpawnChance: (value: string) => boolean
  getIntelTagColor: (index: number) => 'info' | 'warning' | 'success' | 'secondary'
  renderExtractionCard: (item: ExtractionIntelItem) => React.ReactNode
  onClose?: () => void
}

export interface MapInstanceController {
  instance: MapInstance | null
  loading: boolean
  mapPresets: TarkovMapPreset[]
  switchingMap: boolean
  selectedMapId: number | null
  mapUrl?: string
  toolMode: ToolMode
  viewport: Viewport
  wsConnected: boolean
  contentSize: { width: number; height: number }
  brushColor: string
  brushWidth: number
  cursorScale: number
  copied: boolean
  mapIntel: MapIntelResponse | null
  mapIntelLoading: boolean
  mapIntelLoadError: string | null
  bossIntelOpen: boolean
  extractionsOpen: boolean
  containerRef: RefObject<HTMLDivElement | null>
  renderedStrokes: React.ReactNode
  renderedRemoteInProgressStrokes: React.ReactNode
  renderedRemoteCursors: React.ReactNode
  currentMapId: number | null
  currentInstanceId: string
  resolvedMapLabel: string
  canUndo: boolean
  setSelectedMapId: (value: number | null) => void
  setToolMode: (value: ToolMode) => void
  setBrushColor: (value: string) => void
  setBrushWidth: (value: number) => void
  setCursorScale: (value: number) => void
  setBossIntelOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  setExtractionsOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  loadMapIntel: () => Promise<void>
  handleSwitchMap: () => void
  fitViewportToContent: (width: number, height: number) => void
  clearBoard: () => void
  undoLastStroke: () => void
  copyInstanceId: () => Promise<void>
  onPointerDown: React.PointerEventHandler<HTMLDivElement>
  onPointerMove: React.PointerEventHandler<HTMLDivElement>
  onPointerUp: React.PointerEventHandler<HTMLDivElement>
  onPointerLeave: React.PointerEventHandler<HTMLDivElement>
  handleImageLoad: (event: React.SyntheticEvent<HTMLImageElement>) => void
  renderIntelBool: (value: boolean | null) => string
  isGuaranteedSpawnChance: (value: string) => boolean
  getIntelTagColor: (index: number) => 'info' | 'warning' | 'success' | 'secondary'
  renderExtractionCard: (item: ExtractionIntelItem) => React.ReactNode
}
