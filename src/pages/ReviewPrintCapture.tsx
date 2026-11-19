import type { ReviewImage } from "../../config/review.js";

/** Print tall screens in consecutive strips so the capture stays legible on Letter paper. */
export function ReviewPrintCapture({
  image,
  mobile,
  title,
}: {
  image: ReviewImage;
  mobile: boolean;
  title: string;
}) {
  const maxRatio = mobile ? 2.3 : 1.06;
  const count = Math.min(
    128,
    Math.ceil(image.height / (image.width * maxRatio))
  );
  const height = image.height / count;
  return (
    <div
      className="review-page__print-capture"
      data-mobile={mobile || undefined}
    >
      {Array.from({ length: count }, (_, index) => {
        const top = index * height;
        return (
          <div
            className="review-page__print-strip"
            key={top}
            style={{ aspectRatio: `${image.width} / ${height}` }}
          >
            <img
              alt={
                count > 1 ? `${title}, part ${index + 1} of ${count}` : title
              }
              height={image.height}
              src={image.url}
              style={{ top: `${-100 * index}%` }}
              width={image.width}
            />
          </div>
        );
      })}
    </div>
  );
}
