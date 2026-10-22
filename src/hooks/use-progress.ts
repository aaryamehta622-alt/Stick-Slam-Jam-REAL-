import { useSyncExternalStore } from 'react';
import { getProgress,getProgressVersion,getSaveStatus,subscribeProgress } from '@/game/progress';
export function useProgress(){useSyncExternalStore(subscribeProgress,getProgressVersion,getProgressVersion);return getProgress();}
export function useSaveStatus(){useSyncExternalStore(subscribeProgress,getProgressVersion,getProgressVersion);return getSaveStatus();}
