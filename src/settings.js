'use strict';

const theme = document.getElementById('theme');
const liquid = document.getElementById('liquid');
const login = document.getElementById('login');
const status = document.getElementById('status');

window.settingsApi.load().then((value) => {
  theme.value = value.theme;
  liquid.value = value.liquid;
  login.checked = value.launchAtLogin;
});

document.getElementById('save').addEventListener('click', async () => {
  status.textContent = 'Saving…';
  try {
    await window.settingsApi.save({ theme: theme.value, liquid: liquid.value, launchAtLogin: login.checked });
    status.textContent = 'Saved';
  } catch (error) {
    status.textContent = error.message || 'Could not save';
    status.style.color = '#b33e39';
  }
});

document.getElementById('uninstall').addEventListener('click', async () => {
  if (!window.confirm('Uninstall Emoji Suggestions and remove its GNOME shortcuts and saved preferences?')) return;
  status.style.color = '#b33e39';
  status.textContent = 'Removing Emoji Suggestions…';
  try {
    await window.settingsApi.uninstall();
  } catch (error) {
    status.textContent = error.message || 'Uninstall failed';
  }
});
