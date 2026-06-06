import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VideoCard } from "@/components/VideoCard";

// next/image -> plain <img> so we can assert the poster src/alt without Next's
// optimizer. Strip the boolean `fill`/`priority` props to avoid React warnings.
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img src={src} alt={alt} />;
  },
}));

const props = {
  src: "https://videos.example.com/clip.mp4",
  poster: "https://images.unsplash.com/poster.jpg",
  alt: "Nocturne — teal night",
};

describe("VideoCard", () => {
  it("renders the poster image with its alt text", () => {
    render(<VideoCard {...props} />);
    expect(screen.getByRole("img", { name: "Nocturne — teal night" })).toHaveAttribute(
      "src",
      "https://images.unsplash.com/poster.jpg",
    );
  });

  it("does NOT eagerly mount a <video> / set its src before interaction", () => {
    const { container } = render(<VideoCard {...props} />);
    // Lazy-load contract: no <video> (and therefore no src) until the card is
    // hovered or scrolled into view.
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("source")).toBeNull();
    // The clip URL must not appear anywhere in the initial markup.
    expect(container.innerHTML).not.toContain(props.src);
  });
});
