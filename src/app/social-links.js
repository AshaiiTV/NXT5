export const DISCORD_INVITE_URL = "https://discord.gg/esPcQAeNWu";

const DEFAULT_SOCIAL_URLS = {
  discord: DISCORD_INVITE_URL,
  instagram: "https://www.instagram.com/nxt5org/",
  youtube: "https://www.youtube.com/channel/UC_C-OnOepIO05qfqlcUrMRA",
};

const NETWORKS = [
  { id: "discord", label: "Discord", hosts: ["discord.gg", "discord.com"], description: "Retrouve la communauté, partage tes retours et échange avec le staff." },
  { id: "instagram", label: "Instagram", hosts: ["instagram.com", "www.instagram.com"], description: "Conseils et actualités NXT5 en images et en vidéos courtes." },
  { id: "youtube", label: "YouTube", hosts: ["youtube.com", "www.youtube.com"], description: "Retrouve les vidéos et les nouveautés NXT5 sur la chaîne officielle." },
  { id: "twitch", label: "Twitch", hosts: ["twitch.tv", "www.twitch.tv"], description: "Retrouve NXT5 en direct." },
  { id: "tiktok", label: "TikTok", hosts: ["tiktok.com", "www.tiktok.com"], description: "Les moments NXT5 en format court." },
  { id: "x", label: "X", hosts: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"], description: "Les nouvelles de NXT5 au fil des mises à jour." },
];

export function getSocialLinks(env = import.meta.env || {}) {
  return NETWORKS.flatMap(({ hosts, ...network }) => {
    const value = env[`VITE_SOCIAL_${network.id.toUpperCase()}_URL`] || DEFAULT_SOCIAL_URLS[network.id];
    if (!value) return [];
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password || url.port || !hosts.includes(url.hostname) || url.pathname === "/") return [];
      return [{ ...network, href: url.href }];
    } catch {
      return [];
    }
  });
}
