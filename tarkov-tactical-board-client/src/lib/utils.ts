import { clsx, type ClassValue } from 'clsx'
import { debounce, throttle } from 'lodash-es'

export const cn = (...inputs: ClassValue[]) => clsx(inputs)

export { debounce, throttle }
