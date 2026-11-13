const fs = require('fs');
const os = require('os');
const path = require('path');
const { CompilerService } = require('../out/services/compiler-service');

const root = path.resolve(__dirname, '..');
const outputDirectory = path.join(__dirname, 'previews');
const pages = ['guide', 'features', 'tutorial'];

function decodeHtml(text) {
    return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

function slug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function buildPreviews() {
    fs.mkdirSync(outputDirectory, { recursive: true });
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'slidedeck-site-'));
    try {
        const compiler = new CompilerService();
        const used = new Set();
        let count = 0;
        for (const page of pages) {
            const html = fs.readFileSync(path.join(__dirname, `${page}.html`), 'utf8');
            const header = html.match(/<pre data-template-header[^>]*><code>([\s\S]*?)<\/code><\/pre>/);
            if (header) fs.writeFileSync(path.join(temporaryDirectory, 'shared-header.slidedeck'), decodeHtml(header[1]));
            for (const match of html.matchAll(/<pre data-example="([^"]+)"([^>]*)><code>([\s\S]*?)<\/code><\/pre>/g)) {
                const [, name, attributes, content] = match;
                const filename = `${page}-${slug(name)}.html`;
                if (used.has(filename)) throw new Error(`Duplicate example: ${page}/${name}`);
                used.add(filename);
                const sourcePath = attributes.includes('data-preview-template')
                    ? path.join(temporaryDirectory, 'talk.slidedeck')
                    : path.join(root, 'talk.slidedeck');
                const output = path.join(outputDirectory, filename);
                const result = await compiler.compile(decodeHtml(content), undefined, sourcePath, undefined, output);
                if (result.error) throw new Error(`Cannot render ${page}/${name}: ${result.error}`);
                if (!result.slideCount) throw new Error(`Example ${page}/${name} has no slides.`);
                fs.writeFileSync(output, result.html);
                count++;
            }
        }
        console.log(`Built ${count} website example previews.`);
    } finally {
        const template = path.join(temporaryDirectory, 'shared-header.slidedeck');
        if (fs.existsSync(template)) fs.unlinkSync(template);
        fs.rmdirSync(temporaryDirectory);
    }
}

buildPreviews().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
