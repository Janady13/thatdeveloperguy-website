import { loadConfig } from './config.ts';
import { createSmtpProvider } from './email/provider.ts';
import { buildApp } from './app.ts';
import projection from '../build-inputs/authority/public-projection.json' with { type: 'json' };

const config = loadConfig();
const app = await buildApp({ config, provider: createSmtpProvider(config.smtp), contact: { path: '/contact', receivedPath: '/contact/received', telephone: projection.org.telephone, email: projection.org.email } });
const stop = async (signal: string) => { app.log.info({ signal }, 'stopping'); await app.close(); process.exit(0); };
process.on('SIGTERM', () => void stop('SIGTERM'));
process.on('SIGINT', () => void stop('SIGINT'));
await app.listen({ host: config.host, port: config.port });
app.log.info({ host: config.host, port: config.port, origin: config.publicOrigin }, 'tdg inquiry service listening');
