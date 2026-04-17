export interface TarkovMapPreset {
  id: number
  nameZh: string
  nameEn: string
  sortOrder: number
  bannerFileName: string
  mapFileName: string
}

export const TARKOV_MAP_PRESETS: TarkovMapPreset[] = [
  { id: 1, nameZh: '海关', nameEn: 'Customs', sortOrder: 1, bannerFileName: 'images/tarkov-maps/banner/Banner_customs.png', mapFileName: 'images/tarkov-maps/Customs.png' },
  { id: 2, nameZh: '工厂', nameEn: 'Factory', sortOrder: 2, bannerFileName: 'images/tarkov-maps/banner/Banner_factory.png', mapFileName: 'images/tarkov-maps/Factory.png' },
  { id: 3, nameZh: '森林', nameEn: 'Woods', sortOrder: 3, bannerFileName: 'images/tarkov-maps/banner/Banner_woods.png', mapFileName: 'images/tarkov-maps/Woods.png' },
  { id: 4, nameZh: '海岸线', nameEn: 'Shoreline', sortOrder: 4, bannerFileName: 'images/tarkov-maps/banner/Banner_shoreline.png', mapFileName: 'images/tarkov-maps/Shoreline.png' },
  { id: 5, nameZh: '立交桥', nameEn: 'Interchange', sortOrder: 5, bannerFileName: 'images/tarkov-maps/banner/Banner_interchange.png', mapFileName: 'images/tarkov-maps/Interchange.png' },
  { id: 6, nameZh: '储备站', nameEn: 'Reserve', sortOrder: 6, bannerFileName: 'images/tarkov-maps/banner/Banner_reserve.png', mapFileName: 'images/tarkov-maps/Reserve.png' },
  { id: 7, nameZh: '实验室', nameEn: 'The Lab', sortOrder: 7, bannerFileName: 'images/tarkov-maps/banner/Banner_theLab.png', mapFileName: 'images/tarkov-maps/Lab.png' },
  { id: 8, nameZh: '灯塔', nameEn: 'Lighthouse', sortOrder: 8, bannerFileName: 'images/tarkov-maps/banner/Banner_lighthouse.png', mapFileName: 'images/tarkov-maps/Lighthouse.png' },
  { id: 9, nameZh: '塔科夫街区', nameEn: 'Streets of Tarkov', sortOrder: 9, bannerFileName: 'images/tarkov-maps/banner/Banner_streets.png', mapFileName: 'images/tarkov-maps/Streets.png' },
  { id: 10, nameZh: '零号地带', nameEn: 'Ground Zero', sortOrder: 10, bannerFileName: 'images/tarkov-maps/banner/Banner_ground_zero.png', mapFileName: 'images/tarkov-maps/Ground Zero.png' },
]
