const express    = require('express');
const puppeteer  = require('puppeteer');
const nodemailer = require('nodemailer');
const cors       = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Email transporter ──
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// ── Health check ──
app.get('/', (req, res) => res.send('Silagi server running ✅'));

// ── Send form as PDF ──
app.post('/send-form', async (req, res) => {
  const { htmlContent, toEmail, subject, customerName, licenseNum } = req.body;

  if (!htmlContent || !toEmail) {
    return res.status(400).json({ error: 'Missing htmlContent or toEmail' });
  }

  let browser;
  try {
    // Generate PDF with Puppeteer
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      printBackground: true,
    });
    await browser.close();

    const filename = `טופס_קבלת_רכב_${customerName||'לקוח'}_${licenseNum||''}.pdf`
      .replace(/\s+/g, '_');

    // Send email with PDF attached
    await transporter.sendMail({
      from:    `"סילגי 2000 – טפסים" <${process.env.GMAIL_USER}>`,
      to:      toEmail,
      subject: subject || `טופס קבלת רכב – ${customerName}`,
      text:    `טופס קבלת רכב עבור ${customerName || 'לקוח'} מצורף כקובץ PDF.`,
      attachments: [{
        filename,
        content:     pdfBuffer,
        contentType: 'application/pdf',
      }],
    });

    res.json({ success: true });

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
