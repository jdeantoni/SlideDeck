const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const vm = require('vm');
const { CompilerService } = require('../out/services/compiler-service');

async function main() {
    const compiler = new CompilerService();
    const base = [
        '{',
        'author: "Test"',
        'title: "Transitions"',
        'transition: "none"',
        '}',
        '===',
        '# Global',
        '===',
        '{transition: "fade"}',
        '# Override',
        '===',
        '{transition: "slide-in fade-out"}',
        '# Mixed',
        '===',
        '# Global again'
    ].join('\n');

    const check = html => {
        assert.match(html, /transition:\s*"none"/);
        const sections = [...html.matchAll(/<section data-slide-index="(\d+)"([^>]*)>/g)];
        assert.deepStrictEqual(sections.map(m => m[1]), ['0', '1', '2', '3']);
        assert.ok(!sections[0][2].includes('data-transition'));
        assert.ok(sections[1][2].includes('data-transition="fade"'));
        assert.ok(sections[2][2].includes('data-transition="slide-in fade-out"'));
        assert.ok(!sections[3][2].includes('data-transition'));
    };

    const result = await compiler.compile(base);
    assert.ifError(result.error);
    check(result.html);

    const makeSlide = transition => {
        const attrs = transition === null ? {} : { 'data-transition': transition };
        const listeners = new Map();
        return {
            attrs, listeners,
            classList: { contains: () => false },
            getAttribute: name => attrs[name] ?? null,
            setAttribute: (name, value) => { attrs[name] = value; },
            removeAttribute: name => { delete attrs[name]; },
            addEventListener: (name, fn) => listeners.set(name, fn),
            removeEventListener: name => listeners.delete(name)
        };
    };
    const slides = [makeSlide(null), makeSlide('fade'), makeSlide('slide-in fade-out')];
    let onSlideChanged;
    const timers = [];
    const runtime = result.html.match(/const slideTransitions = new WeakMap\(\);[\s\S]*?(?=        Reveal\.initialize\()/);
    assert.ok(runtime);
    vm.runInNewContext(runtime[0], {
        document: { querySelectorAll: () => slides },
        Reveal: { on: (name, fn) => { if (name === 'slidechanged') onSlideChanged = fn; } },
        setTimeout: fn => timers.push(fn)
    });
    onSlideChanged({ previousSlide: slides[0], currentSlide: slides[1] });
    assert.strictEqual(slides[0].attrs['data-transition'], 'fade');
    assert.strictEqual(slides[1].attrs['data-transition'], 'fade');
    slides[0].listeners.get('transitionend')({ target: slides[0] });
    assert.strictEqual(slides[0].getAttribute('data-transition'), null);
    onSlideChanged({ previousSlide: slides[1], currentSlide: slides[2] });
    assert.strictEqual(slides[1].attrs['data-transition'], 'slide-in fade-out');
    onSlideChanged({ previousSlide: slides[2], currentSlide: slides[1] });
    assert.strictEqual(slides[2].attrs['data-transition'], 'fade');
    assert.strictEqual(slides[1].attrs['data-transition'], 'fade');
    timers.forEach(fn => fn());
    assert.strictEqual(slides[2].attrs['data-transition'], 'slide-in fade-out');
    onSlideChanged({ previousSlide: slides[1], currentSlide: slides[0] });
    assert.strictEqual(slides[1].attrs['data-transition'], 'none');
    assert.strictEqual(slides[0].attrs['data-transition'], 'none');

    const defaultResult = await compiler.compile('# Default');
    assert.ifError(defaultResult.error);
    assert.match(defaultResult.html, /transition:\s*"slide"/);

    const example = fs.readFileSync(path.resolve(__dirname, '../examples/sdml/17-transitions.slidedeck'), 'utf8');
    const exampleResult = await compiler.compile(example);
    assert.ifError(exampleResult.error);
    assert.match(exampleResult.html, /transition:\s*"slide"/);
    assert.ok(exampleResult.html.includes('data-transition="fade-in zoom-out"'));

    const unsafe = await compiler.compile('{\nauthor: "A"\ntitle: "T"\ntransition: "</script><script>"\n}\n===\n# Test');
    assert.ifError(unsafe.error);
    assert.ok(unsafe.html.includes('transition: "\\u003c/script>\\u003cscript>"'));

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slidedeck-transitions-'));
    const input = path.join(dir, 'slides.sdml');
    const output = path.join(dir, 'slides.html');
    try {
        fs.writeFileSync(input, base);
        execFileSync(process.execPath, [path.resolve(__dirname, '../out/cli/main.js'), 'compile', input, '-o', output]);
        check(fs.readFileSync(output, 'utf8'));
    } finally {
        if (fs.existsSync(output)) fs.unlinkSync(output);
        if (fs.existsSync(input)) fs.unlinkSync(input);
        fs.rmdirSync(dir);
    }

    console.log('Transition tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
