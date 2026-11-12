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
}
