import express from 'express';
import { webhookHandler } from '../webhook-handler.js';

const router = express.Router();

router.post('/github', async (req, res) => {
  const event = req.headers['x-github-event'];
  const signature = req.headers['x-hub-signature-256'];
  const payload = req.body;
  const payloadString = JSON.stringify(payload);

  if (!webhookHandler.verifySignature(payloadString, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  await webhookHandler.handleEvent(event, payload);
  return res.status(202).json({ status: 'accepted' });
});

export default router;
