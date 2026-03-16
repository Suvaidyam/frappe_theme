# Gallery & Carousel

Frappe Theme provides three visual components for managing and displaying files and images: **Gallery**, **Carousel**, and **Multi-Image Gallery**.

## Gallery

The Gallery component provides a rich file browser with multiple view modes, rendered inside DocType forms using the "Is Custom Design" connection type.

### Features

- **Three view modes**: Card, List, and Directory
- **Dynamic view switching** between modes
- **Permission-based access control** for file operations
- **File grouping** with collapsible groups
- **Folder navigation** for organized file browsing

### Setting Up Gallery in a Form

1. Add an **HTML** field to your DocType (e.g., `files_gallery_html`)
2. Open the **SVADatatable Configuration** for that DocType
3. Add a child entry in the **Child Doctypes** table:

| Field | Value |
|-------|-------|
| HTML Field | `files_gallery_html` |
| Connection Type | `Is Custom Design` |
| Template | `Gallery` |

4. Save

The Gallery will now render all files attached to the document in the selected HTML field.

### View Modes

| Mode | Description |
|------|-------------|
| **Card** | Displays files as visual cards with thumbnails |
| **List** | Compact list view with file details |
| **Directory** | Folder-tree style navigation |

Users can switch between view modes using the view toggle in the gallery header.

## Carousel

The Carousel component creates responsive, touch-enabled image/video sliders. It's configured via the **Carousel** DocType.

### Features

- **Responsive** — adapts to mobile, tablet, and desktop screen sizes
- **Touch gestures** — swipe support for mobile devices
- **Keyboard navigation** — arrow keys and keyboard shortcuts
- **Auto-slide** — configurable auto-advance timing
- **Media support** — images, YouTube videos, Vimeo videos, and local videos
- **Navigation** — page counter, bullet indicators, arrow buttons
- **Device-aware** — different configurations per breakpoint

### Device Breakpoints

| Device | Breakpoint | Behavior |
|--------|-----------|----------|
| Mobile Small | < 480px | Single slide, touch optimized |
| Mobile | < 768px | Compact layout |
| Tablet | < 1024px | Medium layout |
| Desktop | < 1440px | Standard layout |
| Desktop Large | >= 1440px | Full layout |

### Setting Up a Carousel

The Carousel is configured through the **Carousel** DocType and its child **Activity Images** DocType:

1. Create a **Carousel** record
2. Add slides via the **Activity Images** child table
3. Each slide can contain an image URL or video URL

### JavaScript API

```javascript
// The SVACarousel class is available globally
// It initializes automatically based on Carousel DocType configuration

// Key configuration options:
{
    autoSlide: true,          // Enable auto-advance
    autoSlideInterval: 5000,  // Interval in milliseconds
    showPageCounter: true,    // Show "1/5" counter
    showBullets: true,        // Show dot navigation
    showArrows: true,         // Show prev/next arrows
    enableTouchGestures: true // Enable swipe
}
```

## Multi-Image Gallery

The Multi-Image Gallery adds **drag-and-drop reordering** to image attach fields, powered by SortableJS.

### Features

- **Drag-and-drop reordering** with visual feedback (ghost element)
- **Bulk delete** with confirmation dialog
- **Grid mode** for images laid out in a grid
- **Carousel mode** using the `no_wrap` toggle
- **Auto-save** — order changes are saved automatically after reordering
- **Dual context** — works in both Form view and Dialog view

### How It Works

The Multi-Image Gallery hooks into form rendering automatically. When a DocType has an **Attach Image** or **Attach** field with multiple images:

1. Images are displayed in a draggable grid
2. Users can drag to reorder
3. The new order is saved automatically via `frappe.call`
4. Bulk selection and deletion is supported

### Setup

No manual configuration needed — the Multi-Image Gallery is automatically loaded via `app_include_js` and enhances image fields across all DocTypes.

### Dependencies

- **SortableJS** — loaded dynamically from CDN for drag-and-drop functionality

## Tips

- Gallery view mode preference is maintained per session
- The Carousel component supports mixing images and videos in the same slider
- Multi-Image Gallery's drag-and-drop uses the SortableJS `ghostClass` for visual feedback during reordering
- All three components respect Frappe's permission system for file operations
