// Default is a read-only PayPal comparison. --apply repairs the ledger and fulfils saved drafts.
import { askHidden } from './create-admin.js';
import { isMain, openDatabase, readArgs, readDatabaseUrl } from './lib/cli.js';
import { repairPayments } from '../services/paymentRepair.js';

async function main() {
  const { values } = readArgs({ apply: { type: 'boolean', default: false }, help: { type: 'boolean', default: false } });
  if (values.help) { console.log('node scripts/repair-payments.js [--apply] (up to 100 rows; never captures/charges)'); return; }
  const { default: mongoose } = await import('mongoose');
  const url = await readDatabaseUrl({ askHidden });
  const database = await openDatabase({ url, mongoose, appName: 'nhc-payment-repair' });
  try { console.log(JSON.stringify(await repairPayments({ apply: values.apply }), null, 2)); }
  finally { await database.close(); }
}
if (isMain(import.meta.url)) main().catch(() => { console.error('Payment repair failed; check configuration without printing credentials.'); process.exitCode = 1; });
