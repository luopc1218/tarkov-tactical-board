export interface TarkovMapPreset {
  id: number
  slug: string
  nameZh: string
  nameEn: string
  sortOrder: number
  bannerFileName: string
  mapFileName: string
}

const createMapPreset = (
  id: number,
  slug: string,
  nameZh: string,
  nameEn: string,
): TarkovMapPreset => ({
  id,
  slug,
  nameZh,
  nameEn,
  sortOrder: id,
  bannerFileName: `${slug}-thumb.webp`,
  mapFileName: `${slug}.webp`,
})

export const TARKOV_MAP_PRESETS: TarkovMapPreset[] = [
  createMapPreset(1, 'ground-zero', '中心区', 'Ground Zero'),
  createMapPreset(2, 'factory', '工厂', 'Factory'),
  createMapPreset(3, 'customs', '海关', 'Customs'),
  createMapPreset(4, 'customs-dorms', '海关宿舍楼', 'Customs Dorms'),
  createMapPreset(5, 'woods', '森林', 'Woods'),
  createMapPreset(6, 'woods-clean', '森林（无标记）', 'Woods (No Markers)'),
  createMapPreset(7, 'woods-train-depot', '森林火车站', 'Woods Train Depot'),
  createMapPreset(8, 'shoreline', '海岸线', 'Shoreline'),
  createMapPreset(9, 'shoreline-resort', '海岸线疗养院', 'Shoreline Resort'),
  createMapPreset(10, 'interchange', '立交桥', 'Interchange'),
  createMapPreset(11, 'interchange-mall-interior', '立交桥商场内部', 'Interchange Mall Interior'),
  createMapPreset(12, 'reserve', '储备站', 'Reserve'),
  createMapPreset(13, 'reserve-tunnels-2d', '储备站地下通道（2D）', 'Reserve Tunnels (2D)'),
  createMapPreset(14, 'reserve-tunnels-3d', '储备站地下通道（3D）', 'Reserve Tunnels (3D)'),
  createMapPreset(15, 'lighthouse-vertical', '灯塔（垂直）', 'Lighthouse (Vertical)'),
  createMapPreset(16, 'lighthouse-isometric', '灯塔（等轴）', 'Lighthouse (Isometric)'),
  createMapPreset(17, 'streets-of-tarkov', '塔科夫街区', 'Streets of Tarkov'),
  createMapPreset(18, 'streets-lexos-minefield', '街区 LexOs 雷区', 'Streets LexOs Minefield'),
  createMapPreset(19, 'streets-cache-map', '街区物资点地图', 'Streets Cache Map'),
  createMapPreset(20, 'labyrinth', '迷宫', 'The Labyrinth'),
  createMapPreset(21, 'terminal', '码头', 'Terminal'),
  createMapPreset(22, 'transit', '地图转移点', 'Transit'),
  createMapPreset(23, 'icebreaker', '破冰船', 'Icebreaker'),
]

export const findMapPreset = (mapId: number | null | undefined) =>
  mapId == null ? null : TARKOV_MAP_PRESETS.find((item) => item.id === mapId) ?? null

export const getMapAssetUrl = (fileName: string) =>
  `${import.meta.env.BASE_URL}maps/${fileName}`
