import { createContext, useContext } from 'react'
import type { T } from './i18n'

export const LangContext = createContext<T>(null as unknown as T)
export const useLang = () => useContext(LangContext)
