interface IconProps {
  className?: string;
}

function base(className?: string) {
  return {
    className: className ?? 'h-4 w-4',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

export const IconSearch = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const IconUpload = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 16V4" />
    <path d="m7 9 5-5 5 5" />
    <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
  </svg>
);

export const IconDownload = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 4v12" />
    <path d="m7 11 5 5 5-5" />
    <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
  </svg>
);

export const IconGrid = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </svg>
);

export const IconList = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const IconClose = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const IconFilter = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M3 5h18l-7 8v6l-4 2v-8Z" />
  </svg>
);

export const IconChevron = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const IconBooks = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H9v16H5.5A1.5 1.5 0 0 1 4 18.5Z" />
    <path d="M9 4h4.5A1.5 1.5 0 0 1 15 5.5v13a1.5 1.5 0 0 1-1.5 1.5H9Z" />
    <path d="m16.5 6.4 2.6-.7a1 1 0 0 1 1.2.7l2.4 9a1 1 0 0 1-.7 1.2l-2.6.7" />
  </svg>
);

export const IconSpinner = ({ className }: IconProps) => (
  <svg {...base(className)} className={`${className ?? 'h-4 w-4'} animate-spin`}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);

export const IconPlus = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconPencil = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="m14.5 6.5 3 3" />
  </svg>
);

export const IconSliders = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 6h10" />
    <path d="M18 6h2" />
    <circle cx="16" cy="6" r="2" />
    <path d="M4 12h4" />
    <path d="M12 12h8" />
    <circle cx="10" cy="12" r="2" />
    <path d="M4 18h10" />
    <path d="M18 18h2" />
    <circle cx="16" cy="18" r="2" />
  </svg>
);

export const IconSort = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 7h11" />
    <path d="M4 12h7" />
    <path d="M4 17h4" />
    <path d="M17 5v14" />
    <path d="m14 16 3 3 3-3" />
  </svg>
);

export const IconArrowUp = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 19V5" />
    <path d="m6 11 6-6 6 6" />
  </svg>
);

export const IconArrowDown = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 5v14" />
    <path d="m6 13 6 6 6-6" />
  </svg>
);

export const IconPanelCollapse = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M10 4v16" />
    <path d="m16.5 10-2 2 2 2" />
  </svg>
);
