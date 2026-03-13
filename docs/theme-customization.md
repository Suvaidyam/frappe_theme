# Theme Customization

The **My Theme** DocType is a singleton that controls the visual appearance of your entire Frappe site — login page, navbar, sidebar, buttons, tables, inputs, and widgets.

## Accessing My Theme

Search for **"My Theme"** in the Frappe search bar, or navigate to:

```
/app/my-theme
```

## Configuration Tabs

### Login Page Tab

Customize the appearance of your site's login page.

| Field | Type | Description |
|-------|------|-------------|
| Page Background Type | Select | Choose between `Color` or `Image` background |
| Page Background Color | Color | Background color when type is "Color" |
| Page Background Image | Attach Image | Background image when type is "Image" |
| Login Box Position | Select | Position the login box: `Default`, `Left`, or `Right` |
| Box Background Color | Color | Background color of the login box |
| Heading Text Color | Color | Color of the page heading text |
| Login Page Title | Data | Custom title text (max 30 characters) |
| Is App Details Inside The Box | Check | Show app details inside the login box |
| Enable Username/Password Login | Check | Enable traditional login method |
| Button Background Color | Color | Login button background |
| Button Text Color | Color | Login button text |
| Button Hover Background Color | Color | Login button background on hover |
| Button Hover Text Color | Color | Login button text on hover |

**Step-by-step:**

1. Go to **My Theme** > **Login Page** tab
2. Set **Page Background Type** to `Color` or `Image`
3. If `Color`, pick a color in **Page Background Color**
4. If `Image`, upload an image in **Page Background Image**
5. Set **Login Box Position** (Default centers the box)
6. Customize button colors as desired
7. Optionally set a **Login Page Title** (e.g., your organization name)
8. Save

### Navbar Tab

Customize the top navigation bar.

| Field | Type | Description |
|-------|------|-------------|
| Background Color | Color | Navbar background color |
| Text Color | Color | Navbar text/icon color |
| Custom Logo | Attach Image | Upload a custom logo to replace the default |
| Logo Height (px) | Int | Height of the custom logo (default: 45, recommended: 30-60) |
| Hide Help Button | Check | Hide the help (?) button from the navbar |
| Hide Search | Table MultiSelect | Hide the search bar for specific roles |

**Step-by-step:**

1. Go to **My Theme** > **Navbar** tab
2. Pick a **Background Color** (e.g., your brand color)
3. Set **Text Color** to contrast with the background
4. Upload a **Custom Logo** if desired
5. Adjust **Logo Height** to fit your logo's aspect ratio
6. Save — changes apply immediately on next page load

### Buttons Tab

Customize primary and secondary button styles.

**Primary Button:**

| Field | Type | Description |
|-------|------|-------------|
| Background Color | Color | Primary button background |
| Text Color | Color | Primary button text |
| Hover Background Color | Color | Background on hover |
| Hover Text Color | Color | Text color on hover |

**Secondary Button:**

| Field | Type | Description |
|-------|------|-------------|
| Background Color | Color | Secondary button background |
| Text Color | Color | Secondary button text |
| Hover Background Color | Color | Background on hover |
| Hover Text Color | Color | Text color on hover |

### Body Tab

| Field | Type | Description |
|-------|------|-------------|
| Background Color | Color | Main page background color |
| Content Box Background Color | Color | Background of the main content area |

### Table Tab

Customize list view and table appearance.

| Field | Type | Description |
|-------|------|-------------|
| Head Background Color | Color | Table header row background |
| Head Text Color | Color | Table header text color |
| Body Background Color | Color | Table body rows background |
| Body Text Color | Color | Table body text color |
| Hide Like Comment Section | Check | Hide the like/comment section in list views |
| Disable card view on mobile view | Check | Disable mobile card layout for list views |
| Disable flex card content on mobile view | Check | Disable flex layout in mobile cards |

### Widgets Tab

Customize number card widget appearance.

| Field | Type | Description |
|-------|------|-------------|
| Number Card Background Color | Color | Background of number card widgets |
| Number Card Border Color | Color | Border color of number card widgets |
| Number Card Text Color | Color | Text color in number card widgets |

**Dialog Settings:**

| Field | Type | Description |
|-------|------|-------------|
| SVA DataTable Dialog Width | Data | Custom width for SvaDatatable dialogs |

### Input Tab

Customize form input field appearance.

| Field | Type | Description |
|-------|------|-------------|
| Background Color | Color | Input field background |
| Border Color | Color | Input field border |
| Text Color | Color | Input field text |
| Label Color | Color | Field label text color |

### Sidebar Tab

Customize the workspace sidebar appearance.

**General Sidebar:**

| Field | Type | Description |
|-------|------|-------------|
| Sidebar Background Color | Color | Overall sidebar background |
| Remove Sidebar Top Margin | Check | Remove the top margin from sidebar |
| Sidebar Border Radius (px) | Int | Border radius for sidebar container |

**App Title / Logo Area:**

| Field | Type | Description |
|-------|------|-------------|
| App Title / Logo Area Color | Color | Background color of the logo/title area |

**Active State (selected nav item):**

| Field | Type | Description |
|-------|------|-------------|
| Active Background Color | Color | Background when nav item is selected |
| Active Text Color | Color | Text color when nav item is selected |
| Active Left Border Color | Color | Left accent border color |
| Active Left Border Width (px) | Int | Width of the left accent border |
| Active Right Border Color | Color | Right accent border color |
| Active Right Border Width (px) | Int | Width of the right accent border |

**Hover & Inactive States:**

| Field | Type | Description |
|-------|------|-------------|
| Hover Background Color | Color | Background on mouse hover |
| Hover Text Color | Color | Text color on hover |
| Inactive Nav Item Color | Color | Text color for unselected items |

### Workspace Remapping Tab

Remap workspace sidebar navigation items.

| Field | Type | Description |
|-------|------|-------------|
| Sidebar Element Selector | Data | CSS selector for the sidebar element (required if workspace remappings are added) |
| Workspace | Table | Table of workspace remapping entries |

### Features Tab

Toggle various app features on/off.

| Field | Type | Description |
|-------|------|-------------|
| Hide Print Icon | Check | Hide the print icon from forms |
| Hide Fields Comment | Check | Disable per-field commenting |
| Hide Side Bar | Check | Hide the sidebar entirely |
| Hide Form Comment | Check | Hide the comment section in forms |
| Last Imported File | Attach | Reference to the last imported file |
| Cloud Assets | Button | Open Cloud Assets configuration dialog |
| Sanitize all fields | Check | Enable XSS sanitization on all document fields |

### Integrations Tab

Configure external service connections.

**Helpdesk:**

| Field | Type | Description |
|-------|------|-------------|
| URL | Data | Helpdesk URL for ticket integration |
| Creds | Data | Helpdesk API credentials |

## Tips

- Changes to theme colors take effect on the next page load (no bench restart needed)
- The theme configuration is loaded at boot time via `extend_bootinfo` and cached
- All color fields accept standard hex color codes
- Use the **Ticket Button** to quickly create support tickets from the Features tab
