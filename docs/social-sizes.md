# Social sizes and safe zones

The sizes in `config/socialSizes.ts`, where each number came from, checked
November 2026. Platforms change these without notice; re-check before a big
launch, and test safe zones on a real phone.

## Sizes

| Platform | Sizes | Source |
|---|---|---|
| Instagram | Post 1080×1080, 1080×1350, 1080×1440 (3:4, the profile grid), 1080×566; Story/Reel 1080×1920; profile 320×320 | Buffer, SocialPilot, Inro (grid change to 3:4) |
| Facebook | Link 1200×630; posts 1080×1080, 1080×1350; Story/Reel 1080×1920; Page cover 851×315; group cover 1640×856; event cover 1920×1005; profile 320×320 | Buffer, SocialPilot |
| LinkedIn | Post 1200×627, 1080×1080, 1080×1350; personal banner 1584×396; company/showcase cover 1512×256 (LinkedIn Help, Aug 2026; replaces 1128×191); event cover 1280×720; article/newsletter cover 1920×1080; profile 400×400 | ManyPixels, InnerNote (citing LinkedIn Help) |
| X | Post 1200×675, 1080×1080; link card 1200×628; header 1500×500; profile 400×400 | Buffer, Lilach Bullock |
| Threads | Post 1080×1350; link 1200×600 | Buffer, SocialPilot |
| Bluesky | Banner 1500×500 (4:1 on phones); link 1200×627 | Buffer, SocialPilot |
| TikTok | Video/photo 1080×1920; profile 400×400 | SocialPilot |
| YouTube | Thumbnail 1280×720; channel banner 2560×1440; Short 1080×1920; profile 800×800 | Buffer, Pixotter (DEV) |
| Pinterest | Pin 1000×1500, 1000×1000; profile cover 800×450 | Buffer, SocialPilot |
| Snapchat | Story/ad 1080×1920 | SocialPilot |
| Google Business | Cover 2048×1152; post 1200×900; logo 720×720 (Google publishes only minimums) | SocialPilot, PostEverywhere |
| ChatGPT | Business profile cover 1200×400 (the Business Hub's recommendation); ad image square (256×256 minimum) | PostHog marketing issue #460, Tru Commerce |

## Safe zones

| Size | Zone | Source |
|---|---|---|
| Instagram / Facebook Story and Reel | 269 top, 672 bottom, 65 each side | Meta, via Solid Labs |
| Instagram square / portrait | Profile grid crops to 3:4: 135 / 34 off each side | Derived from the 3:4 grid |
| Reel cover | Grid shows the middle 1080×1440 | Inro |
| TikTok | 240 top, 660 bottom, 120 each side | TikTok in-feed template, via Solid Labs |
| YouTube Short | 192 top, 480 bottom, 108 right | Google, via Solid Labs |
| YouTube banner | Middle 1546×423 shows everywhere | Pixotter (DEV) |
| Facebook Page cover | Phones keep the middle 560 of 851 | Derived from the 640×360 phone view |
| LinkedIn banner | Profile photo x 56–360 from y 212; text in x 420–1424, y 40–356 | ManyPixels (measured on desktop) |
| LinkedIn company cover | Logo x 45–286 from y 134; text in x 340–1362, y 28–200 | ManyPixels (measured on desktop) |
| X header | Middle 1200×400 on phones | Lilach Bullock |
| Bluesky banner | Middle 4:1 band on phones | Buffer |

Not drawn, because nobody publishes them: where X's and ChatGPT's profile
photo or logo sits over the header, and Snapchat's current overlay.

## Links

- https://buffer.com/resources/social-media-image-sizes/
- https://www.socialpilot.co/blog/social-media-image-sizes
- https://www.inro.social/blog/instagram-post-size
- https://www.solidlabs.com/social-safe-zones
- https://www.manypixels.co/blog/social-media-design/linkedin-banner-size
- https://www.innernote.space/blog/linkedin-company-page-banner-size
- https://dev.to/pixotter/youtube-banner-size-exact-dimensions-and-safe-zone-guide-for-2026-5epb
- https://www.lilachbullock.com/x-twitter-header-size-guide/
- https://posteverywhere.ai/blog/google-business-profile-image-sizes
- https://github.com/PostHog/marketing/issues/460
- https://trucommerce.ai/insights/chatgpt-ads-image-size-specs
