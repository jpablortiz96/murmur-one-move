import { requestExpandedMode } from '@devvit/web/client';

const startButton = document.getElementById('start-button');
const status = document.getElementById('status');
const cavern = document.querySelector('.cavern');

if (
  !(startButton instanceof HTMLButtonElement) ||
  !(status instanceof HTMLParagraphElement) ||
  !(cavern instanceof HTMLElement)
) {
  throw new Error('MURMUR splash controls are missing');
}

startButton.addEventListener('pointerdown', () => cavern.classList.add('awakening'));

startButton.addEventListener('click', (event) => {
  startButton.disabled = true;
  cavern.classList.remove('awakening');
  cavern.classList.add('entering');
  status.textContent = 'Listening for Echo…';
  requestExpandedMode(event, 'game');

  window.setTimeout(() => {
    startButton.disabled = false;
    cavern.classList.remove('entering');
    status.textContent = '';
  }, 2500);
});
