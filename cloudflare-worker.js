export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const url = new URL(request.url);
    const musicUrl = url.searchParams.get("url");

    if (!musicUrl) {
      return new Response(JSON.stringify({ error: "Missing url parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const isSpotify = /open\.spotify\.com/i.test(musicUrl);
    const isApple = /music\.apple\.com/i.test(musicUrl);

    try {
      if (isSpotify) {
        // Spotify → Apple Music
        // Step 1: Get track metadata via Odesli
        const odesliRes = await fetch(
          `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(musicUrl)}&userCountry=DE`
        );
        const odesliData = await odesliRes.json();

        // Try direct Apple Music link from Odesli first
        const directApple = odesliData.linksByPlatform?.appleMusic?.url || odesliData.linksByPlatform?.itunes?.url;
        if (directApple) {
          return new Response(JSON.stringify({ url: directApple }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          });
        }

        // Step 2: Extract title + artist from entities and search iTunes
        const entities = Object.values(odesliData.entitiesByUniqueId || {});
        const track = entities[0];
        if (!track?.title || !track?.artistName) throw new Error("Could not extract track metadata");

        const searchTerm = encodeURIComponent(`${track.title} ${track.artistName}`);
        const itunesRes = await fetch(
          `https://itunes.apple.com/search?term=${searchTerm}&entity=song&limit=1&country=DE`
        );
        const itunesData = await itunesRes.json();
        const itunesTrack = itunesData.results?.[0];

        if (!itunesTrack?.trackViewUrl) throw new Error("Not found on Apple Music");

        return new Response(JSON.stringify({ url: itunesTrack.trackViewUrl }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });

      } else if (isApple) {
        // Apple Music → Spotify
        // Step 1: Try Odesli directly
        const odesliRes = await fetch(
          `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(musicUrl)}&userCountry=DE`
        );
        const odesliData = await odesliRes.json();

        const spotifyUrl = odesliData.linksByPlatform?.spotify?.url;
        if (spotifyUrl) {
          return new Response(JSON.stringify({ url: spotifyUrl }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          });
        }

        // Step 2: Extract metadata and search Spotify via iTunes first for metadata
        const entities = Object.values(odesliData.entitiesByUniqueId || {});
        const track = entities[0];
        if (!track?.title || !track?.artistName) throw new Error("Could not extract track metadata");

        // Use Spotify search API (no auth needed for basic search via odesli workaround)
        // Search iTunes to confirm track, then try odesli with iTunes URL
        const searchTerm = encodeURIComponent(`${track.title} ${track.artistName}`);
        const itunesRes = await fetch(
          `https://itunes.apple.com/search?term=${searchTerm}&entity=song&limit=1&country=DE`
        );
        const itunesData = await itunesRes.json();
        const itunesTrack = itunesData.results?.[0];

        if (itunesTrack?.trackViewUrl) {
          // Try Odesli again with the iTunes URL
          const odesliRes2 = await fetch(
            `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(itunesTrack.trackViewUrl)}&userCountry=DE`
          );
          const odesliData2 = await odesliRes2.json();
          const spotifyUrl2 = odesliData2.linksByPlatform?.spotify?.url;
          if (spotifyUrl2) {
            return new Response(JSON.stringify({ url: spotifyUrl2 }), {
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
          }
        }

        throw new Error("Not found on Spotify");
      } else {
        throw new Error("Unsupported URL");
      }

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  },
};
