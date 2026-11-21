import { createHash } from 'node:crypto';

const telegramScript='https://telegram.org/js/telegram-web-app.js';
const script=`
const app = window.Telegram?.WebApp;
const button = document.querySelector('button');
const status = document.querySelector('[role="status"]');

if (app && app.platform !== 'unknown' && app.isVersionAtLeast('6.9')) {
  app.ready();
  button.disabled = false;
  button.addEventListener('click', () => {
    button.disabled = true;
    status.textContent = '';
    app.requestContact(shared => {
      if (shared) {
        status.textContent = 'Контакт отправлен. Вернитесь в чат с ботом.';
        app.close();
        return;
      }
      status.textContent = 'Контакт не отправлен. Попробуйте ещё раз.';
      button.disabled = false;
    });
  });
} else {
  status.textContent = 'Откройте эту кнопку из чата с ботом в приложении Telegram.';
}`;
const scriptHash=createHash('sha256').update(script).digest('base64');

export function GET() {
  return new Response(`<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Подтверждение номера · JUICY</title>
<style>
body { background: #f8f4f0; color: #352c31; font: 16px/1.5 system-ui, sans-serif; margin: 0; }
main { max-width: 28rem; margin: 0 auto; padding: 1.5rem; }
h1 { font-size: 1.5rem; }
button { background: #dbadba; color: #352c31; border: 0; border-radius: .55rem; padding: .8rem 1rem; font: inherit; font-weight: 700; }
button:disabled { opacity: .55; }
</style>
</head><body><main>
<h1>Поделитесь номером телефона</h1>
<p>Telegram попросит подтвердить отправку вашего контакта боту JUICY.</p>
<button type="button" disabled>Поделиться номером телефона</button>
<p role="status"></p>
</main>
<script src="${telegramScript}"></script>
<script>${script}</script>
</body></html>`,{headers:{
    'Content-Type':'text/html; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Robots-Tag':'noindex',
    'Content-Security-Policy':`sandbox allow-scripts; default-src 'none'; script-src ${telegramScript} 'sha256-${scriptHash}'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  }});
}
