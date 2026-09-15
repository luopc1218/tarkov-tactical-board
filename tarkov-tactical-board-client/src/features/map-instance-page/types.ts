import type { RefObject } from 'react'
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

export interface BoardMarker {
  id: string
  x: number
  y: number
  label: string
  color: string
  fontSize: number
  markerSize: number
}

export interface MarkerSettingsRequest {
  marker: BoardMarker
  clientX: number
  clientY: number
}

export type ToolMode = 'draw' | 'erase' | 'marker'

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
  switchingMap?: boolean
  mapAlt: string
  renderedStrokes: React.ReactNode
  renderedRemoteInProgressStrokes: React.ReactNode
  renderedRemoteCursors: React.ReactNode
  renderedMarkers: React.ReactNode
  onPointerDown: React.PointerEventHandler<HTMLDivElement>
  onPointerMove: React.PointerEventHandler<HTMLDivElement>
  onPointerUp: React.PointerEventHandler<HTMLDivElement>
  onPointerLeave: React.PointerEventHandler<HTMLDivElement>
  onContextMenu: React.MouseEventHandler<HTMLDivElement>
  onImageLoad: (event: React.SyntheticEvent<HTMLImageElement>) => void
  emptyLabel: string
  loadingLabel: string
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
  containerRef: RefObject<HTMLDivElement | null>
  renderedStrokes: React.ReactNode
  renderedRemoteInProgressStrokes: React.ReactNode
  renderedRemoteCursors: React.ReactNode
  renderedMarkers: React.ReactNode
  pendingMarkerPoint: Point | null
  markerSettingsRequest: MarkerSettingsRequest | null
  currentMapId: number | null
  currentInstanceId: string
  resolvedMapLabel: string
  canUndo: boolean
  setSelectedMapId: (value: number | null) => void
  setToolMode: (value: ToolMode) => void
  setBrushColor: (value: string) => void
  setBrushWidth: (value: number) => void
  setCursorScale: (value: number) => void
  handleSwitchMap: () => void
  fitViewportToContent: (width: number, height: number) => void
  zoomIn: () => void
  zoomOut: () => void
  clearBoard: () => void
  undoLastAction: () => void
  copyInstanceId: () => Promise<void>
  addMarker: (options: Pick<BoardMarker, 'label' | 'color' | 'fontSize' | 'markerSize'>) => void
  cancelMarker: () => void
  updateMarker: (marker: Pick<BoardMarker, 'id' | 'label' | 'color' | 'fontSize' | 'markerSize'>) => void
  deleteMarker: (markerId: string) => void
  closeMarkerSettings: () => void
  onContextMenu: React.MouseEventHandler<HTMLDivElement>
  onPointerDown: React.PointerEventHandler<HTMLDivElement>
  onPointerMove: React.PointerEventHandler<HTMLDivElement>
  onPointerUp: React.PointerEventHandler<HTMLDivElement>
  onPointerLeave: React.PointerEventHandler<HTMLDivElement>
  handleImageLoad: (event: React.SyntheticEvent<HTMLImageElement>) => void
}
