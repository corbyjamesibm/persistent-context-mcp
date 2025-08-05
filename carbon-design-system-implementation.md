# IBM Carbon Design System Implementation

## Date: January 2025

## Overview
Successfully implemented IBM Carbon Design System for the resource allocation dashboard, following official Carbon standards.

## Key Components Implemented

### 1. Carbon Shell Header
```css
.bx--header {
    position: fixed;
    top: 0;
    height: 3rem;
    background-color: var(--cds-ui-05); /* #161616 */
    color: var(--cds-text-04); /* white */
}
```

### 2. Typography System
- Font: IBM Plex Sans
- Productive heading scales (heading-01 through heading-07)
- Body text styles (body-short-01/02, body-long-01/02)
- Proper line heights and letter spacing

### 3. Color Tokens
```css
/* Core UI Colors */
--cds-ui-background: #ffffff;
--cds-ui-01: #f4f4f4;
--cds-ui-05: #161616;

/* Support Colors */
--cds-support-01: #da1e28; /* Error */
--cds-support-02: #24a148; /* Success */
--cds-support-03: #f1c21b; /* Warning */
--cds-support-04: #0f62fe; /* Info */
```

### 4. Component Implementation

#### Data Table
```css
.bx--data-table {
    border-collapse: collapse;
    font-size: var(--cds-body-short-01-font-size);
}

.bx--data-table tbody tr:hover {
    background-color: var(--cds-hover-ui);
}
```

#### Tags (Color Mapping)
- **Allocation Percentage**:
  - Red: >= 80% (high allocation)
  - Magenta: >= 50% (medium)
  - Green: < 50% (normal)

- **Product Experience**:
  - Green: 12+ months
  - Teal: 6-11 months
  - Cyan: < 6 months
  - Gray: No experience

- **Status**:
  - Green: Active/Approved
  - Blue: Requested
  - Gray: Other

#### Pagination
```html
<div class="bx--pagination">
    <div class="bx--pagination__left">
        <span>1–100 of 29,408 items</span>
    </div>
    <div class="bx--pagination__right">
        <!-- Navigation buttons -->
    </div>
</div>
```

### 5. Spacing System
Using Carbon spacing tokens:
- spacing-01: 0.125rem (2px)
- spacing-03: 0.5rem (8px)
- spacing-05: 1rem (16px)
- spacing-07: 2rem (32px)

### 6. Interactive States
- **Hover**: var(--cds-hover-ui) for rows and buttons
- **Focus**: 2px solid outline with var(--cds-focus)
- **Disabled**: Opacity 0.5 with cursor not-allowed

### 7. Grid System
```css
.bx--grid {
    max-width: 99rem;
    margin-left: auto;
    margin-right: auto;
    padding: 0 var(--cds-spacing-05);
}

.bx--col-lg-4 {
    flex: 0 0 25%;
    max-width: 25%;
}
```

## Key Design Decisions

1. **Tiles for Metrics**: Used Carbon tiles instead of custom cards
2. **Tag Colors**: Mapped to Carbon's semantic color system
3. **Loading State**: Carbon spinner with proper animation
4. **Empty State**: Followed Carbon's empty state pattern
5. **Search**: Carbon search with magnifier icon
6. **Dropdowns**: Native selects styled with Carbon theme

## Accessibility Features
- Proper color contrast ratios
- Focus indicators on all interactive elements
- Semantic HTML structure
- ARIA labels where needed

## File Created
- `ibm-resource-allocation-carbon.html` - Full Carbon Design implementation

## Benefits
1. **Consistency**: Matches other IBM applications
2. **Accessibility**: Built-in a11y compliance
3. **Performance**: Optimized CSS variables
4. **Maintainability**: Standard component patterns
5. **Professional**: Enterprise-ready design

## Usage
```bash
# Access at
http://localhost:8888/ibm-resource-allocation-carbon.html
```