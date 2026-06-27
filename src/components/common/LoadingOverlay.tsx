import { useSeismicStore } from '../../store/seismicStore';

export default function LoadingOverlay() {
  const { isLoading, loadProgress, error } = useSeismicStore();

  if (!isLoading && !error) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-2xl p-6 w-[420px] border border-slate-700">
        {error ? (
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-white font-medium mb-2">加载失败</h3>
            <p className="text-slate-400 text-sm mb-4">{error}</p>
            <button
              onClick={() => useSeismicStore.getState().clearError()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors"
            >
              确定
            </button>
          </div>
        ) : loadProgress ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <div>
                <h3 className="text-white font-medium">{loadProgress.currentStage || '处理中...'}</h3>
                <p className="text-slate-400 text-sm">
                  {loadProgress.loaded !== undefined && loadProgress.total !== undefined
                    ? `${Math.round((loadProgress.loaded / loadProgress.total) * 100)}%`
                    : ''}
                </p>
              </div>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300"
                style={{
                  width: loadProgress.total
                    ? `${(loadProgress.loaded / loadProgress.total) * 100}%`
                    : '100%',
                }}
              />
            </div>
            {loadProgress.speed !== undefined && loadProgress.speed > 0 && (
              <div className="flex justify-between mt-2 text-xs text-slate-500">
                <span>{(loadProgress.speed / 1024 / 1024).toFixed(1)} MB/s</span>
                <span>
                  {loadProgress.eta !== undefined && loadProgress.eta > 0
                    ? `剩余 ${Math.ceil(loadProgress.eta)}s`
                    : ''}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-white">加载中...</span>
          </div>
        )}
      </div>
    </div>
  );
}
