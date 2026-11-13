const header = document.querySelector('.site-header');
if (header) {
    const updateHeaderHeight = () => document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`);
    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
}

for (const example of document.querySelectorAll('pre[data-example]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-example';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', `Copy ${example.dataset.example} example`);
    const status = document.createElement('span');
    status.className = 'copy-status';
    status.setAttribute('role', 'status');
    example.before(button, status);
    button.addEventListener('click', async () => {
        try {
            if (!navigator.clipboard) throw new Error('Clipboard unavailable');
            await navigator.clipboard.writeText(example.querySelector('code').textContent);
            status.textContent = 'Copied.';
        } catch (error) {
            status.textContent = 'Could not copy. Select the example and copy it manually.';
        }
    });

    const name = example.dataset.example;
    const page = location.pathname.split('/').pop().replace(/\.html$/, '') || 'index';
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    addPreview(example, `${page}-${slug}`, name);
}

for (const example of document.querySelectorAll('pre[data-preview-reference]')) {
    addPreview(example, example.dataset.previewReference, example.dataset.previewLabel);
}

function addPreview(example, filename, name) {
    const frame = document.createElement('iframe');
    frame.className = 'example-preview';
    frame.title = `Rendered ${name} example`;
    frame.loading = 'lazy';
    frame.src = `previews/${filename}.html`;
    const permissions = 'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads';
    frame.setAttribute('sandbox', name === 'video' ? `${permissions} allow-same-origin` : permissions);
    frame.setAttribute('allow', 'fullscreen');
    const container = document.createElement('div');
    container.className = 'example-preview-container';
    const label = document.createElement('p');
    label.className = 'example-preview-label';
    label.textContent = 'Rendered presentation · Use the slide controls to explore';
    container.append(label, frame);
    example.after(container);
}
