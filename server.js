app.get('/api/resolve', (req, res) => {
  const ip = req.ip;
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Wait a minute and try again.' });
  }

  const rawUrl = (req.query.url || '').toString().trim();
  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
    return res.status(400).json({ error: 'Send a valid link as ?url=' });
  }

  const platform = detectPlatform(rawUrl);
  console.log(`[resolve] incoming: ${platform} — ${rawUrl}`);

  if (platform === 'unknown') {
    return res.status(400).json({ error: 'That link isn\'t from TikTok, Instagram, Facebook, or YouTube.' });
  }

  const args = ['-j', '--no-playlist', '--no-warnings', rawUrl];

  execFile('yt-dlp', args, { timeout: 25000, maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
    if (err) {
      console.error('[resolve] yt-dlp failed:', err.message);
      if (stderr) console.error('[resolve] stderr:', stderr.slice(0, 500));
      const message = /Private|login required/i.test(err.message)
        ? 'That post is private or needs a login — can\'t fetch it.'
        : 'Couldn\'t read that link. It may be region-locked, deleted, or the platform changed something.';
      return res.status(502).json({ error: message });
    }
    console.log('[resolve] yt-dlp succeeded');

    let info;
    try {
      info = JSON.parse(stdout);
    } catch (e) {
      return res.status(502).json({ error: 'Got a response but couldn\'t parse it. Try again.' });
    }

    const formats = Array.isArray(info.formats) ? info.formats : [];
    const progressive = formats
      .filter(f => f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none' && f.url)
      .sort((a, b) => (b.height || 0) - (a.height || 0));

    const best = progressive[0] || (info.url ? info : null);
    if (!best || !best.url) {
      return res.status(502).json({ error: 'Found the post but no downloadable video on it.' });
    }

    const audioOnly = formats
      .filter(f => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none') && f.url)
      .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

    res.json({
      platform,
      author: info.uploader || info.channel || info.creator || '',
      title: info.title || info.description || '',
      thumbnail: info.thumbnail || '',
      videoUrl: best.url,
      audioUrl: audioOnly ? audioOnly.url : null,
      durationSeconds: info.duration || null,
    });
  });
});
