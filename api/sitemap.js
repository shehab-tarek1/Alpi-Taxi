// Sitemap ديناميكي: بيقرا كل الرحلات والسيارات من Firestore ويبني رابط مستقل لكل واحدة فيهم
module.exports = async (req, res) => {
    const projectId = 'alpi-taxi';
    const baseUrl = `https://${req.headers.host}`;

    async function fetchIds(collectionName) {
        try {
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}?pageSize=300`;
            const response = await fetch(url);
            const data = await response.json();
            if (!data.documents) return [];
            return data.documents.map(doc => doc.name.split('/').pop());
        } catch (err) {
            console.error(`Sitemap: failed to fetch ${collectionName}`, err);
            return [];
        }
    }

    const [destIds, vehicleIds] = await Promise.all([
        fetchIds('destinations'),
        fetchIds('vehicles')
    ]);

    const urls = [
        { loc: `${baseUrl}/`, changefreq: 'weekly', priority: '1.0' },
        ...destIds.map(id => ({ loc: `${baseUrl}/?dest=${encodeURIComponent(id)}`, changefreq: 'weekly', priority: '0.8' })),
        ...vehicleIds.map(id => ({ loc: `${baseUrl}/?vehicle=${encodeURIComponent(id)}`, changefreq: 'weekly', priority: '0.7' }))
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(xml);
};
