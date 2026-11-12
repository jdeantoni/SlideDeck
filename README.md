# SlideDeck

A powerful Domain-Specific Language (DSL) for creating modern, interactive reveal.js presentations using an intuitive markdown-like syntax.

## Project Context

This project was developed as part of the **Domain Specific Language (DSL)** course at **Université Côte d'Azur** (SI5/M2 INFO, 2025-2026) under the supervision of **Julien Deantoni**.

### Academic Objective

The goal was to design and implement a DSL that enables computer science students and teachers to quickly create sophisticated web-based slide decks without directly writing HTML5. The DSL had to support:
- Core presentation features (slides, templates, media, customization)
- Modern features (transitions, animations, non-linear navigation, annotations)
- Offline usage capability
- Cross-platform compatibility

### Technology Choice

We selected **reveal.js** as our target framework and **Langium** as our DSL implementation technology, providing a robust and extensible foundation for presentation generation.

## Team Members

- [**Roxane BACON**](https://github.com/RoxaneBacon)
- [**Baptiste LACROIX**](https://github.com/BaptisteLacroix)
- [**Baptiste ROYER**](https://github.com/BaptisteRoyer24)
- [**Théo VIDAL**](https://github.com/Dalvii)

**Repository**: https://github.com/jdeantoni/SlideDeck

**Original project**: https://github.com/RoxaneBacon/sse-dsl-SlideDeckML

## Documentation

- **[User Guide (French)](GUIDE_UTILISATEUR.md)**: Complete syntax reference with examples
- **[Technical Report (French)](docs/RAPPORT.md)**: Domain model, architecture, and implementation details
- **[Developer Guide](DEV_MODE.md)**: Development server and advanced features

## Features

- **Intuitive Syntax**: Write slides with familiar markdown-style syntax
- **Rich Content**: Support for headings, text formatting, lists, code blocks, math (LaTeX), media (images, videos, YouTube)
- **Advanced Features**: 
  - Multiple presentation themes and templates (academic, business, conference, technical, minimal)
  - Interactive chalkboard and annotations
  - Code syntax highlighting
  - Fragment animations and transitions
  - Absolute positioning
  - Integrated IDE for live code editing
  - Interactive quiz system with real-time results
  - QR code generation
- **Metadata Support**: Configure theme, author, title, logo, custom CSS, and more
- **reveal.js Output**: Generates beautiful HTML presentations powered by reveal.js
- **Offline Support**: All generated presentations work without internet connection

## Quick Start

### Project website

The static landing page, getting-started guide, hands-on tutorial and copyable feature examples
live in `website/`. Open
`website/index.html` locally to preview them. The Pages workflow deploys this
directory on pushes to `main` and can also be started manually. It builds the
VS Code extension and includes `slidedeck.vsix` in the deployed site. For a
local preview of the download link, first build the project, then run
`npx --yes @vscode/vsce@4.1.0 package --out website/slidedeck.vsix` (Node.js
22 is used in the workflow). To enable deployment,
set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
The expected project URL is `https://jdeantoni.github.io/SlideDeck/` once the
workflow has run successfully. Links to the full documentation and examples
point to this repository on GitHub.

### Prerequisites

- **Node.js** (version 16 or higher)
- **npm** (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/jdeantoni/SlideDeck.git
cd SlideDeck

# Install dependencies
npm install

# Generate the Langium parser
npm run langium:generate

# Build the project
npm run build
```

Run the test scripts with `npm test`. This regenerates the parser and builds
the project first; dependencies must already be installed.

## Usage

### 1. Write Your Presentation

Create a `.slidedeck` file with your content. Existing `.sdml` files remain supported.
Here's a simple example:

```sdml
{
    author: "Your Name"
    title: "My First Presentation"
    theme: "black"
}
===
# Welcome to SlideDeck
This is my first slide created with SlideDeck!

===

## What Can I Do?

- Write in **bold** and *italic*
- Add `code snippets`
- Create lists and much more!

===

### Thank You!
Questions?
```

For complete syntax documentation, see the **[User Guide](GUIDE_UTILISATEUR.md)**.

To style part of a line, use an inline span:

```sdml
- **Event**: [EDT Catalyst – PC1]{.small-note} *in-person kickoff*
This is [important]{.highlight; font-size: '20px'; color: 'red'}.
```

Classes must be defined in your presentation's CSS. Inline spans also work in
headings, paragraphs, lists, and quotes; they can contain bold and italic text.
Escape literal span delimiters with `\[` and `\]`. The existing `::: {…}`
syntax remains available for styling entire blocks.

For a native browser hover note, add a quoted `note` attribute:

```sdml
This is [EDT]{note: 'Explanation of EDT'; color: 'blue'}.
```

An ⓘ indicator marks the annotated text, including notes on footnotes. The
note becomes an HTML `title` attribute, not a CSS property. The tooltip's
appearance is controlled by the browser and it may not be available on touch
devices or through keyboard focus; include essential information in visible
text. Customize the indicator with `.reveal [data-sd-note]::after` in the
presentation CSS.

For a numbered note at the end of the current slide, use `footnote` instead:

```sdml
This is [EDT]{footnote: 'Explanation of EDT'}.
```

Footnotes are numbered in reading order, restarting on each slide. They appear
after the slide content and take up slide space; fragment footnotes are visible
even before their fragment is revealed. `note` and `footnote` can be combined.

Style an individual footnote using a quoted text inside a styled span:

```sdml
[*a concept*]{footnote: ['a styled footnote']{.todo; color: red}}
```

Classes and CSS properties inside the nested braces apply to the footnote
text, not the reference or its number. Footnote text remains plain text
(HTML is escaped); define classes such as `.todo` in the presentation CSS.
To add a hover tooltip to the footnote text, put `note` inside the brackets:

```sdml
[term]{footnote: ['Short note'; note: 'More details']{.todo}}
```

Alternatively, put `note` inside the nested braces. A `note` on the outer
span instead applies to the reference text. Tooltips use the browser's native
`title` behavior and may be inaccessible by keyboard or on touch devices.

Set a presentation-wide transition in the metadata (after `logo` and `css`,
when present). It defaults to `slide` if omitted. A transition at the start
of an individual slide overrides the presentation setting. When navigating
in either direction, the destination slide's transition applies to both the
incoming and outgoing slides:

```sdml
{
    author: "Your Name"
    title: "My Presentation"
    transition: "none"
}
===
# Uses no transition
===
{transition: "fade"}
# Uses fade for this slide
```

Reveal.js mixed values such as `slide-in fade-out` retain their separate
in/out effects, so the two sides can intentionally look different.

Lists can be nested using Markdown-style indentation:

```sdml
- Main point
   - Sub-point
      1. Numbered detail
- Next main point
```

Indent a child marker at least as far as the start of its parent item's text;
dedent to return to a previous level. Items are single-line, and blank lines
alone do not separate consecutive lists.

Comments can be written on their own lines with `//`, or as `/* ... */`
blocks spanning one or more lines. They are omitted from generated slides.
Comments may also follow metadata values, but markers within slide text are
treated as text; put comments on a separate line there. Normal text formatting still applies. Code
blocks retain their contents, including comments.

For hyperlinks, write `![label] "destination"` in text, headings or lists:

```sdml
Visit ![our website] "https://example.com".
![QR] "https://example.com"
```

The reserved label `QR` generates a QR code as before. Image and video syntax
`![description](url)` is unchanged. Links accept HTTP(S), `mailto:`, relative
paths and fragments; unsupported URL schemes produce a compilation error.
Relative links are resolved by the browser against the generated HTML's
location, and may not work in the live preview.

### 2. Compile to HTML

**Option A: Using build scripts (recommended)**

For **Windows (PowerShell)**:
```powershell
# Compile a single file
.\build-and-compile.ps1 -InputPath examples/sdml/01-simple-markdown.slidedeck

# Compile all files in a directory
.\build-and-compile.ps1 -InputPath examples/sdml -OutputPath examples/html

# Skip build step (if already built)
.\build-and-compile.ps1 -InputPath examples/sdml/01-simple-markdown.slidedeck -SkipBuild
```

For **Linux/Mac (Bash)**:
```bash
# Compile a single file
./build-and-compile.sh examples/sdml/01-simple-markdown.slidedeck

# Compile all files in a directory
./build-and-compile.sh examples/sdml examples/html

# Skip build step (if already built)
./build-and-compile.sh examples/sdml/01-simple-markdown.slidedeck "" --skip-build
```

**Option B: Manual compilation**

```bash
# Using npm script
npm run compile examples/sdml/01-simple-markdown.slidedeck -o output.html

# Using CLI directly
node out/cli/main.js compile examples/sdml/01-simple-markdown.slidedeck -o output.html
```

The build scripts automatically:
- Regenerate the parser (`npm run langium:generate`)
- Compile TypeScript (`npm run build`)
- Compile the specified `.slidedeck` or `.sdml` file(s) to HTML
- Provide colored progress messages and error reporting

### 3. Open in Browser

Simply open the generated HTML file in your web browser:

```bash
# Windows
start output.html

# Mac
open output.html

# Linux
xdg-open output.html
```

Generated presentations display the current slide number and total. To
customize their appearance, add a `.reveal .slide-number` rule to the `css`
metadata, for example:

```sdml
{
    author: "Your Name"
    title: "My Presentation"
    css: ".reveal .slide-number { font-size: 20px; color: red; }"
}
```

### 4. Development Server (Optional)

For live editing and preview:

```bash
npm run dev examples/sdml/01-simple-markdown.slidedeck
```

This starts a development server with its own browser editor and live preview.
Edit there and press Ctrl+S to save; the server does not watch external edits.

### VS Code native editor and preview

The VS Code extension lets you edit `.slidedeck` and `.sdml` files in the normal editor and view
slides beside it, without starting the development server:

1. Open a trusted workspace in desktop VS Code (or a remote VS Code workspace
   with a Node.js extension host).
2. Install the packaged SlideDeck extension, or run it from source: run
   `npm install`, `npm run langium:generate`, and `npm run build`, then open
   this repository in VS Code and press **F5** to launch the extension host.
3. Open a `.slidedeck` or `.sdml` file in the extension host and run **SlideDeck: Open
   Preview to the Side** from the Command Palette, or use the editor title
   action.

To generate standalone HTML, click **Generate HTML** in the editor title bar
or run **SlideDeck: Generate HTML** from the Command Palette. Choose an
output file in the save dialog (the default is beside the source). The
current editor contents, including unsaved edits, are compiled; the source
and output must be files on the extension host's filesystem. Save a new
file first so relative assets can be resolved. Existing output may be
overwritten after the save dialog's confirmation. As with the CLI, local
videos are copied to a matching `-assets` directory next to the HTML.

To start a presentation, click **Start Presentation** in the editor title bar
or run **SlideDeck: Start Presentation**. It compiles the current editor
contents to an HTML file beside the source and opens a new Firefox window.
If the HTML already exists, you must confirm before it is replaced.
Configure `slidedeck.browserExecutable` to choose another browser or an
absolute executable path; `slidedeck.browserArguments` defaults to
`["--new-window"]` and can be changed to suit that browser. Arguments are
passed separately, without a shell. This action requires a local VS Code
extension host; in remote workspaces, generate the HTML and open it locally.

With VS Code 1.97 or later, paste an image or copy an image file into a saved
SlideDeck editor to create an image in an `img` folder beside the source and
insert its SlideDeck image reference. Generated names are unique and do not
overwrite existing images. Regular text pastes are unchanged. The source must
be on the extension host's filesystem.

The preview follows unsaved text changes and the editor cursor. It remains
associated with the file it was opened for; open another preview for another
file. Parse errors appear above the last successful preview. Restart the
extension host after rebuilding extension code.
The embedded preview does not update the URL hash while navigating; generated
standalone presentations retain reveal.js URL-hash navigation.

Embedded code editors require internet access to load Monaco and, for Python
and SQL, their execution runtimes. If the editor cannot load, check your
connection and reload the presentation.

To position an image visually, enable **Edit layout** in the preview and drag
the image. The source is updated as one undoable edit; save the file to keep
the change. For example:
`![Logo](img/logo.png){offset: '40px -20px'}`. Offsets are measured in slide
pixels relative to the image's original position; its space in the normal
layout is retained. The position is also used in generated HTML. Turn off
**Edit layout** to return to normal preview interaction. This supports regular
image lines (including images in styled blocks and fragments), not videos,
QR codes, or images inside synchronized fragments. Wait for the preview to
finish updating before dragging again.

In **Edit layout**, click an image and drag its bottom-right handle to resize
it. Hold Shift while resizing to preserve its proportions. The size is saved
as slide-pixel dimensions in the image source, for example
`![Logo](img/logo.png){size: '400px 200px'}`. Resizing can change surrounding
layout; use Undo to restore the previous dimensions.

**Edit layout** also moves styled blocks (`::: {…} … :::`) as a unit,
including their headings, text, lists and images. Drag the block's content;
Shift-drag an image to move its surrounding block rather than the image.
The offset is stored as a `translate` style on the block and its original
space remains in the layout. Wrap a heading or paragraph in a styled block
to move it independently. Blocks with an existing non-pixel `translate`
style are not draggable.

Use **Draw** in the preview to draw on the slide. Choose the pen, rectangle,
ellipse or arrow, and set a color and width. Pen strokes are smoothed, and
rectangles and ellipses have a slightly hand-drawn outline. **Save
fragments** creates a transparent SVG in `img` for each drawing and inserts
one `fade-in` fragment per SVG at the end of the current slide. Save the
SlideDeck file to keep the source edits. In the generated presentation the
annotations appear in drawing order as you advance the fragments; they are
static images, not stroke-by-stroke animations. Existing fragment ordering
and explicit fragment indices still apply.

To reposition a saved drawing, enable **Edit layout** and drag the dashed box
around the visible drawing. Drag its bottom-right handle to resize it; hold
Shift to preserve proportions. Drawings in unrevealed fragments are also
editable in this mode. The transform is saved in the SlideDeck source and
applies in the generated presentation. Each drawing is manipulated as a
whole; individual arrow endpoints and presentation-time editing are not
supported.

Drawings are drafts until saved. Return to their original slide to save or
clear them. If the source changes while a draft is open, it cannot be saved
against the stale preview; clear it and draw again. Undoing the source
insertion does not delete the generated SVG files. The drawings are separate
SVG images, not individually editable shapes; remove their fragment and SVG
file manually if no longer needed.

To go back from a slide to its source, double-click non-interactive content on
the current slide. The editor opens at the start of that slide. Double-clicks
on links, controls, media and interactive widgets keep their normal behavior.
If the preview is stale because compilation is pending or has failed, fix the
errors and wait for it to update before navigating.

The extension provides syntax coloring, language-server diagnostics and
completion, and snippets. Type `sdml-` and choose a suggestion such as
`sdml-slide`, `sdml-fragment`, `sdml-link`, or `sdml-footnote` (or press
Ctrl+Space). If coloring is missing, check that the language mode in the
bottom-right corner is **SlideDeck**.

The extension identifier is now `slidedeck.slidedeck`. Uninstall the old
`slidedeckml.slidedeckml` extension after installing SlideDeck to avoid
conflicting associations for `.sdml` files. The CLI command is now `slidedeck`;
existing presentation syntax remains unchanged.

The preview runs presentation scripts in a webview and is disabled in
untrusted workspaces. It loads reveal.js and other libraries from their CDNs,
so those features require network access. Local media can be loaded from the
presentation directory and workspace folders; paths outside those roots may
not load. Relative hyperlinks are resolved inside the webview and should be
checked in the generated HTML. Quiz and embedded IDE integrations require
their normal services and may have additional webview restrictions.

## Example Gallery

The `examples/` folder contains comprehensive examples demonstrating all features:

| Example | Description |
|---------|-------------|
| `01-simple-markdown.slidedeck` | Basic markdown syntax |
| `02-code-highlighting.slidedeck` | Code blocks with syntax highlighting |
| `03-code-sync.slidedeck` | Synchronized code fragments |
| `04-latex.slidedeck` | Mathematical equations with LaTeX |
| `05-styling.slidedeck` | Text styling and formatting |
| `06-media.slidedeck` | Images and videos |
| `07-absolute-positioning.slidedeck` | Custom element positioning |
| `08-template-academic.slidedeck` | Academic presentation template |
| `09-template-business.slidedeck` | Business presentation template |
| `10-template-technical.slidedeck` | Technical presentation template |
| `11-template-minimal.slidedeck` | Minimalist template |
| `12-template-conference.slidedeck` | Conference presentation template |
| `13-chalkboard-simple.slidedeck` | Basic chalkboard functionality |
| `14-chalkboard-advanced.slidedeck` | Advanced chalkboard features |
| `16-fragments.slidedeck` | Fragment animations |
| `17-transitions.slidedeck` | Slide transitions |
| `18-youtube-media.slidedeck` | Embedded YouTube videos |
| `19-integrated-ide.slidedeck` | Live code editor integration |
| `20-qrcode.slidedeck` | QR code generation |
| `21-quiz.slidedeck` | Interactive quiz system |
| `complete-demo.slidedeck` | Comprehensive feature showcase |

## Interactive Quiz Server

SlideDeck includes a standalone quiz server for real-time interactive presentations.

### Setup

```bash
cd standalone-quiz-server
npm install
```

### Start the Server

```bash
npm run start-server
```

### Make Server Accessible on Network

```bash
npx http-server -p 3000 -a 0.0.0.0
```

Participants can then connect via their browsers to participate in live quizzes during your presentation.

## Syntax Reference

### Metadata Block

Configure your presentation at the top of your `.sdml` file:

```sdml
{
    author: "Your Name"
    title: "Presentation Title"
    theme: "black"          // Options: black, white, league, beige, sky, night, serif, simple, solarized
    logo: "path/to/logo.png"
    css: "custom-styles.css"
    chalkboard: "true"
    chalkboard-theme: "chalkboard"
}
```

### Headings

```sdml
# Level 1 Heading (H1)
## Level 2 Heading (H2)
### Level 3 Heading (H3)
```

### Text Formatting

```sdml
**bold text**
*italic text*
`inline code`
```

### Lists

```sdml
- Unordered item 1
- Unordered item 2
  - Nested item

1. Ordered item 1
2. Ordered item 2
```

### Code Blocks

```sdml
```language
code here
` ` `
```

### Images and Media

```sdml
![alt text](path/to/image.png)
![alt text](path/to/image.png){width:50%}

// YouTube videos
![YouTube Video](https://www.youtube.com/watch?v=VIDEO_ID)
```

### Slide Separator

```sdml
===
```

For complete syntax documentation, refer to the **[User Guide](GUIDE_UTILISATEUR.md)**.

## 🏗️ Project Architecture

```
SlideDeck/
├── src/
│   ├── language/
│   │   ├── slide-deck.langium           # Grammar definition (DSL syntax)
│   │   └── slide-deck-module.ts         # Langium module setup
│   ├── generator/
│   │   └── html-generator.ts            # HTML generation logic (compiler)
│   ├── cli/
│   │   └── main.ts                      # CLI entry point
│   ├── dev-server/                      # Development server with live reload
│   ├── quiz-server/                     # Quiz server implementation
│   └── extension.ts                     # VS Code extension
├── examples/
│   ├── sdml/                            # Example .slidedeck files
│   ├── html/                            # Generated HTML presentations
│   └── templates/                       # Presentation templates
├── standalone-quiz-server/              # Deployable quiz server
├── syntaxes/
│   └── slidedeck.tmLanguage.json      # Syntax highlighting definition
├── docs/
│   └── RAPPORT.md                       # Technical report (French)
├── tests/                               # Unit tests
├── build-and-compile.ps1                # Build script (PowerShell)
├── build-and-compile.sh                 # Build script (Bash)
├── GUIDE_UTILISATEUR.md                 # User guide (French)
├── DEV_MODE.md                          # Developer documentation
├── langium-config.json                  # Langium configuration
├── package.json                         # Node.js dependencies
└── tsconfig.json                        # TypeScript configuration
```

### Key Technologies

- **Langium**: Framework for building DSLs with TypeScript
- **TypeScript**: Implementation language
- **reveal.js**: Target presentation framework
- **Node.js**: Runtime environment
- **Express**: Web server for development mode and quiz server
- **Socket.IO**: Real-time communication for quiz features

## Development

### Generate Langium Parser

After modifying the grammar in `src/language/slide-deck.langium`:

```bash
npm run langium:generate
```

### Build TypeScript

```bash
npm run build
```

### Watch Mode (Development)

For automatic rebuilding during development:

```bash
npm run langium:watch    # Watch grammar changes
npm run watch            # Watch TypeScript changes
```

### Testing

```bash
# Run tests
node tests/test-lexer.js
node tests/test-parse.js
```

## Available Themes

SlideDeck supports all standard reveal.js themes:

- `black` (default)
- `white`
- `league`
- `beige`
- `sky`
- `night`
- `serif`
- `simple`
- `solarized`

Custom themes can be added via the `css` metadata field.

## Templates

Pre-built templates are available in `examples/templates/`:

- **Academic**: Research presentations with citation support
- **Business**: Corporate-style presentations
- **Conference**: Professional conference talks
- **Technical**: Technical documentation and tutorials
- **Minimal**: Clean, distraction-free design

Use templates by copying and modifying the example files.

## Implementation Highlights

### Domain Model

The DSL is built around a clear domain model:
- **Presentation**: Root container
- **Metadata**: Configuration (theme, author, title, etc.)
- **Slide**: Individual slide container
- **Block**: Content elements (headings, paragraphs, code, media, etc.)

See the **[Technical Report](docs/RAPPORT.md)** for the complete class diagram.

### Concrete Syntax

The grammar is defined in BNF-like form using Langium:
- Intuitive markdown-inspired syntax
- Extensible metadata system
- Support for complex nested structures
- Fragment and animation control

### Compiler Pipeline

1. **Lexical Analysis**: Tokenization of `.sdml` source
2. **Parsing**: AST (Abstract Syntax Tree) generation
3. **Semantic Analysis**: Validation and type checking
4. **Code Generation**: HTML/JavaScript output with reveal.js integration

## Contributing

This project was developed as an academic assignment. For questions or contributions:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See the project for details.

## Contact

For questions or support:
- **Repository**: https://github.com/jdeantoni/SlideDeck
- **Course**: Domain Specific Language (DSL) - SI5/M2 INFO
- **Institution**: Université Côte d'Azur
