import { useEffect } from 'react'
import { useModuleProgressStore } from '../store/moduleProgressStore'

/** Shared module progress — one network load, reused across Alphabet / Flashcards / Lessons. */
export function useModuleProgress() {
  const progress = useModuleProgressStore((s) => s.progress)
  const loading = useModuleProgressStore((s) => s.loading)
  const ensureLoaded = useModuleProgressStore((s) => s.ensureLoaded)
  const refresh = useModuleProgressStore((s) => s.refresh)
  const markItem = useModuleProgressStore((s) => s.markItem)
  const submitQuiz = useModuleProgressStore((s) => s.submitQuiz)

  useEffect(() => {
    ensureLoaded()
  }, [ensureLoaded])

  return { progress, loading, refresh, markItem, submitQuiz }
}
