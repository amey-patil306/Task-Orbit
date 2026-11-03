import PageHeader from './PageHeader'

/** Placeholder for pages whose backend endpoints are not built yet. */
export default function ComingSoon({ title, subtitle, features, needs }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="card">
        <p className="text-sm font-medium text-slate-700">This screen will show:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          {features.map((f) => <li key={f}>{f}</li>)}
        </ul>
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          Waiting on backend: <code className="font-mono">{needs.join(', ')}</code>
        </p>
      </div>
    </>
  )
}
