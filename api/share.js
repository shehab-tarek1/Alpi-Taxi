module.exports = async (req, res) => {
    const { type, id } = req.query;

    // إعلام الكاش أن الاستجابة تختلف حسب نوع الزائر (بوت تواصل اجتماعي أو مستخدم عادي)
    res.setHeader('Vary', 'User-Agent');

    if (!id || !type) {
        res.writeHead(302, { 'Location': '/', 'Cache-Control': 'no-store' });
        return res.end();
    }

    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const isBot = /bot|facebook|whatsapp|telegram|viber|skype|twitter|discord|linkedin|slack|pinterest|applebot/i.test(userAgent);

    // توجيه الزوار الحقيقيين فوراً للموقع الرئيسي مع فتح العنصر
    if (!isBot) {
        res.writeHead(302, { 'Location': `/?${type}=${encodeURIComponent(id)}`, 'Cache-Control': 'no-store' });
        return res.end();
    }

    // بيانات مشروع فايربيز Alpi Taxi
    const projectId = 'alpi-taxi';
    const collectionName = (type === 'vehicle' || type === 'car') ? 'vehicles' : 'destinations';
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${id}`;

    try {
        const response = await fetch(firestoreUrl);
        const data = await response.json();

        if (!data || !data.fields) {
            throw new Error('Element nicht gefunden');
        }

        const fields = data.fields || {};
        let title = 'Alpi Taxi Innsbruck';
        let desc = '';
        let imageUrl = '';

        if (collectionName === 'destinations') {
            // 📍 بيانات الرحلة
            const destTitle = fields.title_de?.stringValue || fields.title?.stringValue || '';
            const from = fields.from?.stringValue || 'Innsbruck';
            const to = fields.to?.stringValue || '';
            const price = fields.price?.integerValue || fields.price?.doubleValue || '';
            const destDesc = fields.desc_de?.stringValue || fields.desc?.stringValue || 'Premium Transfer & Taxi Service in Innsbruck und den Alpen.';

            title = `🚖 ${from} ➔ ${to} | €${price} | Alpi Taxi`;
            desc = `${destTitle ? destTitle + ' • ' : ''}${destDesc.replace(/[\r\n]+/g, ' ').trim()} • 📞 WhatsApp: +43 676 3356300`;
            imageUrl = fields.imageUrl?.stringValue || 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80';
        } else {
            // 🚗 بيانات السيارة
            const carName = fields.name?.stringValue || 'Mercedes';
            const pax = fields.pax?.integerValue || fields.pax?.doubleValue || 8;
            const carDesc = fields.desc_de?.stringValue || fields.desc?.stringValue || 'Geräumig, sicher und komfortabel für Gruppen und VIP Transfers.';

            title = `🚗 ${carName} (Max. ${pax} Personen) | Alpi Taxi`;
            desc = `${carDesc.replace(/[\r\n]+/g, ' ').trim()} • Jetzt mieten via WhatsApp: +43 676 3356300`;
            imageUrl = fields.imageUrl?.stringValue || 'https://res.cloudinary.com/dsxrjmcxs/image/upload/c_limit,w_1200,q_auto,f_auto/v1786716414/bl2wzjvwiuocspelj562.png';
        }

        // تحسين مقاسات صور Cloudinary لمقاس مشاركة الواتساب والفيسبوك (1200x630)
        if (imageUrl.includes('res.cloudinary.com') && imageUrl.includes('/upload/')) {
            let parts = imageUrl.split('/upload/');
            let rawEnd = parts[1];
            let versionMatch = rawEnd.match(/(v\d+\/.*)/);
            rawEnd = versionMatch ? versionMatch[1] : rawEnd.split('/').pop();
            imageUrl = `${parts[0]}/upload/c_fill,w_1200,h_630,g_auto,q_auto,f_auto/${rawEnd}`;
        }

        const siteUrl = `https://${req.headers.host}/api/share?type=${type}&id=${encodeURIComponent(id)}`;

        // حماية النصوص لمنع كسر أكواد HTML
        const escapeHTML = (str) => String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        const safeTitle = escapeHTML(title);
        const safeDesc = escapeHTML(desc);

        const botHtml = `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>${safeTitle}</title>
    
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:secure_url" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="Alpi Taxi Innsbruck" />
    <meta property="og:url" content="${siteUrl}" />
    
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${imageUrl}" />
</head>
<body>
    <script>
        window.location.href = "/?${type}=${encodeURIComponent(id)}";
    </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600'); 
        return res.status(200).send(botHtml);

    } catch (error) {
        console.error('Share preview error:', error);
        res.writeHead(302, { 'Location': '/', 'Cache-Control': 'no-store' });
        return res.end();
    }
};