# SlideDeckML Templates

This folder contains ready-to-use presentation templates. Each template is designed for a specific use case and includes pre-styled sections that you can customize.

## Import a reusable header

The `academic`, `business`, `technical`, `minimal` and `conference` folders
also contain header-only files named `<style>-header.slidedeck`. Import one
at the beginning of a presentation, using a path relative to that presentation:

```slidedeck
@import "../templates/academic/academic-header.slidedeck"
{
    author: "Your Name"
    title: "Your Presentation"
}
===
# First slide
```

The optional metadata block overrides the header's defaults. Edit the
header file to change the theme or CSS for every deck that imports it.
Examples 08–12 in `examples/sdml/` demonstrate each header. The
`*-template.slidedeck` files described below are complete starter decks,
not header-only imports.

## Available Templates

### 1. Academic Template (`academic/`)
**Use for:** University lectures, thesis presentations, educational content

**Features:**
- Clean, professional styling
- Header banner with gradient
- Structured agenda
- Section dividers
- Citation-ready format

**How to use:**
1. Copy `academic-template.sdml`
2. Update metadata (author, title, theme)
3. Replace placeholders `[Your Title]`, `[Your Name]`, etc.
4. Add your content in the existing sections

---

### 2. Business Template (`business/`)
**Use for:** Corporate presentations, investor pitches, quarterly reviews

**Features:**
- Professional corporate styling
- Executive summary layout
- Financial metrics grid
- Timeline/roadmap section
- Call-to-action slides

**How to use:**
1. Copy `business-template.sdml`
2. Update company name and presenter info
3. Fill in metrics (revenue, growth, customers)
4. Customize sections for your use case

---

### 3. Technical Template (`technical/`)
**Use for:** Code reviews, architecture presentations, tech talks

**Features:**
- Dark theme optimized for code
- Syntax highlighting support
- Architecture diagrams layout
- Code example sections
- Technical best practices format

**How to use:**
1. Copy `technical-template.sdml`
2. Update presenter and technology info
3. Add your code examples
4. Customize tech stack and components

---

### 4. Minimal Template (`minimal/`)
**Use for:** Quick presentations, simple talks, draft slides

**Features:**
- Ultra-clean design
- No distractions
- Fast to customize
- Flexible structure

**How to use:**
1. Copy `minimal-template.sdml`
2. Update basic metadata
3. Replace section titles and content
4. Add or remove slides as needed

---

### 5. Conference Template (`conference/`)
**Use for:** Research presentations, academic conferences, symposiums

**Features:**
- Research-oriented structure
- Methodology and results sections
- Figure/visualization support
- References section
- Formal academic styling

**How to use:**
1. Copy `conference-template.sdml`
2. Update research title and authors
3. Fill in methodology, results, and discussion
4. Add your graphs and data visualizations

---

## Customization Guide

### Metadata Section
All templates start with a metadata block:

```sdml
{
    author: "Your Name"
    title: "Your Title"
    theme: "white"  // or "black", "league", "sky", "beige"
    css: "..."      // Custom styling
}
```

### Template Section (between `---`)
The section between `---` markers defines reusable template slides that appear on every presentation. Useful for title slides and common layouts.

### Slide Content
After the template, add your slides separated by `===`:

```sdml
===
# Slide Title

Your content here
```

### Styling
Each template includes custom CSS in the metadata. You can:
- Change colors by replacing hex codes (e.g., `#0066cc` → `#ff0000`)
- Adjust font sizes
- Modify header banner position (top/bottom)
- Customize spacing and layout

## Tips

1. **Start with the right template** - Choose the template closest to your use case
2. **Keep the structure** - The templates are designed with logical flow
3. **Customize colors** - Match your brand/institution colors
4. **Add your logo** - Use `logo: "./path/to/logo.png"` in metadata
5. **Test incrementally** - Compile after major changes to catch errors

## Examples

See `examples/sdml/` for feature demonstrations:
- `01-simple-markdown.sdml` - Basic markdown features
- `02-code-highlighting.sdml` - Code highlighting modes
- `03-code-sync.sdml` - Synchronized fragments
- `04-latex.sdml` - Mathematical equations
- `05-styling.sdml` - Custom styling examples
- `06-media.sdml` - Images and videos
- `07-absolute-positioning.sdml` - Positioning features
- `complete-demo.sdml` - All features combined

## Compiling Templates

Use the build script to compile your presentation:

```powershell
# PowerShell
.\build-and-compile.ps1 -InputPath .\your-presentation.sdml -OutputPath .\output.html

# Bash
./build-and-compile.sh your-presentation.sdml output.html
```

Or compile directly:
```bash
node ./out/cli/main.js compile your-presentation.sdml -o output.html
```
