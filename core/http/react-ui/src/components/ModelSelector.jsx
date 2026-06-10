import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useModels } from '../hooks/useModels'
import SearchableSelect from './SearchableSelect'

export default function ModelSelector({
  value, onChange, capability, className = '',
  options: externalOptions, loading: externalLoading,
  disabled: externalDisabled, searchPlaceholder, style,
}) {
  const hasExternalOptions = Array.isArray(externalOptions)
  // Skip capability fetch when external options are provided (capability will be undefined)
  const { models: hookModels, loading: hookLoading } = useModels(hasExternalOptions ? undefined : capability)

  const modelNames = useMemo(
    () => hasExternalOptions ? externalOptions : hookModels.map(m => m.id),
    [externalOptions, hasExternalOptions, hookModels]
  )
  const isLoading = hasExternalOptions ? (externalLoading || false) : hookLoading
  const isDisabled = isLoading || modelNames.length === 0 || (externalDisabled || false)
  const showInstallPrompt = !hasExternalOptions && !isLoading && modelNames.length === 0

  useEffect(() => {
    if (modelNames.length > 0 && (!value || !modelNames.includes(value))) {
      onChange(modelNames[0])
    }
  }, [modelNames, value, onChange])

  return (
    <div className="model-selector-control">
      <SearchableSelect
        value={value || ''}
        onChange={onChange}
        options={modelNames}
        placeholder={isLoading ? 'Loading models...' : (modelNames.length === 0 ? 'No models available' : 'Select model...')}
        searchPlaceholder={searchPlaceholder || 'Search models...'}
        disabled={isDisabled}
        className={className}
        style={style}
      />
      {showInstallPrompt && (
        <div className="model-selector-empty" role="status">
          <span className="model-selector-empty__message">
            <i className="fas fa-circle-info" aria-hidden="true" />
            <span>No compatible models are installed. Add one from the Models page.</span>
          </span>
          <Link to="/app/models" className="btn btn-secondary btn-sm model-selector-empty__action">
            <i className="fas fa-store" aria-hidden="true" />
            Browse Models
          </Link>
        </div>
      )}
    </div>
  )
}
