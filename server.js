const path = require('path');
const express = require('express');
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

const app = express();

app.use(express.json({ limit: '15mb' }));

// Serve the form UI
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => res.send('ok'));

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

app.post('/sendform', async (req, res) => {
  const { htmlContent, toEmail, subject, customerName, licenseNum } = req.body || {};

  if (!htmlContent || !toEmail) {
    return res.status(400).json({ error: 'Missing htmlContent or toEmail' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      printBackground: true
    });

    await browser.close();
    browser = null;

    const safeName = (customerName || 'לקוח').toString().trim();
    const safeLic = (licenseNum || '').toString().trim();
    const filename = `טופס_קבלת_רכב_${safeName}_${safeLic}.pdf`.replace(/\s+/g, '_');

    await transporter.sendMail({
      from: `"סילגי 2000 טפסים" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: subject || `טופס קבלת רכב ${safeName}`,
      text: `טופס קבלת רכב עבור ${safeName} מצורף כקובץ PDF.`,
      attachments: [
        { filename, content: pdfBuffer, contentType: 'application/pdf' }
      ]
    });

    return res.json({ success: true });
  } catch (err) {
    try {
      if (browser) await browser.close();
    } catch (_) {}

    console.error('sendform error', err);
    return res.status(500).json({ error: err && err.message ? err.message : 'unknown error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server listening on', PORT));
