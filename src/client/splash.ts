import { requestExpandedMode } from '@devvit/web/client';

const startButton = document.getElementById('start-button');
const status = document.getElementById('status');

if (!(startButton instanceof HTMLButtonElement) || !(status instanceof HTMLParagraphElement)) {
  throw new Error('MURMUR splash controls are missing');
}

startButton.addEventListener('click', (event) => {
  startButton.disabled = true;
  status.textContent = 'Listening for Echo…';
  requestExpandedMode(event, 'game');

  window.setTimeout(() => {
    startButton.disabled = false;
    status.textContent = '';
  }, 2500);
});

