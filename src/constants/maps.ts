export interface TarkovMapPreset {
  mapId: number
  id: string
  name: string
  bannerUrl?: string
  mapUrl?: string
}

export const TARKOV_MAP_PRESETS: TarkovMapPreset[] = [
  { mapId: 0, id: 'customs', name: '海关 Customs' },
  { mapId: 0, id: 'interchange', name: '立交桥 Interchange' },
  { mapId: 0, id: 'shoreline', name: '海岸线 Shoreline' },
  { mapId: 0, id: 'woods', name: '森林 Woods' },
  { mapId: 0, id: 'factory', name: '工厂 Factory' },
  { mapId: 0, id: 'reserve', name: '储备站 Reserve' },
  { mapId: 0, id: 'labs', name: '实验室 The Lab' },
  { mapId: 0, id: 'lighthouse', name: '灯塔 Lighthouse' },
  { mapId: 0, id: 'streets', name: '塔科夫街区 Streets of Tarkov' },
  { mapId: 0, id: 'ground-zero', name: '零号地带 Ground Zero' },
]
