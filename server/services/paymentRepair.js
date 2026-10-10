import Payment from '../model/payment.js';
import mongoose from 'mongoose';
import { getOrder } from './paypalService.js';
import { verifiedCaptureStatus } from './paymentCapture.js';
import { recordCaptured } from './payments.js';
import { recoverFulfilment } from '../route/orderRoute.js';

// Only reads PayPal: never calls capture, so abandoned/unapproved checkouts cannot be charged by the job.
export async function repairPayment(payment, { apply = false } = {}) {
  const current = await getOrder(payment.paypalOrderId);
  const status = verifiedCaptureStatus(current, payment.amount);
  if (status !== 'COMPLETED' || !apply) return { status, repaired: false,
    abandoned: current.status === 'VOIDED' && !(current.purchase_units ?? []).some(unit => unit.payments?.captures?.length) };
  await recordCaptured(payment.paypalOrderId, current);
  const repaired = await recoverFulfilment(payment.paypalOrderId);
  return { status, repaired };
}

export async function repairPayments({ apply = false, limit = 100 } = {}) {
  const rows = await Payment.find({ 'linkedTo.id': null, resolvedAt: null,
    $or: [{ captureVerified: mongoose.trusted({ $ne: true }) }, { fulfilment: mongoose.trusted({ $exists: true }) }],
  }).select('+fulfilment').sort({ lastCheckedAt: 1, createdAt: 1 }).limit(Math.min(Math.max(limit, 1), 100));
  const report = [];
  for (const payment of rows) {
    try {
      const result = await repairPayment(payment, { apply });
      if (apply && result.abandoned && Date.now() - new Date(payment.createdAt).getTime() > 30 * 86400000) {
        await Payment.updateOne({ _id: payment._id }, { $unset: { fulfilment: '' } });
      }
      report.push({ paypalOrderId: payment.paypalOrderId, ...result });
    }
    catch { report.push({ paypalOrderId: payment.paypalOrderId, status: 'UNCONFIRMED', repaired: false }); }
    if (apply) await Payment.updateOne({ _id: payment._id }, { $set: { lastCheckedAt: new Date() } });
  }
  return report;
}
