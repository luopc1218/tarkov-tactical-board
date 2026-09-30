export interface TarkovMapPreset {
  id: number
  slug: string
  nameZh: string
  nameEn: string
  sortOrder: number
  coverFileName: string
  bannerFileName: string
  mapFileName: string
}

const createMapPreset = (
  id: number,
  slug: string,
  nameZh: string,
  nameEn: string,
  coverSlug = slug,
): TarkovMapPreset => ({
  id,
  slug,
  nameZh,
  nameEn,
  sortOrder: id,
  coverFileName: `covers/${coverSlug}.webp`,
  bannerFileName: `${slug}-thumb.webp`,
  mapFileName: `${slug}.webp`,
})

export const TARKOV_MAP_PRESETS: TarkovMapPreset[] = [
  createMapPreset(1, 'ground-zero', '中心区', 'Ground Zero'),
  createMapPreset(2, 'factory', '工厂', 'Factory'),
  createMapPreset(3, 'customs', '海关', 'Customs'),
  createMapPreset(4, 'customs-dorms', '海关宿舍楼', 'Customs Dorms', 'customs'),
  createMapPreset(5, 'woods', '森林', 'Woods'),
  createMapPreset(7, 'woods-train-depot', '森林火车站', 'Woods Train Depot', 'woods'),
  createMapPreset(8, 'shoreline', '海岸线', 'Shoreline'),
  createMapPreset(9, 'shoreline-resort', '海岸线疗养院', 'Shoreline Resort', 'shoreline'),
  createMapPreset(10, 'interchange', '立交桥', 'Interchange'),
  createMapPreset(12, 'reserve', '储备站', 'Reserve'),
  createMapPreset(15, 'lighthouse-vertical', '灯塔（垂直）', 'Lighthouse (Vertical)', 'lighthouse'),
  createMapPreset(17, 'streets-of-tarkov', '塔科夫街区', 'Streets of Tarkov'),
  createMapPreset(20, 'labyrinth', '迷宫', 'The Labyrinth'),
  createMapPreset(21, 'terminal', '码头', 'Terminal'),
  createMapPreset(23, 'icebreaker', '破冰船', 'Icebreaker'),
]

export const findMapPreset = (mapId: number | null | undefined) =>
  mapId == null ? null : TARKOV_MAP_PRESETS.find((item) => item.id === mapId) ?? null

export const getMapAssetUrl = (fileName: string) =>
  `${import.meta.env.BASE_URL}maps/${fileName}`
