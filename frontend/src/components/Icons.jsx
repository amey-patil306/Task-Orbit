// Small inline icon set (24x24 stroke icons), so no icon library is needed.
const paths = {
  home: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  workload: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  planner: 'M12 6v6l4 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  alerts: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4',
  settings: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  check: 'M5 12.5 10 17l9-10',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  x: 'M6 6l12 12M18 6 6 18',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5',
  classes: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  inbox: 'M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6l2-8Z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  back: 'M15 18l-6-6 6-6',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
}

export default function Icon({ name, className = 'h-5 w-5', ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
      <path d={paths[name]} />
    </svg>
  )
}
