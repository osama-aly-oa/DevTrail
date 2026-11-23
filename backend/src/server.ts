import { app } from './app.ts';

const configuredPort = process.env.PORT ?? '3000';
const port = Number(configuredPort);

if (configuredPort === '' || /\D/.test(configuredPort) || port < 1 || port > 65535) {
  console.error('Invalid PORT. Set PORT to a whole number from 1 to 65535.');
  process.exit(1);
}

app.listen(port, () => {
  console.log(`DevTrail API listening on port ${port}`);
});
