import { describe, expect, it } from "vitest";
import { sanitizeReviewDoc } from "../../config/review.js";
import { reviewLinkEmail } from "./reviewEmail.js";
import type { ReviewDto } from "./reviews.js";

const review = (screens: unknown[]) =>
  ({
    clientName: "Sam Client",
    doc: sanitizeReviewDoc({ screens }),
    slug: "back-acres",
    title: "Back Acres Rentals",
  }) as unknown as ReviewDto;

const send = (r: ReviewDto, password?: string) =>
  reviewLinkEmail({
    brand: {
      domain: "dallaspeters.com",
      key: "dallas-images",
      ownerName: "Dallas Peters",
      tagline: "Product Designer",
    },
    note: "",
    ownerName: "Dallas",
    password,
    review: r,
    url: "https://www.dallaspeters.com/review/back-acres",
  });

describe("reviewLinkEmail", () => {
  it("shows the first captured screenshot, linked to the review", () => {
    const { html } = send(
      review([
        { id: "a", image: null, title: "Empty" },
        {
          id: "b",
          image: { height: 900, url: "https://x.test/home.png", width: 1440 },
          title: "Home",
        },
      ])
    );
    expect(html).toContain('src="https://x.test/home.png"');
    expect(html).toContain(
      'href="https://www.dallaspeters.com/review/back-acres"'
    );
    expect(html).toContain('alt="Home"');
  });

  it("leaves the picture out when nothing has been captured", () => {
    const { html } = send(review([{ id: "a", image: null, title: "Empty" }]));
    expect(html).not.toContain("max-width:560px");
  });

  it("includes the review password in both email formats", () => {
    const mail = send(review([]), "open <sesame>");
    expect(mail.html).toContain("Review password:");
    expect(mail.html).toContain("open &lt;sesame&gt;");
    expect(mail.text).toContain("Review password: open <sesame>");
  });
});
