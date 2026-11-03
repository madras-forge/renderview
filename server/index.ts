import { createApp } from './app.js';
const port = Number(process.env.PORT ?? 8080);
const server = createApp().listen(port, '0.0.0.0', (error) => {
  if (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  console.log(`renderview API ready on port ${port}`);
});
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10000).unref();
});
