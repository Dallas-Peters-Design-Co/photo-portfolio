/**
 * The branded frame every proposal email sits in.
 *
 * Table layout and inline styles, because that is what mail clients honour:
 * no stylesheet, no flex, no web fonts (Inter where installed, the system
 * sans elsewhere), and the logo as a PNG served from the site, since Gmail
 * strips SVG. It is the sheet from the proposal page: a white card under a
 * blue rule, the mark and wordmark at the top, a quiet footer with the
 * practice and the domain. Content goes in the middle as HTML the callers
 * build with the helpers below, so every email reads as one thing.
 */

export const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const EMAIL_INK = "#0f0f0f";
export const EMAIL_INK_SOFT = "#636363";
export const EMAIL_RULE = "#dedede";
export const EMAIL_TINT = "#f3f3f3";
export const EMAIL_BLUE = "#0e29f1";

const FONT =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Paragraph, heading, list item and label attributes for content HTML. */
export const P = `style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.65;color:${EMAIL_INK}"`;
export const H = `style="margin:28px 0 10px;font-family:${FONT};font-size:20px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;color:${EMAIL_INK}"`;
export const H3 = `style="margin:18px 0 6px;font-family:${FONT};font-size:15px;line-height:1.3;font-weight:600;color:${EMAIL_INK}"`;
export const LI = `style="margin:0 0 6px;font-family:${FONT};font-size:15px;line-height:1.55;color:${EMAIL_INK}"`;
export const LABEL = `style="margin:0 0 6px;font-family:${FONT};font-size:11px;line-height:1.4;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL_INK_SOFT}"`;
export const SOFT = `style="margin:0 0 14px;font-family:${FONT};font-size:13px;line-height:1.55;color:${EMAIL_INK_SOFT}"`;

export const button = (href: string, label: string): string =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px"><tr><td style="background:${EMAIL_INK};border-radius:4px"><a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#ffffff;text-decoration:none">${escapeHtml(label)}</a></td></tr></table>`;

export const rule = (): string =>
  `<div style="height:1px;background:${EMAIL_RULE};margin:22px 0"></div>`;

export interface EmailBrand {
  /** Where the site lives, no scheme: the footer link and the logo host. */
  domain: string;
  /** The site key, which is the folder the logo PNG sits in. */
  key: string;
  ownerName: string;
  tagline: string;
}

export const logoUrl = (brand: EmailBrand): string =>
  `https://${brand.domain}/sites/${brand.key}/logo-email.png`;

export interface EmailFrameInput {
  brand: EmailBrand;
  /** The HTML the mail is about, built from P/H/LI/button above. */
  content: string;
  /** The micro-caps line above the title: "Design proposal", "Accepted". */
  kicker: string;
  /** Text shown by clients in the inbox preview, before the body. */
  preheader?: string;
  title: string;
}

/** The whole HTML document: frame around content. */
export const emailFrame = ({
  brand,
  content,
  kicker,
  preheader,
  title,
}: EmailFrameInput): string => {
  const site = `https://${brand.domain}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_TINT};">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${EMAIL_TINT}">${escapeHtml(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_TINT};padding:32px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-top:8px solid ${EMAIL_BLUE};border-radius:6px;">
        <tr>
          <td style="padding:28px 40px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td valign="middle" style="font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${EMAIL_INK}">
                  <img src="${logoUrl(brand)}" width="22" height="23" alt="" style="display:inline-block;vertical-align:middle;margin-right:10px;border:0;">
                  <span style="vertical-align:middle">${escapeHtml(brand.ownerName)}</span>
                </td>
                <td valign="middle" align="right" style="font-family:${FONT};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL_INK_SOFT}">${escapeHtml(kicker)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:34px 40px 8px;">
            <h1 style="margin:0 0 22px;font-family:${FONT};font-size:26px;line-height:1.15;font-weight:800;letter-spacing:-0.03em;color:${EMAIL_INK}">${escapeHtml(title)}</h1>
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 40px 30px;">
            <div style="height:1px;background:${EMAIL_RULE};margin:0 0 18px"></div>
            <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${EMAIL_INK_SOFT}">
              ${escapeHtml(brand.ownerName)} · ${escapeHtml(brand.tagline)}<br>
              <a href="${site}" style="color:${EMAIL_INK_SOFT};text-decoration:none">${escapeHtml(brand.domain)}</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
};
