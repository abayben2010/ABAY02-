const formats = Array.isArray(info.formats) ? info.formats : [];

    // Best case: a format with both video and audio combined.
    const progressive = formats
      .filter(f => f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none' && f.url)
      .sort((a, b) => (b.height || 0) - (a.height || 0));

    // Fallback: video-only stream (common on Instagram/Facebook) — still playable,
    // just may lack separate high-quality audio track.
    const videoOnly = formats
      .filter(f => f.vcodec && f.vcodec !== 'none' && f.url)
      .sort((a, b) => (b.height || 0) - (a.height || 0));

    const best = progressive[0] || videoOnly[0] || (info.url ? info : null);
    if (!best || !best.url) {
      return res.status(502).json({ error: 'Found the post but no downloadable video on it.' });
                       }
