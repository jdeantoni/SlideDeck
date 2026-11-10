# SlideDeckML

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

**Repository**: https://github.com/RoxaneBacon/sse-dsl-SlideDeckML

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
git clone https://github.com/RoxaneBacon/sse-dsl-SlideDeckML.git
cd sse-dsl-SlideDeckML

# Install dependencies
npm install

# Generate the Langium parser
npm run langium:generate

# Build the project
npm run build
```

## Usage

### 1. Write Your Presentation

Create a `.sdml` file with your content. Here's a simple example:

```sdml
{
    author: "Your Name"
    title: "My First Presentation"
    theme: "black"
}
===
# Welcome to SlideDeckML
This is my first slide created with SlideDeckML!

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
.\build-and-compile.ps1 -InputPath examples/sdml/01-simple-markdown.sdml

# Compile all files in a directory
.\build-and-compile.ps1 -InputPath examples/sdml -OutputPath examples/html

# Skip build step (if already built)
.\build-and-compile.ps1 -InputPath examples/sdml/01-simple-markdown.sdml -SkipBuild
```

For **Linux/Mac (Bash)**:
```bash
# Compile a single file
./build-and-compile.sh examples/sdml/01-simple-markdown.sdml

# Compile all files in a directory
./build-and-compile.sh examples/sdml examples/html

# Skip build step (if already built)
./build-and-compile.sh examples/sdml/01-simple-markdown.sdml "" --skip-build
```

**Option B: Manual compilation**

```bash
# Using npm script
npm run compile examples/sdml/demo.sdml -o output.html

# Using CLI directly
node out/cli/main.js compile examples/sdml/demo.sdml -o output.html
```

The build scripts automatically:
- Regenerate the parser (`npm run langium:generate`)
- Compile TypeScript (`npm run build`)
- Compile the specified `.sdml` file(s) to HTML
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
npm run dev examples/sdml/demo.sdml
```

This starts a development server that automatically reloads when you save changes to your `.sdml` file.

## Example Gallery

The `examples/` folder contains comprehensive examples demonstrating all features:

| Example | Description |
|---------|-------------|
| `01-simple-markdown.sdml` | Basic markdown syntax |
| `02-code-highlighting.sdml` | Code blocks with syntax highlighting |
| `03-code-sync.sdml` | Synchronized code fragments |
| `04-latex.sdml` | Mathematical equations with LaTeX |
| `05-styling.sdml` | Text styling and formatting |
| `06-media.sdml` | Images and videos |
| `07-absolute-positioning.sdml` | Custom element positioning |
| `08-template-academic.sdml` | Academic presentation template |
| `09-template-business.sdml` | Business presentation template |
| `10-template-technical.sdml` | Technical presentation template |
| `11-template-minimal.sdml` | Minimalist template |
| `12-template-conference.sdml` | Conference presentation template |
| `13-chalkboard-simple.sdml` | Basic chalkboard functionality |
| `14-chalkboard-advanced.sdml` | Advanced chalkboard features |
| `16-fragments.sdml` | Fragment animations |
| `17-transitions.sdml` | Slide transitions |
| `18-youtube-media.sdml` | Embedded YouTube videos |
| `19-integrated-ide.sdml` | Live code editor integration |
| `20-qrcode.sdml` | QR code generation |
| `21-quiz.sdml` | Interactive quiz system |
| `complete-demo.sdml` | Comprehensive feature showcase |

## Interactive Quiz Server

SlideDeckML includes a standalone quiz server for real-time interactive presentations.

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
sse-dsl-SlideDeckML/
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
│   ├── sdml/                            # Example .sdml files
│   ├── html/                            # Generated HTML presentations
│   └── templates/                       # Presentation templates
├── standalone-quiz-server/              # Deployable quiz server
├── syntaxes/
│   └── slidedeckml.tmLanguage.json      # Syntax highlighting definition
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

SlideDeckML supports all standard reveal.js themes:

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
- **Repository**: https://github.com/RoxaneBacon/sse-dsl-SlideDeckML
- **Course**: Domain Specific Language (DSL) - SI5/M2 INFO
- **Institution**: Université Côte d'Azur
