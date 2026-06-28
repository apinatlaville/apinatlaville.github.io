/**
 * Icon system — inline Lucide SVG (ISC license)
 * Helpers: icon(), iconHtml(), iconLabel(), iconBtn(), renderClasseurIcon()
 */
(function () {
  const P = {
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    'layout-list': '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><path d="M14 4h7"/><path d="M14 9h7"/><path d="M14 15h7"/><path d="M14 20h7"/>',
    'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    dna: '<path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/><path d="M17 6l-2.5-2.5"/><path d="M14 8l-1-1"/><path d="M7 18l2.5 2.5"/><path d="M3.5 14.5l.5.5"/><path d="M20 9l.5.5"/><path d="M6.5 12.5l1 1"/><path d="M16.5 10.5l1 1"/><path d="M10 16l1.5 1.5"/>',
    map: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/>',
    printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
    folders: '<path d="M20 17a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.9a2 2 0 0 1-1.69-.9L13.5 4.9A2 2 0 0 0 11.8 4H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2Z"/><path d="M2 10h20"/>',
    tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    bug: '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
    'flask-conical': '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    'trash-2': '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    'circle-x': '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
    'book-open': '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
    bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    'map-pin': '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    'lightbulb': '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    'bar-chart': '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    'dice-5': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M16 8h.01"/><path d="M8 8h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/><path d="M12 12h.01"/>',
    timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    square: '<rect width="18" height="18" x="3" y="3" rx="2"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    languages: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
    pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    bed: '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
    'mouse-pointer-click': '<path d="m9 9 5 12 1.8-5.2L21 14Z"/><path d="M7 15h.01"/><path d="M11 19h.01"/>',
    'undo-2': '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/>',
    'qr-code': '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
    scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-up': '<path d="m18 15-6-6-6 6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    brain: '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/>',
    'circle-alert': '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
    'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    library: '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
    'clipboard-list': '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    'circle-minus': '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>',
    minus: '<path d="M5 12h14"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'skip-forward': '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 7.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="m2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
    'move-vertical': '<path d="M12 3v18"/><path d="m8 8 4-4 4 4"/><path d="m8 16 4 4 4-4"/>',
    'circle-dot': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    'graduation-cap': '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    'cloud-off': '<path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/>',
    'cloud-check': '<path d="m17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="m9 15 2 2 4-4"/>'
  };

  function appLogoSvg(size) {
    const svg = window.icon('graduation-cap', size);
    return svg.replace(
      '<svg ',
      '<svg stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
    );
  }

  window.appLogoMark = function () {
    return '<div class="app-logo-mark app-logo-mark--svg" aria-hidden="true">' + appLogoSvg(34) + '</div>';
  };

  window.hydrateAppLogos = function () {
    document.querySelectorAll('[data-app-logo]').forEach(function (el) {
      const isSidebar = el.classList.contains('sidebar-logo-mark');
      const isHdr = el.classList.contains('hdr-logo-mark');
      const size = isSidebar ? 15 : (isHdr ? 18 : 32);
      el.innerHTML = appLogoSvg(size);
      el.classList.add('app-logo-mark', 'app-logo-mark--svg');
    });
  };

  const EMOJI_MAP = {
    '📘': 'book', '📗': 'book', '📕': 'book', '📙': 'book', '📁': 'folder',
    '🏠': 'home', '📋': 'clipboard-list', '📈': 'trending-up', '⚡': 'zap',
    '🧬': 'dna', '🗺': 'map', '🖨': 'printer', '🗂': 'folders', '🏷': 'tag',
    '🐛': 'bug', '🧪': 'flask-conical', '✏️': 'pencil', '🗑': 'trash-2', '🗑️': 'trash-2',
    '▶': 'play', '🔄': 'refresh-cw', '✕': 'x', '📅': 'calendar', '✅': 'check',
    '❌': 'circle-x', '🔥': 'flame', '⭐': 'star', '🌙': 'moon', '⏳': 'hourglass',
    '🗣️': 'mic', '📑': 'bookmark', '🔍': 'search', '📍': 'map-pin', '💡': 'lightbulb',
    '📊': 'bar-chart', '🎯': 'target', '⚠️': 'alert-triangle', '⚠': 'alert-triangle',
    '🎉': 'sparkles', '📷': 'camera', '🎲': 'dice-5', '⏱️': 'timer', '⏱': 'timer',
    '⏸': 'pause', '⏹': 'square', '⬇': 'download', '＋': 'plus', '📚': 'book-open',
    '🎛': 'sliders', '📝': 'file-text', '🇬🇧': 'languages', '📌': 'pin', '🛌': 'bed',
    '👆': 'mouse-pointer-click', '↩️': 'undo-2', '🔳': 'qr-code', '⚖️': 'scale',
    '🛡️': 'shield', '⚙️': 'settings', '▼': 'chevron-down', '🧠': 'brain',
    '🌸': 'sparkles', '➔': 'arrow-right'
  };

  const CLASSEUR_KEYS = {
    'book-blue': 'book', 'book-green': 'book', 'book-red': 'book', 'book-orange': 'book',
    folder: 'folder', book: 'book', library: 'library', languages: 'languages'
  };

  const CLASSEUR_COLORS = {
    'book-blue': 'cl-icon-book-blue', 'book-green': 'cl-icon-book-green',
    'book-red': 'cl-icon-book-red', 'book-orange': 'cl-icon-book-orange', folder: 'cl-icon-folder'
  };

  function resolveName(name) {
    if (!name) return 'circle-dot';
    if (P[name]) return name;
    if (EMOJI_MAP[name]) return EMOJI_MAP[name];
    return 'circle-dot';
  }

  window.icon = function (name, size) {
    const key = resolveName(name);
    const s = size || 16;
    const inner = P[key] || P['circle-dot'];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  };

  window.iconHtml = function (name, size, className) {
    const cls = ['icon'];
    if (className) cls.push(className);
    else if ((size || 16) <= 14) cls.push('icon-sm');
    else if ((size || 16) >= 20) cls.push('icon-md');
    else cls.push('icon-sm');
    return `<span class="${cls.join(' ')}">${window.icon(name, size || 16)}</span>`;
  };

  window.iconLabel = function (name, label, className) {
    return `<span class="icon-inline-label${className ? ' ' + className : ''}">${window.iconHtml(name, 16, 'icon-sm')}${label}</span>`;
  };

  window.iconBtn = function (name, label, extraAttrs) {
    const attrs = extraAttrs || '';
    return `<button class="cbt icon-only-btn" aria-label="${label}" title="${label}" ${attrs}>${window.iconHtml(name, 16, 'icon-sm')}</button>`;
  };

  window.statusDot = function (color, large) {
    return `<span class="status-dot status-${color}${large ? ' status-dot-lg' : ''}" aria-hidden="true"></span>`;
  };

  window.statusLabel = function (color, text) {
    return `<span class="status-label">${window.statusDot(color)}${text}</span>`;
  };

  window.renderClasseurIcon = function (key, size) {
    const resolved = EMOJI_MAP[key] ? resolveName(key) : (CLASSEUR_KEYS[key] || 'folder');
    const colorCls = CLASSEUR_COLORS[key] || '';
    return window.iconHtml(resolved, size || 18, colorCls ? 'icon-md ' + colorCls : 'icon-md');
  };

  window.docTypeLabel = function (type) {
    const map = { COURS: 'cours', TD: 'td', DS: 'ds', KHOLLE: 'kholle', FICHE: 'fiche' };
    const labels = { COURS: 'Cours', TD: 'TD', DS: 'DS', KHOLLE: 'Khôlle', FICHE: 'Fiche' };
    const cls = map[type] || 'cours';
    return `<span class="badge-type-${cls}"><span class="badge-type-dot"></span>${labels[type] || type}</span>`;
  };

  /* dismissSplash → core-utils.js (ne pas redéfinir ici) */

  window.enterApp = function () {
    document.documentElement.style.removeProperty('overflow');
    document.documentElement.style.removeProperty('height');
    document.documentElement.style.removeProperty('max-height');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('height');
    document.body.style.removeProperty('max-height');
  };

  window.importanceHint = function (n) {
    const hints = {
      1: "Peu vital — révisions espacées",
      2: "Secondaire",
      3: "Standard prépa",
      4: "Important — revues plus serrées",
      5: "Fondamental concours — prioritaire"
    };
    return hints[n] || hints[3];
  };

  window.importanceLabel = function (importance) {
    const n = (window.AnkiAlgo && window.AnkiAlgo.getImportance)
      ? window.AnkiAlgo.getImportance(typeof importance === "object" ? importance : { importance: importance })
      : (importance || 3);
    let html = "";
    for (let i = 1; i <= 5; i++) {
      html += `<span class="anki-star ${i <= n ? "on" : "off"}">${i <= n ? "\u2605" : "\u2606"}</span>`;
    }
    return `<span class="anki-stars-display" title="${n}/5 — ${window.importanceHint(n)}">${html}</span>`;
  };

  window.starPickerHtml = function (id, value) {
    const v = Math.max(1, Math.min(5, value || 3));
    let stars = "";
    for (let i = 1; i <= 5; i++) {
      stars += `<button type="button" class="anki-star-btn${i <= v ? " on" : ""}" data-star="${i}" aria-label="${i} étoile${i > 1 ? "s" : ""}" onclick="window.setStarPicker('${id}', ${i})">${i <= v ? "\u2605" : "\u2606"}</button>`;
    }
    return `<div class="anki-star-picker" id="${id}" data-value="${v}"><input type="hidden" id="${id}Val" value="${v}">${stars}</div><p class="anki-star-hint anki-mut" id="${id}Hint">${window.importanceHint(v)}</p>`;
  };

  window.setStarPicker = function (id, n) {
    const root = document.getElementById(id);
    if (!root) return;
    const val = Math.max(1, Math.min(5, n));
    root.dataset.value = val;
    const hidden = document.getElementById(id + "Val");
    if (hidden) hidden.value = val;
    root.querySelectorAll(".anki-star-btn").forEach(function (btn) {
      const star = parseInt(btn.getAttribute("data-star"), 10);
      const on = star <= val;
      btn.classList.toggle("on", on);
      btn.textContent = on ? "\u2605" : "\u2606";
    });
    const hint = document.getElementById(id + "Hint");
    if (hint) hint.textContent = window.importanceHint(val);
  };

  window.getStarPickerValue = function (id) {
    const hidden = document.getElementById(id + "Val");
    if (hidden) return parseInt(hidden.value, 10) || 3;
    const root = document.getElementById(id);
    return root ? parseInt(root.dataset.value, 10) || 3 : 3;
  };

  window.priLabel = function (p) {
    return window.importanceLabel(p);
  };

  window.hydrateIcons = function (root) {
    const scope = root || document;
    scope.querySelectorAll('[data-icon]').forEach(function (el) {
      const name = el.getAttribute('data-icon');
      const size = parseInt(el.getAttribute('data-icon-size') || '14', 10);
      const cls = el.getAttribute('data-icon-class') || 'icon-sm';
      el.innerHTML = window.icon(name, size);
      el.classList.add('icon', cls);
      el.setAttribute('aria-hidden', 'true');
    });
    if (typeof window.hydrateAppLogos === 'function') window.hydrateAppLogos(scope);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.hydrateIcons(); });
  } else {
    window.hydrateIcons();
  }
})();
