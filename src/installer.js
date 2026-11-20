'use strict';

const installButton = document.getElementById('install');
const closeButton = document.getElementById('close');
const status = document.getElementById('status');

installButton.addEventListener('click', async () => {
  installButton.disabled = true;
  status.className = '';
  status.textContent = 'Setting up your shortcuts…';
  try {
    const result = await window.setupApi.install();
    status.className = 'success';
    status.textContent = result.message;
    installButton.textContent = 'Installed';
    setTimeout(() => window.setupApi.close(), 1800);
  } catch (error) {
    status.className = 'error';
    status.textContent = error.message || 'Setup failed. Please try again.';
    installButton.disabled = false;
  }
});

closeButton.addEventListener('click', () => window.setupApi.close());
