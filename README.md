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

### Prerequisites

- **Node.js** (version 14 or higher)
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

The note becomes an HTML `title` attribute, not a CSS property. Its appearance
is controlled by the browser and it may not be available on touch devices or
through keyboard focus; include essential information in visible text.

For a numbered note at the end of the current slide, use `footnote` instead:

```sdml
This is [EDT]{footnote: 'Explanation of EDT'}.
```

Footnotes are numbered in reading order, restarting on each slide. They appear
after the slide content and take up slide space; fragment footnotes are visible
even before their fragment is revealed. `note` and `footnote` can be combined.

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
