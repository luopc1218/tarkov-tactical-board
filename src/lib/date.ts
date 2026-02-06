import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'

import 'dayjs/locale/zh-cn'

dayjs.extend(utc)
dayjs.extend(relativeTime)
dayjs.extend(localizedFormat)
dayjs.locale('zh-cn')

export const formatDateTime = (value: string | number | Date) => dayjs(value).format('YYYY-MM-DD HH:mm:ss')

export const fromNow = (value: string | number | Date) => dayjs(value).fromNow()

export { dayjs }
